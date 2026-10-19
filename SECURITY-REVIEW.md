# Security Audit Report

**Project:** Optimum ERP LMS  
**Review date:** 2026-10-16  
brian obonyo

## Scope and method

This review focused on social identity verification, account linking, and the
associated authentication routes in `backend/apps/accounts`. It was a
source-level review; production provider settings, tenant configuration, and
live database records were not available for inspection.

## Finding

| # | Severity | Area | Finding | Confidence |
|---|---|---|---|---:|
| 1 | HIGH | Social sign-in and account linking | A provider identity could be attached to an existing LMS account solely because its email matched. Microsoft sign-in also accepted mutable `preferred_username` and `xms_edov` as a substitute for an explicitly verified email claim. A reassigned or otherwise untrusted email could therefore be used to take over an existing account. | 8/10 |

## Remediation

- Social sign-in no longer links an identity to an existing account based on
  email. A matching email is rejected without changing the LMS account.
- First-time social sign-in requires a provider-verified email to create a new,
  inactive student account awaiting approval. Microsoft `preferred_username`
  and `xms_edov` alone are not treated as a verified email.
- An already-linked provider identity is resolved by its provider subject, so
  later email changes do not break that identity's sign-in.
- Added `POST /api/auth/social/link/{provider}/` for explicit linking after
  LMS authentication. It checks the authenticated user, CSRF protection, the
  provider token and nonce, and rejects identities already owned by another
  account. Linking does not change the account's email-verification status.
- Documented the social sign-in and account-linking behavior in
  `docs/API_REFERENCE.md`; added a frontend API helper for the link route.

## Validation

- Accounts and permission tests: **109 passed** using an in-memory SQLite
  test database.
- Frontend lint: **passed**.
- Frontend production build: **passed**.
- The normal test invocation against the configured SQL Server could not create
  its test database because the configured database principal lacks `CREATE
  DATABASE` permission in `master`. The account test suite was therefore run
  with a temporary in-process SQLite database override; project settings were
  not changed.

## Review limits

This finding is specific to the social authentication flow reviewed. It is not
a full penetration test or a claim that all application vulnerabilities have
been identified. Validate the configured provider claims and the authenticated
linking flow in a staging environment before production rollout.
