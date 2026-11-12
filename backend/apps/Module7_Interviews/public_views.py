"""Candidate-side endpoints: no account, the private token in the path is the only credential."""
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.parsers import JSONParser
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.common.parsers import LimitedMultiPartParser
from apps.Module1_Authentication.views import PublicAPIView
from apps.Module5_Foundation.serializers import ErrorSerializer

from .serializers import AnswerSerializer, PublicProgressSerializer, PublicSummarySerializer
from .services import engine
from .throttles import LinkRateThrottle

GONE = OpenApiResponse(
    ErrorSerializer,
    description=(
        "The link can no longer be used. Codes: `interview_expired` (message names the company), `interview_completed`, "
        "`interview_cancelled`, `interview_unavailable` (company suspended)."
    ),
)
NOT_FOUND = OpenApiResponse(ErrorSerializer, description="Unknown link.")
TOO_MANY = OpenApiResponse(ErrorSerializer, description="Too many requests for this link.")
NO_QUESTION = OpenApiResponse(
    ErrorSerializer, description="No question could be made right now (`no_question_available`). Sent with `Retry-After`; try again."
)
TOKEN_NOTE = "The token in the path is the whole credential: keep it out of logs, analytics and referrers."


class _LinkView(PublicAPIView):
    throttle_classes = [LinkRateThrottle]
    throttle_scope = "interview_answer"

    def session(self, token):
        return engine.session_for_token(token)


class PublicInterviewView(_LinkView):
    serializer_class = PublicSummarySerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "interview_open"

    @extend_schema(
        summary="Open an interview link",
        description=f"Company, role, kind, instructions, question count, time left to start, status and how many questions are answered, so the page can resume. {TOKEN_NOTE}",
        responses={200: PublicSummarySerializer, 404: NOT_FOUND, 410: GONE, 429: TOO_MANY},
    )
    def get(self, request, token):
        session = self.session(token)
        engine.ensure_available(session)
        return Response(engine.public_summary(session))


class PublicInterviewStartView(_LinkView):
    serializer_class = PublicProgressSerializer
    throttle_scope = "interview_start"

    @extend_schema(
        summary="Start the interview, or resume it",
        description="Returns the first question, or the question still waiting for an answer after a break. Safe to call again after a refresh.",
        request=None,
        responses={200: PublicProgressSerializer, 404: NOT_FOUND, 410: GONE, 429: TOO_MANY, 503: NO_QUESTION},
    )
    def post(self, request, token):
        return Response(engine.start(self.session(token)))


class PublicInterviewAnswerView(_LinkView):
    serializer_class = AnswerSerializer
    parser_classes = [JSONParser, LimitedMultiPartParser]
    throttle_scope = "interview_answer"

    @extend_schema(
        summary="Answer the current question",
        description=(
            "Send `turn_index` and either `answer_text` (JSON) or an `audio` file (multipart). Answering the same question "
            "twice returns the stored result instead of saving twice, so a double click or a second tab is harmless. The "
            "answer is saved before it is scored. Returns the next question, or `done: true` after the last answer."
        ),
        request={"application/json": AnswerSerializer, "multipart/form-data": AnswerSerializer},
        responses={
            200: PublicProgressSerializer,
            400: OpenApiResponse(description="Empty or too long answer: {field: [message]}."),
            404: NOT_FOUND,
            409: OpenApiResponse(ErrorSerializer, description="Not the current question (`wrong_turn`), or not started (`not_started`)."),
            410: GONE,
            422: OpenApiResponse(ErrorSerializer, description="Voice is not available yet (`voice_not_available`), or the recording could not be read (`transcription_failed`, `audio_too_long`). Ask the candidate to type."),
            429: TOO_MANY, 503: NO_QUESTION,
        },  # fmt: skip
    )
    def post(self, request, token):
        data = AnswerSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        values = data.validated_data
        return Response(engine.answer(self.session(token), values["turn_index"], values.get("answer_text"), values.get("audio")))


class PublicInterviewFinishView(_LinkView):
    serializer_class = PublicProgressSerializer
    throttle_scope = "interview_answer"

    @extend_schema(
        summary="Finish early",
        description="Allowed after at least 3 answers. The interview is then evaluated with the answers given. Safe to call twice.",
        request=None,
        responses={200: PublicProgressSerializer, 400: OpenApiResponse(ErrorSerializer, description="Too few answers (`too_few_answers`)."), 404: NOT_FOUND, 410: GONE, 429: TOO_MANY},
    )
    def post(self, request, token):
        return Response(engine.finish_early(self.session(token)))
