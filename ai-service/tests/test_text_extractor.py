"""Unit tests for text extraction from reference documents."""

from app.ingestion.text_extractor import (
    extract_text,
    extract_text_from_txt,
)


def test_txt_extraction_returns_content() -> None:
    """Plain text should be read and returned as a single chunk."""

    content = b"Hello, this is a test document.\nSecond line."
    chunks = extract_text_from_txt(content)

    assert len(chunks) == 1
    assert "Hello, this is a test document." in chunks[0].content
    assert "Second line." in chunks[0].content
    assert chunks[0].source_page == 1
    assert chunks[0].source_location == "Full text"


def test_txt_extraction_handles_utf8() -> None:
    """UTF-8 encoded text including non-ASCII characters should work."""

    content = "Pelatihan untuk karyawan baru — édition spéciale".encode()
    chunks = extract_text_from_txt(content)

    assert len(chunks) == 1
    assert "Pelatihan" in chunks[0].content
    assert "édition" in chunks[0].content


def test_txt_extraction_falls_back_to_latin1() -> None:
    """Non-UTF-8 bytes should be decoded as latin-1 instead of crashing."""

    latin1_content = "résumé café".encode("latin-1")
    chunks = extract_text_from_txt(latin1_content)

    assert len(chunks) == 1
    assert "caf" in chunks[0].content


def test_empty_txt_returns_no_chunks() -> None:
    """An empty text file should produce no chunks without raising errors."""

    chunks = extract_text_from_txt(b"")
    assert chunks == []


def test_whitespace_only_txt_returns_no_chunks() -> None:
    """A whitespace-only file should produce no chunks."""

    chunks = extract_text_from_txt(b"   \n\n\t  ")
    assert chunks == []


def test_unsupported_extension_returns_empty_list() -> None:
    """An unknown extension should return an empty list rather than failing."""

    chunks = extract_text(b"some content", ".xyz")
    assert chunks == []


def test_extract_text_dispatches_txt() -> None:
    """The dispatch function should route .txt to the TXT extractor."""

    content = b"Dispatch test content."
    chunks = extract_text(content, ".txt")

    assert len(chunks) == 1
    assert "Dispatch test" in chunks[0].content
