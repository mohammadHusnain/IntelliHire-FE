"""The question bank: the seed, and the picker that works without any LLM."""
import pytest

from ..models import InterviewQuestionBank
from ..rubrics import SCREENING_AREAS
from ..services import bank
from ..services.bank import NoQuestionAvailable, category_for

pytestmark = pytest.mark.django_db


class Asked:
    def __init__(self, text):
        self.question_text = text


def test_the_seed_covers_every_kind():
    def general(kind):
        return InterviewQuestionBank.objects.filter(kind=kind, role_category="").count()

    assert 15 <= general("screening") <= 20 and 15 <= general("mock") <= 20
    assert InterviewQuestionBank.objects.filter(kind="technical").count() == 20
    for area in SCREENING_AREAS:
        assert InterviewQuestionBank.objects.filter(kind="screening", role_category="", competency=area).count() >= 5
    for category in ("software_engineer", "data_analyst", "product_manager"):
        assert InterviewQuestionBank.objects.filter(kind="screening", role_category=category).exists()
    skills = {s for q in InterviewQuestionBank.objects.filter(kind="technical") for s in q.skills}
    assert {"Python", "Django", "React", "SQL"} <= skills


@pytest.mark.parametrize(
    "title, category",
    [
        ("Backend Developer", "software_engineer"), ("Senior Software Engineer", "software_engineer"), ("Data Analyst", "data_analyst"),
        ("Data Engineer", "data_analyst"), ("Product Manager", "product_manager"), ("Office Manager", ""), ("", ""),
    ],
)  # fmt: skip
def test_role_categories(title, category):
    assert category_for(title) == category


def test_screening_questions_rotate_through_the_three_areas(session):
    session.role_title = "Office Manager"
    seen, turns = [], []
    for _ in range(3):
        question = bank.pick(session, turns)
        seen.append(question["competency"])
        turns.append(Asked(question["question_text"]))
    assert seen == list(SCREENING_AREAS)


def test_a_role_specific_question_comes_before_a_general_one(session):
    session.role_title = "Backend Developer"
    specific = set(InterviewQuestionBank.objects.filter(role_category="software_engineer", kind="screening").values_list("text", flat=True))
    assert bank.pick(session, [], {"focus_area": "experience"})["question_text"] in specific


def test_no_question_is_ever_repeated_and_the_bank_eventually_runs_out(session):
    session.role_title = "Office Manager"
    asked = []
    total = InterviewQuestionBank.objects.filter(kind="screening", role_category="").count()
    for _ in range(total):
        question = bank.pick(session, [Asked(t) for t in asked])
        assert question["question_text"] not in asked
        asked.append(question["question_text"])
    with pytest.raises(NoQuestionAvailable):
        bank.pick(session, [Asked(t) for t in asked])


def test_technical_questions_prefer_the_jobs_skills(session):
    session.kind, session.context = "technical", {"required_skills": ["React"]}
    for _ in range(10):
        picked = InterviewQuestionBank.objects.get(pk=bank.pick(session, [])["bank_id"])
        assert "React" in picked.skills


def test_avoid_topics_are_honoured_when_possible(session):
    assert bank.pick(session, [], {"focus_area": "interest", "avoid_topics": ["interest"]})["competency"] != "interest"


def test_inactive_questions_are_never_picked(session):
    InterviewQuestionBank.objects.filter(kind="screening").update(is_active=False)
    with pytest.raises(NoQuestionAvailable):
        bank.pick(session, [])
