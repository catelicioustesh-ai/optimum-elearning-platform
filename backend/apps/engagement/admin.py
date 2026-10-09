from django.contrib import admin

from .models import Achievement


@admin.register(Achievement)
class AchievementAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "category", "metric", "threshold", "active")
    list_filter = ("active", "category", "metric")
    search_fields = ("name", "code", "description")
    ordering = ("category", "threshold", "name")
