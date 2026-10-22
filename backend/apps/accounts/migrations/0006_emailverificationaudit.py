from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
from django.utils import timezone


def mark_existing_verified_users_as_legacy(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    User.objects.filter(email_verified=True).update(
        email_verification_method="legacy",
        email_verified_at=timezone.now(),
    )


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0005_externalidentity"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="email_verification_method",
            field=models.CharField(
                blank=True,
                choices=[
                    ("self_verified", "User verified"),
                    ("provider_verified", "Identity provider verified"),
                    ("admin_verified", "Administrator verified"),
                    ("operator_override", "Operator override"),
                    ("legacy", "Legacy verification"),
                ],
                default="",
                max_length=24,
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="email_verified_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="user",
            name="email_verified_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="email_verified_accounts",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(
            mark_existing_verified_users_as_legacy,
            migrations.RunPython.noop,
        ),
        migrations.CreateModel(
            name="AccountAuditEvent",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "action",
                    models.CharField(
                        choices=[
                            ("email_admin_verified", "Email administratively verified"),
                            ("email_admin_revoked", "Email administrative verification revoked"),
                            ("email_operator_override", "Email operator override"),
                            ("learner_approved", "Learner approved"),
                        ],
                        max_length=32,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "actor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="account_audit_actions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "target",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="account_audit_events",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-created_at", "-pk"]},
        ),
    ]
