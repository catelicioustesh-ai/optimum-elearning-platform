from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0006_emailverificationaudit"),
    ]

    operations = [
        migrations.AlterField(
            model_name="accountauditevent",
            name="action",
            field=models.CharField(
                choices=[
                    ("email_admin_verified", "Email administratively verified"),
                    ("email_admin_revoked", "Email administrative verification revoked"),
                    ("email_operator_override", "Email operator override"),
                    ("learner_approved", "Learner approved"),
                    ("instructor_approved", "Instructor approved"),
                ],
                max_length=32,
            ),
        ),
    ]
