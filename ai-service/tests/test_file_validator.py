"""Unit tests for server-side reference file validation."""

from app.ingestion.file_validator import (
    FileValidationError,
    FileValidationErrorCode,
    ValidatedFile,
    validate_reference_file,
)

# Minimal valid file signatures for testing.
MINIMAL_PDF_CONTENT = b"%PDF-1.4\nMinimal PDF content for testing."
MINIMAL_ZIP_CONTENT = b"PK\x03\x04Minimal ZIP content for testing OOXML."
MINIMAL_TXT_CONTENT = b"This is plain text content for testing."


def test_valid_pdf_is_accepted() -> None:
    """A PDF with correct extension and magic bytes should pass."""

    result = validate_reference_file("report.pdf", MINIMAL_PDF_CONTENT)
    assert isinstance(result, ValidatedFile)
    assert result.extension == ".pdf"
    assert result.content_type == "application/pdf"
    assert result.size_bytes == len(MINIMAL_PDF_CONTENT)


def test_valid_docx_is_accepted() -> None:
    """A DOCX (ZIP-based) with correct extension and magic bytes should pass."""

    result = validate_reference_file("document.docx", MINIMAL_ZIP_CONTENT)
    assert isinstance(result, ValidatedFile)
    assert result.extension == ".docx"


def test_valid_pptx_is_accepted() -> None:
    """A PPTX (ZIP-based) with correct extension and magic bytes should pass."""

    result = validate_reference_file("slides.pptx", MINIMAL_ZIP_CONTENT)
    assert isinstance(result, ValidatedFile)
    assert result.extension == ".pptx"


def test_valid_txt_is_accepted() -> None:
    """Plain text files should be accepted without magic byte checking."""

    result = validate_reference_file("notes.txt", MINIMAL_TXT_CONTENT)
    assert isinstance(result, ValidatedFile)
    assert result.extension == ".txt"
    assert result.content_type == "text/plain"


def test_unsupported_extension_is_rejected() -> None:
    """Executable, image-only, and legacy formats should be blocked."""

    result = validate_reference_file("malware.exe", b"MZ\x90\x00")
    assert isinstance(result, FileValidationError)
    assert result.code == FileValidationErrorCode.UNSUPPORTED_EXTENSION


def test_ppt_legacy_format_is_rejected() -> None:
    """Legacy .ppt format is not supported by python-pptx."""

    result = validate_reference_file("old.ppt", b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1")
    assert isinstance(result, FileValidationError)
    assert result.code == FileValidationErrorCode.UNSUPPORTED_EXTENSION


def test_oversized_file_is_rejected() -> None:
    """Files exceeding the size limit should be rejected."""

    oversized_content = b"%PDF-" + b"x" * 100
    result = validate_reference_file(
        "large.pdf",
        oversized_content,
        max_file_size_bytes=50,
    )
    assert isinstance(result, FileValidationError)
    assert result.code == FileValidationErrorCode.FILE_TOO_LARGE


def test_wrong_magic_bytes_for_pdf_is_rejected() -> None:
    """A file claiming to be PDF but without the %PDF signature should fail."""

    result = validate_reference_file("fake.pdf", b"This is not a PDF at all.")
    assert isinstance(result, FileValidationError)
    assert result.code == FileValidationErrorCode.INVALID_FILE_SIGNATURE


def test_wrong_magic_bytes_for_docx_is_rejected() -> None:
    """A file claiming to be DOCX but without the PK signature should fail."""

    result = validate_reference_file("fake.docx", b"Not a ZIP archive.")
    assert isinstance(result, FileValidationError)
    assert result.code == FileValidationErrorCode.INVALID_FILE_SIGNATURE


def test_empty_file_is_rejected() -> None:
    """An empty file cannot be processed."""

    result = validate_reference_file("empty.pdf", b"")
    assert isinstance(result, FileValidationError)
    assert result.code == FileValidationErrorCode.FILE_UNREADABLE


def test_encrypted_pdf_is_rejected() -> None:
    """PDFs with an /Encrypt dictionary should be rejected."""

    encrypted_pdf = b"%PDF-1.4\n1 0 obj\n<< /Encrypt >>\nendobj"
    result = validate_reference_file("encrypted.pdf", encrypted_pdf)
    assert isinstance(result, FileValidationError)
    assert result.code == FileValidationErrorCode.ENCRYPTED_FILE


def test_encrypted_office_file_is_rejected() -> None:
    """OLE2-encrypted Office files should be rejected."""

    ole2_header = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\x00" * 100
    result = validate_reference_file("encrypted.docx", ole2_header)
    assert isinstance(result, FileValidationError)
    assert result.code == FileValidationErrorCode.ENCRYPTED_FILE


def test_filename_without_extension_is_rejected() -> None:
    """Files without a recognizable extension should be rejected."""

    result = validate_reference_file("readme", b"some content")
    assert isinstance(result, FileValidationError)
    assert result.code == FileValidationErrorCode.UNSUPPORTED_EXTENSION


def test_case_insensitive_extension() -> None:
    """Extensions should be matched case-insensitively."""

    result = validate_reference_file("REPORT.PDF", MINIMAL_PDF_CONTENT)
    assert isinstance(result, ValidatedFile)
    assert result.extension == ".pdf"
