/* Nous · noyau : identité, stockage local + synchro Sheet (pont Apps Script), photos, notifications, helpers UI, ciel. */
const BRIDGE = { url: 'https://script.google.com/macros/s/AKfycbwQeV-BDd8tDTFEvPtW8xD_EBqWaqCROel6d7iEPMPH26w1Ks1QNI2eswRRZJajqItN/exec', key: 'nous-3e7a91c4d2f85b60' };
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
function profile(u) { if (!USERS[u]) return { name: '', birth: '', tz: '', ntfy: '' }; const p = get('profile-' + u) || { id: 'profile-' + u, t: 'profile', name: USERS[u].name, birth: '', tz: '', ntfy: '' }; if (!p.birth && USERS[u].birth) p.birth = USERS[u].birth; return p; }
function saveProfile(u, patch) { const p = Object.assign(profile(u), patch); put(p); return p; }

// ---------- stockage ----------
// notes = notifs en attente d'envoi : elles partent avec la synchro (même requête que les données, réessayées tant qu'elles n'ont pas abouti).
const DB = { items: {}, lastSync: 0, outbox: [], notes: [] };
function loadDB() { try { const s = JSON.parse(localStorage.getItem('nous-db') || 'null'); if (s) Object.assign(DB, s); } catch (e) {} if (!Array.isArray(DB.notes)) DB.notes = []; }
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
const sleep = ms => new Promise(r => setTimeout(r, ms));
let flushTimer = null, syncing = false, flushFails = 0;
function setSync(state) { const e = document.getElementById('sync'); if (e) e.className = 'sync ' + state; }
function flushSoon(ms) { clearTimeout(flushTimer); flushTimer = setTimeout(flush, ms == null ? 400 : ms); }
async function flush() {
  if ((!DB.outbox.length && !DB.notes.length) || syncing || !navigator.onLine || BRIDGE.url.startsWith('__')) return;
  syncing = true; setSync('busy');
  const items = DB.outbox.slice(0, 40).map(id => DB.items[id]).filter(Boolean);
  const sent = {}; items.forEach(o => { sent[o.id] = o.u; });
  DB.notes = DB.notes.filter(n => Date.now() - (n.at || 0) < 12 * 3600e3); // une notif restée bloquée plus de 12 h n'a plus de sens
  const notes = DB.notes.slice(0, 10);
  let ok = false;
  try {
    const r = await post({ what: 'upsert', items, notes });
    if (r.ok) {
      ok = true;
      // un élément modifié pendant l'envoi reste dans la file (sa nouvelle version n'est pas encore partie)
      DB.outbox = DB.outbox.filter(id => !(id in sent) || (DB.items[id] && DB.items[id].u !== sent[id]));
      const nids = notes.map(n => n.nid); DB.notes = DB.notes.filter(n => !nids.includes(n.nid));
      let changed = 0;
      (r.newer || []).forEach(o => { const loc = DB.items[o.id]; if (!loc || (o.u || 0) > (loc.u || 0)) { DB.items[o.id] = o; changed++; } });
      saveDB(); setSync('ok');
      if (changed) { render(); document.dispatchEvent(new CustomEvent('nous:changed')); }
    } else setSync('err');
  } catch (e) { setSync('err'); }
  syncing = false;
  flushFails = ok ? 0 : flushFails + 1;
  if (DB.outbox.length || DB.notes.length) flushSoon(ok ? 300 : Math.min(60000, 1500 * flushFails * flushFails));
}
let pulling = false;
async function pull(full) {
  if (!navigator.onLine || pulling || BRIDGE.url.startsWith('__')) return;
  pulling = true; setSync('busy');
  for (let i = 0; i < 3; i++) { // la réponse de Google se perd assez souvent : on réessaie tout de suite
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 40000);
    try {
      const r = await fetch(BRIDGE.url + '?key=' + encodeURIComponent(BRIDGE.key) + '&what=all&since=' + (full ? 0 : Math.max(0, DB.lastSync - 60000)), { cache: 'no-store', signal: ctl.signal });
      const j = await r.json();
      if (!j.ok || !Array.isArray(j.items)) throw new Error(j.error || 'pull');
      let changed = 0;
      j.items.forEach(o => {
        const loc = DB.items[o.id];
        if (!loc || (o.u || 0) > (loc.u || 0)) { if (!DB.outbox.includes(o.id)) { DB.items[o.id] = o; changed++; } }
      });
      DB.lastSync = j.now || Date.now(); saveDB(); setSync(DB.outbox.length ? 'busy' : 'ok');
      if (changed) { render(); document.dispatchEvent(new CustomEvent('nous:changed')); }
      if (DB.outbox.length || DB.notes.length) flush();
      break;
    } catch (e) { setSync('err'); if (i < 2) await sleep(1200 + i * 1500); }
    finally { clearTimeout(to); }
  }
  pulling = false;
}
/* Appel POST au pont. Le pont renvoie toujours { what } = la demande : toute autre réponse (page « introuvable » de Google,
   POST changé en GET par Safari…) est rejetée et on réessaie. Côté pont, tout est rejouable sans doublon. */
