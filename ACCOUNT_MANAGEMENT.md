# Account management

Registration is available for learners and instructors. Privileged roles remain
operator-provisioned so a public visitor cannot create an administrator account.

## Create the first administrator

After the database is configured and migrations have run:

```powershell
cd backend
.\venv\Scripts\python.exe manage.py createsuperuser
```

Django asks for a username, email, and password. This first account is
automatically given the platform role `admin` and can sign in at:

```text
http://localhost:5173/login
```

It can also open the Django administration site:

```text
http://127.0.0.1:8000/admin/
```

## Create an instructor or another administrator

1. Sign in to `/admin/` with a trusted Django staff administrator.
2. Open **Accounts > Users**.
3. Select **Add user**.
4. Enter the username, email, and an initial password using the organization's
   approved credential-delivery process.
5. In **Platform role**, select `Instructor` or `Admin`, and enable **Email
   verified** only after the provisioning operator has verified the intended
   identity. Saving an email-verification change records the operator and time.
6. Save the account. Do not expose a public staff or administrator registration
   link or share credentials in source control, chat, or email.

That person then uses the normal frontend login page. The backend reads the
stored role and routes instructors to `/dashboard/instructor`. Admins use the
same instructor/admin dashboard permissions plus the admin dashboard API.
Additional platform administrators are provisioned only by trusted Django
staff through Django Admin; this is an operator-controlled workflow, not a
public registration option.

## Learner and instructor self-registration

At `/register`, applicants may select student or instructor. The backend only
accepts those two roles; administrator and staff roles cannot be assigned by
public registration. New accounts are inactive until the applicant verifies
their email and an administrator approves the registration. These are separate
steps: **Verify email** records mailbox verification (including whether an
administrator performed it), and **Approve** enables the account. The admin
account-review page at `/dashboard/admin/accounts` lists both roles, with
search, status filters, verification history, email verification and approval
actions.

Google, Microsoft and Apple social sign-in are available when configured in
both backend and frontend environments. Set the matching client IDs in
`backend/.env` and `frontend/.env.local`, then register the correct web origins
and callback/return URLs in each provider console. Vite embeds `VITE_*`
settings into the frontend build, so rebuild/restart the frontend after
changing them. Never place provider secrets in `VITE_*` variables. Microsoft
may omit an email claim; in that case the sign-in flow asks for a contact
address and requires email-link verification before administrator approval.
No provider can complete live sign-in until its client IDs and console
configuration are valid.

Apply database migrations before deploying this account-management change:

```powershell
cd backend
python manage.py migrate
```

For reliable resend cooldowns and request throttling across multiple backend
workers, configure a shared Django cache backend in deployment. The repository
defaults to Django's local-memory cache, which is suitable only for a
single-process development server.

Never share the first administrator password or put it in `.env` files.