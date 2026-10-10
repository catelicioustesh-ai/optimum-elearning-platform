from django.contrib.auth import get_user_model
from django.contrib.auth import authenticate
from django.contrib.auth.models import update_last_login
from django.contrib.auth.forms import SetPasswordForm
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import FileResponse
from mimetypes import guess_type
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import generics, permissions, status, serializers
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.views import TokenBlacklistView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.settings import api_settings
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

User = get_user_model()


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

        refresh = self.get_token(user)
        data = {"refresh": str(refresh), "access": str(refresh.access_token)}
        if api_settings.UPDATE_LAST_LOGIN:
            update_last_login(None, user)
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


class LogoutView(TokenBlacklistView):
    """POST /api/auth/logout/ — revoke the submitted refresh token."""
    permission_classes = [permissions.IsAuthenticated]


class MeView(APIView):
    """GET /api/auth/me/ — the currently authenticated user."""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    @extend_schema(responses=UserSerializer)
    def get(self, request):
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
        photo = request.user.profile_photo
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
        user = User.objects.filter(
            email__iexact=serializer.validated_data["email"],
            email_verified=False,
            is_active=True,
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
        user = _get_token_user(serializer.validated_data["uid"])
        if not user or user.email_verified or not email_verification_token.check_token(
            user, serializer.validated_data["token"]
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
        users = User.objects.filter(
            email__iexact=serializer.validated_data["email"],
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
        user = _get_token_user(serializer.validated_data["uid"])
        if not user or not password_reset_token.check_token(user, serializer.validated_data["token"]):
            return Response({"detail": "This password reset link is invalid or has expired."}, status=status.HTTP_400_BAD_REQUEST)

        form = SetPasswordForm(user, {
            "new_password1": serializer.validated_data["new_password"],
            "new_password2": serializer.validated_data["confirm_password"],
        })
        if not form.is_valid():
            errors = form.errors.get_json_data()
            message = next(iter(errors.values()))[0]["message"]
            raise serializers.ValidationError({"new_password": message})

        user = form.save()
        _blacklist_user_refresh_tokens(user)
        send_password_changed_email(user)
        return Response({"detail": "Password updated. Sign in with your new password."})


def _get_token_user(uid):
    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        return User.objects.get(pk=user_id, is_active=True)
    except (TypeError, ValueError, OverflowError, DjangoValidationError, User.DoesNotExist):
        return None


def _blacklist_user_refresh_tokens(user):
    from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

    for outstanding in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=outstanding)
