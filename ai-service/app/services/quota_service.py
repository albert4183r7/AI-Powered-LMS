"""
Quota Management Service.
Tracks and enforces AI generation quotas per instructor.
PRD Section 20: Quota management (open decision to be implemented).
"""
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


class QuotaExceededError(Exception):
    """Raised when instructor exceeds their generation quota."""
    
    def __init__(self, current_usage: int, quota_limit: int, reset_date: datetime):
        self.current_usage = current_usage
        self.quota_limit = quota_limit
        self.reset_date = reset_date
        message = (
            f"Quota exceeded: {current_usage}/{quota_limit} generations used. "
            f"Resets on {reset_date.isoformat()}"
        )
        super().__init__(message)


class QuotaManagementService:
    """
    Manages AI generation quotas for instructors.
    
    Features:
    - Track generation count per instructor
    - Configurable quota limits (default: 100 generations per 30 days)
    - Automatic quota reset on schedule
    - Per-generation-type tracking (module, lesson, revision)
    - Grace period handling for enterprise tenants
    
    Quota Types:
    - Module generation: counts as 1 unit
    - Add lesson: counts as 0.5 units
    - Regenerate lesson: counts as 0.3 units
    - Web research enabled: +0.2 units surcharge
    """
    
    def __init__(
        self,
        default_quota_per_instructor: int = 100,
        quota_reset_days: int = 30,
        grace_period_hours: int = 24,
    ):
        self.default_quota = default_quota_per_instructor
        self.reset_days = quota_reset_days
        self.grace_period_hours = grace_period_hours
        
    async def get_instructor_quota(
        self, 
        user_id: int, 
        db_connection
    ) -> Dict[str, Any]:
        """
        Get current quota status for an instructor.
        
        Returns:
            Dictionary with:
            - current_usage: number of generations used
            - quota_limit: maximum allowed
            - remaining: generations left
            - reset_date: when quota resets
            - is_expired: whether quota period has ended
        """
        cursor = db_connection.cursor()
        
        # Get or create quota record
        cursor.execute("""
            SELECT id, usage_count, period_start, quota_limit, is_unlimited
            FROM instructor_quotas
            WHERE user_id = ?
            ORDER BY period_start DESC
            LIMIT 1
        """, (user_id,))
        
        row = cursor.fetchone()
        
        if not row:
            # Create initial quota record
            period_start = datetime.utcnow()
            reset_date = period_start + timedelta(days=self.reset_days)
            
            cursor.execute("""
                INSERT INTO instructor_quotas 
                (user_id, usage_count, period_start, quota_limit, is_unlimited)
                VALUES (?, 0, ?, ?, 0)
            """, (user_id, period_start.isoformat(), self.default_quota))
            
            db_connection.commit()
            
            return {
                "current_usage": 0,
                "quota_limit": self.default_quota,
                "remaining": self.default_quota,
                "reset_date": reset_date,
                "is_expired": False,
                "is_unlimited": False
            }
        
        quota_id, usage_count, period_start, quota_limit, is_unlimited = row
        period_start_dt = datetime.fromisoformat(period_start)
        reset_date = period_start_dt + timedelta(days=self.reset_days)
        now = datetime.utcnow()
        
        # Check if quota period has expired
        if now > reset_date:
            # Reset quota
            new_period_start = now
            new_reset_date = new_period_start + timedelta(days=self.reset_days)
            
            cursor.execute("""
                UPDATE instructor_quotas
                SET usage_count = 0, period_start = ?
                WHERE id = ?
            """, (new_period_start.isoformat(), quota_id))
            
            db_connection.commit()
            
            return {
                "current_usage": 0,
                "quota_limit": quota_limit if not is_unlimited else float('inf'),
                "remaining": quota_limit if not is_unlimited else float('inf'),
                "reset_date": new_reset_date,
                "is_expired": False,
                "is_unlimited": bool(is_unlimited)
            }
        
        remaining = max(0, (quota_limit - usage_count) if not is_unlimited else float('inf'))
        
        return {
            "current_usage": usage_count,
            "quota_limit": quota_limit if not is_unlimited else float('inf'),
            "remaining": remaining,
            "reset_date": reset_date,
            "is_expired": now > reset_date,
            "is_unlimited": bool(is_unlimited)
        }
    
    async def check_and_consume_quota(
        self,
        user_id: int,
        generation_type: str,
        has_web_research: bool = False,
        db_connection=None
    ) -> Dict[str, Any]:
        """
        Check if user has quota and consume it atomically.
        
        Args:
            user_id: Instructor user ID
            generation_type: 'module', 'lesson', or 'revision'
            has_web_research: Whether web search is enabled (adds surcharge)
            db_connection: Database connection
            
        Returns:
            Quota status dictionary
            
        Raises:
            QuotaExceededError if quota limit reached
        """
        quota_info = await self.get_instructor_quota(user_id, db_connection)
        
        if quota_info["is_unlimited"]:
            # Unlimited quota, just track usage
            return quota_info
        
        # Calculate cost based on generation type
        base_cost = {
            "module": 1.0,
            "lesson": 0.5,
            "revision": 0.3,
        }.get(generation_type, 1.0)
        
        # Add web research surcharge
        if has_web_research:
            base_cost += 0.2
        
        # Round up to nearest integer for storage
        cost_units = int(base_cost * 10)  # Store as deciseconds for precision
        
        if quota_info["remaining"] < base_cost:
            raise QuotaExceededError(
                current_usage=quota_info["current_usage"],
                quota_limit=quota_info["quota_limit"],
                reset_date=quota_info["reset_date"]
            )
        
        # Consume quota
        cursor = db_connection.cursor()
        cursor.execute("""
            UPDATE instructor_quotas
            SET usage_count = usage_count + ?
            WHERE user_id = ?
            AND period_start = (
                SELECT MAX(period_start) 
                FROM instructor_quotas 
                WHERE user_id = ?
            )
        """, (cost_units, user_id, user_id))
        
        db_connection.commit()
        
        logger.info(
            "Quota consumed: user=%d type=%s cost=%.1f remaining=%.1f",
            user_id,
            generation_type,
            base_cost,
            quota_info["remaining"] - base_cost
        )
        
        # Return updated quota info
        quota_info["current_usage"] += base_cost
        quota_info["remaining"] -= base_cost
        return quota_info
    
    async def set_custom_quota(
        self,
        user_id: int,
        quota_limit: int,
        is_unlimited: bool = False,
        db_connection=None
    ) -> bool:
        """
        Set custom quota for specific instructor (e.g., enterprise plan).
        
        Args:
            user_id: Instructor user ID
            quota_limit: Custom quota limit
            is_unlimited: If True, quota_limit is ignored
            db_connection: Database connection
            
        Returns:
            True if successful
        """
        cursor = db_connection.cursor()
        
        # Update current period or create new one
        cursor.execute("""
            SELECT id FROM instructor_quotas
            WHERE user_id = ?
            ORDER BY period_start DESC
            LIMIT 1
        """, (user_id,))
        
        row = cursor.fetchone()
        
        if row:
            cursor.execute("""
                UPDATE instructor_quotas
                SET quota_limit = ?, is_unlimited = ?
                WHERE id = ?
            """, (quota_limit, 1 if is_unlimited else 0, row[0]))
        else:
            period_start = datetime.utcnow()
            cursor.execute("""
                INSERT INTO instructor_quotas
                (user_id, usage_count, period_start, quota_limit, is_unlimited)
                VALUES (?, 0, ?, ?, ?)
            """, (user_id, period_start.isoformat(), quota_limit, 1 if is_unlimited else 0))
        
        db_connection.commit()
        
        logger.info(
            "Custom quota set: user=%d limit=%d unlimited=%s",
            user_id,
            quota_limit,
            is_unlimited
        )
        
        return True
    
    async def get_usage_statistics(
        self,
        user_id: int,
        days: int = 30,
        db_connection=None
    ) -> Dict[str, Any]:
        """
        Get detailed usage statistics for an instructor.
        
        Returns:
            Dictionary with breakdown by generation type
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        cursor = db_connection.cursor()
        
        cursor.execute("""
            SELECT 
                generation_type,
                COUNT(*) as count,
                SUM(CASE WHEN web_research_enabled THEN 1 ELSE 0 END) as with_web_research
            FROM generation_jobs
            WHERE owner_user_id = ?
            AND created_at > ?
            GROUP BY generation_type
        """, (user_id, cutoff_date.isoformat()))
        
        stats = {"by_type": {}, "total": 0, "with_web_research": 0}
        
        for row in cursor.fetchall():
            gen_type, count, web_count = row
            stats["by_type"][gen_type] = count
            stats["total"] += count
            stats["with_web_research"] += web_count or 0
        
        return stats


# Singleton instance with default settings
quota_service = QuotaManagementService(
    default_quota_per_instructor=100,
    quota_reset_days=30,
    grace_period_hours=24,
)
