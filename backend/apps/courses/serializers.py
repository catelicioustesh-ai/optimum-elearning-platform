from django.urls import reverse
from django.utils import timezone
from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field

from .models import Course, LiveSession, Module, Lesson, Activity, LessonAttachment, validate_video_file
from .validators import validate_video_url

ACTIVITY_PUBLIC_FIELDS = [
    "id", "lesson", "activity_type", "title", "instructions",
    "max_score", "max_attempts", "pass_percentage", "deadline", "is_required",
    "language", "starter_code", "quiz_id",
]


class LessonAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source="uploaded_by.get_full_name", read_only=True)
    # The raw media URL is never exposed: files are served only through an
    # authenticated endpoint that re-checks enrollment and module locking.
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = LessonAttachment
        fields = ["id", "lesson", "title", "file", "download_url", "uploaded_by_name", "uploaded_at"]
        read_only_fields = ["uploaded_by_name", "uploaded_at", "download_url"]
        extra_kwargs = {"file": {"write_only": True}}

    @extend_schema_field(serializers.CharField())
    def get_download_url(self, obj):
        return reverse("lesson-attachment-download", args=[obj.pk])


class _ActivityBase(serializers.ModelSerializer):
    quiz_id = serializers.SerializerMethodField()

    @extend_schema_field(serializers.IntegerField(allow_null=True))
    def get_quiz_id(self, obj):
        quiz = getattr(obj, "quiz", None)
        return quiz.id if quiz else None

    def validate_max_attempts(self, value):
        if value < 1:
            raise serializers.ValidationError("Must allow at least one attempt.")
        return value

    def validate_max_score(self, value):
        if value < 1:
            raise serializers.ValidationError("Must be at least 1.")
        return value


class ActivitySerializer(_ActivityBase):
    """Staff view: includes the answer key (test_cases)."""
    class Meta:
        model = Activity
        fields = ACTIVITY_PUBLIC_FIELDS + ["test_cases"]


class ActivityStudentSerializer(_ActivityBase):
    """Student view: `test_cases` (expected outputs) are never sent."""
    completion_status = serializers.SerializerMethodField()

    def get_completion_status(self, obj):
        completions = getattr(obj, "_student_completions", None)
        if completions is None:
            request = self.context.get("request")
            is_completed = bool(
                request
                and request.user.is_authenticated
                and obj.completions.filter(student=request.user).exists()
            )
        else:
            is_completed = bool(completions)

        if is_completed:
            return "completed"
        if obj.deadline and obj.deadline <= timezone.now():
            return "overdue"
        return "not_completed"

    class Meta:
        model = Activity
        fields = ACTIVITY_PUBLIC_FIELDS + ["completion_status"]
        read_only_fields = fields


class LessonSerializer(serializers.ModelSerializer):
    activities = ActivitySerializer(many=True, read_only=True)
    attachments = LessonAttachmentSerializer(many=True, read_only=True)
    video_url = serializers.CharField(required=False, allow_blank=True, validators=[validate_video_url])
    video_file = serializers.FileField(required=False, allow_null=True, write_only=True)
    video_file_url = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = [
            "id", "module", "title", "order", "learning_objectives",
            "video_url", "video_file", "video_file_url", "tutorial_content", "activities", "attachments",
        ]

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_video_file_url(self, obj):
        if not obj.video_file:
            return None
        return reverse("lesson-video", args=[obj.pk])

    def validate_video_file(self, value):
        validate_video_file(value)
        return value

    def validate(self, attrs):
        video_url = attrs.get("video_url", self.instance.video_url if self.instance else "")
        video_file = attrs.get("video_file", self.instance.video_file if self.instance else None)
        if video_url and video_file:
            raise serializers.ValidationError({
                "video_url": "Choose a video link or an uploaded video, not both."
            })
        return attrs


class LessonStudentSerializer(LessonSerializer):
    activities = ActivityStudentSerializer(many=True, read_only=True)

    class Meta(LessonSerializer.Meta):
        read_only_fields = LessonSerializer.Meta.fields


class ModuleSerializer(serializers.ModelSerializer):
    lessons = LessonSerializer(many=True, read_only=True)

    class Meta:
        model = Module
        fields = ["id", "course", "title", "order", "lessons"]


class ModuleListSerializer(serializers.ModelSerializer):
    """Titles/order only — no lesson content. This is all a student gets from
    /modules/ (lesson content comes from /lessons/, which enforces locking)."""
    class Meta:
        model = Module
        fields = ["id", "course", "title", "order"]


class CourseSerializer(serializers.ModelSerializer):
    instructor_name = serializers.CharField(source="instructor.get_full_name", read_only=True)
    module_count = serializers.IntegerField(source="modules.count", read_only=True)
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            "id", "title", "description", "instructor", "instructor_name",
            "module_count", "thumbnail", "thumbnail_url", "status", "created_at"
        ]
        read_only_fields = ["instructor", "thumbnail_url", "status"]

    def validate_thumbnail(self, value):
        if value is not None and value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("Cover image must be smaller than 5MB.")
        return value

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_thumbnail_url(self, obj):
        if not obj.thumbnail:
            return None

        url = obj.thumbnail.url
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(url)

        if url.startswith("http"):
            return url

        base_url = "http://localhost:8000"
        return f"{base_url}{url if url.startswith('/') else '/' + url}"


class CourseDetailSerializer(CourseSerializer):
    modules = ModuleListSerializer(many=True, read_only=True)

    class Meta(CourseSerializer.Meta):
        fields = CourseSerializer.Meta.fields + ["modules"]


class LiveSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = LiveSession
        fields = ["id", "course", "title", "starts_at", "meeting_url", "created_at"]
        read_only_fields = ["created_at"]

    def validate_meeting_url(self, value):
        if not value.lower().startswith("https://"):
            raise serializers.ValidationError("Use a secure meeting link starting with https://.")
        return value

    def validate_starts_at(self, value):
        if value <= timezone.now():
            raise serializers.ValidationError("Schedule the session for a future date and time.")
        return value
