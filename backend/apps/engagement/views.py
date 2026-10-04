from datetime import timedelta

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.access import ADMIN, INSTRUCTOR, STUDENT, role_of, require_teaches
from apps.courses.models import Course

from .certificate_pdf import certificate_completion_date, render_certificate
from .models import Achievement, Certificate, Notification, StudentAchievement, StudentStreak
from .serializers import CertificateSerializer, NotificationSerializer
from .services import issue_certificate, revoke_certificate


class StudentEngagementView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if role_of(request.user) != STUDENT:
            raise PermissionDenied("Student engagement data is only available to students.")

        streak = StudentStreak.objects.filter(student=request.user).first()
        current_streak = 0
        if streak and streak.last_activity_date and streak.last_activity_date >= timezone.localdate() - timedelta(days=1):
            current_streak = streak.current_days
        awards = {
            item.achievement_id: item.earned_at
            for item in StudentAchievement.objects.filter(student=request.user)
        }
        achievements = [
            {
                "code": achievement.code,
                "name": achievement.name,
                "description": achievement.description,
                "category": achievement.category,
                "threshold": achievement.threshold,
                "earned_at": awards.get(achievement.id),
            }
            for achievement in Achievement.objects.filter(active=True)
        ]
        certificates = Certificate.objects.filter(student=request.user).select_related("course")
        return Response({
            "current_streak": current_streak,
            "longest_streak": streak.longest_days if streak else 0,
            "achievements": achievements,
            "certificates": CertificateSerializer(certificates, many=True).data,
        })


class NotificationListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        notifications = Notification.objects.filter(recipient=request.user)
        return Response({
            "results": NotificationSerializer(notifications[:30], many=True).data,
            "unread_count": notifications.filter(read_at__isnull=True).count(),
        })


class NotificationReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, notification_id):
        notification = get_object_or_404(
            Notification, pk=notification_id, recipient=request.user
        )
        if notification.read_at is None:
            notification.read_at = timezone.now()
            notification.save(update_fields=["read_at"])
        return Response(NotificationSerializer(notification).data)


class NotificationReadAllView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(
            recipient=request.user, read_at__isnull=True
        ).update(read_at=timezone.now())
        return Response({"unread_count": 0})


def _certificate_for_user(request, certificate_number):
    certificate = get_object_or_404(
        Certificate.objects.select_related("student", "course", "revoked_by"),
        certificate_number=certificate_number,
    )
    role = role_of(request.user)
    allowed = (
        role == ADMIN
        or (role == STUDENT and certificate.student_id == request.user.id)
        or (role == INSTRUCTOR and certificate.course.instructor_id == request.user.id)
    )
    if not allowed:
        raise NotFound("Certificate not found.")
    return certificate


class CertificateDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, certificate_number):
        certificate = _certificate_for_user(request, certificate_number)
        return Response(CertificateSerializer(certificate).data)


class CertificateDownloadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, certificate_number):
        certificate = _certificate_for_user(request, certificate_number)
        if certificate.status != Certificate.Status.ISSUED:
            raise ValidationError("Revoked certificates cannot be downloaded.")
        filename = f"certificate-{certificate.certificate_number}.pdf"
        response = HttpResponse(render_certificate(certificate), content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["X-Content-Type-Options"] = "nosniff"
        response["Cache-Control"] = "private, no-store"
        return response


class CertificateVerifyView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, certificate_number):
        certificate = get_object_or_404(
            Certificate.objects.select_related("student", "course"),
            certificate_number=certificate_number,
        )
        return Response(
            {
                "certificate_number": str(certificate.certificate_number),
                "course_title": certificate.course.title,
                "student_name": certificate.student.get_full_name()
                or certificate.student.username,
                "status": certificate.status,
                "verified": certificate.status == Certificate.Status.ISSUED,
                "completed_on": certificate_completion_date(certificate).isoformat(),
                "issued_at": certificate.issued_at,
            },
            headers={"Cache-Control": "no-store"},
        )


class IssueCertificateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if role_of(request.user) not in (ADMIN, INSTRUCTOR):
            raise PermissionDenied("Only the course instructor or an admin can issue certificates.")
        try:
            course = Course.objects.get(pk=request.data.get("course_id"))
        except (Course.DoesNotExist, TypeError, ValueError):
            raise NotFound("Course not found.")
        require_teaches(request.user, course)
        from apps.accounts.models import User
        try:
            student = User.objects.get(pk=request.data.get("student_id"), role=STUDENT)
        except (User.DoesNotExist, TypeError, ValueError):
            raise NotFound("Student not found.")
        if not student.enrollments.filter(course=course).exists():
            raise NotFound("Student is not enrolled in this course.")
        try:
            certificate, _ = issue_certificate(student, course)
        except ValueError as error:
            raise ValidationError(str(error))
        return Response(CertificateSerializer(certificate).data, status=status.HTTP_200_OK)


class RevokeCertificateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, certificate_number):
        certificate = _certificate_for_user(request, certificate_number)
        if role_of(request.user) not in (ADMIN, INSTRUCTOR):
            raise PermissionDenied("Only the course instructor or an admin can revoke certificates.")
        reason = str(request.data.get("reason", "")).strip()
        if not reason:
            raise ValidationError({"reason": "A revocation reason is required."})
        if len(reason) > 500:
            raise ValidationError({"reason": "The reason must be 500 characters or fewer."})
        certificate, _ = revoke_certificate(certificate, reason, request.user)
        return Response(CertificateSerializer(certificate).data)


class CertificateListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        role = role_of(request.user)
        if role not in (ADMIN, INSTRUCTOR):
            raise PermissionDenied("Certificate management is available to instructors and admins.")

        certificates = Certificate.objects.select_related("student", "course", "revoked_by")
        course_id = request.query_params.get("course_id")
        if role == INSTRUCTOR and not course_id:
            raise ValidationError({"course_id": "This parameter is required for instructors."})
        if course_id:
            try:
                course = Course.objects.get(pk=course_id)
            except (Course.DoesNotExist, TypeError, ValueError):
                raise NotFound("Course not found.")
            require_teaches(request.user, course)
            certificates = certificates.filter(course=course)
        return Response(CertificateSerializer(certificates, many=True).data)