async function post(payload, opts) {
  opts = opts || {};
  const body = JSON.stringify(Object.assign({ key: BRIDGE.key }, payload));
  let err = null;
  for (let i = 0; i < (opts.tries || 4); i++) {
    if (i) await sleep(Math.min(8000, 700 * i * i));
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), opts.timeout || 45000);
    try {
      const r = await fetch(BRIDGE.url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body, signal: ctl.signal });
      const txt = await r.text();
      let j = null; try { j = JSON.parse(txt); } catch (e) {}
      if (j && j.what === payload.what) return j;
      err = new Error(j && j.error ? j.error : 'réponse illisible');
    } catch (e) { err = e; }
    finally { clearTimeout(to); }
  }
  throw err || new Error('réseau');
}

// ---------- notifications (Web Push natif : pas d'appli à installer, juste Nous sur l'écran d'accueil) ----------
const NOTIFS_ON = true;
function notify(to, title, msg, kind) {
  if (!NOTIFS_ON || !ME) return;
  DB.notes.push({ to: to || YOU(), from: ME, title, msg, kind: kind || '', nid: uid('n'), at: Date.now() });
  saveDB(); flushSoon();
}
// type de notif -> écran à ouvrir quand on la touche
const KIND_VIEW = {
  ping: ['home'], meet: ['home'], qd: ['home'], quote: ['home'], photo: ['home'], test: ['home'],
  album: ['duo', 'duo', 'photos'], cine: ['duo', 'duo', 'cine'], match: ['duo', 'duo', 'swipe'], envie: ['duo', 'duo', 'swipe'], wish: ['duo', 'duo', 'wish'], coupon: ['duo', 'duo', 'coupon'],
  english: ['games', 'game', 'english'], quiz: ['games', 'game', 'quiz'], defi: ['games', 'game', 'defi'], guess: ['games', 'game', 'guess'], wheel: ['games', 'game', 'wheel'], life: ['games', 'game', 'life'],
  checkin: ['us', 'us', 'checkin'], mood: ['us', 'us', 'mood'], letter: ['us', 'us', 'letters'], capsule: ['us', 'us', 'capsules'], idea: ['us', 'us', 'ideas'],
};
function openKind(kind) { const v = KIND_VIEW[kind]; if (!v || !ME) return; VIEW.tab = v[0]; if (v[1]) VIEW[v[1]] = v[2]; closeSheet(); render(); scrollTop(); }
const PUSH = {
  ios: /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  standalone: () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
  supported: () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
  // 'install' (iPhone : ouvrir depuis l'écran d'accueil) | 'unsupported' | 'default' | 'granted' | 'denied'
  state() { if (!this.supported()) return this.ios && !this.standalone() ? 'install' : 'unsupported'; return Notification.permission; },
};
const b64uBytes = s => { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); s += '='.repeat((4 - s.length % 4) % 4); return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
async function pushInfo() {
  const r = await fetch(BRIDGE.url + '?key=' + encodeURIComponent(BRIDGE.key) + '&what=push', { cache: 'no-store' });
  const j = await r.json(); if (!j.ok || !j.vapid) throw new Error('pont');
  localStorage.setItem('nous-vapid', j.vapid);
  return j;
}
async function vapidKey() { return localStorage.getItem('nous-vapid') || (await pushInfo()).vapid; }
// À appeler directement depuis un toucher : sur iPhone, la demande d'autorisation doit venir d'un geste.
async function enablePush() {
  const st = PUSH.state();
  if (st === 'install' || st === 'unsupported') throw new Error(st);
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error(perm);
  if (!(await syncPush(true))) throw new Error('pont');
  return true;
}
// Abonne ce téléphone et le signale au pont (au lancement, sans rien demander si l'autorisation est déjà donnée).
async function syncPush(force) {
  if (!ME || PUSH.state() !== 'granted' || BRIDGE.url.startsWith('__')) return false;
  const reg = await navigator.serviceWorker.ready;
  const key = b64uBytes(await vapidKey());
  let sub = await reg.pushManager.getSubscription();
  const cur = sub && sub.options && sub.options.applicationServerKey ? new Uint8Array(sub.options.applicationServerKey) : null;
  if (sub && cur && (cur.length !== key.length || cur.some((b, i) => b !== key[i]))) { await sub.unsubscribe().catch(() => {}); sub = null; }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  const j = sub.toJSON(), sig = ME + '|' + j.endpoint;
  let last = {}; try { last = JSON.parse(localStorage.getItem('nous-push') || '{}'); } catch (e) {}
  if (!force && last.sig === sig && Date.now() - (last.at || 0) < 3 * 864e5) return true;
  const u = navigator.userAgent, dev = /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android' : /Mac/.test(u) ? 'Mac' : 'Navigateur';
  const r = await post({ what: 'push_sub', user: ME, sub: j, dev });
  if (r.ok) localStorage.setItem('nous-push', JSON.stringify({ sig, at: Date.now() }));
  return !!r.ok;
}

