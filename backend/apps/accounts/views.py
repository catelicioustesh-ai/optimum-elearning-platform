from typing import TypedDict, cast

from django.contrib.auth import authenticate
from django.contrib.auth.models import update_last_login
from django.contrib.auth.forms import SetPasswordForm
from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from django.http import FileResponse
from mimetypes import guess_type
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from django.middleware.csrf import get_token, rotate_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework import generics, permissions, status, serializers
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer,
    TokenRefreshSerializer,
)
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema

from .models import User
from .serializers import (
    DetailResponseSerializer,
    EmailActionSerializer,
    EmailTokenSerializer,
    PasswordResetSerializer,
    RegisterSerializer,
    UserSerializer,
)
from .services import (
    email_verification_token,
    password_reset_token,
    send_password_changed_email,
    send_password_reset_email,
    send_verification_email,
)

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"


def set_auth_cookies(response, token_data):
    access_lifetime = api_settings.ACCESS_TOKEN_LIFETIME
    response.set_cookie(
        ACCESS_COOKIE,
        token_data["access"],
        max_age=int(access_lifetime.total_seconds()),
        httponly=True,
        secure=not settings.DEBUG,
        samesite="Lax",
        path="/api/",
    )
    refresh = token_data.get("refresh")
    if refresh:
        refresh_lifetime = api_settings.REFRESH_TOKEN_LIFETIME
        response.set_cookie(
            REFRESH_COOKIE,
            refresh,
            max_age=int(refresh_lifetime.total_seconds()),
            httponly=True,
            secure=not settings.DEBUG,
            samesite="Lax",
            path="/api/auth/",
        )
    response["Cache-Control"] = "no-store"


def clear_auth_cookies(response):
    response.delete_cookie(ACCESS_COOKIE, path="/api/", samesite="Lax")
    response.delete_cookie(REFRESH_COOKIE, path="/api/auth/", samesite="Lax")
    response["Cache-Control"] = "no-store"


class EmailActionData(TypedDict):
    email: str


class EmailTokenData(TypedDict):
    uid: str
    token: str


class PasswordResetData(EmailTokenData):
    new_password: str
    confirm_password: str


class RegisterView(generics.CreateAPIView):
    """POST /api/auth/register/ — open to anyone."""
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"

    def perform_create(self, serializer):
        user = serializer.save()
        send_verification_email(user)


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    SimpleJWT defaults to username+password. We log in with email,
    and embed the role in the token so the frontend can route by role
    without an extra API call.
    """
    username_field = User.USERNAME_FIELD

    def validate(self, attrs):
        # " Ann@Example.COM " and "ann@example.com" are the same account.
        # The password is deliberately left untouched (case-sensitive, untrimmed).
        email = attrs[self.username_field].strip().lower()
        user = authenticate(
            request=self.context.get("request"),
            **{self.username_field: email, "password": attrs["password"]},
        )
        if not user:
            raise AuthenticationFailed("Incorrect email or password.")

        refresh = cast(RefreshToken, self.get_token(user))
        data = {"refresh": str(refresh), "access": str(refresh.access_token)}
        self.user = user
        if api_settings.UPDATE_LAST_LOGIN:
            update_last_login(User, user)
        return data

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["email"] = user.email
        return token


class LoginView(TokenObtainPairView):
    """POST /api/auth/login/ — body: {"email": ..., "password": ...}"""
    serializer_class = EmailTokenObtainPairSerializer
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"

    @method_decorator(csrf_protect)
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rotate_token(request)
        response = Response({
            "user": UserSerializer(serializer.user, context={"request": request}).data,
            "csrfToken": get_token(request),
        })
        set_auth_cookies(response, serializer.validated_data)
        return response


class CsrfTokenView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        response = Response({"csrfToken": get_token(request)})
        response["Cache-Control"] = "no-store"
        return response


class RefreshCookieView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"

    @method_decorator(csrf_protect)
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)

    def post(self, request):
        refresh = request.COOKIES.get(REFRESH_COOKIE)
        if not refresh:
            raise AuthenticationFailed("No refresh session is available.")
        serializer = TokenRefreshSerializer(data={"refresh": refresh})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:
            raise AuthenticationFailed("No valid refresh session is available.") from exc
        response = Response({"detail": "Session refreshed."})
        set_auth_cookies(response, serializer.validated_data)
        return response


class LogoutView(APIView):
    """POST /api/auth/logout/ — revoke the refresh cookie and clear the session."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = "auth"

    @method_decorator(csrf_protect)
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)

    def post(self, request):
        refresh = request.COOKIES.get(REFRESH_COOKIE)
        response = Response(status=status.HTTP_204_NO_CONTENT)
        clear_auth_cookies(response)
        if refresh:
            try:
                RefreshToken(refresh).blacklist()
            except TokenError:
                pass
        return response


