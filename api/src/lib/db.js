import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// ─── Load .env before anything else ────────────────────────────────────────
// db.js is at api/src/lib/db.js  →  ../../  resolves to  api/
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const envPath    = path.resolve(__dirname, '../../.env');
const dotenvResult = dotenv.config({ path: envPath, override: true });

if (dotenvResult.error) {
  console.warn('[DATABASE] dotenv could not load', envPath, '—', dotenvResult.error.message);
} else {
  console.log('[DATABASE] Loaded env from', envPath);
}

const { Pool } = pg;

// ─── Lazy pool: reads DATABASE_URL at connection time, not at import time ──
// This is required because ES Module imports are hoisted — db.js can be
// evaluated before index.js's dotenv.config() has run. By using a getter
// that reads process.env.DATABASE_URL on demand we guarantee the value is
// always current, even if this module was cached before env was populated.
let _pool = null;

function getPool() {
  if (_pool) return _pool;

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('[DATABASE ERROR] DATABASE_URL is not set! Check api/.env');
    // Return a dummy pool-like object so callers get a clear error at query time
    return {
      query: () => Promise.reject(new Error('DATABASE_URL is not configured.')),
      on: () => {},
    };
  }

  const isLocalhost =
    connectionString.includes('localhost') ||
    connectionString.includes('127.0.0.1');

  console.log('[DATABASE] Creating pool →', (() => {
    try { return new URL(connectionString).hostname; } catch { return '(parse error)'; }
  })());

  _pool = new Pool({
    connectionString,
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
  });

  _pool.on('error', (err) => {
    console.error('[DATABASE ERROR] Unexpected idle client error:', err.message);
  });

  // Diagnostic ping
  _pool.query('SELECT 1')
    .then(() => {
      try {
        const url = new URL(connectionString);
        console.log(`[DATABASE] Connected to PostgreSQL at: ${url.hostname}:${url.port || 5432}${url.pathname}`);
      } catch {
        console.log('[DATABASE] Connected to PostgreSQL.');
      }
    })
    .catch((err) => {
      console.error('[DATABASE ERROR] Failed to connect:', err.message);
      if (err.code === 'ECONNREFUSED') {
        console.error('[DATABASE ERROR] Connection refused — is the DB reachable from this host?');
      }
    });

  return _pool;
}

// ─── Proxy object so all callers use `db.query(...)` as before ─────────────
export const db = new Proxy(
  {},
  {
    get(_target, prop) {
      const pool = getPool();
      const val = pool[prop];
      return typeof val === 'function' ? val.bind(pool) : val;
    },
  }
);
