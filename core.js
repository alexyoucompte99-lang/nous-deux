/* Nous · noyau : identité, stockage local + synchro Sheet (pont Apps Script), helpers UI, ciel. */
const BRIDGE = { url: 'https://script.google.com/macros/s/AKfycbw6jlFaJuGaaM8tZCpn52L9VI-2V-vFnv56f2fXO34mvRuvRuZKgXcygXmvt8f2dhTT/exec', key: 'nous-3e7a91c4d2f85b60' };
const APP_URL = 'https://alexyoucompte99-lang.github.io/nous-deux/';

// ---------- dates ----------
const pad = n => (n < 10 ? '0' : '') + n;
const ymd = d => { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const today = () => ymd(new Date());
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return ymd(d); };
const dow = s => (new Date(s + 'T12:00:00').getDay() + 6) % 7;
const monday = s => addDays(s || today(), -dow(s || today()));
const weekKey = s => monday(s || today());
const dayIndex = s => Math.round((new Date((s || today()) + 'T12:00:00') - new Date('2026-01-01T12:00:00')) / 864e5);
const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MONTHS_L = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const fmtDate = s => { if (!s) return ''; const d = new Date(s + 'T12:00:00'); return d.getDate() + ' ' + MONTHS[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''); };
const fmtLong = s => { const d = new Date(s + 'T12:00:00'); return DAYS[dow(s)] + ' ' + d.getDate() + ' ' + MONTHS_L[d.getMonth()]; };
const ago = ms => { const m = Math.round((Date.now() - ms) / 60000); if (m < 1) return 'à l\'instant'; if (m < 60) return 'il y a ' + m + ' min'; const h = Math.round(m / 60); if (h < 24) return 'il y a ' + h + ' h'; const d = Math.round(h / 24); return d === 1 ? 'hier' : 'il y a ' + d + ' j'; };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl = s => esc(s).replace(/\n/g, '<br>');
const uid = t => t + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const pick = (arr, seed) => arr[((seed % arr.length) + arr.length) % arr.length];
const shuffle = (arr, seed) => { const a = arr.slice(); let s = seed || 1; for (let i = a.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor(s / 233280 * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- identité ----------
let ME = localStorage.getItem('nous-me') || '';
const YOU = () => OTHER[ME];
const nameOf = u => (profile(u).name || USERS[u].name);
const myName = () => nameOf(ME), yourName = () => nameOf(YOU());
function profile(u) { return get('profile-' + u) || { id: 'profile-' + u, t: 'profile', name: USERS[u].name, birth: '', tz: '', ntfy: '' }; }
function saveProfile(u, patch) { const p = Object.assign(profile(u), patch); put(p); return p; }

// ---------- stockage ----------
const DB = { items: {}, lastSync: 0, outbox: [] };
function loadDB() { try { const s = JSON.parse(localStorage.getItem('nous-db') || 'null'); if (s) Object.assign(DB, s); } catch (e) {} }
function saveDB() { try { localStorage.setItem('nous-db', JSON.stringify(DB)); } catch (e) {} }
function all(type) { const r = []; for (const k in DB.items) { const o = DB.items[k]; if (!o.del && (!type || o.t === type)) r.push(o); } return r; }
function get(id) { const o = DB.items[id]; return o && !o.del ? o : null; }
function put(o, silent) { o.u = Date.now(); if (!o.t) o.t = o.id.split('-')[0]; DB.items[o.id] = o; if (!DB.outbox.includes(o.id)) DB.outbox.push(o.id); saveDB(); if (!silent) flushSoon(); return o; }
function remove(id) { const o = DB.items[id]; if (!o) return; o.del = true; put(o); }
function mine(type) { return all(type).filter(o => o.by === ME); }
function theirs(type) { return all(type).filter(o => o.by === YOU()); }
const byNewest = (a, b) => (b.u || 0) - (a.u || 0);
const byDate = (a, b) => (a.d || '').localeCompare(b.d || '');

// ---------- synchro ----------
let flushTimer = null, syncing = false;
function setSync(state) { const e = document.getElementById('sync'); if (e) e.className = 'sync ' + state; }
function flushSoon() { clearTimeout(flushTimer); flushTimer = setTimeout(flush, 500); }
async function flush() {
  if (!DB.outbox.length || syncing || !navigator.onLine) return;
  syncing = true; setSync('busy');
  const ids = DB.outbox.slice(0, 40);
  const items = ids.map(id => DB.items[id]).filter(Boolean);
  try {
    const r = await post({ what: 'upsert', items });
    if (r && r.ok) { DB.outbox = DB.outbox.filter(id => !ids.includes(id)); saveDB(); setSync('ok'); }
    else setSync('err');
  } catch (e) { setSync('err'); }
  syncing = false;
  if (DB.outbox.length) flushSoon();
}
let pulling = false;
async function pull(full) {
  if (!navigator.onLine || pulling || BRIDGE.url.startsWith('__')) return;
  pulling = true; setSync('busy');
  try {
    const r = await fetch(BRIDGE.url + '?key=' + encodeURIComponent(BRIDGE.key) + '&what=all&since=' + (full ? 0 : Math.max(0, DB.lastSync - 60000)), { cache: 'no-store' });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'pull');
    let changed = 0;
    (j.items || []).forEach(o => {
      const loc = DB.items[o.id];
      if (!loc || (o.u || 0) > (loc.u || 0)) { if (!DB.outbox.includes(o.id)) { DB.items[o.id] = o; changed++; } }
    });
    DB.lastSync = j.now || Date.now(); saveDB(); setSync(DB.outbox.length ? 'busy' : 'ok');
    if (changed) { render(); document.dispatchEvent(new CustomEvent('nous:changed')); }
    if (DB.outbox.length) flush();
  } catch (e) { setSync('err'); }
  pulling = false;
}
async function post(payload) {
  const r = await fetch(BRIDGE.url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(Object.assign({ key: BRIDGE.key }, payload)), keepalive: true });
  return r.json();
}
/* notif ntfy vers l'autre (ou 'both'). Le pont connaît les sujets. */
function notify(to, title, msg, tags) { if (BRIDGE.url.startsWith('__')) return; post({ what: 'notify', to: to || YOU(), title, msg, tags: tags || '' }).catch(() => {}); }

// ---------- photos ----------
function compressImage(file, max) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, (max || 1400) / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', 0.82).split(',')[1]);
    };
    img.onerror = rej; img.src = url;
  });
}
async function uploadPhoto(file, name) {
  const data = await compressImage(file);
  const r = await post({ what: 'photo', name: name || ('photo-' + Date.now() + '.jpg'), data, mime: 'image/jpeg' });
  if (!r.ok) throw new Error(r.error || 'upload');
  return r.url;
}
function pickPhoto(cb, capture) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; if (capture) inp.capture = 'environment';
  inp.onchange = () => { if (inp.files[0]) cb(inp.files[0]); };
  inp.click();
}

