import express from 'express';
import cors from 'cors';

import authRouter from './routes/auth.js';
import eventsRouter from './routes/events.js';
import registerRouter from './routes/register.js';

import { db } from './lib/db.js';

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

app.get('/readyz', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ ok: true });
  } catch (e) {
    res.status(503).json({
      ok: false,
      error: e.message,
    });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/events', eventsRouter);
app.use('/api', registerRouter);

app.use((_req, res) =>
  res.status(404).json({ error: 'NOT_FOUND' })
);

// Central error handler
app.use((err, _req, res, _next) => {
  console.error(err);

  res.status(500).json({
    error: 'SERVER_ERROR',
    message: err.message || 'Something went wrong.',
  });
});

const port = process.env.PORT || 8080;

app.listen(port, '0.0.0.0', () => {
  console.log(`API listening on :${port}`);
});