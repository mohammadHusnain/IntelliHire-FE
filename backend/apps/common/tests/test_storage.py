import pytest
from django.conf import settings
from django.core.files.base import ContentFile

from apps.common.storage import PrivateFileSystemStorage, RandomUploadPath, private_storage


def test_private_storage_lives_outside_public_media():
    storage = private_storage()
    assert isinstance(storage, PrivateFileSystemStorage)
    assert str(storage.location) == str(settings.PRIVATE_MEDIA_ROOT)
    assert str(settings.PRIVATE_MEDIA_ROOT) != str(settings.MEDIA_ROOT)


def test_private_files_have_no_url():
    storage = private_storage()
    name = storage.save("resumes/x.pdf", ContentFile(b"%PDF"))
    try:
        with pytest.raises(ValueError):
            storage.url(name)
    finally:
        storage.delete(name)


def test_random_upload_path_hides_original_name():
    upload_to = RandomUploadPath("resumes")
    first = upload_to(None, "My CV (final).PDF")
    second = upload_to(None, "My CV (final).PDF")
    assert first.startswith("resumes/") and first.endswith(".pdf")
    assert "CV" not in first and first != second


def test_random_upload_path_is_migration_serializable():
    path, args, kwargs = RandomUploadPath("avatars").deconstruct()
    assert path.endswith("RandomUploadPath")
    assert args == ("avatars",) and kwargs == {}
