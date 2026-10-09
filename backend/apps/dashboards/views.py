"""
Dashboard endpoints — read-only aggregation over data owned by other apps.
Matches brief sections 13, 14, 15 field-for-field.
"""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.access import ADMIN, role_of
from apps.accounts.permissions import IsInstructorOrAdmin, IsAdmin
from apps.courses.models import Activity, Course, Lesson, Module
from apps.enrollment.models import Enrollment
from apps.progress.services import is_module_complete, is_module_unlocked
from apps.submissions.models import Submission, SubmissionStatus

User = get_user_model()


class StudentDashboardView(APIView):
    """
    GET /api/dashboard/student/
    "Where am I? What have I completed? What should I do next?" (section 13)
    """
    permission_classes = [permissions.IsAuthenticated]

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

    def get(self, request):
        students = User.objects.filter(role="student").order_by("username")
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

        return Response({
            "total_students": students.count(),
            "total_instructors": User.objects.filter(role="instructor").count(),
            "total_courses": Course.objects.count(),
            "active_enrollments": Enrollment.objects.count(),
            "pending_submissions": Submission.objects.filter(status=SubmissionStatus.SUBMITTED).count(),
            "registered_students": registered_students,
        })