class MeView(APIView):
    """GET /api/auth/me/ — the currently authenticated user."""
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_permissions(self):
        permission_class = (
            permissions.AllowAny
            if self.request.method == "GET"
            else permissions.IsAuthenticated
        )
        return [permission_class()]

    @extend_schema(responses={200: UserSerializer, 204: None})
    def get(self, request):
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(UserSerializer(request.user, context={"request": request}).data)

    @extend_schema(request=UserSerializer, responses=UserSerializer)
    def patch(self, request):
        serializer = UserSerializer(
            request.user,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class MyProfilePhotoView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        responses={
            (200, "image/*"): OpenApiTypes.BINARY,
            404: None,
        }
    )
    def get(self, request):
        user = cast(User, request.user)
        photo = user.profile_photo
        if not photo:
            return Response(status=status.HTTP_404_NOT_FOUND)
        response = FileResponse(
            photo.open("rb"),
            content_type=guess_type(photo.name)[0] or "application/octet-stream",
        )
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response


class ResendVerificationView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "password_reset"

    @extend_schema(
        request=EmailActionSerializer,
        responses={200: DetailResponseSerializer},
    )
    def post(self, request):
        serializer = EmailActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = cast(EmailActionData, serializer.validated_data)
        user = User.objects.filter(
            email__iexact=validated_data["email"],
            email_verified=False,
        ).filter(
            Q(is_active=True) | Q(is_approved=False),
        ).first()
        if user and user.has_usable_password():
            send_verification_email(user)
        return Response({
            "detail": "If an unverified account exists for that address, a verification link will be sent."
        })


class VerifyEmailView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"

    @extend_schema(
        request=EmailTokenSerializer,
        responses={200: DetailResponseSerializer, 400: DetailResponseSerializer},
    )
    def post(self, request):
        serializer = EmailTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = cast(EmailTokenData, serializer.validated_data)
        user = _get_token_user(validated_data["uid"], include_inactive=True)
        if not user or user.email_verified or not email_verification_token.check_token(
            user, validated_data["token"]
        ):
            return Response({"detail": "This verification link is invalid or has expired."}, status=status.HTTP_400_BAD_REQUEST)
        user.email_verified = True
        user.save(update_fields=["email_verified"])
        return Response({"detail": "Email address verified successfully."})


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "password_reset"

    @extend_schema(
        request=EmailActionSerializer,
        responses={200: DetailResponseSerializer},
    )
    def post(self, request):
        serializer = EmailActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = cast(EmailActionData, serializer.validated_data)
        users = User.objects.filter(
            email__iexact=validated_data["email"],
            is_active=True,
        )
        for user in users:
            if user.has_usable_password():
                send_password_reset_email(user)
        return Response({
            "detail": "If an account exists for that address, password reset instructions will be sent."
        })


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "password_reset"

    @extend_schema(
        request=PasswordResetSerializer,
        responses={200: DetailResponseSerializer, 400: DetailResponseSerializer},
    )
    def post(self, request):
        serializer = PasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = cast(PasswordResetData, serializer.validated_data)
        user = _get_token_user(validated_data["uid"])
        if not user or not password_reset_token.check_token(user, validated_data["token"]):
            return Response({"detail": "This password reset link is invalid or has expired."}, status=status.HTTP_400_BAD_REQUEST)

        form = SetPasswordForm(user, {
            "new_password1": validated_data["new_password"],
            "new_password2": validated_data["confirm_password"],
        })
        if not form.is_valid():
            errors = form.errors.get_json_data() or {}
            message = None
            for field_errors in errors.values():
                if not isinstance(field_errors, list):
                    continue
                for error in field_errors:
                    if isinstance(error, dict):
                        message = error.get("message")
                    elif isinstance(error, str):
                        message = error
                    if message:
                        break
                if message:
                    break
            if not message:
                message = "Please correct the highlighted password errors."
            raise serializers.ValidationError({"new_password": message})

        user = form.save()
        _blacklist_user_refresh_tokens(user)
        send_password_changed_email(user)
        return Response({"detail": "Password updated. Sign in with your new password."})


def _get_token_user(uid, *, include_inactive=False):
    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        users = User.objects
        if not include_inactive:
            users = users.filter(is_active=True)
        return users.get(pk=user_id)
    except (TypeError, ValueError, OverflowError, DjangoValidationError, User.DoesNotExist):
        return None


def _blacklist_user_refresh_tokens(user):
    from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

    for outstanding in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=outstanding)