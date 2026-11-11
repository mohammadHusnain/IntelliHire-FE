from django.core.management.base import BaseCommand

from apps.Module5_Foundation.alerts import check_alerts


class Command(BaseCommand):
    help = (
        "Open or resolve system alerts, including 'background worker down', which a dead worker cannot report "
        "itself. Run it every 5 minutes from cron or a scheduler outside the Celery worker."
    )

    def handle(self, *args, **options):
        check_alerts(evaluate_worker=True)
        self.stdout.write("Alert check complete.")
