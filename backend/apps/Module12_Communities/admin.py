from django.contrib import admin

from .models import Community, CommunityPost


@admin.register(Community)
class CommunityAdmin(admin.ModelAdmin):
    list_display = ("name", "company", "join_mode", "status", "member_count")
    list_filter = ("status", "join_mode")
    search_fields = ("name",)
    readonly_fields = ("member_count",)


@admin.register(CommunityPost)
class CommunityPostAdmin(admin.ModelAdmin):
    list_display = ("title", "community", "kind", "status", "created_at")
