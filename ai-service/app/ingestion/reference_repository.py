"""SQLite persistence for reference files and extracted images."""

import sqlite3
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

SQLITE_CONNECTION_TIMEOUT_SECONDS = 5


@dataclass(frozen=True)
class StoredReferenceFile:
    """Internal database representation of one ingested reference."""

    file_id: str
    owner_user_id: str
    original_filename: str
    content_type: str
    size_bytes: int
    storage_path: str
    extracted_text_path: str | None
    extracted_text_length: int
    extracted_image_count: int
    created_at: datetime


@dataclass(frozen=True)
class StoredExtractedImage:
    """Internal database representation of one extracted image."""

    image_id: str
    file_id: str
    source_page: int
    width: int
    height: int
    format: str
    storage_path: str
    created_at: datetime


class ReferenceRepository:
    """Store and retrieve reference file metadata in the AI jobs database."""

    def __init__(self, database_path: Path) -> None:
        self._database_path = database_path

    def initialize_tables(self) -> None:
        """Create reference tables when the service starts for the first time."""

        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS reference_files (
                    file_id TEXT PRIMARY KEY,
                    owner_user_id TEXT NOT NULL,
                    original_filename TEXT NOT NULL,
                    content_type TEXT NOT NULL,
                    size_bytes INTEGER NOT NULL,
                    storage_path TEXT NOT NULL,
                    extracted_text_path TEXT,
                    extracted_text_length INTEGER NOT NULL DEFAULT 0,
                    extracted_image_count INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS reference_files_owner_index
                ON reference_files (owner_user_id, file_id)
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS extracted_images (
                    image_id TEXT PRIMARY KEY,
                    file_id TEXT NOT NULL,
                    source_page INTEGER NOT NULL,
                    width INTEGER NOT NULL,
                    height INTEGER NOT NULL,
                    format TEXT NOT NULL,
                    storage_path TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (file_id) REFERENCES reference_files (file_id)
                )
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS extracted_images_file_index
                ON extracted_images (file_id)
                """
            )

    def store_reference_file(
        self,
        *,
        file_id: str,
        owner_user_id: str,
        original_filename: str,
        content_type: str,
        size_bytes: int,
        storage_path: str,
        extracted_text_path: str | None,
        extracted_text_length: int,
        extracted_image_count: int,
    ) -> StoredReferenceFile:
        """Persist metadata for a validated and ingested reference file."""

        created_at = self._now()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO reference_files (
                    file_id, owner_user_id, original_filename, content_type,
                    size_bytes, storage_path, extracted_text_path,
                    extracted_text_length, extracted_image_count, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    file_id,
                    owner_user_id,
                    original_filename,
                    content_type,
                    size_bytes,
                    storage_path,
                    extracted_text_path,
                    extracted_text_length,
                    extracted_image_count,
                    created_at,
                ),
            )
        return StoredReferenceFile(
            file_id=file_id,
            owner_user_id=owner_user_id,
            original_filename=original_filename,
            content_type=content_type,
            size_bytes=size_bytes,
            storage_path=storage_path,
            extracted_text_path=extracted_text_path,
            extracted_text_length=extracted_text_length,
            extracted_image_count=extracted_image_count,
            created_at=datetime.fromisoformat(created_at),
        )

    def store_extracted_image(
        self,
        *,
        image_id: str,
        file_id: str,
        source_page: int,
        width: int,
        height: int,
        image_format: str,
        storage_path: str,
    ) -> None:
        """Persist metadata for one image extracted from a reference."""

        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO extracted_images (
                    image_id, file_id, source_page, width, height,
                    format, storage_path, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    image_id,
                    file_id,
                    source_page,
                    width,
                    height,
                    image_format,
                    storage_path,
                    self._now(),
                ),
            )

    def get_reference_file_for_owner(
        self,
        file_id: str,
        owner_user_id: str,
    ) -> StoredReferenceFile | None:
        """Return a reference file only when it belongs to the authenticated user."""

        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM reference_files WHERE file_id = ? AND owner_user_id = ?",
                (file_id, owner_user_id),
            ).fetchone()
        return self._map_reference_row(row) if row else None

    def get_reference_files_by_ids_for_owner(
        self,
        file_ids: list[str],
        owner_user_id: str,
    ) -> list[StoredReferenceFile]:
        """Return only the files that exist and belong to the given owner."""

        if not file_ids:
            return []
        placeholders = ",".join("?" for _ in file_ids)
        with self._connect() as connection:
            rows = connection.execute(
                f"""
                SELECT * FROM reference_files
                WHERE file_id IN ({placeholders}) AND owner_user_id = ?
                """,
                [*file_ids, owner_user_id],
            ).fetchall()
        return [self._map_reference_row(row) for row in rows]

    def get_extracted_images_for_file(
        self,
        file_id: str,
        owner_user_id: str,
    ) -> list[StoredExtractedImage]:
        """Return images only when the parent file belongs to the owner."""

        reference = self.get_reference_file_for_owner(file_id, owner_user_id)
        if reference is None:
            return []
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT * FROM extracted_images WHERE file_id = ?",
                (file_id,),
            ).fetchall()
        return [self._map_image_row(row) for row in rows]

    def delete_reference_file(
        self,
        file_id: str,
        owner_user_id: str,
    ) -> bool:
        """Delete a reference and its images, returning True if the file existed."""

        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            result = connection.execute(
                "DELETE FROM reference_files WHERE file_id = ? AND owner_user_id = ?",
                (file_id, owner_user_id),
            )
            if result.rowcount == 0:
                connection.commit()
                return False
            connection.execute(
                "DELETE FROM extracted_images WHERE file_id = ?",
                (file_id,),
            )
            connection.commit()
        return True

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(
            self._database_path,
            timeout=SQLITE_CONNECTION_TIMEOUT_SECONDS,
        )
        connection.row_factory = sqlite3.Row
        return connection

    @staticmethod
    def _now() -> str:
        return datetime.now(UTC).isoformat()

    @staticmethod
    def _map_reference_row(row: sqlite3.Row) -> StoredReferenceFile:
        return StoredReferenceFile(
            file_id=row["file_id"],
            owner_user_id=row["owner_user_id"],
            original_filename=row["original_filename"],
            content_type=row["content_type"],
            size_bytes=row["size_bytes"],
            storage_path=row["storage_path"],
            extracted_text_path=row["extracted_text_path"],
            extracted_text_length=row["extracted_text_length"],
            extracted_image_count=row["extracted_image_count"],
            created_at=datetime.fromisoformat(row["created_at"]),
        )

    @staticmethod
    def _map_image_row(row: sqlite3.Row) -> StoredExtractedImage:
        return StoredExtractedImage(
            image_id=row["image_id"],
            file_id=row["file_id"],
            source_page=row["source_page"],
            width=row["width"],
            height=row["height"],
            format=row["format"],
            storage_path=row["storage_path"],
            created_at=datetime.fromisoformat(row["created_at"]),
        )
