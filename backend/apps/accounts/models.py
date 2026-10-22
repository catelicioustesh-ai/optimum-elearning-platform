from django.contrib.auth.models import AbstractUser, UserManager as DjangoUserManager
from django.db import models
from django.utils import timezone


class Role(models.TextChoices):
    STUDENT = "student", "Student"
    INSTRUCTOR = "instructor", "Instructor"
    ADMIN = "admin", "Admin"


class EmailVerificationMethod(models.TextChoices):
    SELF = "self_verified", "User verified"
    PROVIDER = "provider_verified", "Identity provider verified"
    ADMIN = "admin_verified", "Administrator verified"
    OPERATOR = "operator_override", "Operator override"
    LEGACY = "legacy", "Legacy verification"


class UserManager(DjangoUserManager):
    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields["role"] = Role.ADMIN
        extra_fields.setdefault("email_verified", True)
        extra_fields.setdefault("email_verification_method", EmailVerificationMethod.OPERATOR)
        extra_fields.setdefault("email_verified_at", timezone.now())
        return super().create_superuser(username, email, password, **extra_fields)


class User(AbstractUser):
    """
    Extends Django's built-in user with a role.
    email is used as the login identifier instead of username.
    """
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.STUDENT)
    is_approved = models.BooleanField(default=True)
    email = models.EmailField(unique=True)
    email_verified = models.BooleanField(default=False)
    email_verification_method = models.CharField(
        max_length=24,
        choices=EmailVerificationMethod.choices,
        blank=True,
        default="",
    )
    email_verified_at = models.DateTimeField(blank=True, null=True)
    email_verified_by = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        related_name="email_verified_accounts",
        blank=True,
        null=True,
    )
    bio = models.CharField(max_length=500, blank=True)
    profile_photo = models.ImageField(upload_to="profile_photos/", blank=True, null=True)
    leaderboard_opt_in = models.BooleanField(default=False)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]
    objects = UserManager()

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.role})"

    def save(self, *args, **kwargs):
        self.email = self.email.strip().lower()
        update_fields = kwargs.get("update_fields")
        email_is_being_saved = update_fields is None or "email" in update_fields
        if self.pk and email_is_being_saved:
            previous_email = (
                type(self).objects.filter(pk=self.pk).values_list("email", flat=True).first()
            )
            if (
                previous_email
                and previous_email.strip().lower() != self.email
                and self.email_verified
            ):
                self.email_verified = False
                self.email_verification_method = ""
                self.email_verified_at = None
                self.email_verified_by = None
                if update_fields is not None:
                    kwargs["update_fields"] = set(update_fields) | {
                        "email_verified",
                        "email_verification_method",
                        "email_verified_at",
                        "email_verified_by",
                    }
        super().save(*args, **kwargs)


class AccountAuditEvent(models.Model):
    class Action(models.TextChoices):
        EMAIL_ADMIN_VERIFIED = "email_admin_verified", "Email administratively verified"
        EMAIL_ADMIN_REVOKED = "email_admin_revoked", "Email administrative verification revoked"
        EMAIL_OPERATOR_OVERRIDE = "email_operator_override", "Email operator override"
        LEARNER_APPROVED = "learner_approved", "Learner approved"
        INSTRUCTOR_APPROVED = "instructor_approved", "Instructor approved"
        ACCOUNT_SUSPENDED = "account_suspended", "Account suspended"
        ACCOUNT_REACTIVATED = "account_reactivated", "Account reactivated"

    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="account_audit_actions",
        blank=True,
        null=True,
    )
    target = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="account_audit_events",
    )
    action = models.CharField(max_length=32, choices=Action.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-pk"]


class ExternalIdentity(models.Model):
    class Provider(models.TextChoices):
        GOOGLE = "google", "Google"
        MICROSOFT = "microsoft", "Microsoft"
        APPLE = "apple", "Apple"

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="external_identities",
    )
    provider = models.CharField(max_length=16, choices=Provider.choices)
    subject = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("provider", "subject"),
                name="accounts_ext_provider_subject_uq",
            ),
            models.UniqueConstraint(
                fields=("user", "provider"),
                name="accounts_ext_user_provider_uq",
            ),
        ]

    def __str__(self):
        return f"{self.provider} identity for user {self.user_id}"
