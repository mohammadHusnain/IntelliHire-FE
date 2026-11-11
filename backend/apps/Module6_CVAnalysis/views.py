from django.db import transaction
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response

from apps.common.errors import ApiError
from apps.common.permissions import IsCompanyUser
from apps.Module3_JobPosting.models import JobPosting
from apps.Module3_JobPosting.services.queries import jobs_of
from apps.Module4_ApplicationManagement.models import ApplicationStatus
from apps.Module4_ApplicationManagement.services.review import applications_of
from apps.Module5_Foundation.serializers import ErrorSerializer

from .models import AnalysisStatus, CVAnalysis
from .permissions import CanManageScreening, CanRunScreening
from .serializers import (
    CVAnalysisSerializer,
    ProgressSerializer,
    RankingRowSerializer,
    RunResponseSerializer,
    RunSerializer,
    ScreeningConfigSerializer,
    ThresholdResponseSerializer,
    ThresholdSerializer,
    ranking_row,
)
from .services import pipeline, screening, shortlist
from .services.config import config_for
from .services.scoring import job_signature

NOT_FOUND = OpenApiResponse(ErrorSerializer, description="No such job or application in your company.")
FORBIDDEN = OpenApiResponse(ErrorSerializer, description="Your role may not do this (viewers only read).")


def company_of(request):
    return request.user.company_membership.company


def job_of(request, job_id):
    try:
        return jobs_of(company_of(request)).get(pk=job_id)
    except JobPosting.DoesNotExist:
        raise NotFound("Job not found.")


class _JobView(GenericAPIView):
    permission_classes = [IsCompanyUser]
    filter_backends = []
    pagination_class = None
    queryset = JobPosting.objects.none()


class ScreeningConfigView(_JobView):
    serializer_class = ScreeningConfigSerializer

    def get_permissions(self):
        return [IsCompanyUser() if self.request.method == "GET" else CanManageScreening()]

    @extend_schema(
        summary="How this job's CVs are analysed and shortlisted",
        description="Created with defaults on first use: analyse on arrival, threshold 70, weights 50/25/15/10, no automatic shortlisting.",
        responses={200: ScreeningConfigSerializer, 404: NOT_FOUND},
    )
    def get(self, request, job_id):
        return Response(ScreeningConfigSerializer(config_for(job_of(request, job_id))).data)

    @extend_schema(
        summary="Change the screening settings (admin, HR manager)",
        description=(
            "Send any of the fields. The four weights must add up to 100. Changing a weight re-scores every analysed CV "
            "of the job in the background. `invite_on_shortlist` is stored now and takes effect with the interview module."
        ),
        request=ScreeningConfigSerializer,
        responses={200: ScreeningConfigSerializer, 400: OpenApiResponse(description="Invalid value, or weights do not total 100."), 403: FORBIDDEN, 404: NOT_FOUND},
    )
    def put(self, request, job_id):
        job = job_of(request, job_id)
        config = config_for(job)
        before = config.weights
        serializer = ScreeningConfigSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            config = serializer.save(updated_by=request.user)
            if config.weights != before:
                from .tasks import rescore_job

                job_id_text = str(job.pk)
                transaction.on_commit(lambda: screening._safely(lambda: rescore_job.delay(job_id_text)))
        return Response(ScreeningConfigSerializer(config).data)


class RunScreeningView(_JobView):
    permission_classes = [CanRunScreening]
    serializer_class = RunSerializer

    @extend_schema(
        summary="Begin CV screening for a job",
        description=(
            "`missing` (default): analyse CVs that were never analysed or failed. `full`: read every CV again. "
            "`rescore`: recompute scores from what was already read, for example after the job's skills changed. "
            "Returns at once; follow the work with the progress endpoint."
        ),
        request=RunSerializer,
        responses={
            202: RunResponseSerializer, 403: FORBIDDEN, 404: NOT_FOUND,
            409: OpenApiResponse(ErrorSerializer, description="The job has no applications (code `no_applications`)."),
        },  # fmt: skip
    )
    def post(self, request, job_id):
        serializer = RunSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        mode = serializer.validated_data["mode"]
        with transaction.atomic():
            queued = screening.start_run(job_of(request, job_id), mode, request.user)
        return Response({"mode": mode, "queued": queued}, status=status.HTTP_202_ACCEPTED)


class ScreeningProgressView(_JobView):
    serializer_class = ProgressSerializer

    @extend_schema(summary="Progress of a job's CV screening", responses={200: ProgressSerializer, 404: NOT_FOUND})
    def get(self, request, job_id):
        return Response(screening.progress(job_of(request, job_id)))


