from ..serializers.jobs import JobDetailSerializer
from ..services.queries import get_job


def company_of(request):
    return request.user.company_membership.company


def job_response_data(company, job_id):
    """The job as the API returns it everywhere: re-read with its count annotation and custom fields."""
    return JobDetailSerializer(get_job(company, job_id)).data
