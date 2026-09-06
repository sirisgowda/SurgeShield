# Dev D — Registration UX & Surge Story

Built straight from your runbook, task by task. Everything runs standalone
against fake data right now — no waiting on B or the backend.

## Run it today (fake data, no backend needed)

```bash
cd web
npm install
npm run dev
```

Open the printed localhost URL. You'll see two tabs:
- **Registration** — the D5/D6 flow, backed by an in-memory mock in
  `src/lib/api.js` (positions move, then resolve to CONFIRMED/WAITLISTED).
- **Surge Story** — the D2/D4/D7/D8 dashboard, driven by `src/lib/mockData.js`,
  which scripts a NORMAL -> ELEVATED -> HIGH surge with mode changes, scaling,
  duplicates, and lets the chaos buttons actually inject events into the feed.

## What maps to what in the runbook

| Runbook step | File(s) |
|---|---|
| D1 static components | `src/components/ModeBadge.jsx`, `StatTile.jsx`, `StatusCard.jsx` |
| D2 Surge Story skeleton | `src/components/SurgeCharts.jsx`, `src/lib/mockData.js` |
| D3 timeline endpoint | `api/src/routes/ops.js`, `api/src/lib/db.js` |
| D4 translation layer | `src/lib/narrate.js`, `src/components/Timeline.jsx` |
| D5 registration flow | `src/hooks/useRegistration.js`, `src/pages/Register.jsx` |
| D6 copy audit | baked into `StatusCard.jsx`, checklist in `docs/copy-audit.md` |
| D7-D8 invariant + chaos panels | `src/components/InvariantPanel.jsx`, `ChaosPanel.jsx` |
| D9 switch to real data | `src/pages/Ops.jsx` — set `VITE_USE_MOCK=false` in `web/.env` |
| D10-D12 deck & demo | `docs/deck-outline.md`, `docs/demo-script.md` |

## Wiring up the real backend (D9)

1. Get `DATABASE_URL` for the shared Postgres from whoever owns it, put it in
   `api/.env`.
2. `cd api && npm install && npm run dev` — confirm `/api/ops/timeline` and
   `/api/ops/summary` return real rows once B's seed data lands.
3. Coordinate with A (adds `/chaos`) and B (adds `/invariants`) before editing
   `api/src/routes/ops.js` — same router, same file.
4. In `web/.env`, set `VITE_USE_MOCK=false`. `Ops.jsx` and `api.js` switch to
   live polling automatically — no other file changes.
5. Whoever owns `/api/events/:id/register` and `/api/intents/:id` (the actual
   registration backend) — once those are live, the mock in `src/lib/api.js`
   is bypassed the same way.
6. Watch A's first 200-VU run for the two things that always break per D9:
   timestamps arriving as strings (already parsed in `Ops.jsx`) and charts
   re-mounting on every poll (already memoised).

## Still yours to do

- D9: run it against A's real load test and fix anything that looks wrong
  live (axis scaling, empty gaps, scroll position).
- D10-12: fill in the actual architecture/sequence diagrams and results
  numbers in the deck — the outline and demo script are drafted in `docs/`.
- Rehearse the demo script alone at 04:00, then with the team at 09:00.
