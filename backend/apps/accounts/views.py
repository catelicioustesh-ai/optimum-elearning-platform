from typing import TypedDict, cast
import secrets
from uuid import uuid4
from hashlib import sha256

from django.contrib.auth import authenticate
from django.contrib.auth.models import update_last_login
from django.contrib.auth.forms import SetPasswordForm
from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import FileResponse
from mimetypes import guess_type
from django.utils.encoding import force_str
from django.utils import timezone
from django.utils.http import urlsafe_base64_decode
from django.middleware.csrf import get_token, rotate_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework import generics, permissions, status, serializers
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.exceptions import APIException, AuthenticationFailed, PermissionDenied
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

from .models import AccountAuditEvent, EmailVerificationMethod, ExternalIdentity, Role, User
from .serializers import (
    DetailResponseSerializer,
    EmailActionSerializer,
    EmailTokenSerializer,
    ExternalProviderLoginSerializer,
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
SOCIAL_NONCE_COOKIE = "social_login_nonce"


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

    def create(self, request, *args, **kwargs):
        self.verification_email_sent = False
        response = super().create(request, *args, **kwargs)
        response.data["verification_email_sent"] = self.verification_email_sent
        response.data["detail"] = (
            "Account created. Check your email for a verification link."
            if self.verification_email_sent
            else "Account created, but the verification email could not be sent. Please try resending it."
        )
        return response

    def perform_create(self, serializer):
        user = serializer.save()
        self.verification_email_sent = bool(send_verification_email(user))


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
        if not user.email_verified or not user.is_approved:
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


class ExternalVerificationUnavailable(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "The identity provider is temporarily unavailable. Please try again shortly."
    default_code = "identity_provider_unavailable"


def verify_google_credential(credential):
    """Verify the browser credential against Google's signing keys and our audience."""
    from google.auth.exceptions import GoogleAuthError
    from google.auth.transport.requests import Request as GoogleRequest
    from google.oauth2 import id_token
    from requests.exceptions import RequestException

    try:
        claims = id_token.verify_oauth2_token(
            credential,
            GoogleRequest(),
            audience=settings.GOOGLE_OAUTH_CLIENT_ID,
        )
    except ValueError as exc:
        raise AuthenticationFailed("The Google credential is invalid or has expired.") from exc
    except (GoogleAuthError, RequestException) as exc:
        raise ExternalVerificationUnavailable() from exc

    email = claims.get("email")
    if (
        not claims.get("sub")
        or not isinstance(email, str)
        or not email.strip()
        or claims.get("email_verified") is not True
    ):
        raise AuthenticationFailed("Google must provide a verified email address to sign in.")
    return claims


def verify_microsoft_credential(credential):
    import jwt
    from jwt.exceptions import PyJWKClientError
    from requests.exceptions import RequestException

    client_id = settings.MICROSOFT_OAUTH_CLIENT_ID
    if not client_id:
        raise ExternalVerificationUnavailable(
            "Microsoft sign-in has not been configured. Please use another sign-in method."
        )

    try:
        key = jwt.PyJWKClient(
            "https://login.microsoftonline.com/common/discovery/v2.0/keys"
        ).get_signing_key_from_jwt(credential).key
        claims = jwt.decode(
            credential,
            key,
            algorithms=["RS256"],
            audience=client_id,
            options={"verify_iss": False},
        )
    except (jwt.PyJWTError, PyJWKClientError, RequestException) as exc:
        raise AuthenticationFailed("The Microsoft credential is invalid or has expired.") from exc

    tenant_id = claims.get("tid")
    if (
        not isinstance(tenant_id, str)
        or claims.get("ver") != "2.0"
        or claims.get("iss") != f"https://login.microsoftonline.com/{tenant_id}/v2.0"
    ):
        raise AuthenticationFailed("The Microsoft credential has an invalid issuer.")
    return claims


def verify_apple_credential(credential):
    import jwt
    from jwt.exceptions import PyJWKClientError
    from requests.exceptions import RequestException

    client_id = settings.APPLE_OAUTH_CLIENT_ID
    if not client_id:
        raise ExternalVerificationUnavailable(
            "Apple sign-in has not been configured. Please use another sign-in method."
        )

    try:
        key = jwt.PyJWKClient(
            "https://appleid.apple.com/auth/keys"
        ).get_signing_key_from_jwt(credential).key
        claims = jwt.decode(
            credential,
            key,
            algorithms=["RS256"],
            audience=client_id,
            issuer="https://appleid.apple.com",
        )
    except (jwt.PyJWTError, PyJWKClientError, RequestException) as exc:
        raise AuthenticationFailed("The Apple credential is invalid or has expired.") from exc
    return claims


def verify_provider_credential(provider, credential):
    verifiers = {
        ExternalIdentity.Provider.GOOGLE: verify_google_credential,
        ExternalIdentity.Provider.MICROSOFT: verify_microsoft_credential,
        ExternalIdentity.Provider.APPLE: verify_apple_credential,
    }
    client_id_setting = {
        ExternalIdentity.Provider.GOOGLE: "GOOGLE_OAUTH_CLIENT_ID",
        ExternalIdentity.Provider.MICROSOFT: "MICROSOFT_OAUTH_CLIENT_ID",
        ExternalIdentity.Provider.APPLE: "APPLE_OAUTH_CLIENT_ID",
    }
    client_id = getattr(settings, client_id_setting.get(provider, ""), "")
    if not client_id:
        provider_name = provider.title() if provider else "Social"
        raise ExternalVerificationUnavailable(
            f"{provider_name} sign-in has not been configured. Please use your email and password."
        )

    claims = verifiers[provider](credential)
    email = claims.get("email")
    if provider == ExternalIdentity.Provider.MICROSOFT:
        verified = claims.get("email_verified") is True
    elif provider == ExternalIdentity.Provider.APPLE:
        verified = claims.get("email_verified") in (True, "true")
    else:
        verified = claims.get("email_verified") is True

    if not claims.get("sub"):
        raise AuthenticationFailed(f"{provider.title()} did not provide a stable account identifier.")

    if provider == ExternalIdentity.Provider.MICROSOFT:
        claims["email_verified"] = verified
        if isinstance(email, str) and email.strip():
            try:
                claims["email"] = serializers.EmailField().run_validation(email).strip()
            except serializers.ValidationError:
                claims.pop("email", None)
        else:
            claims.pop("email", None)
        return claims

    if not isinstance(email, str) or not email.strip() or not verified:
        raise AuthenticationFailed(
            f"{provider.title()} must provide a verified email address to sign in."
        )
    try:
        claims["email"] = serializers.EmailField().run_validation(email).strip()
    except serializers.ValidationError as exc:
        raise AuthenticationFailed(
            f"{provider.title()} did not provide a valid email address."
        ) from exc
    claims["email_verified"] = True
    return claims


def resolve_external_user(provider, claims, contact_email=None):
    """Resolve a linked identity or create a pending learner account."""
    subject = claims["sub"]
    try:
        with transaction.atomic():
            identity = ExternalIdentity.objects.select_related("user").filter(
                provider=provider,
                subject=subject,
            ).first()
            if identity:
                user = identity.user
            else:
                provider_email = claims.get("email")
                provider_email = (
                    provider_email.strip().lower()
                    if isinstance(provider_email, str)
                    else ""
                )
                email_verified = claims.get("email_verified") is True
                email = provider_email if email_verified else (
                    provider_email or contact_email or ""
                )
                if not email:
                    raise AuthenticationFailed(
                        f"{provider.title()} did not provide an email address for this account."
                    )

                user = User.objects.select_for_update().filter(email__iexact=email).first()
                if user:
                    raise AuthenticationFailed(
                        "An LMS account already uses this email. Sign in to that account first; "
                        "provider accounts cannot be linked automatically."
                    )
                else:
                    user = User.objects.create_user(
                        username=f"{provider}_{uuid4().hex[:12]}",
                        email=email,
                        password=None,
                        first_name=str(claims.get("given_name", ""))[:150],
                        last_name=str(claims.get("family_name", ""))[:150],
                        role=Role.STUDENT,
                        email_verified=email_verified,
                        email_verification_method=(
                            EmailVerificationMethod.PROVIDER if email_verified else ""
                        ),
                        email_verified_at=timezone.now() if email_verified else None,
                        is_approved=False,
                        is_active=False,
                    )
                    ExternalIdentity.objects.create(
                        user=user,
                        provider=provider,
                        subject=subject,
                    )
        return user
    except IntegrityError as exc:
        # A simultaneous first sign-in may have created the unique email or subject.
        identity = ExternalIdentity.objects.select_related("user").filter(
            provider=provider,
            subject=subject,
        ).first()
        if identity:
            return identity.user
        raise AuthenticationFailed(
            f"{provider.title()} sign-in could not be completed because this account was updated at the same time. Please try again."
        ) from exc


def send_verification_email_with_cooldown(user):
    cooldown_key = f"verification_resend:{sha256(user.email.encode()).hexdigest()}"
    if not cache.add(
        cooldown_key,
        True,
        timeout=settings.EMAIL_VERIFICATION_RESEND_COOLDOWN,
    ):
        return False
    if not send_verification_email(user):
        cache.delete(cooldown_key)
        return False
    return True


def validate_social_nonce(request, claims, nonce, *, consume=True):
    cookie_nonce = request.COOKIES.get(SOCIAL_NONCE_COOKIE, "")
    token_nonce = claims.get("nonce", "")
    if (
        not cookie_nonce
        or not secrets.compare_digest(cookie_nonce, nonce)
        or not isinstance(token_nonce, str)
        or not secrets.compare_digest(cookie_nonce, token_nonce)
    ):
        raise AuthenticationFailed("The sign-in request expired. Please start again.")
    nonce_key = f"social_nonce_consumed:{sha256(cookie_nonce.encode()).hexdigest()}"
    if consume and not cache.add(nonce_key, True, timeout=300):
        raise AuthenticationFailed("The sign-in request has already been used. Please start again.")


def link_external_identity(user, provider, claims):
    subject = claims["sub"]
    try:
        with transaction.atomic():
            identity = ExternalIdentity.objects.select_for_update().filter(
                provider=provider,
                subject=subject,
            ).first()
            if identity:
                if identity.user_id != user.pk:
                    raise PermissionDenied(
                        f"This {provider.title()} account is already linked to another LMS account."
                    )
                return

            existing = ExternalIdentity.objects.select_for_update().filter(
                user=user,
                provider=provider,
            ).first()
            if existing:
                raise PermissionDenied(
                    f"This LMS account is already linked to a different {provider.title()} account."
                )
            ExternalIdentity.objects.create(
                user=user,
                provider=provider,
                subject=subject,
            )
    except IntegrityError as exc:
        identity = ExternalIdentity.objects.filter(
            provider=provider,
            subject=subject,
            user=user,
        ).first()
        if identity:
            return
        raise PermissionDenied(
            f"This {provider.title()} account could not be linked because the account was updated at the same time. Please try again."
        ) from exc


class ExternalProviderLoginView(APIView):
    """Verify a provider ID token and issue the usual cookie session."""
    provider = None
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = "auth"

    @method_decorator(csrf_protect)
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)

    @extend_schema(request=ExternalProviderLoginSerializer, responses={200: UserSerializer})
    def post(self, request):
        serializer = ExternalProviderLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        claims = verify_provider_credential(self.provider, serializer.validated_data["credential"])
        nonce = serializer.validated_data["nonce"]
        validate_social_nonce(request, claims, nonce, consume=False)

        contact_email = serializer.validated_data.get("contact_email")
        if (
            self.provider == ExternalIdentity.Provider.MICROSOFT
            and not claims.get("email")
            and not contact_email
            and not ExternalIdentity.objects.filter(
                provider=self.provider,
                subject=claims["sub"],
            ).exists()
        ):
            response = Response(
                {
                    "code": "contact_email_required",
                    "detail": "Microsoft did not provide an email address. Enter a contact email to receive a verification link.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
            return response

        validate_social_nonce(request, claims, nonce)
        user = resolve_external_user(self.provider, claims, contact_email=contact_email)

        if not user.email_verified:
            verification_email_sent = send_verification_email_with_cooldown(user)
            response = Response(
                {
                    "detail": (
                        "Verify your email before signing in. "
                        "A verification link was sent if delivery is available."
                    ),
                    "verification_email_sent": verification_email_sent,
                },
                status=status.HTTP_403_FORBIDDEN,
            )
            response.delete_cookie(SOCIAL_NONCE_COOKIE, path="/api/auth/", samesite="Lax")
            return response

        if not user.is_approved:
            response = Response(
                {"detail": f"Your verified email is linked to a {user.role} account awaiting administrator approval."},
                status=status.HTTP_403_FORBIDDEN,
            )
            response.delete_cookie(SOCIAL_NONCE_COOKIE, path="/api/auth/", samesite="Lax")
            return response
        if not user.is_active:
            response = Response(
                {"detail": "This account is not currently active. Please contact an administrator."},
                status=status.HTTP_403_FORBIDDEN,
            )
            response.delete_cookie(SOCIAL_NONCE_COOKIE, path="/api/auth/", samesite="Lax")
            return response

        refresh = EmailTokenObtainPairSerializer.get_token(user)
        token_data = {"refresh": str(refresh), "access": str(refresh.access_token)}
        if api_settings.UPDATE_LAST_LOGIN:
            update_last_login(User, user)
        rotate_token(request)
        response = Response({
            "user": UserSerializer(user, context={"request": request}).data,
            "csrfToken": get_token(request),
        })
        set_auth_cookies(response, token_data)
        response.delete_cookie(SOCIAL_NONCE_COOKIE, path="/api/auth/", samesite="Lax")
        return response


class GoogleLoginView(ExternalProviderLoginView):
    provider = ExternalIdentity.Provider.GOOGLE


class MicrosoftLoginView(ExternalProviderLoginView):
    provider = ExternalIdentity.Provider.MICROSOFT


class AppleLoginView(ExternalProviderLoginView):
    provider = ExternalIdentity.Provider.APPLE


class ExternalProviderLinkView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "auth"

    @method_decorator(csrf_protect)
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)

    @extend_schema(request=ExternalProviderLoginSerializer, responses={200: DetailResponseSerializer})
    def post(self, request, provider):
        if provider not in ExternalIdentity.Provider.values:
            raise serializers.ValidationError({"provider": "Choose a supported identity provider."})

        serializer = ExternalProviderLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        claims = verify_provider_credential(provider, serializer.validated_data["credential"])
        validate_social_nonce(request, claims, serializer.validated_data["nonce"])
        link_external_identity(request.user, provider, claims)

        response = Response({"detail": f"{provider.title()} account linked."})
        response.delete_cookie(SOCIAL_NONCE_COOKIE, path="/api/auth/", samesite="Lax")
        return response


class SocialLoginNonceView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        nonce = secrets.token_urlsafe(32)
        response = Response({"nonce": nonce})
        response.set_cookie(
            SOCIAL_NONCE_COOKIE,
            nonce,
            max_age=300,
            httponly=True,
            secure=not settings.DEBUG,
            samesite="Lax",
            path="/api/auth/",
        )
        response["Cache-Control"] = "no-store"
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
    throttle_scope = "email_resend"

    @extend_schema(
        request=EmailActionSerializer,
        responses={200: DetailResponseSerializer},
    )
    def post(self, request):
        serializer = EmailActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = cast(EmailActionData, serializer.validated_data)
        email = validated_data["email"]
        user = User.objects.filter(
            email__iexact=email,
            email_verified=False,
        ).filter(
            Q(is_active=True) | Q(is_approved=False),
        ).first()
        if user and user.has_usable_password():
            send_verification_email_with_cooldown(user)
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
        if not user:
            return Response({"detail": "This verification link is invalid or has expired."}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            user = User.objects.select_for_update().filter(pk=user.pk).first()
            if not user or user.email_verified or not email_verification_token.check_token(
                user, validated_data["token"]
            ):
                return Response({"detail": "This verification link is invalid or has expired."}, status=status.HTTP_400_BAD_REQUEST)
            user.email_verified = True
            user.email_verification_method = EmailVerificationMethod.SELF
            user.email_verified_at = timezone.now()
            user.email_verified_by = None
            user.save(update_fields=[
                "email_verified",
                "email_verification_method",
                "email_verified_at",
                "email_verified_by",
            ])
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