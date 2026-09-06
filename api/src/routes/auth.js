import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { db } from '../lib/db.js';
import { sign, requireAuth } from '../lib/auth.js';

const r = Router();
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const google = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

r.post('/signup', async (req, res, next) => {
  try {
    const email = (req.body.email || '').toLowerCase().trim();
    const { password, role } = req.body;
    if (!EMAIL.test(email)) return res.status(400).json({ error: 'BAD_EMAIL' });
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'WEAK_PASSWORD', message: 'At least 8 characters.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO users (email,password_hash,role) VALUES ($1,$2,$3)
       RETURNING id,email,role`,
      [email, hash, role === 'organizer' ? 'organizer' : 'attendee'],
    );
    res.status(201).json({ token: sign(rows[0]), user: rows[0] });
  } catch (e) {
    if (e.code === '23505') {
      return res
        .status(409)
        .json({ error: 'EMAIL_TAKEN', message: 'That email is already registered.' });
    }
    next(e);
  }
});

r.post('/login', async (req, res, next) => {
  try {
    const email = (req.body.email || '').toLowerCase().trim();
    const { rows } = await db.query(
      'SELECT id,email,role,password_hash FROM users WHERE email=$1',
      [email],
    );
    const u = rows[0];
    // Same response whether the account is missing or the password is wrong —
    // distinguishing them lets an attacker enumerate registered emails.
    if (!u?.password_hash || !(await bcrypt.compare(req.body.password || '', u.password_hash))) {
      return res
        .status(401)
        .json({ error: 'BAD_CREDENTIALS', message: 'Email or password is incorrect.' });
    }
    delete u.password_hash;
    res.json({ token: sign(u), user: u });
  } catch (e) {
    next(e);
  }
});

r.post('/google', async (req, res, next) => {
  try {
    if (!req.body.id_token) return res.status(400).json({ error: 'MISSING_TOKEN' });
    // Never trust the client: the id_token is verified server-side against
    // Google's public keys, so a forged/tampered token is rejected here.
    const ticket = await google.verifyIdToken({
      idToken: req.body.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const { sub, email } = ticket.getPayload();
    const { rows } = await db.query(
      `INSERT INTO users (email,google_sub) VALUES ($1,$2)
       ON CONFLICT (email) DO UPDATE SET google_sub = EXCLUDED.google_sub
       RETURNING id,email,role`,
      [email.toLowerCase(), sub],
    );
    res.json({ token: sign(rows[0]), user: rows[0] });
  } catch (e) {
    res.status(401).json({ error: 'BAD_GOOGLE_TOKEN', message: 'Google sign-in failed.' });
  }
});

r.get('/me', requireAuth(), async (req, res) =>
  res.json({ id: req.user.sub, email: req.user.email, role: req.user.role }),
);

export default r;
