import { api, store, actions, forms, $, esc, toast, parseHash, loadSession, reveal } from './lib.js';
import { renderChrome, markActive, emptyState } from './components.js';
import * as P from './pages.js';
import * as A from './admin.js';

const ROUTES = [
  [/^\/$/, P.home], [/^\/cars$/, P.cars], [/^\/cars\/([^/]+)$/, P.carDetail],
  [/^\/login$/, P.login], [/^\/register$/, P.register],
  [/^\/wishlist$/, P.wishlist, 'auth'], [/^\/cart$/, P.cart, 'auth'], [/^\/checkout$/, P.checkout, 'auth'],
  [/^\/account$/, P.account, 'auth'], [/^\/orders\/(\d+)$/, P.orderDetail, 'auth'],
  [/^\/admin$/, A.dashboard, 'admin'], [/^\/admin\/cars$/, A.cars, 'admin'], [/^\/admin\/cars\/new$/, A.carForm, 'admin'], [/^\/admin\/cars\/(\d+)$/, A.carForm, 'admin'],
  [/^\/admin\/inventory$/, A.inventory, 'admin'], [/^\/admin\/orders$/, A.orders, 'admin'], [/^\/admin\/users$/, A.users, 'admin'],
];
const app = $('#app');
let token = 0;

async function render() {
  const t = ++token, { path, query } = parseHash();
  document.title = 'APEX NOIR — Koenigsegg & BMW Performance Luxury';
  $('.hdr')?.classList.remove('open');
  const hit = ROUTES.map(([re, h, g]) => [path.match(re), h, g]).find(([m]) => m);
  if (!hit) { app.innerHTML = P.notFound(); return done(); }
  const [m, handler, guard] = hit;
  if (guard && !store.user) { location.hash = '#/login?next=' + encodeURIComponent(location.hash.slice(1)); return; }
  if (guard === 'admin' && store.user.role !== 'admin') { app.innerHTML = `<div class="wrap section">${emptyState('Access denied', 'You need administrator privileges to view this page.', '<a class="btn" href="#/">Go home</a>')}</div>`; return done(); }
  app.innerHTML = '<div class="loader"><i></i></div>';
  const ctx = { params: m.slice(1), query, after: null };
  try {
    const html = await handler(ctx);
    if (t !== token) return;
    app.innerHTML = html;
    ctx.after?.();
  } catch (e) {
    if (t !== token) return;
    if (e.status === 401) { store.user = null; renderChrome(); location.hash = '#/login'; return; }
    app.innerHTML = `<div class="wrap section">${emptyState(e.status === 404 ? 'Not found' : 'Something went wrong', e.message, '<a class="btn" href="#/">Back to home</a>')}</div>`;
  }
  done();
}
function done() { window.scrollTo(0, 0); reveal(); markActive(); }

/* ---- Delegated events (components never need inline handlers) ---- */
const run = async (fn, el, ev) => { try { await fn(el, ev); } catch (e) { if (e.status === 401) { store.user = null; renderChrome(); location.hash = '#/login'; } toast(e.message, 'err'); } };
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (el && actions[el.dataset.action]) { e.preventDefault(); run(actions[el.dataset.action], el, e); }
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (el && actions[el.dataset.change]) run(actions[el.dataset.change], el, e);
});
let timer;
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-input]');
  if (!el) return;
  clearTimeout(timer);
  timer = setTimeout(() => run(actions[el.dataset.input], el, e), 350);
});
document.addEventListener('submit', async (e) => {
  const f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  const btn = f.querySelector('button[type=submit]'), err = f.querySelector('[data-error]');
  if (err) err.textContent = '';
  if (btn) btn.disabled = true;
  try { await forms[f.dataset.form](f, Object.fromEntries(new FormData(f))); }
  catch (x) {
    const msg = x.message + (x.details ? ': ' + x.details.join('. ') : '');
    if (err) err.textContent = msg; else toast(msg, 'err');
  } finally { if (btn) btn.disabled = false; }
});

window.addEventListener('hashchange', render);
(async () => {
  await loadSession();
  renderChrome();
  render();
})();
