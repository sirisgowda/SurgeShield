import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbUrl = 'postgresql://surgeshield:CHANGE_ME_LongPassword123@surgeshieldstack-surgeshielddb00fdca62-lqiaianukybm.ctkosgim82f7.ap-south-1.rds.amazonaws.com:5432/surgeshield';

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function fixSchema() {
  try {
    await client.connect();
    console.log('Connected to RDS PostgreSQL!');

    console.log('Re-creating events table with VARCHAR(64) ID...');
    await client.query(`
      DROP TABLE IF EXISTS registrations CASCADE;
      DROP TABLE IF EXISTS events CASCADE;

      CREATE TABLE events (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL DEFAULT 'Event',
        total_seats INT NOT NULL DEFAULT 1,
        seats_left INT NOT NULL DEFAULT 1,
        status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
        start_time TIMESTAMP WITH TIME ZONE,
        end_time TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE registrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id VARCHAR(64) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'CONFIRMED',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_event_user UNIQUE(event_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS decision_log (
        id SERIAL PRIMARY KEY,
        event_id VARCHAR(64),
        correlation_id VARCHAR(128),
        actor VARCHAR(64) NOT NULL,
        action VARCHAR(64) NOT NULL,
        reason TEXT,
        payload JSONB,
        ts TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Seeding test event (event-1)...');
    await client.query(`
      INSERT INTO events (id, name, total_seats, seats_left, status)
      VALUES ('event-1', 'Surge Hackathon Test Event', 10, 10, 'OPEN')
      ON CONFLICT (id) DO UPDATE SET status = 'OPEN';
    `);

    const cols = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'events';
    `);
    console.log('Events table columns:', cols.rows);

    const rows = await client.query('SELECT * FROM events WHERE id=$1', ['event-1']);
    console.log('Query result for event-1:', rows.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

fixSchema();
