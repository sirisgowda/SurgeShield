import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { db } from './lib/db.js';
import registerRouter from './routes/register.js';
import eventsRouter from './routes/events.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/healthz', (_, res) => res.json({ ok: true }));
app.get('/readyz', async (_, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ ok: true });
  } catch (e) {
    res.status(503).json({ ok: false, error: e.message });
  }
});

// Routes
app.use('/api', registerRouter);
app.use('/api', eventsRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'INTERNAL', message: err.message });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`SurgeShield API up on port ${PORT}`));
