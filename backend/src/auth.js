const jwt = require('jsonwebtoken');
const db = require('./db');
const { HttpError, wrap } = require('./utils');

const COOKIE = { httpOnly: true, sameSite: 'strict', secure: process.env.COOKIE_SECURE === 'true', path: '/' };
const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
const setCookie = (res, id) => res.cookie('token', signToken(id), { ...COOKIE, maxAge: 7 * 24 * 3600 * 1000 });
const clearCookie = (res) => res.clearCookie('token', COOKIE);

const readToken = (req) => {
  const m = (req.headers.cookie || '').match(/(?:^|;\s*)token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
};

const auth = wrap(async (req, res, next) => {
  const t = readToken(req);
  if (!t) throw new HttpError(401, 'Authentication required');
  let payload;
  try { payload = jwt.verify(t, process.env.JWT_SECRET); } catch { throw new HttpError(401, 'Session expired, please sign in again'); }
  const [[u]] = await db.pool.query('SELECT id,name,email,phone,role,created_at FROM users WHERE id=?', [payload.id]);
  if (!u) throw new HttpError(401, 'Account not found');
  req.user = u;
  next();
});
const adminOnly = (req, res, next) => (req.user && req.user.role === 'admin' ? next() : next(new HttpError(403, 'Administrator access required')));

module.exports = { auth, adminOnly, setCookie, clearCookie };
