from django.contrib import admin

from .models import Company, CompanyMember, StaffInvitation


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("name", "industry", "status", "created_at")
    list_filter = ("status", "company_size")
    search_fields = ("name", "official_email")
    readonly_fields = ("id", "slug", "reviewed_by", "reviewed_at", "created_by", "created_at", "updated_at")


@admin.register(CompanyMember)
class CompanyMemberAdmin(admin.ModelAdmin):
    list_display = ("user", "company", "role", "is_active", "joined_at")
    list_filter = ("role", "is_active")
    search_fields = ("user__email", "company__name")
    raw_id_fields = ("user", "company", "invited_by")


@admin.register(StaffInvitation)
class StaffInvitationAdmin(admin.ModelAdmin):
    list_display = ("email", "company", "role", "status", "expires_at")
    list_filter = ("status", "role")
    search_fields = ("email", "company__name")
    readonly_fields = ("id", "token_hash", "created_at", "accepted_at")
    raw_id_fields = ("company", "invited_by")
