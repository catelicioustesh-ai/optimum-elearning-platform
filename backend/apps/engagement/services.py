from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from .models import (
    Achievement,
    Certificate,
    LearningActivityDay,
    Notification,
    StudentAchievement,
    StudentStreak,
)


def create_notification(recipient, kind, title, message, url=""):
    return Notification.objects.create(
        recipient=recipient,
        kind=kind,
        title=title,
        message=message,
        url=url,
    )


def _award_achievements(student, metrics):
    for metric, value in metrics.items():
        eligible = Achievement.objects.filter(
            active=True, metric=metric, threshold__lte=value
        ).exclude(awards__student=student)
        for achievement in eligible:
            award, created = StudentAchievement.objects.get_or_create(
                student=student, achievement=achievement
            )
            if created:
                create_notification(
                    student,
                    "achievement_earned",
                    f"Achievement earned: {achievement.name}",
                    achievement.description,
                    "/dashboard/student",
                )


@transaction.atomic
def _record_study_day(student):
    from django.contrib.auth import get_user_model
    get_user_model().objects.select_for_update().get(pk=student.pk)

    today = timezone.localdate()
    day, created = LearningActivityDay.objects.get_or_create(
        student=student, activity_date=today
    )
    streak, _ = StudentStreak.objects.get_or_create(student=student)
    if streak.last_activity_date != today:
        if streak.last_activity_date == today - timedelta(days=1):
            streak.current_days += 1
        else:
            streak.current_days = 1
        streak.longest_days = max(streak.longest_days, streak.current_days)
        streak.last_activity_date = today
        streak.save(update_fields=[
            "current_days", "longest_days", "last_activity_date", "updated_at"
        ])

    if created:
        create_notification(
            student,
            "learning_activity",
            "Learning streak updated",
            f"You were active in Optimum LMS on {today:%B %d, %Y}.",
            "/dashboard/student",
        )
    _award_achievements(student, {Achievement.Metric.STREAK_DAYS: streak.current_days})
    return streak


def record_study_activity(student):
    """Record a day on which the student made verified learning progress."""
    if LearningActivityDay.objects.filter(
        student=student, activity_date=timezone.localdate()
    ).exists():
        return
    _record_study_day(student)


def record_activity_completion(student, activity):
    """Record one successful completion and award its activity/course thresholds."""
    _record_study_day(student)
    create_notification(
        student,
        "activity_completed",
        "Learning activity completed",
        f"You completed {activity.title}.",
        "/dashboard/student",
    )

    from apps.progress.models import ActivityCompletion
    from apps.progress.services import is_course_complete
    from apps.enrollment.models import Enrollment

    activity_count = ActivityCompletion.objects.filter(student=student).count()
    completed_courses = sum(
        1 for enrollment in Enrollment.objects.filter(student=student).select_related("course")
        if enrollment.course.modules.exists() and is_course_complete(student, enrollment.course)
    )
    _award_achievements(student, {
        Achievement.Metric.ACTIVITIES: activity_count,
        Achievement.Metric.COURSES: completed_courses,
    })


@transaction.atomic
def issue_certificate(student, course):
    from apps.progress.services import is_course_complete

    if not course.modules.exists() or not is_course_complete(student, course):
        raise ValueError("The student must complete every course module before certification.")

    from django.contrib.auth import get_user_model
    from django.db.models import Max

    from apps.progress.models import ActivityCompletion

    get_user_model().objects.select_for_update().get(pk=student.pk)
    certificate = Certificate.objects.filter(
        student=student, course=course, status=Certificate.Status.ISSUED
    ).first()
    if certificate:
        return certificate, False

    completed_at = ActivityCompletion.objects.filter(
        student=student,
        activity__lesson__module__course=course,
        activity__is_required=True,
    ).aggregate(latest=Max("completed_at"))["latest"] or timezone.now()
    certificate = Certificate.objects.create(
        student=student,
        course=course,
        completed_at=completed_at,
    )
    create_notification(
        student,
        "certificate_issued",
        "Certificate issued",
        f"Your certificate for {course.title} is ready.",
        "/dashboard/student",
    )
    return certificate, True


@transaction.atomic
def revoke_certificate(certificate, reason, revoked_by=None):
    certificate = Certificate.objects.select_for_update().get(pk=certificate.pk)
    if certificate.status == Certificate.Status.REVOKED:
        return certificate, False

    certificate.status = Certificate.Status.REVOKED
    certificate.revoked_at = timezone.now()
    certificate.revocation_reason = reason
    certificate.revoked_by = revoked_by
    certificate.save(update_fields=[
        "status", "revoked_at", "revocation_reason", "revoked_by"
    ])
    create_notification(
        certificate.student,
        "certificate_revoked",
        "Certificate revoked",
        f"Your certificate for {certificate.course.title} was revoked.",
        "/dashboard/student",
    )
    return certificate, True


def sync_course_certificate(student, course):
    """Issue on completion; revoke an active certificate if completion is invalidated."""
    from apps.progress.services import is_course_complete

    if is_course_complete(student, course):
        return issue_certificate(student, course)[0]

    active = Certificate.objects.filter(
        student=student, course=course, status=Certificate.Status.ISSUED
    ).first()
    if active:
        revoke_certificate(active, "Course completion requirements are no longer met.")
    return None