class RankingQuerySerializer(serializers.Serializer):
    min_score = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=0, max_value=100, required=False)
    status = serializers.ChoiceField(choices=ApplicationStatus.choices, required=False)
    analysis_status = serializers.ChoiceField(choices=[*AnalysisStatus.values, "none"], required=False)


class RankingView(GenericAPIView):
    permission_classes = [IsCompanyUser]
    serializer_class = RankingRowSerializer
    filter_backends = []
    queryset = JobPosting.objects.none()

    @extend_schema(
        summary="A job's candidates ranked by CV match",
        description="Best score first; ties go to the earlier submission; applications without a score come last. `rank` is the position within the filtered list.",
        parameters=[
            OpenApiParameter("min_score", float, required=False, description="Only scores at or above this (0 to 100)."),
            OpenApiParameter("status", str, required=False, enum=ApplicationStatus.values, description="Application status."),
            OpenApiParameter("analysis_status", str, required=False, enum=[*AnalysisStatus.values, "none"], description="Analysis state; `none` = not analysed."),
        ],
        responses={200: RankingRowSerializer(many=True), 400: OpenApiResponse(description="Invalid filter."), 404: NOT_FOUND},
    )
    def get(self, request, job_id):
        job = job_of(request, job_id)
        query = RankingQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        queryset = screening.ranking(applications_of(company_of(request)).filter(job=job), **query.validated_data)
        page = self.paginate_queryset(queryset)
        signature = job_signature(job, config_for(job).weights)
        offset = (self.paginator.page.number - 1) * self.paginator.get_page_size(request)
        rows = [ranking_row(application, offset + index, signature) for index, application in enumerate(page, 1)]
        return self.get_paginated_response(rows)


class ApplyThresholdView(_JobView):
    permission_classes = [CanManageScreening]
    serializer_class = ThresholdSerializer

    @extend_schema(
        summary="Shortlist everyone at or above the threshold (admin, HR manager)",
        description=(
            "Shortlists scored applications that are still under review and at or above the threshold, and saves the "
            "threshold on the job. Nobody below it is rejected or changed. With `dry_run` nothing changes and the "
            "response says how many would be shortlisted. Without `threshold` the job's saved threshold is used."
        ),
        request=ThresholdSerializer,
        responses={200: ThresholdResponseSerializer, 403: FORBIDDEN, 404: NOT_FOUND},
    )
    def post(self, request, job_id):
        job = job_of(request, job_id)
        serializer = ThresholdSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        threshold = serializer.validated_data.get("threshold", config_for(job).shortlist_threshold)
        if serializer.validated_data["dry_run"]:
            return Response(shortlist.preview(job, threshold))
        return Response(shortlist.apply_threshold(job, threshold, request.user))


def _analysis_of(request, application_id):
    application = applications_of(company_of(request)).filter(pk=application_id).first()
    if application is None:
        raise NotFound("Application not found.")
    return application


class _ApplicationView(GenericAPIView):
    permission_classes = [IsCompanyUser]
    filter_backends = []
    pagination_class = None
    queryset = CVAnalysis.objects.none()
    serializer_class = CVAnalysisSerializer


class CVAnalysisView(_ApplicationView):
    @extend_schema(
        summary="What was read from one CV and how it scored",
        description="Parsed skills, education, experience and projects, the four part scores, matched and missing skills, flags and the explanation. Candidates never see this.",
        responses={200: CVAnalysisSerializer, 404: OpenApiResponse(ErrorSerializer, description="Unknown application, or its CV has not been analysed (code `not_analysed`).")},
    )
    def get(self, request, application_id):
        application = _analysis_of(request, application_id)
        analysis = getattr(application, "cv_analysis", None)
        if analysis is None:
            raise ApiError("This CV has not been analysed yet.", "not_analysed", 404)
        return Response(CVAnalysisSerializer(analysis).data)


class CVAnalysisRerunView(_ApplicationView):
    permission_classes = [CanRunScreening]

    @extend_schema(
        summary="Analyse one CV again",
        request=None,
        responses={
            202: OpenApiResponse(description="Queued."), 403: FORBIDDEN, 404: NOT_FOUND,
            409: OpenApiResponse(ErrorSerializer, description="The CV is being analysed right now (code `analysis_in_progress`)."),
        },  # fmt: skip
    )
    def post(self, request, application_id):
        application = _analysis_of(request, application_id)
        with transaction.atomic():
            if not pipeline.queue_analysis(application):
                raise ApiError("This CV is being analysed right now.", "analysis_in_progress", 409)
        return Response({"detail": "Analysis queued."}, status=status.HTTP_202_ACCEPTED)

