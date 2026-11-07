require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const db = require('./src/db');
const { HttpError, UPLOAD_DIR } = require('./src/utils');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('❌ JWT_SECRET must be set to at least 32 characters in backend/.env');
  process.exit(1);
}

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '100kb' }));

// Health check (used by ALB / target groups)
app.get('/api/hell/health', async (req, res) => {
  try {
    await db.pool.query('SELECT 1');
    res.json({ status: 'ok', message: 'Apex Noir API is healthy', database: 'connected', uptime: Math.round(process.uptime()), timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', message: 'Database unreachable', database: 'disconnected' });
  }
});

const limiter = (windowMs, max) => rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests, please slow down.' } });
app.use('/api', limiter(60 * 1000, 300));
app.use('/api/auth/login', limiter(15 * 60 * 1000, 20));
app.use('/api/auth/register', limiter(60 * 60 * 1000, 20));

app.use('/uploads', express.static(UPLOAD_DIR, { index: false, maxAge: '7d', setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff') }));

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/admin', require('./src/routes/admin'));
app.use('/api', require('./src/routes/cars'));
app.use('/api', require('./src/routes/shop'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found' }));

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, details: err.details });
  if (err.name === 'MulterError') return res.status(400).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A record with these details already exists' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

db.init()
  .then(() => app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Apex Noir API listening on port ${PORT}  →  /api/hell/health`)))
  .catch((e) => { console.error('❌ Failed to start:', e.message); process.exit(1); });
