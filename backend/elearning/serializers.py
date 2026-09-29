from rest_framework import serializers
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


# =========================
# REGISTRATION
# =========================

class RegisterSerializer(serializers.ModelSerializer):

    password = serializers.CharField(
        write_only=True,
        min_length=8
    )

    role = serializers.ChoiceField(
        choices=UserProfile.ROLE_CHOICES,
        write_only=True
    )

    registration_number = serializers.CharField(
        max_length=50,
        required=False,
        allow_blank=True,
        allow_null=True,
        write_only=True
    )

    phone_number = serializers.CharField(
        max_length=20,
        required=False,
        allow_blank=True,
        write_only=True
    )

    class Meta:
        model = User

        fields = [
            'username',
            'email',
            'password',
            'first_name',
            'last_name',
            'role',
            'registration_number',
            'phone_number',
        ]

    def create(self, validated_data):

        role = validated_data.pop('role')

        registration_number = validated_data.pop(
            'registration_number',
            None
        )

        phone_number = validated_data.pop(
            'phone_number',
            ''
        )

        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
        )

        UserProfile.objects.create(
            user=user,
            role=role,
            registration_number=registration_number,
            phone_number=phone_number,
        )

        return user


# =========================
# USER
# =========================

class UserSerializer(serializers.ModelSerializer):

    class Meta:
        model = User

        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
        ]


# =========================
# USER PROFILE
# =========================

class UserProfileSerializer(serializers.ModelSerializer):

    class Meta:
        model = UserProfile

        fields = [
            'id',
            'user',
            'role',
            'registration_number',
            'phone_number',
            'profile_picture',
        ]


# =========================
# COURSE
# =========================

class CourseSerializer(serializers.ModelSerializer):

    class Meta:
        model = Course

        fields = [
            'id',
            'code',
            'name',
            'description',
            'lecturer',
            'created_at',
        ]


# =========================
# ENROLLMENT
# =========================

class EnrollmentSerializer(serializers.ModelSerializer):

    class Meta:
        model = Enrollment

        fields = [
            'id',
            'student',
            'course',
            'enrolled_at',
        ]


# =========================
# LEARNING MATERIAL
# =========================

class LearningMaterialSerializer(serializers.ModelSerializer):

    class Meta:
        model = LearningMaterial

        fields = [
            'id',
            'course',
            'title',
            'description',
            'material_type',
            'file',
            'external_url',
            'uploaded_by',
            'uploaded_at',
        ]


# =========================
# ASSIGNMENT
# =========================

class AssignmentSerializer(serializers.ModelSerializer):

    class Meta:
        model = Assignment

        fields = [
            'id',
            'course',
            'title',
            'description',
            'due_date',
            'attachment',
            'created_by',
            'created_at',
        ]


# =========================
# ASSIGNMENT SUBMISSION
# =========================

class AssignmentSubmissionSerializer(serializers.ModelSerializer):

    class Meta:
        model = AssignmentSubmission

        fields = [
            'id',
            'assignment',
            'student',
            'submission_file',
            'submission_text',
            'submitted_at',
            'marks',
            'feedback',
        ]


# =========================
# QUIZ
# =========================

class QuizSerializer(serializers.ModelSerializer):

    class Meta:
        model = Quiz

        fields = [
            'id',
            'course',
            'title',
            'description',
            'duration_minutes',
            'total_marks',
            'created_by',
            'created_at',
        ]


# =========================
# QUESTION
# =========================

class QuestionSerializer(serializers.ModelSerializer):

    class Meta:
        model = Question

        fields = [
            'id',
            'quiz',
            'question_text',
            'marks',
        ]


# =========================
# QUIZ OPTION
# =========================

class QuizOptionSerializer(serializers.ModelSerializer):

    class Meta:
        model = QuizOption

        fields = [
            'id',
            'question',
            'option_text',
            'is_correct',
        ]


# =========================
# QUIZ ATTEMPT
# =========================

class QuizAttemptSerializer(serializers.ModelSerializer):

    class Meta:
        model = QuizAttempt

        fields = [
            'id',
            'quiz',
            'student',
            'started_at',
            'completed_at',
            'score',
        ]


# =========================
# QUIZ ANSWER
# =========================

class QuizAnswerSerializer(serializers.ModelSerializer):

    class Meta:
        model = QuizAnswer

        fields = [
            'id',
            'attempt',
            'question',
            'selected_option',
            'marks_awarded',
        ]


# =========================
# LAB
# =========================

class LabSerializer(serializers.ModelSerializer):

    class Meta:
        model = Lab

        fields = [
            'id',
            'course',
            'title',
            'description',
            'instructions',
            'due_date',
            'attachment',
            'created_by',
            'created_at',
        ]


# =========================
# LAB SUBMISSION
# =========================

class LabSubmissionSerializer(serializers.ModelSerializer):

    class Meta:
        model = LabSubmission

        fields = [
            'id',
            'lab',
            'student',
            'submission_file',
            'submission_text',
            'submitted_at',
            'marks',
            'feedback',
        ]