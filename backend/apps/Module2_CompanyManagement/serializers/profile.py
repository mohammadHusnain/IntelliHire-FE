from rest_framework import serializers

from apps.common.validators import validate_phone, validate_profile_image

from ..models import Company, CompanySize
from ..services.profile import profile_completion

NAME_TAKEN = "A company with this name is already registered."


class CompanyProfileSerializer(serializers.ModelSerializer):
    logo = serializers.ImageField(required=False, allow_null=True, validators=[validate_profile_image])
    contact_phone = serializers.CharField(max_length=20, validators=[validate_phone])
    description = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    company_size = serializers.ChoiceField(choices=CompanySize.choices, required=False, allow_blank=True)
    profile_completion = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = [
            "id",
            "name",
            "slug",
            "industry",
            "official_email",
            "contact_phone",
            "website",
            "description",
            "headquarters",
            "logo",
            "company_size",
            "status",
            "profile_completion",
            "created_at",
        ]
        read_only_fields = ["id", "slug", "official_email", "status", "created_at"]

    def get_profile_completion(self, company) -> int:
        return profile_completion(company)

    def validate_name(self, value):
        value = value.strip()
        if Company.objects.filter(name__iexact=value).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError(NAME_TAKEN)
        return value
