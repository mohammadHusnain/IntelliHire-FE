import zlib
from contextlib import contextmanager

from django.db import connection, transaction


@contextmanager
def single_run(name):
    """Yield True if this caller holds the named lock, False if another run already has it.

    The lock is a PostgreSQL advisory lock tied to the surrounding transaction, so it is released on commit, on
    error and when the connection drops. Scheduled jobs use it so overlapping runs never do the same work twice.
    """
    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_try_advisory_xact_lock(%s)", [zlib.crc32(name.encode())])
            acquired = cursor.fetchone()[0]
        yield acquired
