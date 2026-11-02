from django.contrib import admin

from .models import CandidateProfile, Education, Experience, User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("email", "full_name", "role", "status", "email_verified", "date_joined")
    list_filter = ("role", "status", "email_verified")
    search_fields = ("email", "full_name")
    ordering = ("-date_joined",)
    readonly_fields = ("id", "password", "last_login", "date_joined")
    exclude = ("groups", "user_permissions")

    def has_add_permission(self, request):
        return False


class EducationInline(admin.TabularInline):
    model = Education
    extra = 0


class ExperienceInline(admin.TabularInline):
    model = Experience
    extra = 0


@admin.register(CandidateProfile)
class CandidateProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "location", "updated_at")
    search_fields = ("user__email", "user__full_name")
    raw_id_fields = ("user",)
    exclude = ("resume_text",)
    inlines = [EducationInline, ExperienceInline]
