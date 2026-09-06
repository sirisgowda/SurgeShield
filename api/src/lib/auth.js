import jwt from 'jsonwebtoken';

export const sign = (u) =>
  jwt.sign({ sub: u.id, role: u.role, email: u.email }, process.env.JWT_SECRET, {
    expiresIn: '12h',
  });

export const requireAuth = (role) => (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'NO_TOKEN' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (role && payload.role !== role) {
      return res.status(403).json({ error: 'FORBIDDEN', need: role });
    }
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'BAD_TOKEN' });
  }
};
