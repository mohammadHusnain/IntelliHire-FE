from django.core.management.base import BaseCommand

from apps.Module3_JobPosting.services.lifecycle import close_expired_jobs


class Command(BaseCommand):
    help = (
        "Close every open job whose deadline has passed (close reason: deadline). "
        "Run it every 5 minutes (cron, Windows Task Scheduler, or a scheduled job). "
        "Late applications are refused even without it; it keeps stored statuses accurate."
    )

    def handle(self, *args, **options):
        closed = close_expired_jobs()
        self.stdout.write(f"Closed {closed} expired job(s).")
