import json
import string

import jsonschema
from django.db import IntegrityError, transaction
from django.utils import timezone

from ..models import PromptTemplate
from .errors import PromptError

TRUNCATED = "…[truncated]"
PUBLISH_ATTEMPTS = 3


def active_template(key):
    template = PromptTemplate.objects.filter(key=key, is_active=True).first()
    if template is None:
        raise PromptError(f"No active prompt template named {key!r}.")
    return template


def _check_text(text):
    """Placeholders must be plain names: no attributes, indexes, numbers, conversions or format specs.

    Anything else would let a prompt read attributes of the values it is given.
    """
    try:
        parsed = list(string.Formatter().parse(text))
    except ValueError as exc:
        raise PromptError(f"The prompt text is malformed: {exc}.") from exc
    for _, name, spec, conversion in parsed:
        if name is None:
            continue
        if not name.isidentifier() or spec or conversion:
            raise PromptError(f"Placeholders must be plain names like {{answer}}; found {{{name}{'!' + conversion if conversion else ''}{':' + spec if spec else ''}}}.")


def _text(value, limit):
    text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, default=str)
    return text if len(text) <= limit else text[: max(limit - len(TRUNCATED), 0)] + TRUNCATED


def render(template, variables, max_chars):
    """Fill the template. The variables must match its placeholders exactly; long values are cut to `max_chars`."""
    _check_text(template.system_text)
    _check_text(template.user_text)
    needed = template.placeholders()
    given = set(variables)
    if needed - given:
        raise PromptError(f"Prompt {template.key!r} is missing values for: {sorted(needed - given)}.")
    if given - needed:
        raise PromptError(f"Prompt {template.key!r} has no placeholder for: {sorted(given - needed)}.")
    values = {name: _text(variables[name], max_chars) for name in needed}
    return template.system_text.format_map(values), template.user_text.format_map(values)


def wrap_untrusted(label, text):
    """Fence off text written by a candidate or taken from a CV so the model treats it as data, never instructions.

    A fence marker inside the text is defused so it cannot close the block early.
    """
    label = "".join(ch for ch in label.upper() if ch.isalnum() or ch == "_") or "DATA"
    opening, closing = f"<<<{label}", f"{label}>>>"
    body = (text or "").replace(opening, "<<").replace(closing, ">>")
    return f"{opening}\n{body}\n{closing}"


def publish_template(*, key, system_text, user_text, output_schema, user=None, model_role="chat"):
    """Save a new version and make it the active one. Old versions are never edited."""
    try:
        jsonschema.Draft202012Validator.check_schema(output_schema or {})
    except jsonschema.SchemaError as exc:
        raise PromptError(f"The output schema is not a valid JSON Schema: {exc.message}") from exc
    _check_text(system_text)
    _check_text(user_text)
    names = PromptTemplate(key=key, system_text=system_text, user_text=user_text).placeholders()
    for attempt in range(PUBLISH_ATTEMPTS):
        try:
            with transaction.atomic():
                versions = list(PromptTemplate.objects.select_for_update().filter(key=key))
                previous = next((v for v in versions if v.is_active), None)
                if previous is not None and previous.placeholders() - names:
                    raise PromptError(
                        f"The new version drops placeholders the current one uses: {sorted(previous.placeholders() - names)}."
                    )
                PromptTemplate.objects.filter(key=key, is_active=True).update(is_active=False)
                return PromptTemplate.objects.create(
                    key=key,
                    version=max((v.version for v in versions), default=0) + 1,
                    model_role=model_role,
                    system_text=system_text,
                    user_text=user_text,
                    output_schema=output_schema or {},
                    is_active=True,
                    created_by=user,
                    created_at=timezone.now(),
                )
        except IntegrityError:
            if attempt == PUBLISH_ATTEMPTS - 1:
                raise
    raise AssertionError("unreachable")


def rollback_template(*, key, version, user=None):
    """Make an earlier version current again by saving a copy of it as the newest version."""
    old = PromptTemplate.objects.filter(key=key, version=version).first()
    if old is None:
        raise PromptError(f"Prompt {key!r} has no version {version}.")
    return publish_template(
        key=key, system_text=old.system_text, user_text=old.user_text, output_schema=old.output_schema,
        user=user, model_role=old.model_role,
    )  # fmt: skip
