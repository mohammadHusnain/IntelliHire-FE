import uuid
from pathlib import Path

from django.conf import settings
from django.core.files.storage import FileSystemStorage, storages
from django.utils.deconstruct import deconstructible


class PrivateFileSystemStorage(FileSystemStorage):
    """Files outside MEDIA_ROOT that are never exposed through a URL."""

    def __init__(self, **kwargs):
        kwargs.setdefault("location", settings.PRIVATE_MEDIA_ROOT)
        super().__init__(**kwargs)

    def url(self, name):
        raise ValueError("Private files are not accessible through a URL.")


def private_storage():
    return storages["private"]


@deconstructible
class RandomUploadPath:
    """upload_to that stores files under a random name, never the original."""

    def __init__(self, prefix):
        self.prefix = prefix

    def __call__(self, instance, filename):
        return f"{self.prefix}/{uuid.uuid4().hex}{Path(filename).suffix.lower()}"
