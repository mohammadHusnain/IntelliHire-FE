import pytest

from apps.Module5_Foundation.ai import llm
from apps.Module5_Foundation.ai.providers.fake import FakeProvider
from apps.Module5_Foundation.models import PromptTemplate

SCORE_SCHEMA = {
    "type": "object",
    "required": ["score", "feedback"],
    "properties": {"score": {"type": "integer", "minimum": 0, "maximum": 10}, "feedback": {"type": "string"}},
}


@pytest.fixture
def waits():
    return []


@pytest.fixture(autouse=True)
def _fresh_ai(monkeypatch, waits):
    FakeProvider.reset()
    llm.clear_embedding_cache()
    monkeypatch.setattr(llm, "_sleep", waits.append)
    yield
    FakeProvider.reset()


@pytest.fixture
def template(db):
    def make(key="score_answer", system="Score the answer.", user="Answer: {answer}", schema=None, role="chat", active=True, version=1):
        return PromptTemplate.objects.create(
            key=key, version=version, model_role=role, system_text=system, user_text=user,
            output_schema=SCORE_SCHEMA if schema is None else schema, is_active=active,
        )  # fmt: skip

    return make


@pytest.fixture
def platform_admin(user_factory):
    from apps.common.choices import UserRole

    return user_factory(role=UserRole.PLATFORM_ADMIN)
