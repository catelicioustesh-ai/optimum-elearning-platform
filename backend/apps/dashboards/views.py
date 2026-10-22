"""
Dashboard endpoints — read-only aggregation over data owned by other apps.
Matches brief sections 13, 14, 15 field-for-field.
"""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, serializers, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema, inline_serializer

from apps.accounts.access import ADMIN, role_of
from apps.accounts.models import AccountAuditEvent, EmailVerificationMethod
from apps.accounts.permissions import IsInstructorOrAdmin, IsAdmin
from apps.courses.models import Activity, Course, Lesson, Module
from apps.enrollment.models import Enrollment
from apps.progress.services import is_module_complete, is_module_unlocked
from apps.submissions.models import Submission, SubmissionStatus

User = get_user_model()


class AdminAccountPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


def admin_account_status(user):
    if not user.email_verified:
        return "pending_email_verification"
    if not user.is_approved:
        return "pending_admin_approval"
    if not user.is_active:
        return "suspended"
    return "active"


def admin_account_data(user):
    return {
        "id": user.pk,
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "full_name": user.get_full_name(),
        "role": user.role,
        "email_verified": user.email_verified,
        "email_verification_method": user.email_verification_method or None,
        "email_verified_at": user.email_verified_at,
        "email_verified_by": (
            user.email_verified_by.get_full_name() or user.email_verified_by.email
            if user.email_verified_by
            else None
        ),
        "is_approved": user.is_approved,
        "is_active": user.is_active,
        "status": admin_account_status(user),
        "date_joined": user.date_joined,
    }


