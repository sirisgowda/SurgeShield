# SurgeShield

Event registration platform with organizer-managed capacity and live status.

<!-- TODO (team): one-paragraph description of what SurgeShield actually does
     and who it's for. Fill in once all four parts are integrated. -->

**Live URL:** <!-- TODO: Amplify URL from A -->

## Architecture

<!-- TODO: paste the exported PNG from mermaid.live here, e.g.
     ![architecture](./docs/architecture.png)
     Verify the diagram matches what was actually built before exporting —
     if the real thing diverged from the plan, fix the diagram, not the story. -->

## Running locally

```bash
# API
cd api
cp .env.example .env      # fill in DATABASE_URL, JWT_SECRET, GOOGLE_CLIENT_ID
npm install
npm run dev                # http://localhost:8080

# Web
cd web
npm install
npm run dev                # http://localhost:5173
```

Apply `api/schema.sql` to your Postgres database before starting the API
(or use A's migration if one already exists — reconcile the two).

## Environment variables

| File | Variable | Purpose |
|---|---|---|
| `api/.env` | `DATABASE_URL` | Postgres connection string |
| `api/.env` | `JWT_SECRET` | Signs/verifies session tokens |
| `api/.env` | `GOOGLE_CLIENT_ID` | Verifies Google sign-in tokens server-side |
| `api/.env` | `CORS_ORIGIN` | Allowed frontend origin |
| `web/.env.local` | `VITE_API_URL` | Backend base URL |
| `web/.env.local` | `VITE_GOOGLE_CLIENT_ID` | Google Identity Services client ID |

(Names only — never commit actual values. Both `.env` files are gitignored.)

## What's excluded and why

<!-- TODO: e.g. "Email verification on signup — out of scope for the demo
     window" or "Password reset flow — not needed for the evaluation." -->

## AI usage

See [`AI_USAGE.md`](./AI_USAGE.md) for the ownership map and per-section log.
