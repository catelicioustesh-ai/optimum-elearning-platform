from django.urls import path

from .views import (
    AdminDashboardView,
    ApproveLearnerView,
    AdminApproveAccountView,
    AdminAccountDetailView,
    AdminAccountListView,
    AdminVerifyAccountEmailView,
    PendingLearnerApprovalsView,
    InstructorDashboardView,
    StudentDashboardView,
)

urlpatterns = [
    path("student/", StudentDashboardView.as_view(), name="dashboard-student"),
    path("instructor/", InstructorDashboardView.as_view(), name="dashboard-instructor"),
    path("admin/", AdminDashboardView.as_view(), name="dashboard-admin"),
    path("admin/learner-approvals/", PendingLearnerApprovalsView.as_view(), name="dashboard-learner-approvals"),
    path("admin/learner-approvals/<int:learner_id>/approve/", ApproveLearnerView.as_view(), name="dashboard-learner-approve"),
    path("admin/accounts/", AdminAccountListView.as_view(), name="dashboard-admin-accounts"),
    path("admin/accounts/<int:account_id>/", AdminAccountDetailView.as_view(), name="dashboard-admin-account-detail"),
    path("admin/accounts/<int:account_id>/approve/", AdminApproveAccountView.as_view(), name="dashboard-admin-account-approve"),
    path("admin/accounts/<int:account_id>/verify-email/", AdminVerifyAccountEmailView.as_view(), name="dashboard-admin-account-verify-email"),
]
