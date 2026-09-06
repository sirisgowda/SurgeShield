import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import eventsRouter from './routes/events.js';

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use('/api/events', eventsRouter);

app.use((req, res) => res.status(404).json({ error: 'NOT_FOUND' }));

// Central error handler: every route's `next(e)` lands here, so we never
// leak a stack trace to the client and never forget a try/catch's failure path.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'SERVER_ERROR', message: 'Something went wrong.' });
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`API listening on :${port}`));
