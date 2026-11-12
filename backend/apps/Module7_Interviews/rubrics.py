"""Rubrics and the JSON Schemas every hook result is checked against. Plain data; no model is called here."""

# Criteria are scored 0 to 10 per answer. The overall score is the average of the answer scores times 10.
RUBRICS = {
    "screening": ("role_alignment", "communication_clarity", "answer_relevance", "motivation_interest"),
    "technical": ("technical_accuracy", "depth_of_understanding", "problem_solving"),
    "mock": ("communication", "confidence", "technical_relevance", "structure"),
}
# The three areas a screening interview moves through (UC-08 step 3), and the mock interview's four dimensions.
SCREENING_AREAS = ("interest", "familiarity", "experience")
MOCK_AREAS = ("communication", "confidence", "technical_relevance", "structure")
FOCUS_AREAS = {"screening": SCREENING_AREAS, "mock": MOCK_AREAS}

DIFFICULTIES = ("easy", "medium", "hard")
TECHNICAL_RELEVANCE = ("strong", "adequate", "weak")

_TEXT = {"type": "string", "minLength": 1, "maxLength": 2000}
_SHORT = {"type": "string", "minLength": 1, "maxLength": 200}
_SCORE = {"type": "number", "minimum": 0, "maximum": 10}

NEXT_QUESTION_SCHEMA = {
    "type": "object",
    "required": ["question_text", "competency", "topic", "difficulty", "is_follow_up"],
    "properties": {
        "question_text": {"type": "string", "minLength": 5, "maxLength": 1000},
        "competency": _SHORT,
        "topic": _SHORT,
        "difficulty": {"enum": list(DIFFICULTIES)},
        "is_follow_up": {"type": "boolean"},
    },
}

TRANSCRIBE_SCHEMA = {
    "type": "object",
    "required": ["text", "duration_seconds"],
    "properties": {"text": {"type": "string", "maxLength": 20000}, "duration_seconds": {"type": "number", "minimum": 0}},
}


def evaluate_answer_schema(kind):
    return {
        "type": "object",
        "required": ["score", "criteria", "feedback", "flags"],
        "properties": {
            "score": _SCORE,
            "criteria": {
                "type": "object",
                "properties": {name: _SCORE for name in RUBRICS[kind]},
                "additionalProperties": False,
            },
            "feedback": {"type": "string", "maxLength": 600},
            "flags": {"type": "array", "maxItems": 10, "items": {"type": "string", "pattern": "^[a-z][a-z_]{0,39}$"}},
        },
    }


def evaluate_session_schema(kind):
    properties = {
        "summary": {"type": "string", "maxLength": 3000},
        "strengths": {"type": "array", "maxItems": 10, "items": _TEXT},
        "weaknesses": {"type": "array", "maxItems": 10, "items": _TEXT},
    }
    required = ["summary", "strengths", "weaknesses"]
    if kind == "mock":
        properties["suggestions"] = {"type": "array", "maxItems": 10, "items": _TEXT}
        properties["dimension_comments"] = {
            "type": "object", "properties": {name: _TEXT for name in RUBRICS["mock"]}, "additionalProperties": False,
        }  # fmt: skip
        required += ["suggestions", "dimension_comments"]
    else:
        properties["per_question"] = {
            "type": "array", "maxItems": 50,
            "items": {
                "type": "object", "required": ["index", "comment"],
                "properties": {"index": {"type": "integer", "minimum": 1}, "comment": _TEXT},
            },
        }  # fmt: skip
        required.append("per_question")
        if kind == "technical":
            properties["technical_relevance"] = {"enum": list(TECHNICAL_RELEVANCE)}
            required.append("technical_relevance")
    return {"type": "object", "required": required, "properties": properties}
