"""Unit tests for image extraction and dimension filtering."""

from app.ingestion.image_extractor import (
    _guess_image_dimensions,
    _is_large_enough,
    extract_images,
)


def test_is_large_enough_above_threshold() -> None:
    """Images meeting or exceeding the minimum should be accepted."""

    assert _is_large_enough(200, 150, 100) is True
    assert _is_large_enough(100, 100, 100) is True


def test_is_large_enough_below_threshold() -> None:
    """Small images like icons should be filtered out."""

    assert _is_large_enough(50, 50, 100) is False
    assert _is_large_enough(100, 50, 100) is False


def test_guess_png_dimensions() -> None:
    """PNG header should be parsed correctly for width and height."""

    # Build a minimal PNG header: 8-byte magic + IHDR chunk.
    png_magic = b"\x89PNG\r\n\x1a\n"
    # IHDR chunk: length (4) + "IHDR" (4) + width (4) + height (4)
    ihdr_length = b"\x00\x00\x00\x0d"
    ihdr_type = b"IHDR"
    width_bytes = (640).to_bytes(4, "big")
    height_bytes = (480).to_bytes(4, "big")
    png_data = png_magic + ihdr_length + ihdr_type + width_bytes + height_bytes + b"\x00" * 5

    width, height = _guess_image_dimensions(png_data)
    assert width == 640
    assert height == 480


def test_guess_unknown_format_returns_zero() -> None:
    """Unrecognized formats should return (0, 0) for safe filtering."""

    width, height = _guess_image_dimensions(b"\x00\x00\x00\x00")
    assert width == 0
    assert height == 0


def test_guess_short_data_returns_zero() -> None:
    """Data too short to parse should not crash."""

    width, height = _guess_image_dimensions(b"\x89PN")
    assert width == 0
    assert height == 0


def test_extract_images_unsupported_extension() -> None:
    """Unsupported extensions should return an empty list."""

    images = extract_images(b"some content", ".txt")
    assert images == []


def test_extract_images_unknown_extension() -> None:
    """Unknown extensions should return an empty list."""

    images = extract_images(b"some content", ".xyz")
    assert images == []
