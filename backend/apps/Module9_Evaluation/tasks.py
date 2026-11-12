from celery import shared_task

from apps.Module5_Foundation.locks import single_run

from .services import recompute, report


@shared_task(name="evaluation.generate_report")
def generate_report(application_id):
    return report.generate(application_id)


@shared_task(name="evaluation.recompute_job")
def recompute_job(job_id):
    return recompute.recompute_job(job_id)


@shared_task(name="evaluation.sweep")
def sweep():
    with single_run("evaluation.sweep") as acquired:
        if acquired:
            return report.sweep()
