"""Company-side endpoints (JWT). Thin: they find the object inside the caller's company, then call a service."""
from django.http import HttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response

from apps.common.errors import ApiError
from apps.common.pagination import StandardPagination
from apps.common.permissions import IsCompanyUser
from apps.Module3_JobPosting.models import JobPosting
from apps.Module3_JobPosting.services.queries import jobs_of
from apps.Module4_ApplicationManagement.models import Application, ApplicationStatus
from apps.Module4_ApplicationManagement.services.review import applications_of
from apps.Module5_Foundation.serializers import ErrorSerializer

from .models import CandidateEvaluation
from .permissions import CanDecide, CanManageWeights
from .serializers import (
    CompareSerializer,
    DecisionInputSerializer,
    DecisionResponseSerializer,
    DecisionSerializer,
    EvaluationDetailSerializer,
    EvaluationRankingRowSerializer,
    WeightsSerializer,
    compare_item,
    evaluation_detail,
    ranking_row,
)
from .services import decision as decisions, pdf, ranking, report
from .services.weights import set_weights, weights_for

NOT_FOUND = OpenApiResponse(ErrorSerializer, description="No such job or application in your company.")
FORBIDDEN = OpenApiResponse(ErrorSerializer, description="Your role may not do this (viewers only read).")


def company_of(request):
    return request.user.company_membership.company


def job_of(request, job_id):
    try:
        return jobs_of(company_of(request)).get(pk=job_id)
    except JobPosting.DoesNotExist:
        raise NotFound("Job not found.") from None


def application_of(request, application_id):
    try:
        return applications_of(company_of(request)).select_related("job__company", "candidate_user").get(pk=application_id)
    except Application.DoesNotExist:
        raise NotFound("Application not found.") from None


def evaluation_of(application):
    try:
        return application.evaluation
    except CandidateEvaluation.DoesNotExist:
        raise ApiError("This candidate has no evaluation yet.", "not_evaluated", 404) from None


class _View(GenericAPIView):
    permission_classes = [IsCompanyUser]
    filter_backends = []
    pagination_class = None
    queryset = CandidateEvaluation.objects.none()