// ---------- photos ----------
// Une photo part en petits morceaux (45 Ko), chacun réessayé ; le pont les assemble. Les gros envois en un bloc
// échouaient souvent sur iPhone (réseau mobile, réponse de Google perdue) alors que la photo arrivait parfois sur le Drive.
const PHOTO_CHUNK = 45000;
function compressImage(file, max) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const k = Math.min(1, (max || 1280) / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        const data = c.toDataURL('image/jpeg', 0.8).split(',')[1];
        if (!data || data.length < 500) return rej(new Error('image vide'));
        res(data);
      } catch (e) { rej(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('format')); };
    img.src = url;
  });
}
function fileToBase64(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(file); }); }
async function photoData(file) {
  try { return { b64: await compressImage(file), mime: 'image/jpeg' }; }
  catch (e) { // HEIC ou format que le navigateur ne sait pas lire : on envoie tel quel si ce n'est pas énorme
    if (file.size > 8e6) throw new Error('photo trop lourde');
    return { b64: await fileToBase64(file), mime: /^image\//.test(file.type) ? file.type : 'image/jpeg' };
  }
}
async function pool(list, k, fn) { const q = list.slice(); await Promise.all(Array.from({ length: Math.min(k, q.length) }, async () => { while (q.length) await fn(q.shift()); })); }
// Lance l'envoi tout de suite. job.done = promesse du lien de la photo ; job.retry() relance (seuls les morceaux manquants repartent).
function photoJob(file, onChange) {
  const job = { pid: uid('ph'), state: 'up', pct: 3, url: null, preview: URL.createObjectURL(file), done: null };
  const tell = () => { try { onChange && onChange(job); } catch (e) {} };
  let data = null, missing = null;
  const run = async () => {
    job.state = 'up'; tell();
    if (!data) data = await photoData(file);
    const n = Math.max(1, Math.ceil(data.b64.length / PHOTO_CHUNK));
    if (!missing) missing = [...Array(n).keys()];
    for (let round = 0; round < 5; round++) {
      let sentN = n - missing.length;
      await pool(missing, 3, async i => {
        try { await post({ what: 'photo_part', pid: job.pid, i, n, data: data.b64.slice(i * PHOTO_CHUNK, (i + 1) * PHOTO_CHUNK) }, { timeout: 60000 }); sentN++; job.pct = Math.round(3 + 87 * sentN / n); tell(); } catch (e) {}
      });
      const r = await post({ what: 'photo_done', pid: job.pid, n, mime: data.mime }, { timeout: 60000 }).catch(() => null);
      if (r && r.ok && r.url) { job.url = r.url; job.state = 'ok'; job.pct = 100; tell(); return r.url; }
      missing = r && Array.isArray(r.missing) ? r.missing : []; // réponse perdue : le pont dira au prochain tour ce qui manque
      await sleep(1000 + round * 1500);
    }
    missing = null;
    throw new Error('envoi impossible');
  };
  job.retry = () => { job.done = run().catch(e => { job.state = 'err'; job.error = e; tell(); throw e; }); job.done.catch(() => {}); return job.done; };
  job.retry();
  return job;
}
function photoStateText(j) { return j.state === 'ok' ? 'Photo prête ✓' : j.state === 'err' ? 'La photo n\'est pas partie (réseau). On réessaie quand tu valides.' : 'Envoi de la photo… ' + j.pct + ' %'; }
// Feuille « aperçu + légende + bouton » : le bouton marche tout de suite, la publication attend que la photo soit en ligne.
function photoSheet(file, title, fieldsHtml, label, onPublish) {
  const sh = openSheet(title, `<div class="ph-prev"><img alt=""><div class="ph-bar"><i></i></div></div><div class="small muted mt" data-st>Envoi de la photo…</div>${fieldsHtml}<button class="btn p wide mt" data-ok>${label}</button>`);
  const st = sh.querySelector('[data-st]'), bar = sh.querySelector('.ph-bar i'), ok = sh.querySelector('[data-ok]');
  let waiting = false;
  const job = photoJob(file, j => { bar.style.width = j.pct + '%'; bar.parentNode.classList.toggle('done', j.state === 'ok'); st.textContent = photoStateText(j); if (j.state === 'err') { waiting = false; ok.disabled = false; ok.textContent = 'Réessayer'; } });
  sh.querySelector('.ph-prev img').src = job.preview;
  ok.onclick = async () => {
    if (waiting) return;
    waiting = true; ok.disabled = true;
    if (job.state === 'err') job.retry();
    ok.textContent = job.state === 'ok' ? label : 'Publication dès que la photo est envoyée…';
    try { const url = await job.done; if (document.body.contains(sh)) onPublish(url, sh); }
    catch (e) { waiting = false; ok.disabled = false; ok.textContent = 'Réessayer'; }
  };
  return sh;
}
// Bouton « 📷 Photo » dans un formulaire : ph.url() attend la fin de l'envoi (null si pas de photo).
function photoInline(btn, stat) {
  let job = null;
  btn.onclick = () => pickPhoto(f => { job = photoJob(f, j => { if (stat) stat.textContent = photoStateText(j); }); });
  return { has: () => !!job, url: async () => { if (!job) return null; if (job.state === 'err') job.retry(); return job.done; } };
}
function pickPhoto(cb, capture) {
  let inp = document.getElementById('nous-file');
  if (inp) inp.remove();
  inp = document.createElement('input'); inp.type = 'file'; inp.id = 'nous-file'; inp.accept = 'image/*'; if (capture) inp.capture = 'environment';
  inp.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
  document.body.appendChild(inp);
  inp.addEventListener('change', () => { const f = inp.files && inp.files[0]; setTimeout(() => inp.remove(), 500); if (f) cb(f); });
  inp.click();
}
async function sha(s) { const b = new TextEncoder().encode('nous·' + s); const d = await crypto.subtle.digest('SHA-256', b); return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join(''); }
function pinSheet(title, text, onOk) {
  const sh = openSheet(title, `<p>${text}</p><input class="in mt" type="password" inputmode="numeric" pattern="[0-9]*" data-pin placeholder="Code" autocomplete="off"><button class="btn p wide mt" data-ok>Valider</button>`);
  const go = async () => { const v = val(sh, '[data-pin]'); if (!v) return; const ok = await onOk(v); if (ok) sh.close(); else { toast('Code incorrect'); sh.querySelector('[data-pin]').value = ''; } };
  sh.querySelector('[data-ok]').onclick = go;
  sh.querySelector('[data-pin]').onkeydown = e => { if (e.key === 'Enter') go(); };
  setTimeout(() => sh.querySelector('[data-pin]').focus(), 200);
  return sh;
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
