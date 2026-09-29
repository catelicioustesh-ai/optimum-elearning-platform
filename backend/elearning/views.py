from django.utils import timezone

from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from rest_framework.permissions import IsAuthenticated

from django.contrib.auth import authenticate
from django.contrib.auth.models import User

from .models import (
    UserProfile,
    Course,
    Enrollment,
    LearningMaterial,
    Assignment,
    AssignmentSubmission,
    Quiz,
    Question,
    QuizOption,
    QuizAttempt,
    QuizAnswer,
    Lab,
    LabSubmission,
)

from .serializers import (
    RegisterSerializer,
    UserSerializer,
    UserProfileSerializer,
    CourseSerializer,
    EnrollmentSerializer,
    LearningMaterialSerializer,
    AssignmentSerializer,
    AssignmentSubmissionSerializer,
    QuizSerializer,
    QuestionSerializer,
    QuizOptionSerializer,
    QuizAttemptSerializer,
    QuizAnswerSerializer,
    LabSerializer,
    LabSubmissionSerializer,
)


# =========================================================
# AUTHENTICATION
# =========================================================

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer


class LoginView(APIView):

    def post(self, request):

        username = request.data.get("username")
        password = request.data.get("password")

        if not username or not password:
            return Response(
                {
                    "error": "Username and password are required."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = authenticate(
            username=username,
            password=password
        )

        if user is None:
            return Response(
                {
                    "error": "Invalid username or password."
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        token, created = Token.objects.get_or_create(
            user=user
        )

        profile = UserProfile.objects.filter(
            user=user
        ).first()

        return Response(
            {
                "message": "Login successful.",
                "token": token.key,
                "user": UserSerializer(user).data,
                "profile": (
                    UserProfileSerializer(profile).data
                    if profile
                    else None
                ),
            },
            status=status.HTTP_200_OK,
        )


class LogoutView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request):

        token = request.auth

        if token:
            token.delete()

        return Response(
            {
                "message": "Logout successful."
            },
            status=status.HTTP_200_OK,
        )


# =========================================================
# USER PROFILES
# =========================================================

class UserProfileListCreateView(
    generics.ListCreateAPIView
):

    queryset = UserProfile.objects.all()
    serializer_class = UserProfileSerializer


class UserProfileDetailView(
    generics.RetrieveUpdateDestroyAPIView
):

    queryset = UserProfile.objects.all()
    serializer_class = UserProfileSerializer


# =========================================================
# COURSES
# =========================================================

class CourseListCreateView(
    generics.ListCreateAPIView
):

    queryset = Course.objects.all()
    serializer_class = CourseSerializer


class CourseDetailView(
    generics.RetrieveUpdateDestroyAPIView
):

    queryset = Course.objects.all()
    serializer_class = CourseSerializer


class MyCoursesView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        enrollments = Enrollment.objects.filter(
            student=request.user
        ).select_related("course")

        courses = [
            enrollment.course
            for enrollment in enrollments
        ]

        serializer = CourseSerializer(
            courses,
            many=True
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK
        )


# =========================================================
# ENROLLMENTS
# =========================================================

class EnrollmentListCreateView(
    generics.ListCreateAPIView
):

    queryset = Enrollment.objects.all()
    serializer_class = EnrollmentSerializer


class EnrollmentDetailView(
    generics.RetrieveUpdateDestroyAPIView
):

    queryset = Enrollment.objects.all()
    serializer_class = EnrollmentSerializer


# =========================================================
# LEARNING MATERIALS
# =========================================================

class LearningMaterialListCreateView(
    generics.ListCreateAPIView
):

    queryset = LearningMaterial.objects.all()
    serializer_class = LearningMaterialSerializer


class LearningMaterialDetailView(
    generics.RetrieveUpdateDestroyAPIView
):

    queryset = LearningMaterial.objects.all()
    serializer_class = LearningMaterialSerializer


class CourseMaterialsView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request, course_id):

        try:
            course = Course.objects.get(
                id=course_id
            )

        except Course.DoesNotExist:

            return Response(
                {
                    "error": "Course not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        is_enrolled = Enrollment.objects.filter(
            student=request.user,
            course=course
        ).exists()

        if not is_enrolled:

            return Response(
                {
                    "error": "You are not enrolled in this course."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        materials = LearningMaterial.objects.filter(
            course=course
        ).order_by("-uploaded_at")

        serializer = LearningMaterialSerializer(
            materials,
            many=True,
            context={
                "request": request
            }
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK
        )


# =========================================================
# ASSIGNMENTS
# =========================================================

class AssignmentListCreateView(
    generics.ListCreateAPIView
):

    queryset = Assignment.objects.all()
    serializer_class = AssignmentSerializer


class AssignmentDetailView(
    generics.RetrieveUpdateDestroyAPIView
):

    queryset = Assignment.objects.all()
    serializer_class = AssignmentSerializer


# =========================================================
# ASSIGNMENT SUBMISSIONS
# =========================================================

class AssignmentSubmissionListCreateView(
    generics.ListCreateAPIView
):

    queryset = AssignmentSubmission.objects.all()
    serializer_class = AssignmentSubmissionSerializer


class AssignmentSubmissionDetailView(
    generics.RetrieveUpdateDestroyAPIView
):

    queryset = AssignmentSubmission.objects.all()
    serializer_class = AssignmentSubmissionSerializer


# =========================================================
# QUIZZES
# =========================================================

class QuizListCreateView(
    generics.ListCreateAPIView
):

    queryset = Quiz.objects.all()
    serializer_class = QuizSerializer


class QuizDetailView(
    generics.RetrieveUpdateDestroyAPIView
):

    queryset = Quiz.objects.all()
    serializer_class = QuizSerializer


# =========================================================
# QUESTIONS
# =========================================================

class QuestionListCreateView(
    generics.ListCreateAPIView
):

    queryset = Question.objects.all()
    serializer_class = QuestionSerializer


class QuestionDetailView(
    generics.RetrieveUpdateDestroyAPIView
):

    queryset = Question.objects.all()
    serializer_class = QuestionSerializer


# =========================================================
# QUIZ OPTIONS
# =========================================================

class QuizOptionListCreateView(
    generics.ListCreateAPIView
):

    queryset = QuizOption.objects.all()
    serializer_class = QuizOptionSerializer


class QuizOptionDetailView(
    generics.RetrieveUpdateDestroyAPIView
):

    queryset = QuizOption.objects.all()
    serializer_class = QuizOptionSerializer


# =========================================================
# QUIZ ATTEMPTS
# =========================================================

class QuizAttemptListCreateView(
    generics.ListCreateAPIView
):

    queryset = QuizAttempt.objects.all()
    serializer_class = QuizAttemptSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):

        return QuizAttempt.objects.filter(
            student=self.request.user
        )


class QuizAttemptDetailView(
    generics.RetrieveUpdateDestroyAPIView
):

    queryset = QuizAttempt.objects.all()
    serializer_class = QuizAttemptSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):

        return QuizAttempt.objects.filter(
            student=self.request.user
        )


# =========================================================
# QUIZ ANSWERS
# =========================================================

class QuizAnswerListCreateView(
    generics.ListCreateAPIView
):

    queryset = QuizAnswer.objects.all()
    serializer_class = QuizAnswerSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):

        return QuizAnswer.objects.filter(
            attempt__student=self.request.user
        )


class QuizAnswerDetailView(
    generics.RetrieveUpdateDestroyAPIView
):

    queryset = QuizAnswer.objects.all()
    serializer_class = QuizAnswerSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):

        return QuizAnswer.objects.filter(
            attempt__student=self.request.user
        )


# =========================================================
# SUBMIT QUIZ AND CALCULATE SCORE
# =========================================================

class SubmitQuizView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request, quiz_id):

        # -------------------------------------------------
        # Find the quiz
        # -------------------------------------------------

        try:
            quiz = Quiz.objects.get(
                id=quiz_id
            )

        except Quiz.DoesNotExist:

            return Response(
                {
                    "error": "Quiz not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # -------------------------------------------------
        # Check student enrollment
        # -------------------------------------------------

        is_enrolled = Enrollment.objects.filter(
            student=request.user,
            course=quiz.course
        ).exists()

        if not is_enrolled:

            return Response(
                {
                    "error": "You are not enrolled in this course."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # -------------------------------------------------
        # Get submitted answers
        # -------------------------------------------------

        submitted_answers = request.data.get(
            "answers",
            []
        )

        if not isinstance(
            submitted_answers,
            list
        ):

            return Response(
                {
                    "error": "Answers must be provided as a list."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not submitted_answers:

            return Response(
                {
                    "error": "No answers were submitted."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # -------------------------------------------------
        # Create attempt
        # -------------------------------------------------

        attempt = QuizAttempt.objects.create(
            quiz=quiz,
            student=request.user
        )

        total_score = 0

        # -------------------------------------------------
        # Process answers
        # -------------------------------------------------

        for answer_data in submitted_answers:

            question_id = answer_data.get(
                "question_id"
            )

            selected_option_id = answer_data.get(
                "selected_option_id"
            )

            if not question_id:
                continue

            try:

                question = Question.objects.get(
                    id=question_id,
                    quiz=quiz
                )

            except Question.DoesNotExist:

                continue

            selected_option = None

            if selected_option_id:

                try:

                    selected_option = QuizOption.objects.get(
                        id=selected_option_id,
                        question=question
                    )

                except QuizOption.DoesNotExist:

                    selected_option = None

            marks_awarded = 0

            if (
                selected_option
                and selected_option.is_correct
            ):

                marks_awarded = question.marks

                total_score += question.marks

            QuizAnswer.objects.create(
                attempt=attempt,
                question=question,
                selected_option=selected_option,
                marks_awarded=marks_awarded
            )

        # -------------------------------------------------
        # Complete attempt
        # -------------------------------------------------

        attempt.completed_at = timezone.now()

        attempt.score = total_score

        attempt.save(
            update_fields=[
                "completed_at",
                "score"
            ]
        )

        # -------------------------------------------------
        # Calculate total marks
        # -------------------------------------------------

        total_marks = sum(
            question.marks
            for question in quiz.questions.all()
        )

        percentage = 0

        if total_marks > 0:

            percentage = (
                total_score / total_marks
            ) * 100

        # -------------------------------------------------
        # Return result
        # -------------------------------------------------

        return Response(
            {
                "message": "Quiz submitted successfully.",
                "quiz": quiz.title,
                "attempt_id": attempt.id,
                "score": total_score,
                "total_marks": total_marks,
                "percentage": round(
                    percentage,
                    2
                ),
                "completed_at": attempt.completed_at,
            },
            status=status.HTTP_201_CREATED,
        )


# =========================================================
# LABS
# =========================================================

class LabListCreateView(
    generics.ListCreateAPIView
):

    queryset = Lab.objects.all()
    serializer_class = LabSerializer


class LabDetailView(
    generics.RetrieveUpdateDestroyAPIView
):

    queryset = Lab.objects.all()
    serializer_class = LabSerializer


# =========================================================
# LAB SUBMISSIONS
# =========================================================

class LabSubmissionListCreateView(
    generics.ListCreateAPIView
):

    queryset = LabSubmission.objects.all()
    serializer_class = LabSubmissionSerializer


class LabSubmissionDetailView(
    generics.RetrieveUpdateDestroyAPIView
):

    queryset = LabSubmission.objects.all()
    serializer_class = LabSubmissionSerializer


# =========================================================
# INSTRUCTOR DASHBOARD
# =========================================================

class InstructorDashboardView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        # -------------------------------------------------
        # Get instructor profile
        # -------------------------------------------------

        profile = UserProfile.objects.filter(
            user=request.user
        ).first()

        if not profile:

            return Response(
                {
                    "error": "User profile not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # -------------------------------------------------
        # Make sure user is an instructor
        # -------------------------------------------------

        if profile.role != "lecturer":

            return Response(
                {
                    "error": "Access denied. Instructor account required."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # -------------------------------------------------
        # Get instructor's courses
        # -------------------------------------------------

        courses = Course.objects.filter(
            lecturer=request.user
        ).order_by("-created_at")

        # -------------------------------------------------
        # Dashboard statistics
        # -------------------------------------------------

        total_courses = courses.count()

        total_students = Enrollment.objects.filter(
            course__lecturer=request.user
        ).values(
            "student"
        ).distinct().count()

        total_labs = Lab.objects.filter(
            course__lecturer=request.user
        ).count()

        total_assignments = Assignment.objects.filter(
            course__lecturer=request.user
        ).count()

        total_quizzes = Quiz.objects.filter(
            course__lecturer=request.user
        ).count()

        total_materials = LearningMaterial.objects.filter(
            course__lecturer=request.user
        ).count()

        # -------------------------------------------------
        # Course information
        # -------------------------------------------------

        course_data = []

        for course in courses:

            student_count = Enrollment.objects.filter(
                course=course
            ).values(
                "student"
            ).distinct().count()

            lab_count = Lab.objects.filter(
                course=course
            ).count()

            assignment_count = Assignment.objects.filter(
                course=course
            ).count()

            quiz_count = Quiz.objects.filter(
                course=course
            ).count()

            material_count = LearningMaterial.objects.filter(
                course=course
            ).count()

            course_data.append(
                {
                    "id": course.id,
                    "code": course.code,
                    "name": course.name,
                    "description": course.description,
                    "students": student_count,
                    "labs": lab_count,
                    "assignments": assignment_count,
                    "quizzes": quiz_count,
                    "materials": material_count,
                    "created_at": course.created_at,
                }
            )

        # -------------------------------------------------
        # Return dashboard
        # -------------------------------------------------

        return Response(
            {
                "message": "Instructor dashboard loaded successfully.",

                "instructor": {
                    "id": request.user.id,
                    "username": request.user.username,
                    "email": request.user.email,
                    "first_name": request.user.first_name,
                    "last_name": request.user.last_name,
                    "role": profile.role,
                },

                "statistics": {
                    "total_courses": total_courses,
                    "total_students": total_students,
                    "total_labs": total_labs,
                    "total_assignments": total_assignments,
                    "total_quizzes": total_quizzes,
                    "total_materials": total_materials,
                },

                "courses": course_data,
            },
            status=status.HTTP_200_OK,
        )