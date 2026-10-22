from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils import timezone
from .models import AccountAuditEvent, EmailVerificationMethod, User


@admin.register(User)
class UserAdminConfig(UserAdmin):
    readonly_fields = UserAdmin.readonly_fields + (
        "email_verification_method",
        "email_verified_at",
        "email_verified_by",
    )
    fieldsets = UserAdmin.fieldsets + (
        ("Platform access", {"fields": (
            "role",
            "email_verified",
            "email_verification_method",
            "email_verified_at",
            "email_verified_by",
        )}),
        ("Student profile", {"fields": ("bio", "profile_photo", "leaderboard_opt_in")}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ("Platform access", {"fields": ("role", "email_verified")}),
    )

    def save_model(self, request, obj, form, change):
        previous_value = None
        if change:
            previous_value = User.objects.values_list(
                "email_verified", flat=True
            ).get(pk=obj.pk)

        if obj.email_verified and previous_value is not True:
            obj.email_verification_method = EmailVerificationMethod.ADMIN
            obj.email_verified_at = timezone.now()
            obj.email_verified_by = request.user
        elif not obj.email_verified and previous_value is True:
            obj.email_verification_method = ""
            obj.email_verified_at = None
            obj.email_verified_by = None

        super().save_model(request, obj, form, change)

        verification_changed = (
            obj.email_verified
            if previous_value is None
            else obj.email_verified != previous_value
        )
        if verification_changed:
            action = (
                AccountAuditEvent.Action.EMAIL_ADMIN_VERIFIED
                if obj.email_verified
                else AccountAuditEvent.Action.EMAIL_ADMIN_REVOKED
            )
            AccountAuditEvent.objects.create(
                actor=request.user,
                target=obj,
                action=action,
            )


@admin.register(AccountAuditEvent)
class AccountAuditEventAdmin(admin.ModelAdmin):
    list_display = ("action", "target", "actor", "created_at")
    list_filter = ("action", "created_at")
    search_fields = ("target__email", "target__username", "actor__email")
    readonly_fields = ("actor", "target", "action", "created_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