# --- Per job ----------------------------------------------------------------------------------------------------
class EvaluationWeightsView(_View):
    serializer_class = WeightsSerializer

    def get_permissions(self):
        return [IsCompanyUser() if self.request.method == "GET" else CanManageWeights()]

    @extend_schema(
        summary="How this job combines its three stage scores",
        description="Created with the defaults on first use: CV 30, screening 30, technical 40, and a missing stage is ignored and the others rescaled.",
        responses={200: WeightsSerializer, 404: NOT_FOUND},
    )
    def get(self, request, job_id):
        return Response(WeightsSerializer(weights_for(job_of(request, job_id))).data)

    @extend_schema(
        summary="Change the weights or the missing-stage policy (admin, HR manager)",
        description="Send any of the three weights (they must add up to 100) and/or `missing_stage_policy` (`renormalise` or `zero`). A real change recomputes every evaluation of the job in the background; decisions are untouched.",
        request=WeightsSerializer,
        responses={200: WeightsSerializer, 400: OpenApiResponse(description="The weights do not add up to 100, or a value is out of range."), 403: FORBIDDEN, 404: NOT_FOUND},
    )
    def put(self, request, job_id):
        job = job_of(request, job_id)
        current = weights_for(job)
        serializer = WeightsSerializer(current, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        weights, _ = set_weights(job, request.user, serializer.validated_data)
        return Response(WeightsSerializer(weights).data)


class JobEvaluationsView(_View):
    serializer_class = EvaluationRankingRowSerializer
    pagination_class = StandardPagination

    @extend_schema(
        summary="Ranked, evaluated candidates of one job",
        description="Best composite first, ties to the earlier submission. Candidates with a missing stage are included, labelled `is_partial`.",
        parameters=[
            OpenApiParameter("min_score", float, required=False), OpenApiParameter("max_score", float, required=False),
            OpenApiParameter("status", str, enum=ApplicationStatus.values, required=False, description="The application's status."),
            OpenApiParameter("stage", str, enum=list(ranking.STAGES), required=False, description="The furthest stage with a score; `complete` means all three."),
            OpenApiParameter("partial", bool, required=False),
        ],
        responses={200: EvaluationRankingRowSerializer(many=True), 400: OpenApiResponse(ErrorSerializer, description="A bad filter (code `invalid_filter`)."), 404: NOT_FOUND},
    )
    def get(self, request, job_id):
        job = job_of(request, job_id)
        q = request.query_params
        try:
            filters = {
                "min_score": float(q["min_score"]) if q.get("min_score") else None, "max_score": float(q["max_score"]) if q.get("max_score") else None,
                "status": q.get("status") or None, "stage": q.get("stage") or None,
                "partial": {"true": True, "false": False}[q["partial"].lower()] if q.get("partial") else None,
            }  # fmt: skip
        except (ValueError, KeyError):
            raise ApiError("A filter has a value that is not allowed.", "invalid_filter", 400) from None
        if (filters["status"] and filters["status"] not in ApplicationStatus.values) or (filters["stage"] and filters["stage"] not in ranking.STAGES):
            raise ApiError("A filter has a value that is not allowed.", "invalid_filter", 400)
        page = self.paginate_queryset(ranking.ranked(job, **filters))
        return self.get_paginated_response(EvaluationRankingRowSerializer([ranking_row(e) for e in page], many=True).data)


class EvaluationCompareView(_View):
    serializer_class = CompareSerializer

    @extend_schema(
        summary="Compare two to four candidates side by side",
        parameters=[OpenApiParameter("applications", str, required=True, description="Comma-separated application ids (2 to 4) of this job.")],
        responses={200: CompareSerializer, 400: OpenApiResponse(ErrorSerializer, description="Fewer than 2 or more than 4 ids, or an id that is not valid (`invalid_count`)."), 404: NOT_FOUND},
    )
    def get(self, request, job_id):
        import uuid

        job = job_of(request, job_id)
        try:
            ids = [uuid.UUID(part) for part in request.query_params.get("applications", "").split(",") if part.strip()]
        except ValueError:
            raise ApiError("Choose between 2 and 4 candidates to compare.", "invalid_count", 400) from None
        return Response({"applications": [compare_item(a) for a in ranking.compare(job, ids)]})


# --- Per application --------------------------------------------------------------------------------------------
class ApplicationEvaluationView(_View):
    serializer_class = EvaluationDetailSerializer

    @extend_schema(
        summary="One candidate's evaluation",
        description="Stage scores, composite, the AI-assisted report and the decision history. Candidates never see this.",
        responses={200: EvaluationDetailSerializer, 404: OpenApiResponse(ErrorSerializer, description="Unknown application, or nothing scored yet (code `not_evaluated`).")},
    )
    def get(self, request, application_id):
        application = application_of(request, application_id)
        evaluation = evaluation_of(application)
        history = list(application.decisions.select_related("decided_by").order_by("-decided_at", "-id"))
        return Response(evaluation_detail(evaluation, history))


class EvaluationGenerateView(_View):
    permission_classes = [CanDecide]

    @extend_schema(
        summary="Generate (or retry) the report",
        description="Useful for a partial candidate or after a failure. The scores are shown at once; the report follows in the background.",
        request=None,
        responses={202: OpenApiResponse(description="Queued."), 403: FORBIDDEN, 404: NOT_FOUND, 409: OpenApiResponse(ErrorSerializer, description="Nothing has been scored yet (`no_scores`).")},
    )
    def post(self, request, application_id):
        application = application_of(request, application_id)
        try:
            application.evaluation
        except CandidateEvaluation.DoesNotExist:
            raise ApiError("There are no scores to report on yet.", "no_scores", 409) from None
        report.request_report(application.pk)
        return Response({"detail": "Report queued."}, status=status.HTTP_202_ACCEPTED)


class EvaluationPdfView(_View):
    @extend_schema(
        summary="Download the evaluation as a PDF",
        description="One to two pages: scores, report, decision history, the AI disclaimer and the time it was generated. Built on request, not stored.",
        responses={(200, "application/pdf"): OpenApiTypes.BINARY, 404: OpenApiResponse(ErrorSerializer, description="Unknown application or nothing scored yet.")},
    )
    def get(self, request, application_id):
        application = application_of(request, application_id)
        evaluation = evaluation_of(application)
        history = list(application.decisions.select_related("decided_by").order_by("-decided_at", "-id"))
        response = HttpResponse(pdf.build_pdf(application, evaluation, history), content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="evaluation-{application.reference}.pdf"'
        return response


class ApplicationDecisionView(_View):
    permission_classes = [CanDecide]
    serializer_class = DecisionInputSerializer

    @extend_schema(
        summary="Record the final decision",
        description=(
            "`selected`, `rejected` or `on_hold`. One transaction: the decision row (permanent, never edited) and the status change. "
            "The candidate is emailed unless `notify` is false. The same decision as the current one is 409. Contradicting the AI "
            "recommendation is allowed and recorded (`overrode_ai`). Selecting never closes the job; `hint` says whether its openings are filled."
        ),
        request=DecisionInputSerializer,
        responses={
            201: DecisionResponseSerializer, 400: OpenApiResponse(description="Unknown decision or a note over 1000 characters."),
            403: FORBIDDEN, 404: NOT_FOUND, 409: OpenApiResponse(ErrorSerializer, description="This is already the current decision (`same_decision`)."),
        },  # fmt: skip
    )
    def post(self, request, application_id):
        application_of(request, application_id)  # another company's application is 404 before anything is validated
        data = DecisionInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        row, application = decisions.record(
            company=company_of(request), application_id=application_id, user=request.user, decision=data.validated_data["decision"],
            note=data.validated_data.get("note", ""), notify_candidate=data.validated_data["notify"],
        )  # fmt: skip
        return Response(
            {"decision": DecisionSerializer(row).data, "status": application.status, "hint": decisions.openings_filled(application.job)},
            status=status.HTTP_201_CREATED,
        )


class ApplicationDecisionsView(_View):
    @extend_schema(summary="The decision history, newest first", responses={200: DecisionSerializer(many=True), 404: NOT_FOUND})
    def get(self, request, application_id):
        application = application_of(request, application_id)
        rows = application.decisions.select_related("decided_by").order_by("-decided_at", "-id")
        return Response(DecisionSerializer(rows, many=True).data)
