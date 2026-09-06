import pg from 'pg';

const { Pool } = pg;

// Whoever owns infra/env vars: point DATABASE_URL at the shared Postgres
// instance. decision_log is B's table — see their seed script for the
// action/payload shapes this router's queries expect.
export const db = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/hackathon',
  ssl: { rejectUnauthorized: false },
});
