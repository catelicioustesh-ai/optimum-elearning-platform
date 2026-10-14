from django.urls import path
from .views import (
    RegisterView,
    LoginView,
    LogoutView,
    CsrfTokenView,
    RefreshCookieView,
    MeView,
    MyProfilePhotoView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    ResendVerificationView,
    VerifyEmailView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("csrf/", CsrfTokenView.as_view(), name="csrf-token"),
    path("login/", LoginView.as_view(), name="login"),
    path("login/refresh/", RefreshCookieView.as_view(), name="login-refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", MeView.as_view(), name="me"),
    path("me/profile-photo/", MyProfilePhotoView.as_view(), name="me-profile-photo"),
    path("email/verify/", VerifyEmailView.as_view(), name="email-verify"),
    path("email/resend-verification/", ResendVerificationView.as_view(), name="email-resend-verification"),
    path("password-reset/", PasswordResetRequestView.as_view(), name="password-reset"),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
]
