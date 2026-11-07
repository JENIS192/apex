const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { auth, setCookie, clearCookie } = require('../auth');
const { HttpError, wrap, str, EMAIL_RE } = require('../utils');

const DUMMY_HASH = bcrypt.hashSync('timing-safe-dummy', 12);
const strongPw = (p) => typeof p === 'string' && p.length >= 8 && p.length <= 72 && /[A-Za-z]/.test(p) && /\d/.test(p);
const pub = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role });

router.post('/register', wrap(async (req, res) => {
  const name = str(req.body.name, 100), email = str(req.body.email, 190).toLowerCase(), phone = str(req.body.phone, 30) || null;
  const errs = [];
  if (name.length < 2) errs.push('Name must be at least 2 characters');
  if (!EMAIL_RE.test(email)) errs.push('A valid email is required');
  if (!strongPw(req.body.password)) errs.push('Password must be 8-72 characters and contain letters and numbers');
  if (errs.length) throw new HttpError(400, 'Validation failed', errs);
  const [[dup]] = await db.pool.query('SELECT id FROM users WHERE email=?', [email]);
  if (dup) throw new HttpError(409, 'An account with this email already exists');
  const hash = await bcrypt.hash(req.body.password, 12);
  const [r] = await db.pool.query('INSERT INTO users (name,email,password_hash,phone) VALUES (?,?,?,?)', [name, email, hash, phone]);
  setCookie(res, r.insertId);
  res.status(201).json({ user: { id: r.insertId, name, email, phone, role: 'customer' } });
}));

router.post('/login', wrap(async (req, res) => {
  const email = str(req.body.email, 190).toLowerCase(), password = typeof req.body.password === 'string' ? req.body.password : '';
  const [[u]] = await db.pool.query('SELECT * FROM users WHERE email=?', [email]);
  const ok = await bcrypt.compare(password, u ? u.password_hash : DUMMY_HASH);
  if (!u || !ok) throw new HttpError(401, 'Invalid email or password');
  setCookie(res, u.id);
  res.json({ user: pub(u) });
}));

router.post('/logout', (req, res) => { clearCookie(res); res.json({ ok: true }); });
router.get('/me', auth, (req, res) => res.json({ user: pub(req.user) }));

router.put('/profile', auth, wrap(async (req, res) => {
  const name = str(req.body.name, 100), phone = str(req.body.phone, 30) || null;
  if (name.length < 2) throw new HttpError(400, 'Name must be at least 2 characters');
  if (req.body.newPassword) {
    const [[u]] = await db.pool.query('SELECT password_hash FROM users WHERE id=?', [req.user.id]);
    if (!(await bcrypt.compare(String(req.body.currentPassword || ''), u.password_hash))) throw new HttpError(400, 'Current password is incorrect');
    if (!strongPw(req.body.newPassword)) throw new HttpError(400, 'New password must be 8-72 characters and contain letters and numbers');
    await db.pool.query('UPDATE users SET password_hash=? WHERE id=?', [await bcrypt.hash(req.body.newPassword, 12), req.user.id]);
  }
  await db.pool.query('UPDATE users SET name=?, phone=? WHERE id=?', [name, phone, req.user.id]);
  res.json({ user: { ...pub(req.user), name, phone } });
}));

module.exports = router;
