"""Image validation and normalisation for uploads.

Every accepted image is decoded and re-encoded rather than stored as received.
That is what removes metadata, and it also means no crafted file reaches
storage intact.
"""

from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from typing import Any

from PIL import Image, ImageOps, UnidentifiedImageError

# Long edge cap. A 12MP phone photo becomes roughly a tenth of the bytes while
# staying sharper than any layout on the site displays it.
MAX_DIMENSION = 2560

# Checked before decoding: a small file can declare enormous dimensions and
# exhaust memory when expanded — a decompression bomb.
MAX_PIXELS = 40_000_000

ALLOWED_FORMATS: dict[str, str] = {
    "JPEG": "image/jpeg",
    "PNG": "image/png",
    "WEBP": "image/webp",
}


class ImageRejectedError(Exception):
    """The upload is not an image we will store. The message is shown to the user."""


@dataclass(frozen=True)
class ProcessedImage:
    data: bytes
    extension: str
    content_type: str
    width: int
    height: int
    byte_size: int


def process_image(raw: bytes) -> ProcessedImage:
    if not raw:
        raise ImageRejectedError("The file is empty.")

    # The format is read from the file's own bytes. The uploaded filename and
    # the declared content type are attacker-controlled and ignored.
    try:
        with Image.open(BytesIO(raw)) as probe:
            source_format = (probe.format or "").upper()
            width, height = probe.size
    except (UnidentifiedImageError, OSError) as error:
        raise ImageRejectedError("That file is not a readable image.") from error

    if source_format not in ALLOWED_FORMATS:
        raise ImageRejectedError("Images must be JPEG, PNG or WebP.")
    if width * height > MAX_PIXELS:
        raise ImageRejectedError("That image is too large to process.")

    with Image.open(BytesIO(raw)) as image:
        # Apply the orientation flag before discarding metadata, or portrait
        # photos from phones end up sideways.
        oriented = ImageOps.exif_transpose(image) or image
        oriented.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.Resampling.LANCZOS)

        has_alpha = oriented.mode in ("RGBA", "LA") or (
            oriented.mode == "P" and "transparency" in oriented.info
        )
        mode, out_format, extension = (
            ("RGBA", "PNG", "png") if has_alpha else ("RGB", "JPEG", "jpg")
        )

        # Pixels are copied into a brand-new image, so nothing from the
        # original's metadata survives: no GPS coordinates, no camera serial
        # number, no timestamps.
        clean = Image.new(mode, oriented.size)
        clean.paste(oriented.convert(mode))

        options: dict[str, Any] = (
            {"optimize": True}
            if out_format == "PNG"
            else {"quality": 85, "optimize": True, "progressive": True}
        )
        buffer = BytesIO()
        clean.save(buffer, format=out_format, **options)
        output_size = (clean.width, clean.height)

    data = buffer.getvalue()
    return ProcessedImage(
        data=data,
        extension=extension,
        content_type=ALLOWED_FORMATS[out_format],
        width=output_size[0],
        height=output_size[1],
        byte_size=len(data),
    )
