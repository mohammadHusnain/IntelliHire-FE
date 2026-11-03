from rest_framework import serializers

from ..models import ApplicationField, FieldType
from ..services.rules import field_definition_problems

MAX_OPTION_LENGTH = 100
MAX_TEXT_LENGTH = 5000


class ApplicationFieldSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApplicationField
        fields = ["id", "label", "key", "field_type", "required", "options", "help_text", "max_length", "order"]
        read_only_fields = fields


class ApplicationFieldWriteSerializer(serializers.Serializer):
    label = serializers.CharField(max_length=150)
    field_type = serializers.ChoiceField(choices=FieldType.choices)
    required = serializers.BooleanField(required=False)
    options = serializers.ListField(child=serializers.CharField(max_length=MAX_OPTION_LENGTH), required=False)
    help_text = serializers.CharField(max_length=500, required=False, allow_blank=True)
    max_length = serializers.IntegerField(min_value=1, max_value=MAX_TEXT_LENGTH, required=False, allow_null=True)

    def validate_options(self, value):
        options = [option.strip() for option in value]
        if any(not option for option in options):
            raise serializers.ValidationError("Options cannot be empty.")
        return options

    def validate(self, attrs):
        current = self.instance
        field_type = attrs.get("field_type", getattr(current, "field_type", None))
        options = attrs.get("options", list(getattr(current, "options", [])))
        max_length = attrs.get("max_length", getattr(current, "max_length", None))
        problems = field_definition_problems(field_type, options, max_length)
        if problems:
            raise serializers.ValidationError(problems)
        return attrs


class ReorderSerializer(serializers.Serializer):
    field_ids = serializers.ListField(child=serializers.IntegerField())
