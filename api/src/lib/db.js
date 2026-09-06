import pg from 'pg';

let dbUrl = process.env.DATABASE_URL || '';

if (!dbUrl || dbUrl.startsWith('jdbc:') || !dbUrl.includes('CHANGE_ME_LongPassword123')) {
  dbUrl = 'postgresql://surgeshield:CHANGE_ME_LongPassword123@surgeshieldstack-surgeshielddb00fdca62-lqiaianukybm.ctkosgim82f7.ap-south-1.rds.amazonaws.com:5432/surgeshield';
}

if (dbUrl.startsWith('jdbc:')) {
  dbUrl = dbUrl.substring(5);
}

export const db = new pg.Pool({
  connectionString: dbUrl,
  max: 5,                          // 10 App Runner instances x 5 = 50 connections
  ssl: { rejectUnauthorized: false }
});
