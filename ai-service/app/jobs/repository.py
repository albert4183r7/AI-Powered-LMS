"""SQLite persistence for module-generation jobs."""

import sqlite3
from dataclasses import dataclass
from datetime import timezone, datetime
from pathlib import Path
from uuid import uuid4

from app.schemas.jobs import GenerationJobStage, GenerationJobStatus

CLAIMED_PROGRESS_PERCENT = 20
COMPLETED_PROGRESS_PERCENT = 100
SQLITE_CONNECTION_TIMEOUT_SECONDS = 5
LEGACY_RUNNING_STATUS = "running"


@dataclass(frozen=True)
class StoredGenerationJob:
    """Internal database representation of one generation job."""

    id: str
    owner_user_id: str
    status: GenerationJobStatus
    stage: GenerationJobStage
    progress: int
    request_json: str
    result_json: str | None
    error: str | None
    created_at: datetime
    updated_at: datetime


class GenerationJobRepository:
    """Store and atomically claim jobs using one small SQLite database."""

    def __init__(self, database_path: Path) -> None:
        self._database_path = database_path

    def initialize_database(self) -> None:
        """Create the database table when the service starts for the first time."""

        self._database_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect_to_database() as database_connection:
            database_connection.execute(
                """
                CREATE TABLE IF NOT EXISTS generation_jobs (
                    id TEXT PRIMARY KEY,
                    owner_user_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    stage TEXT NOT NULL,
                    progress INTEGER NOT NULL,
                    request_json TEXT NOT NULL,
                    result_json TEXT,
                    error TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            existing_column_names = {
                database_column["name"]
                for database_column in database_connection.execute(
                    "PRAGMA table_info(generation_jobs)",
                ).fetchall()
            }
            if "owner_user_id" not in existing_column_names:
                database_connection.execute(
                    """
                    ALTER TABLE generation_jobs
                    ADD COLUMN owner_user_id TEXT NOT NULL DEFAULT ''
                    """
                )
            database_connection.execute(
                """
                CREATE INDEX IF NOT EXISTS generation_jobs_owner_id_index
                ON generation_jobs (owner_user_id, id)
                """
            )
            database_connection.execute(
                "UPDATE generation_jobs SET status = ? WHERE status = ?",
                (GenerationJobStatus.PROCESSING.value, LEGACY_RUNNING_STATUS),
            )

    def create_generation_job(
        self,
        generation_request_json: str,
        owner_user_id: str,
    ) -> StoredGenerationJob:
        """Persist a queued module-generation request."""

        generation_job_id = str(uuid4())
        current_timestamp = self._get_current_utc_timestamp()
        with self._connect_to_database() as database_connection:
            database_connection.execute(
                """
                INSERT INTO generation_jobs (
                    id, owner_user_id, status, stage, progress, request_json,
                    result_json, error, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)
                """,
                (
                    generation_job_id,
                    owner_user_id,
                    GenerationJobStatus.QUEUED.value,
                    GenerationJobStage.QUEUED.value,
                    0,
                    generation_request_json,
                    current_timestamp,
                    current_timestamp,
                ),
            )
        stored_generation_job = self.get_generation_job(generation_job_id)
        if stored_generation_job is None:
            raise RuntimeError("Failed to read the generation job after creation.")
        return stored_generation_job

    def get_generation_job_for_owner(
        self,
        generation_job_id: str,
        owner_user_id: str,
    ) -> StoredGenerationJob | None:
        """Return a job only when it belongs to the authenticated LMS user."""

        with self._connect_to_database() as database_connection:
            generation_job_row = database_connection.execute(
                """
                SELECT * FROM generation_jobs
                WHERE id = ? AND owner_user_id = ?
                """,
                (generation_job_id, owner_user_id),
            ).fetchone()
        return (
            self._map_database_row_to_generation_job(generation_job_row)
            if generation_job_row
            else None
        )

    def get_active_generation_jobs_for_owner(
        self,
        owner_user_id: str,
    ) -> list[StoredGenerationJob]:
        """Return all active (queued, processing, cancelling) jobs for the authenticated LMS user."""

        with self._connect_to_database() as database_connection:
            active_job_rows = database_connection.execute(
                """
                SELECT * FROM generation_jobs
                WHERE owner_user_id = ? AND status IN (?, ?, ?)
                ORDER BY created_at DESC
                """,
                (
                    owner_user_id,
                    GenerationJobStatus.QUEUED.value,
                    GenerationJobStatus.PROCESSING.value,
                    GenerationJobStatus.CANCELLING.value,
                ),
            ).fetchall()
        
        return [
            self._map_database_row_to_generation_job(row)
            for row in active_job_rows
        ]

    def get_generation_job(self, generation_job_id: str) -> StoredGenerationJob | None:
        """Return a job by ID for worker and repository-internal operations."""

        with self._connect_to_database() as database_connection:
            generation_job_row = database_connection.execute(
                "SELECT * FROM generation_jobs WHERE id = ?",
                (generation_job_id,),
            ).fetchone()
        return (
            self._map_database_row_to_generation_job(generation_job_row)
            if generation_job_row
            else None
        )

    def claim_next_queued_job(self) -> StoredGenerationJob | None:
        """Atomically move the oldest queued job into the processing state."""

        with self._connect_to_database() as database_connection:
            database_connection.execute("BEGIN IMMEDIATE")
            queued_generation_job_row = database_connection.execute(
                """
                SELECT * FROM generation_jobs
                WHERE status = ?
                ORDER BY created_at ASC
                LIMIT 1
                """,
                (GenerationJobStatus.QUEUED.value,),
            ).fetchone()
            if queued_generation_job_row is None:
                database_connection.commit()
                return None

            current_timestamp = self._get_current_utc_timestamp()
            generation_job_id = queued_generation_job_row["id"]
            database_connection.execute(
                """
                UPDATE generation_jobs
                SET status = ?, stage = ?, progress = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    GenerationJobStatus.PROCESSING.value,
                    GenerationJobStage.PLANNING.value,
                    CLAIMED_PROGRESS_PERCENT,
                    current_timestamp,
                    generation_job_id,
                ),
            )
            claimed_generation_job_row = database_connection.execute(
                "SELECT * FROM generation_jobs WHERE id = ?",
                (generation_job_id,),
            ).fetchone()
            database_connection.commit()
        if claimed_generation_job_row is None:
            raise RuntimeError("Failed to read the generation job after claiming it.")
        return self._map_database_row_to_generation_job(claimed_generation_job_row)

    def update_generation_job_progress(
        self,
        generation_job_id: str,
        stage: GenerationJobStage,
        progress: int,
    ) -> None:
        """Update the progress of a processing job without finishing it."""

        with self._connect_to_database() as database_connection:
            database_connection.execute(
                """
                UPDATE generation_jobs
                SET stage = ?, progress = ?, updated_at = ?
                WHERE id = ? AND status = ?
                """,
                (
                    stage.value,
                    progress,
                    self._get_current_utc_timestamp(),
                    generation_job_id,
                    GenerationJobStatus.PROCESSING.value,
                ),
            )
            database_connection.commit()

    def mark_generation_job_completed(
        self,
        generation_job_id: str,
        module_plan_json: str,
    ) -> None:
        """Complete active work unless its owner requested cancellation."""

        with self._connect_to_database() as database_connection:
            completion_result = database_connection.execute(
                """
                UPDATE generation_jobs
                SET status = ?, stage = ?, progress = ?, result_json = ?,
                    error = NULL, updated_at = ?
                WHERE id = ? AND status = ?
                """,
                (
                    GenerationJobStatus.COMPLETED.value,
                    GenerationJobStage.COMPLETED.value,
                    COMPLETED_PROGRESS_PERCENT,
                    module_plan_json,
                    self._get_current_utc_timestamp(),
                    generation_job_id,
                    GenerationJobStatus.PROCESSING.value,
                ),
            )
            if completion_result.rowcount == 0:
                database_connection.execute(
                    """
                    UPDATE generation_jobs
                    SET status = ?, stage = ?, result_json = NULL,
                        error = NULL, updated_at = ?
                    WHERE id = ? AND status = ?
                    """,
                    (
                        GenerationJobStatus.CANCELLED.value,
                        GenerationJobStage.CANCELLED.value,
                        self._get_current_utc_timestamp(),
                        generation_job_id,
                        GenerationJobStatus.CANCELLING.value,
                    ),
                )

    def mark_generation_job_failed(
        self,
        generation_job_id: str,
        user_safe_error_message: str,
    ) -> None:
        """Store a user-safe error without persisting prompts in application logs."""

        with self._connect_to_database() as database_connection:
            failure_result = database_connection.execute(
                """
                UPDATE generation_jobs
                SET status = ?, stage = ?, error = ?, updated_at = ?
                WHERE id = ? AND status = ?
                """,
                (
                    GenerationJobStatus.FAILED.value,
                    GenerationJobStage.FAILED.value,
                    user_safe_error_message,
                    self._get_current_utc_timestamp(),
                    generation_job_id,
                    GenerationJobStatus.PROCESSING.value,
                ),
            )
            if failure_result.rowcount == 0:
                database_connection.execute(
                    """
                    UPDATE generation_jobs
                    SET status = ?, stage = ?, error = NULL, updated_at = ?
                    WHERE id = ? AND status = ?
                    """,
                    (
                        GenerationJobStatus.CANCELLED.value,
                        GenerationJobStage.CANCELLED.value,
                        self._get_current_utc_timestamp(),
                        generation_job_id,
                        GenerationJobStatus.CANCELLING.value,
                    ),
                )

    def request_generation_job_cancellation(
        self,
        generation_job_id: str,
        owner_user_id: str,
    ) -> StoredGenerationJob | None:
        """Cancel queued work or flag processing work for safe cancellation."""

        with self._connect_to_database() as database_connection:
            database_connection.execute("BEGIN IMMEDIATE")
            generation_job_row = database_connection.execute(
                """
                SELECT * FROM generation_jobs
                WHERE id = ? AND owner_user_id = ?
                """,
                (generation_job_id, owner_user_id),
            ).fetchone()
            if generation_job_row is None:
                database_connection.commit()
                return None

            current_status = GenerationJobStatus(generation_job_row["status"])
            if current_status == GenerationJobStatus.QUEUED:
                next_status = GenerationJobStatus.CANCELLED
                next_stage = GenerationJobStage.CANCELLED
            elif current_status == GenerationJobStatus.PROCESSING:
                next_status = GenerationJobStatus.CANCELLING
                next_stage = GenerationJobStage.CANCELLING
            else:
                database_connection.commit()
                return self._map_database_row_to_generation_job(generation_job_row)

            database_connection.execute(
                """
                UPDATE generation_jobs
                SET status = ?, stage = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    next_status.value,
                    next_stage.value,
                    self._get_current_utc_timestamp(),
                    generation_job_id,
                ),
            )
            updated_generation_job_row = database_connection.execute(
                "SELECT * FROM generation_jobs WHERE id = ?",
                (generation_job_id,),
            ).fetchone()
            database_connection.commit()

        if updated_generation_job_row is None:
            raise RuntimeError("Failed to read the generation job after cancellation.")
        return self._map_database_row_to_generation_job(updated_generation_job_row)

    def requeue_interrupted_jobs(self) -> None:
        """Recover processing jobs and finish interrupted cancellations."""

        with self._connect_to_database() as database_connection:
            database_connection.execute(
                """
                UPDATE generation_jobs
                SET status = ?, stage = ?, progress = ?, updated_at = ?
                WHERE status = ?
                """,
                (
                    GenerationJobStatus.QUEUED.value,
                    GenerationJobStage.QUEUED.value,
                    0,
                    self._get_current_utc_timestamp(),
                    GenerationJobStatus.PROCESSING.value,
                ),
            )
            database_connection.execute(
                """
                UPDATE generation_jobs
                SET status = ?, stage = ?, updated_at = ?
                WHERE status = ?
                """,
                (
                    GenerationJobStatus.CANCELLED.value,
                    GenerationJobStage.CANCELLED.value,
                    self._get_current_utc_timestamp(),
                    GenerationJobStatus.CANCELLING.value,
                ),
            )

    def _connect_to_database(self) -> sqlite3.Connection:
        database_connection = sqlite3.connect(
            self._database_path,
            timeout=SQLITE_CONNECTION_TIMEOUT_SECONDS,
        )
        database_connection.row_factory = sqlite3.Row
        return database_connection

    @staticmethod
    def _get_current_utc_timestamp() -> str:
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _map_database_row_to_generation_job(
        generation_job_row: sqlite3.Row,
    ) -> StoredGenerationJob:
        return StoredGenerationJob(
            id=generation_job_row["id"],
            owner_user_id=generation_job_row["owner_user_id"],
            status=GenerationJobStatus(generation_job_row["status"]),
            stage=GenerationJobStage(generation_job_row["stage"]),
            progress=generation_job_row["progress"],
            request_json=generation_job_row["request_json"],
            result_json=generation_job_row["result_json"],
            error=generation_job_row["error"],
            created_at=datetime.fromisoformat(generation_job_row["created_at"]),
            updated_at=datetime.fromisoformat(generation_job_row["updated_at"]),
        )