class StudentDashboardView(APIView):
    """
    GET /api/dashboard/student/
    "Where am I? What have I completed? What should I do next?" (section 13)
    """
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        responses=inline_serializer(
            name="StudentDashboard",
            fields={
                "enrolled_courses": inline_serializer(
                    name="StudentDashboardCourse",
                    many=True,
                    fields={
                        "course_id": serializers.IntegerField(),
                        "course_title": serializers.CharField(),
                        "progress_percent": serializers.IntegerField(),
                        "current_module": serializers.CharField(allow_null=True),
                        "current_module_id": serializers.IntegerField(allow_null=True),
                        "current_lesson_id": serializers.IntegerField(allow_null=True),
                        "current_lesson_title": serializers.CharField(allow_null=True),
                        "modules": inline_serializer(
                            name="StudentDashboardModule",
                            many=True,
                            fields={
                                "module_id": serializers.IntegerField(),
                                "title": serializers.CharField(),
                                "order": serializers.IntegerField(),
                                "status": serializers.ChoiceField(
                                    choices=["done", "active", "locked"]
                                ),
                            },
                        ),
                        "completed": serializers.BooleanField(),
                    },
                ),
                "current_course": inline_serializer(
                    name="StudentCurrentCourse",
                    fields={
                        "course_id": serializers.IntegerField(),
                        "course_title": serializers.CharField(),
                        "progress_percent": serializers.IntegerField(),
                        "current_module": serializers.CharField(allow_null=True),
                        "current_module_id": serializers.IntegerField(allow_null=True),
                        "current_lesson_id": serializers.IntegerField(allow_null=True),
                        "current_lesson_title": serializers.CharField(allow_null=True),
                        "modules": inline_serializer(
                            name="StudentCurrentCourseModule",
                            many=True,
                            fields={
                                "module_id": serializers.IntegerField(),
                                "title": serializers.CharField(),
                                "order": serializers.IntegerField(),
                                "status": serializers.ChoiceField(
                                    choices=["done", "active", "locked"]
                                ),
                            },
                        ),
                        "completed": serializers.BooleanField(),
                    },
                    allow_null=True,
                ),
                "pending_labs": serializers.IntegerField(),
                "recent_grades": inline_serializer(
                    name="StudentRecentGrade",
                    many=True,
                    fields={
                        "activity": serializers.CharField(),
                        "grade": serializers.FloatField(allow_null=True),
                        "max_score": serializers.FloatField(),
                        "graded_at": serializers.DateTimeField(allow_null=True),
                        "feedback": serializers.CharField(allow_null=True),
                    },
                ),
                "upcoming_deadlines": inline_serializer(
                    name="StudentUpcomingDeadline",
                    many=True,
                    fields={
                        "activity_id": serializers.IntegerField(),
                        "title": serializers.CharField(),
                        "activity_type": serializers.CharField(),
                        "course_id": serializers.IntegerField(),
                        "course_title": serializers.CharField(),
                        "deadline": serializers.DateTimeField(),
                    },
                ),
            },
        )
    )
    def get(self, request):
        student = request.user
        enrollments = Enrollment.objects.filter(
            student=student, course__status=Course.Status.PUBLISHED
        ).select_related("course")

        courses_data = []
        for enrollment in enrollments:
            modules = Module.objects.filter(course=enrollment.course).order_by("order")
            total = modules.count()
            done = 0
            current_module = None
            module_path = []
            for module in modules:
                unlocked = is_module_unlocked(student, module)
                complete = is_module_complete(student, module) if unlocked else False
                if complete:
                    done += 1
                elif unlocked and current_module is None:
                    current_module = module
                module_path.append({
                    "module_id": module.id,
                    "title": module.title,
                    "order": module.order,
                    "status": "done" if complete else "active" if unlocked else "locked",
                })

            current_lesson = (
                Lesson.objects.filter(module=current_module).order_by("order").first()
                if current_module else None
            )
            courses_data.append({
                "course_id": enrollment.course.id,
                "course_title": enrollment.course.title,
                "progress_percent": round((done / total) * 100) if total else 0,
                "current_module": current_module.title if current_module else None,
                "current_module_id": current_module.id if current_module else None,
                "current_lesson_id": current_lesson.id if current_lesson else None,
                "current_lesson_title": current_lesson.title if current_lesson else None,
                "modules": module_path,
                "completed": done == total and total > 0,
            })

        current_course = next(
            (course for course in courses_data if not course["completed"]),
            courses_data[0] if courses_data else None,
        )

        pending_labs = Submission.objects.filter(
            student=student, status=SubmissionStatus.SUBMITTED
        ).count()

        recent_grades = (
            Submission.objects.filter(student=student, status=SubmissionStatus.GRADED)
            .order_by("-graded_at")[:5]
        )
        grades_data = [
            {
                "activity": s.activity.title,
                "grade": s.grade,
                "max_score": s.activity.max_score,
                "graded_at": s.graded_at.isoformat() if s.graded_at else None,
                "feedback": s.feedback,
            }
            for s in recent_grades
        ]

        deadlines = []
        upcoming_activities = (
            Activity.objects.filter(
                lesson__module__course__enrollments__student=student,
                deadline__gte=timezone.now(),
            )
            .exclude(completions__student=student)
            .select_related("lesson__module__course")
            .order_by("deadline", "id")
            .distinct()
        )
        for activity in upcoming_activities:
            if not is_module_unlocked(student, activity.lesson.module):
                continue
            deadlines.append({
                "activity_id": activity.id,
                "title": activity.title,
                "activity_type": activity.activity_type,
                "course_id": activity.lesson.module.course_id,
                "course_title": activity.lesson.module.course.title,
                "deadline": activity.deadline.isoformat(),
            })
            if len(deadlines) == 5:
                break

        return Response({
            "enrolled_courses": courses_data,
            "current_course": current_course,
            "pending_labs": pending_labs,
            "recent_grades": grades_data,
            "upcoming_deadlines": deadlines,
        })


