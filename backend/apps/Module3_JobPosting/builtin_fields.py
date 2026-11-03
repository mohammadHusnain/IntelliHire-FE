"""The fixed first part of every application form (Doc §3.1, FR-24, FR-29).

Defined once here. The form-schema endpoints use it to describe the form, and the
submission validator in Module 4 must use the same list, so the form HR previews is the
form candidates fill in.
"""

from .models import EducationLevel, FieldType

BUILT_IN_FIELDS = (
    {
        "key": "full_name",
        "label": "Full name",
        "type": FieldType.SHORT_TEXT.value,
        "required": True,
        "options": [],
        "help_text": "",
        "max_length": 150,
    },
    {
        "key": "email",
        "label": "Email",
        "type": FieldType.EMAIL.value,
        "required": True,
        "options": [],
        "help_text": "",
        "max_length": 254,
    },
    {
        "key": "phone",
        "label": "Phone number",
        "type": FieldType.SHORT_TEXT.value,
        "required": True,
        "options": [],
        "help_text": "Digits, spaces, + and - only.",
        "max_length": 20,
    },
    {
        "key": "education_level",
        "label": "Highest education level",
        "type": FieldType.SINGLE_CHOICE.value,
        "required": True,
        "options": list(EducationLevel.values),
        "help_text": "",
        "max_length": None,
    },
    {
        "key": "institution",
        "label": "Institution",
        "type": FieldType.SHORT_TEXT.value,
        "required": True,
        "options": [],
        "help_text": "",
        "max_length": 200,
    },
    {
        "key": "graduation_year",
        "label": "Graduation year",
        "type": FieldType.NUMBER.value,
        "required": True,
        "options": [],
        "help_text": "",
        "max_length": None,
    },
    {
        "key": "resume",
        "label": "CV",
        "type": FieldType.FILE.value,
        "required": True,
        "options": [],
        "help_text": "PDF or DOCX, 5 MB or smaller.",
        "max_length": None,
    },
)

BUILT_IN_KEYS = frozenset(field["key"] for field in BUILT_IN_FIELDS)

# Display names for the options of built-in choice fields (custom choice options are their own labels).
BUILT_IN_OPTION_LABELS = {"education_level": dict(EducationLevel.choices)}
