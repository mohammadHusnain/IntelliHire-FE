import logging

from celery import shared_task

from apps.Module5_Foundation.locks import single_run

from .services import pipeline

logger = logging.getLogger(__name__)


@shared_task(name="cv_analysis.analyse_cv")
def analyse_cv(application_id):
    return pipeline.analyse(application_id)


@shared_task(name="cv_analysis.rescore_job")
def rescore_job(job_id):
    return pipeline.rescore_job(job_id)


@shared_task(name="cv_analysis.sweep")
def sweep():
    with single_run("cv_analysis.sweep") as acquired:
        if acquired:
            return pipeline.sweep()
