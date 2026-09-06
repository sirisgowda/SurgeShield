const BASE = import.meta.env.VITE_API_BASE || '';

// "Never wait for real data." — while the register/intents endpoints aren't
// live yet, VITE_USE_MOCK (default true) fakes them here so useRegistration.js
// and the copy audit (D5/D6) can be built and demoed standalone. Flip
// VITE_USE_MOCK=false in .env once the backend is wired — no other file
// needs to change.
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

const mockIntents = new Map();

function mockRegister() {
  const intentId = crypto.randomUUID();
  const mode = Math.random() < 0.5 ? 'ELEVATED' : 'NORMAL';
  const position = mode === 'ELEVATED' ? Math.floor(500 + Math.random() * 2000) : 1;
  mockIntents.set(intentId, { ticks: 0, mode, position, resolveAt: 3 + Math.floor(Math.random() * 4) });
  return { intent_id: intentId, position, mode };
}

function mockPollIntent(intentId) {
  const rec = mockIntents.get(intentId);
  if (!rec) return { status: 'REJECTED', reason: 'unknown_intent' };
  rec.ticks += 1;
  if (rec.ticks < rec.resolveAt) {
    rec.position = Math.max(1, rec.position - Math.ceil(rec.position / 4));
    return { status: 'QUEUED', position: rec.position, mode: rec.mode };
  }
  return { status: Math.random() < 0.85 ? 'CONFIRMED' : 'WAITLISTED' };
}

export async function api(path, opts = {}) {
  if (USE_MOCK) {
    if (/^\/api\/events\/[^/]+\/register$/.test(path) && opts.method === 'POST') {
      return mockRegister();
    }
    const intentMatch = path.match(/^\/api\/intents\/([^/]+)$/);
    if (intentMatch) return mockPollIntent(intentMatch[1]);
  }

  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed: ${res.status}`);
  }
  return res.json();
}
