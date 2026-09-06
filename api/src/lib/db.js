import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const { Pool } = pg;

// Optional .env for local development.
// In ECS, DATABASE_URL is supplied by the task definition / Secrets Manager.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../../.env');

const result = dotenv.config({
  path: envPath,
});

if (result.error) {
  console.warn(
    `[DATABASE] Optional .env not loaded from ${envPath}`
  );
} else {
  console.log(`[DATABASE] Loaded local environment from ${envPath}`);
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not configured. Provide it through .env locally or ECS Secrets Manager.'
  );
}

const isLocalhost =
  connectionString.includes('localhost') ||
  connectionString.includes('127.0.0.1');

console.log('[DATABASE] Creating PostgreSQL pool');

export const db = new Pool({
  connectionString,
  ssl: isLocalhost
    ? false
    : { rejectUnauthorized: false },
});

db.on('error', (err) => {
  console.error(
    '[DATABASE ERROR] Unexpected idle client error:',
    err.message
  );
});