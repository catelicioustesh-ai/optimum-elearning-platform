# Authentication and Account Management Baseline

**Audit date:** 2026-10-22  
**Scope:** learner registration, email verification, account approval, administrator account management, and social sign-in.

## Verified implementation

- `backend/apps/accounts/models.py` defines a custom email-login `User` with `student`, `instructor`, and `admin` roles, plus separate `email_verified`, `is_approved`, and `is_active` fields. `ExternalIdentity` uses a provider/subject unique constraint.
- `backend/apps/accounts/serializers.py` omits role from public registration and creates inactive, unapproved learners with Django password hashing and password-policy validation.
- `backend/apps/accounts/views.py` exposes registration, login, logout, refresh, email verification/resend, password reset, and Google, Microsoft, and Apple ID-token login/link endpoints. Login tokens are set in HttpOnly cookies; login and social-login endpoints use CSRF protection.
- Verification links are signed, time-limited, and bound to the account state in `backend/apps/accounts/services.py`. Resend requests use a shared `password_reset` throttle scope.
- `backend/apps/dashboards/views.py` provides an admin-only pending-learner list and approval action. Approval requires prior email verification and separately activates the learner.
- The React app has learner registration, verification, login, and a platform overview with learner approval. The frontend has Google Identity Services, Microsoft MSAL popup, and Apple JS popup flows, backed by nonce and credential endpoints.
- Django Admin and `createsuperuser` remain available for trusted operator provisioning; public registration does not expose privileged roles.

## Baseline gaps and risks to address

1. **High functional priority — application account management is incomplete.** There is no paginated/searchable learner-and-instructor account list, account detail/history view, or administrator action that records an administrator-verified email separately from user/provider verification.
2. **High functional priority — resend feedback and abuse controls need improvement.** Registration does not report whether the email provider accepted the verification email. Resends are IP-throttled but have no per-address cooldown; the current generic response correctly avoids account enumeration.
3. **Medium — verification consumption is not explicitly serialized.** The endpoint checks a signed one-use token and updates the user, but does not lock the account during consumption to make concurrent use unambiguously single-use.
4. **Medium — social nonce replay window.** The backend checks the nonce cookie against the caller-supplied value and the signed token claim. The nonce is removed from the browser after success, but the server does not atomically record consumption, so parallel/replayed requests within the cookie lifetime are not explicitly rejected.
5. **Provider readiness is unverified externally.** Client-ID environment-variable hooks and callback/popup code exist, but provider-console configuration, deployed credentials/origins, and live callback behavior cannot be verified from this checkout.
6. **Social identity policy is deliberately restrictive.** New social accounts become verified-but-inactive learners awaiting admin approval; matching email addresses are not automatically linked; explicit linking requires authentication. Automated provider tests mock credential verification.

## Security review and validation baseline

- The required read-only security review found **no confirmed exploitable vulnerability** in the reviewed flows. Provider-console and production deployment settings were not externally verifiable.
- Frontend baseline lint: **passed** (`npm run lint`).
- Backend account/dashboard tests: **blocked before test discovery** because the current Python environment is missing `rest_framework_simplejwt`.
- Existing worktree changes observed before implementation: `docs/API_REFERENCE.md` (modified) and `COURSE_PUBLISHING_AUDIT.md` (untracked); they are unrelated and must be preserved.
