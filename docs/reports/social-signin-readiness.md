# Social Sign-In Readiness Report

**Project:** Optimum ERP LMS  
**Audit date:** 2026-10-22  
**Environment examined:** checked-out development repository and local settings; no live provider flow exercised.

## 1. Executive summary

Google, Microsoft, and Apple sign-in are implemented as browser-side OpenID Connect ID-token acquisition followed by backend verification and local account resolution. They are not merely decorative buttons: each configured frontend flow obtains a provider credential and posts it to a provider-specific API endpoint. The backend validates tokens, uses a signed/nonce-bound request flow, stores identities by provider and subject, rejects email-only auto-linking, and does not grant new users privileged roles.

All three client-ID settings are **missing in the current runtime**. The frontend `.env.example` values are blank, the backend returns a not-configured response when client IDs are missing, and no real provider-console application, callback, or live sign-in was verified. Current overall state is **Prototype**, not staging- or production-ready.

The account-management implementation now provides a separate LMS admin account list/detail/review workflow. Applicants may register as learners or instructors; both require email verification and separate admin approval. Manual email verification records an administrator method, actor, and time. See [auth-baseline-findings.md](./auth-baseline-findings.md) for baseline scope and constraints.

## 2. Providers discovered

| Provider | Frontend | Backend | Current client ID present? | Live flow verified? |
|---|---|---|---|---|
| Google | Google Identity Services | Google Auth ID-token verifier | No | No |
| Microsoft | MSAL Browser popup | PyJWT/JWKS verifier | No | No |
| Apple | Apple JS popup | PyJWT/JWKS verifier | No | No |

No other sign-in provider is wired in the inspected frontend/backend flow.

## 3. Authentication architecture and sequence

1. React login page reads the public provider client ID from `VITE_GOOGLE_CLIENT_ID`, `VITE_MICROSOFT_CLIENT_ID`, or `VITE_APPLE_CLIENT_ID`.
2. Before starting authentication it obtains a one-time backend nonce from `GET /api/auth/social/nonce/`. The API places the nonce in a short-lived HttpOnly cookie.
3. The provider browser SDK obtains an ID token. Google receives the nonce when initializing GIS; MSAL receives it in the popup request; Apple JS receives it in `auth.init`. The app also compares Apple's returned state with the generated state; no application-owned redirect callback route is present.
4. React posts `{credential, nonce}` to `POST /api/auth/google/`, `/microsoft/`, or `/apple/`.
5. Django verifies signature, issuer/audience/expiry according to provider verifier, then compares the ID token nonce with the short-lived nonce cookie and request body.
6. `ExternalIdentity(provider, subject)` is the stable local provider link. A new identity cannot silently attach to an existing account by email. Explicit linking requires an authenticated local session and CSRF protection.
7. A new social identity creates an inactive, unapproved learner. Verified Google/Apple (or Microsoft) email claims are recorded as provider-verified. When Microsoft omits email, the UI requests a contact address, sends an email challenge, and does not consider that address verified until the link is used. An unlinked identity with an email already used locally is rejected. No access/refresh cookie is issued before the local policy permits login.
8. Approved, active linked accounts receive the same HttpOnly cookie JWT session as password users.

Password login uses email and password. Learner and instructor registration each require an email challenge followed by distinct admin approval.

## 4. Findings and evidence

### Security strengths confirmed in source

