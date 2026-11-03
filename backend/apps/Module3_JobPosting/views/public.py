from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

from apps.Module1_Authentication.views import PublicAPIView

from ..models import JobPosting, JobStatus
from ..serializers.jobs import FormSchemaSerializer
from ..services.form import build_form_schema


class PublicJobView(PublicAPIView):
    serializer_class = FormSchemaSerializer
    throttle_classes = []

    @extend_schema(
        description=(
            "The application form of a published job, without any token. An unknown slug or a draft is 404. "
            "A closed job (or one past its deadline, or whose company is not approved) is 200 with "
            "`accepting: false` and a `message`."
        ),
        responses={200: FormSchemaSerializer},
    )
    def get(self, request, form_slug):
        try:
            job = (
                JobPosting.objects.select_related("company")
                .prefetch_related("custom_fields")
                .exclude(status=JobStatus.DRAFT)
                .get(form_slug=form_slug)
            )
        except JobPosting.DoesNotExist:
            raise NotFound("Job not found.")
        return Response(build_form_schema(job, request.build_absolute_uri))
