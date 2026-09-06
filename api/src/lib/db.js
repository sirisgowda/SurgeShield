// NOTE: A owns the DB/infra setup per the runbook. This is a minimal stand-in
// so auth.js and events.js are runnable/testable in isolation before
// integration — swap for A's real db.js on merge (keep the same `db.query`
// interface so routes/auth.js and routes/events.js don't need edits).
import pg from 'pg';

const { Pool } = pg;

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

db.on?.('error', (err) => {
  console.error('Unexpected DB pool error', err);
});