- Public registration accepts only learner or instructor roles, validates passwords with Django validators, stores Django password hashes, and creates inactive/unapproved accounts: `backend/apps/accounts/serializers.py` (`RegisterSerializer`); `backend/apps/accounts/views.py` (`RegisterView`).
- Login rejects unverified or unapproved users; auth tokens are HttpOnly cookies and state-changing auth actions use CSRF protection: `backend/apps/accounts/views.py` (`EmailTokenObtainPairSerializer`, `LoginView`, `set_auth_cookies`).
- Email-verification tokens are signed, expire using `EMAIL_VERIFICATION_TIMEOUT`, and become unusable after verification; verification now stores method and timestamp and serializes consumption under a user-row lock: `backend/apps/accounts/services.py`; `backend/apps/accounts/views.py:687-719`.
- Social identity uniqueness is constrained by provider and subject and by user/provider: `backend/apps/accounts/models.py` (`ExternalIdentity`), `backend/apps/accounts/migrations/0005_externalidentity.py`.
- New social users receive the learner role and await approval; matching local email does not link accounts. Microsoft email claims are not assumed verified; when absent, the user supplies a contact address that is verified through the existing email-link flow: `backend/apps/accounts/views.py` (`verify_provider_credential`, `resolve_external_user`, `ExternalProviderLoginView`); `frontend/src/pages/Login.jsx`.
- Social nonce replays are rejected using atomic cache insertion. This relies on a shared cache for consistent behavior across multiple workers: `backend/apps/accounts/views.py` (`validate_social_nonce`).
- Account-review endpoints require authenticated `admin` role; normal learners/instructors are explicitly denied. Email verification and approval are separate actions for either role: `backend/apps/dashboards/views.py` (`AdminAccountListView`, `AdminAccountDetailView`, `AdminVerifyAccountEmailView`, `AdminApproveAccountView`).

### Severity-ranked functional/readiness findings

| Severity | Finding | Evidence / consequence |
|---|---|---|
| High — release blocker | Provider client IDs are absent in the examined runtime; no provider can pass the backend configuration guard. | `backend/config/settings.py` reads three optional IDs; current runtime reports each missing. `.env.example` contains empty placeholders. |
| High — release blocker | Provider-console setup, authorized origins/redirect URIs, supported account types, HTTPS origins, callback behavior, and production credentials are not externally verified. | No access to provider consoles or production deployment configuration in this audit. |
| Medium | Automated tests mock the central provider-verification function for sign-in flows; real signature/key/issuer/audience/nonce failure cases are not fully demonstrated by live or fixture-signed end-to-end tests. | `backend/apps/accounts/tests.py` (`ExternalProviderLoginTests`); ordinary suite must remain credential-free. |
| Medium | Microsoft uses the `common` authority and accepts the issuer for the validated tenant ID without an allowlisted tenant policy. This is a broad multi-tenant/personal-account posture, not evidence of a token-signature bypass; business tenant restrictions must be decided and configured before deployment. | `frontend/src/pages/Login.jsx` MSAL authority; `backend/apps/accounts/views.py` (`verify_microsoft_credential`). |
| Medium | First-time Microsoft accounts require a contact address if the ID token contains no email. The supplied address is not treated as verified; a real email challenge is required before administrator approval. | `frontend/src/pages/Login.jsx`; `backend/apps/accounts/views.py` (`ExternalProviderLoginView`, `resolve_external_user`). |
| Medium | Django defaults to local-memory cache. The nonce replay guard and address resend cooldown do not coordinate across workers unless deployment configures a shared cache. | `backend/config/settings.py` and `backend/apps/accounts/views.py` (`validate_social_nonce`, `ResendVerificationView`). |
| Low | There is no backend OAuth authorization-code callback route; the app uses browser SDK popup ID-token flows instead. Provider return URLs belong to the SDK/application registration, and live behavior remains unverified. | `frontend/src/pages/Login.jsx`; provider endpoints in `backend/apps/accounts/urls.py`. |

The read-only security review found **no confirmed exploitable vulnerability** in the reviewed registration, verification, approval, authorization, or social sign-in paths. This conclusion does not certify provider-console configuration or deployed infrastructure.

## 5. Scores and rubric

Scoring uses the requested six categories and awards points only for code demonstrated in this checkout. The configuration score is low because placeholders are not deployment evidence. The testing score reflects mocked/local automated coverage only; it does not imply external provider integration was exercised.

| Category | Maximum |
|---|---:|
| Frontend authorization and callback flow | 15 |
| Backend identity/token validation | 25 |
| Secure account creation and linking | 20 |
| Local account, role, and verification policy | 15 |
| Configuration and deployment readiness | 10 |
| Automated and integration test coverage | 15 |

| Provider | Frontend | Backend | Creation/link | Local policy | Config | Tests | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| Google | 11 | 25 | 18 | 15 | 2 | 10 | **81/100** |
| Microsoft | 11 | 22 | 18 | 14 | 2 | 9 | **76/100** |
| Apple | 11 | 24 | 18 | 14 | 2 | 9 | **78/100** |
| Combined mean | — | — | — | — | — | — | **78/100** |

