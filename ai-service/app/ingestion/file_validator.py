"""Server-side validation for uploaded reference files.

Checks extension, file size, and magic bytes independently of the
browser-side validation so that direct API calls cannot bypass safety
rules.
"""

from dataclasses import dataclass
from enum import StrEnum

SUPPORTED_CONTENT_TYPES: dict[str, str] = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".txt": "text/plain",
}

# Minimum byte sequences that identify a file format before parsing.
MAGIC_BYTES: dict[str, bytes] = {
    ".pdf": b"%PDF",
    ".docx": b"PK",
    ".pptx": b"PK",
}

# Magic bytes are not checked for plain text because any byte sequence
# is technically valid UTF-8 text.
MAGIC_BYTE_CHECK_EXTENSIONS = frozenset(MAGIC_BYTES.keys())

DEFAULT_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024


class FileValidationErrorCode(StrEnum):
    """Machine-readable reasons a reference file was rejected."""

    UNSUPPORTED_EXTENSION = "unsupported_extension"
    FILE_TOO_LARGE = "file_too_large"
    INVALID_FILE_SIGNATURE = "invalid_file_signature"
    ENCRYPTED_FILE = "encrypted_file"
    FILE_UNREADABLE = "file_unreadable"


@dataclass(frozen=True)
class FileValidationError:
    """User-safe rejection result with a stable error code."""

    code: FileValidationErrorCode
    message: str


@dataclass(frozen=True)
class ValidatedFile:
    """A file that passed all validation checks."""

    original_filename: str
    extension: str
    content_type: str
    content: bytes
    size_bytes: int


def _get_file_extension(filename: str) -> str:
    """Extract the lowercased file extension including the dot."""

    dot_index = filename.rfind(".")
    if dot_index < 0:
        return ""
    return filename[dot_index:].lower()


def _check_magic_bytes(content: bytes, extension: str) -> bool:
    """Verify that the file content starts with the expected signature."""

    if extension not in MAGIC_BYTE_CHECK_EXTENSIONS:
        return True
    expected_signature = MAGIC_BYTES[extension]
    return content[: len(expected_signature)] == expected_signature


def _check_pdf_encryption(content: bytes) -> bool:
    """Detect password-protected PDFs by looking for the Encrypt dictionary.

    This is a heuristic — a full parse would be more reliable but would
    also be slower and introduce failure modes we want to avoid at the
    validation stage.
    """

    return b"/Encrypt" in content[:8192]


def _check_office_encryption(content: bytes) -> bool:
    """Detect encrypted Office files.

    Encrypted OOXML files lose their PK (ZIP) header and instead start
    with the OLE2 compound document signature.
    """

    ole2_signature = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
    return content[: len(ole2_signature)] == ole2_signature


def validate_reference_file(
    filename: str,
    content: bytes,
    *,
    max_file_size_bytes: int = DEFAULT_MAX_FILE_SIZE_BYTES,
) -> ValidatedFile | FileValidationError:
    """Run all server-side checks and return either a validated file or an error."""

    extension = _get_file_extension(filename)
    if extension not in SUPPORTED_CONTENT_TYPES:
        supported_list = ", ".join(sorted(SUPPORTED_CONTENT_TYPES.keys()))
        return FileValidationError(
            code=FileValidationErrorCode.UNSUPPORTED_EXTENSION,
            message=f"Unsupported file type. Accepted formats: {supported_list}",
        )

    size_bytes = len(content)
    if size_bytes > max_file_size_bytes:
        max_size_mb = max_file_size_bytes / (1024 * 1024)
        return FileValidationError(
            code=FileValidationErrorCode.FILE_TOO_LARGE,
            message=f"File exceeds the {max_size_mb:.0f} MB size limit.",
        )

    if not content:
        return FileValidationError(
            code=FileValidationErrorCode.FILE_UNREADABLE,
            message="The uploaded file is empty.",
        )

    # Check for OLE2 encryption before magic bytes — an encrypted Office file
    # loses its PK (ZIP) header and would otherwise fail as INVALID_FILE_SIGNATURE.
    if extension in {".docx", ".pptx"} and _check_office_encryption(content):
        return FileValidationError(
            code=FileValidationErrorCode.ENCRYPTED_FILE,
            message="Encrypted Office files are not supported.",
        )

    if not _check_magic_bytes(content, extension):
        return FileValidationError(
            code=FileValidationErrorCode.INVALID_FILE_SIGNATURE,
            message="The file content does not match its extension.",
        )

    # Check for PDF encryption after confirming the file is a valid PDF.
    if extension == ".pdf" and _check_pdf_encryption(content):
        return FileValidationError(
            code=FileValidationErrorCode.ENCRYPTED_FILE,
            message="Password-protected PDFs are not supported.",
        )

    content_type = SUPPORTED_CONTENT_TYPES[extension]
    return ValidatedFile(
        original_filename=filename,
        extension=extension,
        content_type=content_type,
        content=content,
        size_bytes=size_bytes,
    )
