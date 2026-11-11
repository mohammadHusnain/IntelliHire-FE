import hashlib

from django.db import IntegrityError, transaction

from apps.Module5_Foundation.ai import llm
from apps.Module5_Foundation.ai.config import get_config

from ..models import JobScreeningConfig
from .scoring import job_scoring_text


def config_for(job):
    """The job's screening settings, created with the defaults the first time they are needed."""
    try:
        return job.screening_config
    except JobScreeningConfig.DoesNotExist:
        pass
    try:
        with transaction.atomic():
            config = JobScreeningConfig.objects.create(job=job)
    except IntegrityError:  # created by a parallel request
        config = JobScreeningConfig.objects.get(job=job)
    job.screening_config = config
    return config


def job_vector(job, config):
    """The embedding of the job's requirements, computed once per job text and embedding model."""
    text = job_scoring_text(job)
    model = get_config().embed_model
    key = hashlib.sha256(f"{model}\0{text}".encode()).hexdigest()
    if config.job_embedding and config.job_embedding_key == key:
        return config.job_embedding
    (vector,) = llm.embed([text], related=job)
    JobScreeningConfig.objects.filter(pk=config.pk).update(job_embedding=vector, job_embedding_key=key)
    config.job_embedding, config.job_embedding_key = vector, key
    return vector
