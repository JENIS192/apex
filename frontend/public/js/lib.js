// Core utilities: state store, API client, router helpers, toasts, action registries.
export const store = { user: null, wishlist: new Set(), cart: [] };
export const actions = {};   // data-action / data-change handlers
export const forms = {};     // data-form submit handlers

export const $ = (s, r = document) => r.querySelector(s);
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const money = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(n) || 0);
export const date = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
export const qs = (o) => { const u = new URLSearchParams(); Object.entries(o).forEach(([k, v]) => { if (v !== '' && v != null) u.set(k, v); }); return u.toString(); };

export function parseHash() {
  const h = location.hash.slice(1) || '/';
  const [p, q = ''] = h.split('?');
  return { path: p.replace(/\/+$/, '') || '/', query: Object.fromEntries(new URLSearchParams(q)) };
}
export const rerender = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

export async function api(path, { method = 'GET', body, form } = {}) {
  const opt = { method, headers: {}, credentials: 'same-origin' };
  if (form) opt.body = form;
  else if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  let r;
  try { r = await fetch('/api' + path, opt); } catch { throw new Error('Network error — please check your connection'); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: r.status, details: data.details });
  return data;
}

export function toast(msg, type = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast ' + (type === 'err' ? 'err' : '');
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.08 });
export const reveal = () => document.querySelectorAll('.reveal:not(.in)').forEach((el) => io.observe(el));

export async function loadUserData() {
  try {
    const [w, c] = await Promise.all([api('/wishlist'), api('/cart')]);
    store.wishlist = new Set(w.items.map((x) => x.id));
    store.cart = c.items;
  } catch { /* ignore */ }
}
export async function loadSession() {
  try { store.user = (await api('/auth/me')).user; await loadUserData(); } catch { store.user = null; }
}
