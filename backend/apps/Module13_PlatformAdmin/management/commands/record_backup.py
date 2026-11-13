"""Called by the deployment's backup job when it finishes; the platform only reads this table."""
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.Module13_PlatformAdmin.models import BackupRecord, BackupStatus


class Command(BaseCommand):
    help = "Record the result of a backup run."

    def add_arguments(self, parser):
        parser.add_argument("--status", choices=list(BackupStatus.values), required=True)
        parser.add_argument("--started-at", help="ISO timestamp; defaults to now")
        parser.add_argument("--finished-at", help="ISO timestamp; defaults to now")
        parser.add_argument("--size-bytes", type=int, default=0)
        parser.add_argument("--location", default="")
        parser.add_argument("--notes", default="")

    def handle(self, *args, **options):
        now = timezone.now()

        def when(value):
            if not value:
                return now
            parsed = parse_datetime(value)
            if parsed is None:
                raise CommandError(f"Not a timestamp: {value}")
            return parsed if timezone.is_aware(parsed) else timezone.make_aware(parsed)

        record = BackupRecord.objects.create(
            started_at=when(options["started_at"]), finished_at=when(options["finished_at"]), status=options["status"],
            size_bytes=max(0, options["size_bytes"]), location=options["location"][:300], notes=options["notes"][:500],
        )
        self.stdout.write(f"Recorded backup {record.pk} ({record.status}).")
