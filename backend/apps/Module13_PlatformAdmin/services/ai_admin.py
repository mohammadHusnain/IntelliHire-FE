"""AI settings and prompt versions (UC-13). Every change is audited with the old and new values; keys stay in the environment."""
from django.core.exceptions import ValidationError
from django.db import transaction
from rest_framework import serializers
from rest_framework.exceptions import NotFound

from apps.common.errors import ApiError
from apps.Module5_Foundation.ai.config import clear_config_cache
from apps.Module5_Foundation.events import log_event
from apps.Module5_Foundation.models import AISettings, PromptTemplate

FIELDS = (
    "provider", "chat_model", "eval_model", "embed_model", "stt_model", "fallback_provider", "fallback_chat_model",
    "temperature_questions", "temperature_evaluation", "max_tokens", "timeout_seconds", "screening_min_score",
    "screening_questions", "technical_questions", "mock_questions",
)  # fmt: skip


def settings_row():
    return AISettings.objects.filter(pk=1).first() or AISettings(pk=1)


def save_settings(admin, data):
    """Validate against the allowed-model list and the model's own rules, then save and audit the difference."""
    row = settings_row()
    before = {field: getattr(row, field) for field in FIELDS}
    for field, value in data.items():
        setattr(row, field, value)
    try:
        row.full_clean()
    except ValidationError as exc:
        raise serializers.ValidationError(exc.message_dict) from None
    with transaction.atomic():
        row.updated_by = admin
        row.save()
    clear_config_cache()
    after = {field: getattr(row, field) for field in FIELDS}
    changed = {field: {"from": before[field], "to": after[field]} for field in FIELDS if before[field] != after[field]}
    if changed:
        log_event("ai.settings_changed", actor=admin, summary="AI settings changed", metadata={"changed": changed})
    return row


def prompt_keys():
    rows = {}
    for template in PromptTemplate.objects.all().order_by("key", "-version"):
        entry = rows.setdefault(template.key, {"key": template.key, "versions": 0, "active_version": None, "model_role": template.model_role, "updated_at": template.created_at})
        entry["versions"] += 1
        if template.is_active:
            entry["active_version"] = template.version
        entry["updated_at"] = max(entry["updated_at"], template.created_at)
    return list(rows.values())


def versions_of(key):
    rows = list(PromptTemplate.objects.filter(key=key).order_by("-version"))
    if not rows:
        raise NotFound("Prompt not found.")
    return rows


def save_version(key, admin, data):
    """Store a new version and make it the active one. It must keep every placeholder the active version used."""
    current = PromptTemplate.objects.filter(key=key).order_by("-version").first()
    if current is None:
        raise NotFound("Prompt not found.")
    active = PromptTemplate.objects.filter(key=key, is_active=True).first() or current
    draft = PromptTemplate(
        key=key, version=current.version + 1, model_role=data.get("model_role", active.model_role),
        system_text=data["system_text"], user_text=data["user_text"], output_schema=data.get("output_schema", active.output_schema),
        created_by=admin, is_active=True,
    )  # fmt: skip
    missing = sorted(active.placeholders() - draft.placeholders())
    if missing:
        raise serializers.ValidationError({"user_text": [f"Keep every placeholder the active version used. Missing: {', '.join('{' + m + '}' for m in missing)}."]})
    _validate_schema(draft.output_schema)
    with transaction.atomic():
        PromptTemplate.objects.filter(key=key, is_active=True).update(is_active=False)
        draft.save()
        log_event("ai.settings_changed", actor=admin, summary=f"Prompt {key} saved as version {draft.version}", metadata={"key": key, "version": draft.version})
    return draft


def _validate_schema(schema):
    import jsonschema

    if not isinstance(schema, dict) or not schema:
        raise serializers.ValidationError({"output_schema": ["Give the JSON Schema the answer must match."]})
    try:
        jsonschema.Draft202012Validator.check_schema(schema)
    except jsonschema.SchemaError as exc:
        raise serializers.ValidationError({"output_schema": [f"This is not a valid JSON Schema: {exc.message[:200]}"]}) from None


def rollback(key, admin, version):
    """Make an earlier version active again. The history keeps every version and says which one is live."""
    target = PromptTemplate.objects.filter(key=key, version=version).first()
    if target is None:
        raise NotFound("Prompt version not found.")
    if target.is_active:
        raise ApiError("That version is already active.", "already_active", 409)
    with transaction.atomic():
        PromptTemplate.objects.filter(key=key, is_active=True).update(is_active=False)
        PromptTemplate.objects.filter(pk=target.pk).update(is_active=True)
        log_event("ai.settings_changed", actor=admin, summary=f"Prompt {key} rolled back to version {version}", metadata={"key": key, "version": version, "rollback": True})
    target.refresh_from_db()
    return target
