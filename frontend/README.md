# Optimum LMS frontend

React single-page application built with Vite and Tailwind CSS. It provides
the learner, instructor, and administrator interfaces for the Django API.

## Local development

From this directory:

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Vite serves the frontend at `http://localhost:5173` and proxies `/api`,
`/admin`, and `/media` to Django at `http://127.0.0.1:8000`. Start and
configure the backend first; see the root [README](../README.md) and
[database setup](../DATABASE_SETUP.md).

On macOS/Linux, use `cp .env.example .env.local` in place of `Copy-Item`.

## Environment configuration

`VITE_API_URL` defaults to `/api`, which uses the local Vite proxy. The
optional `VITE_GOOGLE_CLIENT_ID`, `VITE_MICROSOFT_CLIENT_ID`, and
`VITE_APPLE_CLIENT_ID` values enable the corresponding social sign-in
buttons. The provider app must also allow the matching website origin and
redirect URI. Never put backend secrets in frontend environment variables:
Vite values are included in the browser bundle.

## Available commands

- `npm run dev` — start Vite with hot module replacement.
- `npm run build` — create the production frontend bundle.
- `npm run preview` — preview a production build locally.
- `npm run lint` — run ESLint.

The same `dev`, `build`, and `lint` commands are available through the
repository-root `package.json`.