class InstructorDashboardView(APIView):
    """
    GET /api/dashboard/instructor/
    Pending submissions to review + students falling behind (section 14).
    """
    permission_classes = [permissions.IsAuthenticated, IsInstructorOrAdmin]

    @extend_schema(
        responses=inline_serializer(
            name="InstructorDashboard",
            fields={
                "pending_submissions": inline_serializer(
                    name="InstructorPendingSubmission",
                    many=True,
                    fields={
                        "submission_id": serializers.IntegerField(),
                        "student": serializers.CharField(),
                        "activity": serializers.CharField(),
                        "course": serializers.CharField(),
                        "submitted_at": serializers.DateTimeField(),
                    },
                ),
                "pending_submission_count": serializers.IntegerField(),
                "students_falling_behind": inline_serializer(
                    name="InstructorStudentFallingBehind",
                    many=True,
                    fields={
                        "student": serializers.CharField(),
                        "course": serializers.CharField(),
                    },
                ),
                "my_courses": inline_serializer(
                    name="InstructorDashboardCourse",
                    many=True,
                    fields={
                        "id": serializers.IntegerField(),
                        "title": serializers.CharField(),
                    },
                ),
            },
        )
    )
    def get(self, request):
        instructor = request.user
        my_courses = Course.objects.all() if role_of(instructor) == ADMIN else Course.objects.filter(instructor=instructor)

        pending_submissions = (
            Submission.objects.filter(
                activity__lesson__module__course__in=my_courses,
                status=SubmissionStatus.SUBMITTED,
            )
            .select_related("student", "activity")
            .order_by("submitted_at")[:20]
        )
        pending_data = [
            {
                "submission_id": s.id,
                "student": s.student.get_full_name() or s.student.username,
                "activity": s.activity.title,
                "course": s.activity.lesson.module.course.title,
                "submitted_at": s.submitted_at,
            }
            for s in pending_submissions
        ]

        # "Falling behind" — a simple, real definition: enrolled, but no
        # completed activity in the last 7 days. Cheap enough to compute
        # per-course at this stage; revisit with a materialized/cached
        # version once enrollment counts get large (see note in README).
        cutoff = timezone.now() - timedelta(days=7)
        falling_behind = []
        for course in my_courses:
            enrolled_students = User.objects.filter(enrollments__course=course)
            for student in enrolled_students:
                has_recent_activity = student.activity_completions.filter(
                    activity__lesson__module__course=course, completed_at__gte=cutoff
                ).exists()
                if not has_recent_activity:
                    falling_behind.append({
                        "student": student.get_full_name() or student.username,
                        "course": course.title,
                    })

        return Response({
            "pending_submissions": pending_data,
            "pending_submission_count": Submission.objects.filter(
                activity__lesson__module__course__in=my_courses,
                status=SubmissionStatus.SUBMITTED,
            ).count(),
            "students_falling_behind": falling_behind,
            "my_courses": [{"id": c.id, "title": c.title} for c in my_courses],
        })


