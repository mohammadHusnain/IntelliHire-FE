from django.core.management.base import BaseCommand

from apps.Module12_Communities.models import Community
from apps.Module12_Communities.services.core import recount


class Command(BaseCommand):
    help = "Recompute every community's cached member_count from its active memberships."

    def handle(self, *args, **options):
        fixed = 0
        for community in Community.objects.all().iterator():
            before = community.member_count
            if recount(community) != before:
                fixed += 1
        self.stdout.write(f"{fixed} community count(s) corrected.")
