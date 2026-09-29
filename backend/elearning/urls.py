from django.urls import path

from .views import (
    RegisterView,
    LoginView,
    LogoutView,

    UserProfileListCreateView,
    UserProfileDetailView,

    CourseListCreateView,
    CourseDetailView,
    MyCoursesView,

    EnrollmentListCreateView,
    EnrollmentDetailView,

    LearningMaterialListCreateView,
    LearningMaterialDetailView,
    CourseMaterialsView,

    AssignmentListCreateView,
    AssignmentDetailView,

    AssignmentSubmissionListCreateView,
    AssignmentSubmissionDetailView,

    QuizListCreateView,
    QuizDetailView,

    QuestionListCreateView,
    QuestionDetailView,

    QuizOptionListCreateView,
    QuizOptionDetailView,

    QuizAttemptListCreateView,
    QuizAttemptDetailView,

    QuizAnswerListCreateView,
    QuizAnswerDetailView,

    SubmitQuizView,

    InstructorDashboardView,
)


urlpatterns = [

    # =====================================================
    # AUTHENTICATION
    # =====================================================

    path(
        "register/",
        RegisterView.as_view(),
        name="register"
    ),

    path(
        "login/",
        LoginView.as_view(),
        name="login"
    ),

    path(
        "logout/",
        LogoutView.as_view(),
        name="logout"
    ),


    # =====================================================
    # USER PROFILES
    # =====================================================

    path(
        "profiles/",
        UserProfileListCreateView.as_view(),
        name="profile-list"
    ),

    path(
        "profiles/<int:pk>/",
        UserProfileDetailView.as_view(),
        name="profile-detail"
    ),


    # =====================================================
    # COURSES
    # =====================================================

    path(
        "courses/",
        CourseListCreateView.as_view(),
        name="course-list"
    ),

    path(
        "courses/<int:pk>/",
        CourseDetailView.as_view(),
        name="course-detail"
    ),

    path(
        "my-courses/",
        MyCoursesView.as_view(),
        name="my-courses"
    ),


    # =====================================================
    # ENROLLMENTS
    # =====================================================

    path(
        "enrollments/",
        EnrollmentListCreateView.as_view(),
        name="enrollment-list"
    ),

    path(
        "enrollments/<int:pk>/",
        EnrollmentDetailView.as_view(),
        name="enrollment-detail"
    ),


    # =====================================================
    # LEARNING MATERIALS
    # =====================================================

    path(
        "materials/",
        LearningMaterialListCreateView.as_view(),
        name="material-list"
    ),

    path(
        "materials/<int:pk>/",
        LearningMaterialDetailView.as_view(),
        name="material-detail"
    ),

    path(
        "courses/<int:course_id>/materials/",
        CourseMaterialsView.as_view(),
        name="course-materials"
    ),


    # =====================================================
    # ASSIGNMENTS
    # =====================================================

    path(
        "assignments/",
        AssignmentListCreateView.as_view(),
        name="assignment-list"
    ),

    path(
        "assignments/<int:pk>/",
        AssignmentDetailView.as_view(),
        name="assignment-detail"
    ),


    # =====================================================
    # ASSIGNMENT SUBMISSIONS
    # =====================================================

    path(
        "submissions/",
        AssignmentSubmissionListCreateView.as_view(),
        name="submission-list"
    ),

    path(
        "submissions/<int:pk>/",
        AssignmentSubmissionDetailView.as_view(),
        name="submission-detail"
    ),


    # =====================================================
    # QUIZZES
    # =====================================================

    path(
        "quizzes/",
        QuizListCreateView.as_view(),
        name="quiz-list"
    ),

    path(
        "quizzes/<int:pk>/",
        QuizDetailView.as_view(),
        name="quiz-detail"
    ),


    # =====================================================
    # QUESTIONS
    # =====================================================

    path(
        "questions/",
        QuestionListCreateView.as_view(),
        name="question-list"
    ),

    path(
        "questions/<int:pk>/",
        QuestionDetailView.as_view(),
        name="question-detail"
    ),


    # =====================================================
    # QUIZ OPTIONS
    # =====================================================

    path(
        "options/",
        QuizOptionListCreateView.as_view(),
        name="option-list"
    ),

    path(
        "options/<int:pk>/",
        QuizOptionDetailView.as_view(),
        name="option-detail"
    ),


    # =====================================================
    # QUIZ ATTEMPTS
    # =====================================================

    path(
        "attempts/",
        QuizAttemptListCreateView.as_view(),
        name="attempt-list"
    ),

    path(
        "attempts/<int:pk>/",
        QuizAttemptDetailView.as_view(),
        name="attempt-detail"
    ),


    # =====================================================
    # QUIZ ANSWERS
    # =====================================================

    path(
        "answers/",
        QuizAnswerListCreateView.as_view(),
        name="answer-list"
    ),

    path(
        "answers/<int:pk>/",
        QuizAnswerDetailView.as_view(),
        name="answer-detail"
    ),


    # =====================================================
    # SUBMIT QUIZ
    # =====================================================

    path(
        "quizzes/<int:quiz_id>/submit/",
        SubmitQuizView.as_view(),
        name="submit-quiz"
    ),


    # =====================================================
    # INSTRUCTOR DASHBOARD
    # =====================================================

    path(
        "instructor/dashboard/",
        InstructorDashboardView.as_view(),
        name="instructor-dashboard"
    ),
]