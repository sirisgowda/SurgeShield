import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Ensure .env is explicitly loaded from the api directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('[DATABASE ERROR] DATABASE_URL is not set in environment or .env file!');
}

const isLocalhost = connectionString?.includes('localhost') || connectionString?.includes('127.0.0.1');

export const db = new Pool({
  connectionString,
  ssl: isLocalhost ? false : { rejectUnauthorized: false },
});

// Diagnostic connection test on startup
db.query('SELECT 1')
  .then(() => {
    try {
      const url = new URL(connectionString);
      console.log(`[DATABASE] Successfully connected to real PostgreSQL database at: ${url.hostname}:${url.port || 5432}${url.pathname}`);
    } catch {
      console.log('[DATABASE] Successfully connected to real PostgreSQL database.');
    }
  })
  .catch((err) => {
    console.error(`[DATABASE ERROR] Failed to connect to real PostgreSQL database: ${err.message}`);
    if (err.code === 'ECONNREFUSED') {
      console.error('[DATABASE ERROR] Connection was refused. Ensure PostgreSQL / RDS instance is reachable and running.');
    }
  });

db.on('error', (err) => {
  console.error('[DATABASE ERROR] Unexpected error on idle client:', err.message);
});