class AdminDashboardView(APIView):
    """
    GET /api/dashboard/admin/
    Platform-wide statistics (section 15).
    """
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    @extend_schema(
        responses=inline_serializer(
            name="AdminDashboard",
            fields={
                "total_students": serializers.IntegerField(),
                "total_instructors": serializers.IntegerField(),
                "total_courses": serializers.IntegerField(),
                "active_enrollments": serializers.IntegerField(),
                "pending_submissions": serializers.IntegerField(),
                "pending_learner_approval_count": serializers.IntegerField(),
                "registered_students": inline_serializer(
                    name="AdminRegisteredStudent",
                    many=True,
                    fields={
                        "id": serializers.IntegerField(),
                        "username": serializers.CharField(),
                        "full_name": serializers.CharField(),
                        "email": serializers.EmailField(),
                        "enrolled_courses": inline_serializer(
                            name="AdminStudentCourse",
                            many=True,
                            fields={
                                "id": serializers.IntegerField(),
                                "title": serializers.CharField(),
                            },
                        ),
                        "pending_learner_approvals": inline_serializer(
                            name="AdminPendingLearnerApproval",
                            many=True,
                            fields={
                                "id": serializers.IntegerField(),
                                "username": serializers.CharField(),
                                "full_name": serializers.CharField(),
                                "email": serializers.EmailField(),
                                "email_verified": serializers.BooleanField(),
                                "date_joined": serializers.DateTimeField(),
                            },
                        ),
                    },
                ),
            },
        )
    )
    def get(self, request):
        students = User.objects.filter(
            role="student", is_approved=True, is_active=True
        ).order_by("username")
        registered_students = []
        for student in students:
            enrolled_courses = list(
                student.enrollments.select_related("course").order_by("course__title").values(
                    "course_id", "course__title"
                )
            )
            registered_students.append({
                "id": student.id,
                "username": student.username,
                "full_name": student.get_full_name(),
                "email": student.email,
                "enrolled_courses": [
                    {"id": row["course_id"], "title": row["course__title"]}
                    for row in enrolled_courses
                ],
            })

        pending_students = User.objects.filter(
            role="student", is_approved=False
        ).order_by("date_joined")

        return Response({
            "total_students": students.count(),
            "total_instructors": User.objects.filter(role="instructor").count(),
            "total_courses": Course.objects.count(),
            "active_enrollments": Enrollment.objects.count(),
            "pending_submissions": Submission.objects.filter(status=SubmissionStatus.SUBMITTED).count(),
            "registered_students": registered_students,
            "pending_learner_approvals": [
                {
                    "id": student.id,
                    "username": student.username,
                    "full_name": student.get_full_name(),
                    "email": student.email,
                    "email_verified": student.email_verified,
                    "date_joined": student.date_joined,
                }
                for student in pending_students
            ],
            "pending_learner_approval_count": pending_students.count(),
        })


class PendingLearnerApprovalsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    @extend_schema(
        responses=inline_serializer(
            name="PendingLearnerApproval",
            many=True,
            fields={
                "id": serializers.IntegerField(),
                "username": serializers.CharField(),
                "full_name": serializers.CharField(),
                "email": serializers.EmailField(),
                "email_verified": serializers.BooleanField(),
                "date_joined": serializers.DateTimeField(),
            },
        )
    )
    def get(self, request):
        pending_students = User.objects.filter(
            role="student", is_approved=False
        ).order_by("date_joined")
        return Response([
            {
                "id": student.id,
                "username": student.username,
                "full_name": student.get_full_name(),
                "email": student.email,
                "email_verified": student.email_verified,
                "date_joined": student.date_joined,
            }
            for student in pending_students
        ])


