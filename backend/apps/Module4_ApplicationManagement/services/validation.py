"""Validation of one submission against the job's form (built-in fields, then custom fields).

Every problem is collected and returned together, keyed by field key, so the form can mark
all invalid inputs at once (FR-30). Messages name the field: "Email is required.".
"""

import math
from datetime import date
from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator, validate_email
from django.utils import timezone

from apps.Module1_Authentication.validators import normalize_email
from apps.Module3_JobPosting.builtin_fields import BUILT_IN_FIELDS
from apps.Module3_JobPosting.models import EducationLevel, FieldType
from apps.common.validators import validate_cv_file, validate_phone

EARLIEST_GRADUATION_YEAR = 1970
GRADUATION_YEARS_AHEAD = 6
SHORT_TEXT_LIMIT = 255
LONG_TEXT_LIMIT = 5000
_URL_VALIDATOR = URLValidator(schemes=["http", "https"])
_BUILT_IN = {field["key"]: field for field in BUILT_IN_FIELDS}


def _required(label):
    return f"{label} is required."


def _first_message(error):
    return error.messages[0]


def _text(data, key):
    value = data.get(key)
    return value.strip() if isinstance(value, str) else ""


def _check_file(upload, label, errors, key):
    try:
        validate_cv_file(upload)
    except DjangoValidationError as exc:
        errors.setdefault(key, []).append(_first_message(exc))
        return False
    return True


def validate_built_in(data, files, errors):
    """Returns the cleaned built-in values (only those that passed)."""
    cleaned = {}

    def fail(key, message):
        errors.setdefault(key, []).append(message)

    name = _text(data, "full_name")
    if not name:
        fail("full_name", _required(_BUILT_IN["full_name"]["label"]))
    elif len(name) > 150:
        fail("full_name", "Full name must be 150 characters or fewer.")
    else:
        cleaned["full_name"] = name

    email = normalize_email(_text(data, "email"))
    if not email:
        fail("email", _required(_BUILT_IN["email"]["label"]))
    else:
        try:
            if len(email) > 254:
                raise DjangoValidationError("too long")
            validate_email(email)
            cleaned["email"] = email
        except DjangoValidationError:
            fail("email", "Enter a valid email address.")

    phone = _text(data, "phone")
    if not phone:
        fail("phone", _required(_BUILT_IN["phone"]["label"]))
    else:
        try:
            if len(phone) > 20:
                raise DjangoValidationError("Enter a valid phone number.")
            validate_phone(phone)
            cleaned["phone"] = phone
        except DjangoValidationError as exc:
            fail("phone", _first_message(exc))

    level = _text(data, "education_level")
    if not level:
        fail("education_level", _required(_BUILT_IN["education_level"]["label"]))
    elif level not in EducationLevel.values:
        fail("education_level", "Select a valid education level.")
    else:
        cleaned["education_level"] = level

    institution = _text(data, "institution")
    if not institution:
        fail("institution", _required(_BUILT_IN["institution"]["label"]))
    elif len(institution) > 200:
        fail("institution", "Institution must be 200 characters or fewer.")
    else:
        cleaned["institution"] = institution

    year_text = _text(data, "graduation_year")
    latest = timezone.now().year + GRADUATION_YEARS_AHEAD
    if not year_text:
        fail("graduation_year", _required(_BUILT_IN["graduation_year"]["label"]))
    else:
        try:
            year = int(year_text)
        except ValueError:
            year = None
        if year is None or not EARLIEST_GRADUATION_YEAR <= year <= latest:
            fail("graduation_year", f"Enter a graduation year between {EARLIEST_GRADUATION_YEAR} and {latest}.")
        else:
            cleaned["graduation_year"] = year

    cv = files.get("resume")
    if cv is None:
        fail("resume", _required(_BUILT_IN["resume"]["label"]))
    elif _check_file(cv, "CV", errors, "resume"):
        cleaned["resume"] = cv
    return cleaned


def _number(text):
    try:
        value = Decimal(text)
    except InvalidOperation:
        return None
    if not value.is_finite():
        return None
    if value == value.to_integral_value():
        return int(value)
    number = float(value)
    return number if math.isfinite(number) else None


def validate_custom(fields, data, files, errors):
    """Returns (answers, file_answers). Unknown submitted keys are ignored."""
    answers, uploads = {}, {}
    for field in fields:
        key, label = field.key, field.label
        kind = field.field_type

        def fail(message, key=key):
            errors.setdefault(key, []).append(message)

        if kind == FieldType.FILE:
            upload = files.get(key)
            if upload is None:
                if field.required:
                    fail(_required(label))
            elif _check_file(upload, label, errors, key):
                uploads[key] = upload
            continue

        if kind == FieldType.MULTIPLE_CHOICE:
            chosen = []
            for value in data.getlist(key):
                value = value.strip() if isinstance(value, str) else ""
                if value and value not in chosen:
                    chosen.append(value)
            if not chosen:
                if field.required:
                    fail(_required(label))
            elif not set(chosen) <= set(field.options):
                fail(f"Select valid options for {label}.")
            else:
                answers[key] = chosen
            continue

        text = _text(data, key)
        if not text:
            if field.required:
                fail(_required(label))
            continue
        if kind in (FieldType.SHORT_TEXT, FieldType.LONG_TEXT):
            limit = field.max_length or (SHORT_TEXT_LIMIT if kind == FieldType.SHORT_TEXT else LONG_TEXT_LIMIT)
            if len(text) > limit:
                fail(f"{label} must be {limit} characters or fewer.")
            else:
                answers[key] = text
        elif kind == FieldType.NUMBER:
            number = _number(text)
            if number is None:
                fail(f"{label} must be a number.")
            else:
                answers[key] = number
        elif kind == FieldType.EMAIL:
            try:
                validate_email(text)
                answers[key] = text.lower()
            except DjangoValidationError:
                fail(f"{label} must be a valid email address.")
        elif kind == FieldType.URL:
            try:
                _URL_VALIDATOR(text)
                answers[key] = text
            except DjangoValidationError:
                fail(f"{label} must be a valid URL starting with http:// or https://.")
        elif kind == FieldType.DATE:
            try:
                answers[key] = date.fromisoformat(text).isoformat()
            except ValueError:
                fail(f"{label} must be a date in YYYY-MM-DD format.")
        elif kind == FieldType.SINGLE_CHOICE:
            if text not in field.options:
                fail(f"Select a valid option for {label}.")
            else:
                answers[key] = text
    return answers, uploads
