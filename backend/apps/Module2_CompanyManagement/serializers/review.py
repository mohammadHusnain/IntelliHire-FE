from rest_framework import serializers

from ..models import Company

MIN_REASON_LENGTH = 10


class ReviewAdminSerializer(serializers.Serializer):
    id = serializers.UUIDField(source="pk")
    full_name = serializers.CharField()
    email = serializers.EmailField()
    email_verified = serializers.BooleanField()
    status = serializers.CharField()
    date_joined = serializers.DateTimeField()


class CompanyReviewListSerializer(serializers.ModelSerializer):
    admin = ReviewAdminSerializer(source="created_by", read_only=True)

    class Meta:
        model = Company
        fields = ["id", "name", "industry", "official_email", "contact_phone", "status", "created_at", "admin"]
        read_only_fields = fields


class CompanyReviewDetailSerializer(CompanyReviewListSerializer):
    reviewed_by = serializers.SerializerMethodField()

    class Meta(CompanyReviewListSerializer.Meta):
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
            "rejection_reason",
            "suspension_reason",
            "reviewed_by",
            "reviewed_at",
            "created_at",
            "admin",
        ]
        read_only_fields = fields

    def get_reviewed_by(self, company) -> str | None:
        return company.reviewed_by.email if company.reviewed_by else None


class ReasonSerializer(serializers.Serializer):
    reason = serializers.CharField(trim_whitespace=True, max_length=2000)

    def validate_reason(self, value):
        if len(value) < MIN_REASON_LENGTH:
            raise serializers.ValidationError(f"Reason must be at least {MIN_REASON_LENGTH} characters.")
        return value


class CompanyListQuerySerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[*Company.Status.values, "all"], required=False, default="pending")
    search = serializers.CharField(required=False, allow_blank=True, default="", max_length=200)
