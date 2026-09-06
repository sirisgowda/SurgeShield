import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbUrl = process.env.DATABASE_URL || 'postgresql://surgeshield:CHANGE_ME_LongPassword123@surgeshieldstack-surgeshielddb00fdca62-lqiaianukybm.ctkosgim82f7.ap-south-1.rds.amazonaws.com:5432/surgeshield';

console.log('Connecting to RDS PostgreSQL Database...');
console.log('URL:', dbUrl.replace(/:[^:@]+@/, ':****@'));

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  try {
    await client.connect();
    console.log('Successfully connected to RDS PostgreSQL!');

    const sqlPath = path.join(__dirname, '../migrations/001.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Applying 001.sql schema...');
    await client.query(sql);
    console.log('Schema created successfully!');

    console.log('Seeding test event (event-1)...');
    await client.query(`
      INSERT INTO events (id, name, total_seats, seats_left, status)
      VALUES ('event-1', 'Surge Hackathon Test Event', 10, 10, 'OPEN')
      ON CONFLICT (id) DO UPDATE SET status = 'OPEN';
    `);
    console.log('Seeded event-1 successfully!');

    const res = await client.query('SELECT * FROM events;');
    console.log('Current events in database:', res.rows);

  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
