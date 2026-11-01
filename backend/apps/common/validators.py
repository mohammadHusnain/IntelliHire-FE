from pathlib import Path

from django.conf import settings
from django.core.exceptions import ValidationError

CV_TYPE_ERROR = "Only PDF and DOCX files are accepted."
IMAGE_TYPE_ERROR = "Only JPG and PNG images are accepted."

_PDF_MAGIC = b"%PDF"
_ZIP_MAGIC = b"PK"
_JPEG_MAGIC = b"\xff\xd8\xff"
_PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def _head(file, length=8):
    file.seek(0)
    data = file.read(length)
    file.seek(0)
    return data


def _megabytes(limit):
    return f"{limit // (1024 * 1024)} MB"


def validate_cv_file(file):
    """PDF or DOCX, within the size limit, with content matching the extension."""
    extension = Path(file.name).suffix.lower()
    head = _head(file)
    is_pdf = extension == ".pdf" and head.startswith(_PDF_MAGIC)
    is_docx = extension == ".docx" and head.startswith(_ZIP_MAGIC)
    if not (is_pdf or is_docx):
        raise ValidationError(CV_TYPE_ERROR, code="invalid_file_type")
    if file.size > settings.CV_MAX_UPLOAD_BYTES:
        raise ValidationError(
            f"File must be {_megabytes(settings.CV_MAX_UPLOAD_BYTES)} or smaller.",
            code="file_too_large",
        )


def validate_profile_image(file):
    """JPG or PNG, within the size limit, with content matching the extension."""
    extension = Path(file.name).suffix.lower()
    head = _head(file)
    is_jpeg = extension in {".jpg", ".jpeg"} and head.startswith(_JPEG_MAGIC)
    is_png = extension == ".png" and head.startswith(_PNG_MAGIC)
    if not (is_jpeg or is_png):
        raise ValidationError(IMAGE_TYPE_ERROR, code="invalid_file_type")
    if file.size > settings.IMAGE_MAX_UPLOAD_BYTES:
        raise ValidationError(
            f"Image must be {_megabytes(settings.IMAGE_MAX_UPLOAD_BYTES)} or smaller.",
            code="file_too_large",
        )