Score evidence:

- **Frontend:** all three have real SDK-backed popup/credential acquisition, UI error handling, and a backend exchange. Deductions reflect missing live configuration/callback exercise and no independently demonstrated browser cancellation/retry automation.
- **Backend:** Google uses `google-auth` token verification against its configured audience. Microsoft and Apple use PyJWT with provider JWKS and explicit issuer/audience checks (Microsoft issuer checked against the token's tenant ID). The shared endpoint additionally requires the configured client ID, a stable `sub`, and the nonce. Microsoft loses points for no tenant allowlist when `common` is selected; all three lose a small amount for integration behavior only tested with mocks.
- **Creation/linking:** `ExternalIdentity` has uniqueness constraints; email equality alone never links; explicit linking requires authentication. Deductions are for lack of adversarial concurrency/provider-claim integration evidence.
- **Local policy:** new social accounts are learners, pending approval, and receive no JWT until active, email-verified, and approved. Verified provider claims can establish email verification; Microsoft accounts without a verified email claim must complete an email challenge. Matching local emails never create an automatic link.
- **Configuration:** only code hooks and example names are present. All three runtime IDs are absent; console origins, redirect URIs, tenant policy, and production HTTPS configuration are unverified.
- **Tests:** automated tests exercise mocked provider credential resolution, approval policy, subject linking, and nonce checks. Mocking the main credential-verifier means provider cryptographic validation is not proven by a real, signed fixture through all endpoints, and no real callback has been tested.

A high numeric score is **not** a production certification. Missing provider IDs and unverified console/deployment settings keep every provider below staging readiness.

## 6. Requirement checklist

| Requirement | State | Evidence or remaining condition |
|---|---|---|
| Provider buttons initiate actual SDK flows when configured | Complete in source | GIS, MSAL popup, Apple JS popup in `frontend/src/pages/Login.jsx`; no live app IDs. |
| Loading, failure, and retry feedback | Partial | Shared busy/error state and provider-specific network/load errors exist; cancellation and retry not browser-tested. |
| State/nonce binding | Partial-to-complete in source | Backend cookie/body/token nonce checks and replay rejection; Apple response state is compared and MSAL uses its state validation; shared cache is required across workers. |
| PKCE | Partial / SDK-managed | MSAL browser popup uses MSAL-managed authorization-code flow protections; verify deployed SDK/config behavior. Google GIS and Apple JS use their respective SDK-managed flows; no custom backend PKCE flow. |
| Backend signature, issuer, audience, expiration validation | Complete in source, not externally integration-tested | Provider-specific verifier functions and SDK/library JWKS verification. |
| Stable provider identity key | Complete in source | Provider and `sub` uniqueness constraint. |
| No automatic account linking by email | Complete and unit-tested | Existing local matching email is rejected; explicit authenticated linking route is separate. |
| Default learner role and approval | Complete and unit-tested | New external users are inactive, unapproved learners. |
| Microsoft first sign-in when token omits email | Complete in source and covered by mocked test | The UI requests a contact email, backend sends the verification link, and approval remains blocked until verification. |
| Provider credentials/client IDs | Missing in current runtime | All three server-side IDs absent; all three frontend example IDs empty. |
| Provider console setup and actual callback | Externally unverified | Must be confirmed by deployment owner. |
| Real provider flow in authorized environment | Not run | Requires client IDs, provider console and browser/device testing. |

## 7. Required settings and provider-console checklist

No secret values are included in this report. Runtime inspection showed these client-ID settings are **missing**:

- Backend: `GOOGLE_OAUTH_CLIENT_ID`, `MICROSOFT_OAUTH_CLIENT_ID`, `APPLE_OAUTH_CLIENT_ID`.
- Frontend build: `VITE_GOOGLE_CLIENT_ID`, `VITE_MICROSOFT_CLIENT_ID`, `VITE_APPLE_CLIENT_ID`.
- Apple return URL: `VITE_APPLE_REDIRECT_URI` is optional in code and defaults to the frontend origin; exact Apple registration is unverified.

Deployment owner must configure matching public client identifiers, provider application registrations, allowed frontend origins and SDK return URLs/redirect URIs, intended Microsoft account types/tenant policy, HTTPS production origins, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` via that origin list, and a shared Django cache. Keep provider client secrets (where a provider requires one) on the server only; never add them to `VITE_*` variables. Email delivery must also be configured and independently tested for learner registration.

Related email and link settings to configure and validate are `EMAIL_BACKEND`,
`EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`,
`EMAIL_USE_TLS`, `DEFAULT_FROM_EMAIL`, `FRONTEND_URL`,
`EMAIL_VERIFICATION_TIMEOUT`, and `EMAIL_VERIFICATION_RESEND_COOLDOWN`.
The local `FRONTEND_URL` determines the verification-link host; production
requires HTTPS.

## 8. Automated test evidence

Executed during this audit:

- `python manage.py check` (configured MSSQL): **passed**, no issues.
- `python manage.py makemigrations --check --dry-run accounts` (configured MSSQL): **passed**, no model/migration drift.
- `python manage.py spectacular --validate`: **completed successfully**; schema generation reports existing warnings that the custom cookie-JWT authenticator has no registered OpenAPI authentication extension.
- `npm run lint`: **passed**.
- `npm run build`: **passed**.
- Latest focused registration, social sign-in, and admin review tests using an in-memory SQLite override solely for test execution: **passed, 9 tests**. Coverage includes instructor signup, privileged-role rejection, verified Google signup, Microsoft's missing/unverified email flows, admin approval/verification sequencing, and unauthorized access.
- The broader account/dashboard suite passed **76 tests before the latest instructor-signup and Microsoft email-fallback changes**. The full suite was not rerun for this follow-up.
- Backend focused tests using configured MSSQL: **blocked before test execution** because the SQL login lacks `CREATE DATABASE` permission for Django's temporary `test_optimum_erp_lms`; no existing database was deleted or modified.

The mock-based social tests are in `backend/apps/accounts/tests.py` (`ExternalProviderLoginTests`); account list, detail, manual verification, approval, audit, and 403 tests are in `backend/apps/dashboards/tests.py` (`AdminDashboardStudentListTests`). No live provider credentials were used.

## 9. Manual tests still required

1. Register each provider's test/development app with the exact deployed origin and SDK redirect/return URI.
2. In a controlled browser environment, exercise successful login, user cancellation, provider denial, network failure, retry, expired credential, and unapproved redirect behavior for each enabled provider.
3. Confirm the Microsoft account-type decision: personal plus all organizational tenants (`common`) versus an allowlisted organization/tenant.
4. Confirm each provider's actual ID token contains the expected issuer, client audience, stable subject, nonce, expiration, and email-verification claims for both first and repeat login.
5. Verify new social users remain pending learners; verify an existing account with matching email is not linked; verify an authenticated explicit-link attempt.
6. Verify cookie flags, HTTPS, CORS/CSRF origins, cache sharing/replay rejection, email delivery, and refresh/logout behavior in staging.
7. Enable/verify a shared production cache and mail service before enabling registration or social sign-in in production.

## 10. Prioritized remaining work and estimated effort

| Priority | Work | Estimate |
|---|---|---:|
| P0 | Configure provider client IDs and console origins/redirects in a non-production environment; verify Microsoft tenant policy. | 2–4 hours, excluding provider approval |
| P1 | Add deterministic cryptographic token-verifier tests for wrong signature, audience, issuer, expiration, and nonce per provider. | 0.5–1.5 days |
| P1 | Add browser-level social-flow tests with provider SDK stubs for cancel/error/retry/redirect handling. | 0.5–1 day |
| P1 | Configure shared cache and validate replay/resend limits across multiple workers. | 2–4 hours |
| P2 | Perform authorized live callback and account-link tests in staging; collect evidence before rollout. | 0.5–1 day |

## 11. Final assessment

**Google: Prototype — 81/100.**  
**Microsoft: Prototype — 76/100.**  
**Apple: Prototype — 78/100.**  
**Combined: Prototype — 78/100.**

The integration architecture and account-linking safeguards are implemented, and focused social/account tests pass. Current runtime credentials are absent, console and deployment details are unverified, and no live provider flow was exercised. Do not enable any provider in production until the P0 configuration items and manual staging tests are complete.
