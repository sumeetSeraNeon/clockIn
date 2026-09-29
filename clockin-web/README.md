# ClockIn Web (`clockin-web`)

Next.js frontend for ClockIn. Talks to `clockin-api` (NestJS) on port **3000**.
This app runs on port **3001**.

## Prerequisites

1. Backend running: `cd ../clockin-api` → `npm.cmd run start:dev`
2. CORS enabled for `http://localhost:3001` (already in Nest `main.ts`)
3. Firebase Web config in `.env.local` (copy from `.env.example`)
4. A Firebase Auth user that matches a seeded ClockIn user (e.g. `owner@clockin.local`)

## Run

```powershell
cd clockIn/clockin-web
npm.cmd install
npm.cmd run dev
```

Open http://localhost:3001 → login → dashboard shows `/api/me` profile.

## Foundation (done)

- Shared `api` client (`src/lib/api-client.ts`) — attaches Firebase token, handles 401
- `AuthProvider` + `useAuth` — Firebase session + `/api/me`
- Login page, protected app shell, dashboard stub
- Design tokens (coral / paper / ink) in `globals.css`

## Next

Build shared UI primitives, then Clients screens as the template (see `explainer/frontend/`).