class AdminAccountListView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get(self, request):
        accounts = User.objects.filter(role__in=("student", "instructor")).select_related(
            "email_verified_by"
        )

        role = request.query_params.get("role", "").strip()
        if role:
            if role not in ("student", "instructor"):
                raise serializers.ValidationError({"role": "Choose student or instructor."})
            accounts = accounts.filter(role=role)

        verified = request.query_params.get("email_verified", "").strip().lower()
        if verified:
            if verified not in ("true", "false"):
                raise serializers.ValidationError(
                    {"email_verified": "Choose true or false."}
                )
            accounts = accounts.filter(email_verified=(verified == "true"))

        account_status = request.query_params.get("status", "").strip()
        status_filters = {
            "pending_email_verification": Q(email_verified=False),
            "pending_admin_approval": Q(email_verified=True, is_approved=False),
            "suspended": Q(is_approved=True, is_active=False),
            "active": Q(email_verified=True, is_approved=True, is_active=True),
        }
        if account_status:
            if account_status not in status_filters:
                raise serializers.ValidationError(
                    {"status": "Choose a supported account status."}
                )
            accounts = accounts.filter(status_filters[account_status])

        search = request.query_params.get("search", "").strip()
        if search:
            accounts = accounts.filter(
                Q(email__icontains=search)
                | Q(username__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
            )

        accounts = accounts.order_by("date_joined", "pk")
        paginator = AdminAccountPagination()
        page = paginator.paginate_queryset(accounts, request, view=self)
        return paginator.get_paginated_response([admin_account_data(user) for user in page])


class AdminAccountDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get(self, request, account_id):
        account = get_object_or_404(
            User.objects.select_related("email_verified_by"),
            pk=account_id,
            role__in=("student", "instructor"),
        )
        data = admin_account_data(account)
        data["verification_history"] = [
            {
                "action": event.action,
                "actor": (
                    event.actor.get_full_name() or event.actor.email
                    if event.actor
                    else None
                ),
                "created_at": event.created_at,
            }
            for event in account.account_audit_events.select_related("actor")[:25]
        ]
        return Response(data)


class AdminVerifyAccountEmailView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def post(self, request, account_id):
        with transaction.atomic():
            account = get_object_or_404(
                User.objects.select_for_update(),
                pk=account_id,
                role__in=("student", "instructor"),
            )
            if account.email_verified:
                return Response(
                    {"detail": "This account's email is already verified."},
                    status=status.HTTP_409_CONFLICT,
                )

            account.email_verified = True
            account.email_verification_method = EmailVerificationMethod.ADMIN
            account.email_verified_at = timezone.now()
            account.email_verified_by = request.user
            account.save(update_fields=[
                "email_verified",
                "email_verification_method",
                "email_verified_at",
                "email_verified_by",
            ])
            AccountAuditEvent.objects.create(
                actor=request.user,
                target=account,
                action=AccountAuditEvent.Action.EMAIL_ADMIN_VERIFIED,
            )

        return Response(admin_account_data(account))


class AdminApproveAccountView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def post(self, request, account_id):
        with transaction.atomic():
            account = get_object_or_404(
                User.objects.select_for_update(),
                pk=account_id,
                role__in=("student", "instructor"),
            )
            if account.is_approved:
                return Response(
                    {"detail": "This account has already been approved."},
                    status=status.HTTP_409_CONFLICT,
                )
            if not account.email_verified:
                return Response(
                    {"detail": "This account must have a verified email before approval."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            account.is_approved = True
            account.is_active = True
            account.save(update_fields=["is_approved", "is_active"])
            action = (
                AccountAuditEvent.Action.LEARNER_APPROVED
                if account.role == "student"
                else AccountAuditEvent.Action.INSTRUCTOR_APPROVED
            )
            AccountAuditEvent.objects.create(
                actor=request.user,
                target=account,
                action=action,
            )

        return Response(admin_account_data(account))


class ApproveLearnerView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    @extend_schema(
        responses=inline_serializer(
            name="ApprovedLearner",
            fields={
                "id": serializers.IntegerField(),
                "username": serializers.CharField(),
                "full_name": serializers.CharField(),
                "email": serializers.EmailField(),
                "enrolled_courses": inline_serializer(
                    name="ApprovedLearnerCourse",
                    many=True,
                    fields={
                        "id": serializers.IntegerField(),
                        "title": serializers.CharField(),
                    },
                ),
            },
        )
    )
    def post(self, request, learner_id):
        with transaction.atomic():
            learner = get_object_or_404(
                User.objects.select_for_update(),
                pk=learner_id,
                role="student",
                is_approved=False,
            )
            if not learner.email_verified:
                return Response(
                    {"detail": "This learner must verify their email before approval."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            learner.is_approved = True
            learner.is_active = True
            learner.save(update_fields=["is_approved", "is_active"])
            AccountAuditEvent.objects.create(
                actor=request.user,
                target=learner,
                action=AccountAuditEvent.Action.LEARNER_APPROVED,
            )
        return Response({
            "id": learner.id,
            "username": learner.username,
            "full_name": learner.get_full_name(),
            "email": learner.email,
            "enrolled_courses": [],
        })
