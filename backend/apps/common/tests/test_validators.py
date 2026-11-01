import pytest
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.common.validators import validate_cv_file, validate_profile_image

PDF = b"%PDF-1.7\n%test"
DOCX = b"PK\x03\x04rest-of-zip"
JPEG = b"\xff\xd8\xff\xe0jfif"
PNG = b"\x89PNG\r\n\x1a\nrest"
MB = 1024 * 1024


def upload(name, content):
    return SimpleUploadedFile(name, content)


@pytest.mark.parametrize("name,content", [("cv.pdf", PDF), ("cv.docx", DOCX), ("CV.PDF", PDF)])
def test_cv_accepts_valid_files(name, content):
    validate_cv_file(upload(name, content))


@pytest.mark.parametrize(
    "name,content",
    [
        ("photo.jpg", JPEG),
        ("cv.pdf", JPEG),
        ("cv.pdf", DOCX),
        ("cv.docx", PDF),
        ("cv.doc", PDF),
        ("run.exe", b"MZ\x90\x00"),
        ("cv", PDF),
        ("cv.pdf", b""),
    ],
)
def test_cv_rejects_wrong_type_or_content(name, content):
    with pytest.raises(ValidationError) as exc:
        validate_cv_file(upload(name, content))
    assert exc.value.messages == ["Only PDF and DOCX files are accepted."]


def test_cv_size_limit_is_5_mb():
    validate_cv_file(upload("cv.pdf", PDF + b"0" * (5 * MB - len(PDF))))
    with pytest.raises(ValidationError) as exc:
        validate_cv_file(upload("cv.pdf", PDF + b"0" * (5 * MB)))
    assert exc.value.messages == ["File must be 5 MB or smaller."]


def test_cv_validation_resets_file_pointer():
    file = upload("cv.pdf", PDF)
    validate_cv_file(file)
    assert file.read() == PDF


@pytest.mark.parametrize("name,content", [("a.jpg", JPEG), ("a.jpeg", JPEG), ("a.png", PNG)])
def test_image_accepts_valid_files(name, content):
    validate_profile_image(upload(name, content))


@pytest.mark.parametrize(
    "name,content",
    [("a.gif", b"GIF89a"), ("a.png", JPEG), ("a.jpg", PNG), ("a.pdf", PDF), ("a.png", b"")],
)
def test_image_rejects_wrong_type_or_content(name, content):
    with pytest.raises(ValidationError) as exc:
        validate_profile_image(upload(name, content))
    assert exc.value.messages == ["Only JPG and PNG images are accepted."]


def test_image_size_limit_is_2_mb():
    validate_profile_image(upload("a.png", PNG + b"0" * (2 * MB - len(PNG))))
    with pytest.raises(ValidationError) as exc:
        validate_profile_image(upload("a.png", PNG + b"0" * (2 * MB)))
    assert exc.value.messages == ["Image must be 2 MB or smaller."]
