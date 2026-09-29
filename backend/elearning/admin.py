from django.contrib import admin
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
)


admin.site.register(UserProfile)
admin.site.register(Course)
admin.site.register(Enrollment)
admin.site.register(LearningMaterial)
admin.site.register(Assignment)
admin.site.register(AssignmentSubmission)
admin.site.register(Quiz)
admin.site.register(Question)
admin.site.register(QuizOption)
admin.site.register(QuizAttempt)
admin.site.register(QuizAnswer)