// ---------- ciel / heure locale ----------
function hourIn(tz) { try { return Number(new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', hour12: false, timeZone: tz || undefined }).format(new Date())) % 24; } catch (e) { return new Date().getHours(); } }
function timeIn(tz) { try { return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: tz || undefined }).format(new Date()); } catch (e) { return ''; } }
function phase(h) { if (h < 5) return 'nuit'; if (h < 7) return 'aube'; if (h < 11) return 'matin'; if (h < 17) return 'jour'; if (h < 20) return 'soir'; if (h < 22) return 'crepuscule'; return 'nuit'; }
const PHASE_ICON = { nuit: '🌙', aube: '🌅', matin: '☀️', jour: '☀️', soir: '🌇', crepuscule: '🌆' };
function applySky() {
  const h = hourIn(profile(ME).tz);
  const p = phase(h);
  document.body.dataset.sky = p;
  document.body.classList.toggle('night', p === 'nuit' || p === 'crepuscule');
  const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = getComputedStyle(document.body).getPropertyValue('--sky1').trim() || '#fde7d6';
}

// ---------- numérologie ----------
function reduce9(n) { while (n > 9) n = String(n).split('').reduce((s, c) => s + Number(c), 0); return n; }
const digitsum = s => String(s).replace(/\D/g, '').split('').reduce((a, c) => a + Number(c), 0);
function personalDay(birth, date) {
  if (!birth) return null;
  const b = new Date(birth + 'T12:00:00'), d = new Date((date || today()) + 'T12:00:00');
  const py = reduce9(reduce9(b.getMonth() + 1) + reduce9(b.getDate()) + reduce9(digitsum(d.getFullYear())));
  const pm = reduce9(py + reduce9(d.getMonth() + 1));
  return reduce9(pm + reduce9(d.getDate()));
}
function lifePath(birth) { return birth ? reduce9(digitsum(birth)) : null; }

// ---------- UI ----------
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 1900); }
function h(html) { const d = document.createElement('div'); d.innerHTML = html; return d; }
function openSheet(title, bodyHtml, opts) {
  opts = opts || {};
  const root = document.getElementById('sheet-root');
  root.innerHTML = '';
  const bg = h(`<div class="sheet-bg"><div class="sheet ${opts.cls || ''}"><div class="sheet-h"><h2>${title}</h2><button class="x" data-x>✕</button></div><div class="sheet-body">${bodyHtml}</div></div></div>`).firstChild;
  root.appendChild(bg);
  const close = () => { root.innerHTML = ''; document.body.style.overflow = ''; if (opts.onClose) opts.onClose(); };
  bg.addEventListener('click', e => { if (e.target === bg || e.target.hasAttribute('data-x')) close(); });
  bg.close = close;
  document.body.style.overflow = 'hidden';
  return bg;
}
function closeSheet() { const r = document.getElementById('sheet-root'); r.innerHTML = ''; document.body.style.overflow = ''; }
function confirmSheet(title, text, okLabel) { return new Promise(res => { const s = openSheet(title, `<p>${text}</p><div class="row mt2"><button class="btn grow" data-no>Annuler</button><button class="btn p grow" data-ok>${okLabel || 'OK'}</button></div>`, { onClose: () => res(false) }); s.querySelector('[data-ok]').onclick = () => { res(true); s.close(); }; s.querySelector('[data-no]').onclick = () => s.close(); }); }
function val(root, sel) { const e = root.querySelector(sel); return e ? e.value.trim() : ''; }
function chipsHtml(name, opts, cur) { return `<div class="chips" data-seg="${name}">${opts.map(o => `<button type="button" class="chip ${o.v === cur ? 'on' : ''}" data-v="${esc(o.v)}">${o.l}</button>`).join('')}</div>`; }
function scaleHtml(name, n, cur) { let s = `<div class="scale" data-seg="${name}">`; for (let i = 1; i <= n; i++) s += `<button type="button" data-v="${i}" class="${cur === i ? 'on' : ''}">${i}</button>`; return s + '</div>'; }
function wireSegs(root) { root.querySelectorAll('[data-seg]').forEach(seg => seg.addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (!b) return; seg.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); seg.dispatchEvent(new CustomEvent('change', { bubbles: true })); })); }
function segVal(root, name) { const b = root.querySelector(`[data-seg="${name}"] button.on`); return b ? (isNaN(b.dataset.v) ? b.dataset.v : Number(b.dataset.v)) : null; }
function avatar(u, size) { const p = profile(u); return `<span class="av ${u}" style="--s:${size || 28}px">${p.photo ? `<img src="${esc(p.photo)}" alt="">` : esc((p.name || USERS[u].name).slice(0, 1))}</span>`; }
function empty(txt, ico) { return `<div class="empty"><div class="ico">${ico || '✨'}</div><div>${txt}</div></div>`; }
function imgUrl(id) { return id; }
function haptic() { try { navigator.vibrate && navigator.vibrate(12); } catch (e) {} }
function scrollTop() { window.scrollTo({ top: 0 }); }
