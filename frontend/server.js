// Zero-dependency web server: serves the static storefront and reverse-proxies /api + /uploads to the backend.
// Same-origin by design => no CORS needed anywhere. (In AWS, Nginx does this same job — see /deploy/nginx.conf.)
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const target = new URL(process.env.BACKEND_URL || 'http://localhost:5000');
const lib = target.protocol === 'https:' ? https : http;
const ROOT = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json' };
const SEC = {
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'strict-origin-when-cross-origin',
};

function proxy(req, res) {
  const p = lib.request({
    protocol: target.protocol, hostname: target.hostname, port: target.port || (target.protocol === 'https:' ? 443 : 80), path: req.url, method: req.method,
    headers: { ...req.headers, host: target.host, 'x-forwarded-for': req.socket.remoteAddress, 'x-forwarded-proto': req.headers['x-forwarded-proto'] || 'http' },
  }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  p.on('error', () => { if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' }); res.end('{"error":"Backend service unavailable"}'); });
  req.pipe(p);
}

function serve(req, res) {
  let file = path.normalize(path.join(ROOT, decodeURIComponent(req.url.split('?')[0])));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) file = path.join(ROOT, 'index.html');
  const ext = path.extname(file);
  res.writeHead(200, { ...SEC, 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600' });
  fs.createReadStream(file).pipe(res);
}

http.createServer((req, res) => {
  if (req.url === '/healthz') { res.writeHead(200); return res.end('ok'); }
  if (req.url.startsWith('/api/') || req.url.startsWith('/uploads/')) return proxy(req, res);
  serve(req, res);
}).listen(PORT, '0.0.0.0', () => console.log(`🌐 Apex Noir storefront on http://localhost:${PORT}  (proxying /api → ${target.origin})`));
