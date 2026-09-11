// Pont « Nous » : stockage des données de l'appli dans un Google Sheet + photos Drive + notifs Web Push + Complice (API Claude).
// KEY est aussi dans l'appli (page publique) : elle évite juste les appels accidentels.
// Secrets (clés VAPID, abonnements push, clé Anthropic, id du Sheet) = ScriptProperties, jamais dans ce code.
//
// Chaque réponse POST renvoie { what } = la demande reçue. L'appli rejette toute réponse qui ne correspond pas :
// Safari transforme parfois un POST en GET sans corps, qui tombait sur doGet et répondait « ok » (photo publiée sans lien).
//
// doGet  ?key=…&what=all&since=<ms serveur>   -> { ok, items:[…], now }   (since = horodatage serveur, colonne srv)
//        ?key=…&what=photo&pid=…              -> { ok, url } si la photo est arrivée
//        ?key=…&what=push                     -> { ok, vapid, subs:{ alex:n, manon:n } }
// doPost { key, what, … } :
//   setup       {}                                   crée le Sheet, génère les clés VAPID, installe le rappel lettres/capsules
//   upsert      { items:[…], notes:[…] }             écrit/écrase par id (dernier `u` gagne), puis envoie les notifs `notes`
//   photo_part  { pid, i, n, data(base64) }          un morceau de photo (cache 6 h)
//   photo_done  { pid, n, mime }                     assemble -> { url } ou { missing:[…] } ; rejouable sans risque
//   photo       { name, data, mime }                 ancien envoi en un seul bloc (vieilles versions de l'appli)
//   push_sub    { user, sub:{ endpoint, keys:{ p256dh, auth } }, dev }
//   push_unsub  { endpoint }
//   notify      { to, from, title, msg, kind, nid }  notif vers les téléphones de `to` (nid = anti-doublon)
//   push_test   { user }
//   ai          { messages:[{role,content}], context } -> { text }
//   ai_setup    { api_key }

const KEY = 'nous-3e7a91c4d2f85b60';
const P = PropertiesService.getScriptProperties();
const TAB = 'Items';
const HDR = ['id', 'type', 'date', 'updated', 'deleted', 'json', 'srv'];
const TZ = 'Europe/Paris';
const APP_URL_DEF = 'https://alexyoucompte99-lang.github.io/nous-deux/';
const PEOPLE = ['alex', 'manon'];
const PUSH_USERS = ['alex', 'manon', 'diag'];

function doGet(e) {
  const q = (e && e.parameter) || {};
  if (q.key !== KEY) return out({ ok: false, error: 'key' });
  try {
    if (q.what === 'all') return out(Object.assign({ what: 'all' }, all_(Number(q.since || 0))));
    if (q.what === 'photo') return out(Object.assign({ what: 'photo' }, photoFind_(q.pid)));
    if (q.what === 'push') return out(Object.assign({ what: 'push' }, pushStatus_()));
    if (q.what === 'diag') return out({ ok: true, what: 'diag', push_err: P.getProperty('LAST_PUSH_ERR') || null, ai: !!P.getProperty('ANTHROPIC_KEY'), subs: pushStatus_().subs });
  } catch (err) {
    return out({ ok: false, what: q.what, error: String(err && err.message || err) });
  }
  return out({ ok: false, error: 'get' });
}

function doPost(e) {
  let p = {};
  try { p = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'bad json' }); }
  if (p.key !== KEY) return out({ ok: false, error: 'bad key' });
  const res = r => out(Object.assign({ what: p.what }, r));
  try {
    switch (p.what) {
      case 'setup': return res(setup_(p));
      case 'upsert': return res(upsert_(p.items || [], p.notes || []));
      case 'all': return res(all_(Number(p.since || 0)));
      case 'photo_part': return res(photoPart_(p));
      case 'photo_done': return res(photoDone_(p));
      case 'photo': return res(photo_(p));
      case 'push_sub': return res(pushSub_(p));
      case 'push_unsub': return res(pushUnsub_(p.endpoint));
      case 'notify': return res(notify_(p));
      case 'push_test': return res({ ok: true, sent: pushTo_(p.user, { title: 'Nous 💛', body: 'Les notifications marchent sur ce téléphone.', kind: 'test' }) });
      case 'ai': return res(ai_(p));
      case 'ai_setup': P.setProperty('ANTHROPIC_KEY', String(p.api_key || '').trim()); return res({ ok: true });
    }
    return res({ ok: false, error: 'unknown what' });
  } catch (err) {
    return res({ ok: false, error: String(err && err.message || err) });
  }
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// ---------- setup ----------
function autoriser() { setup_({}); Logger.log('OK : ' + book_().getUrl()); }
function setup_(p) {
  if (p.app_url) P.setProperty('APP_URL', p.app_url);
  const ss = book_();
  sheet_(ss);
  const def = ss.getSheetByName('Feuille 1') || ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
  vapidKeys_();
  installTriggers_();
  return { ok: true, sheet_url: ss.getUrl(), vapid: P.getProperty('VAPID_PUB'), ai: !!P.getProperty('ANTHROPIC_KEY') };
}
function book_() {
  const id = P.getProperty('SHEET_ID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) {} }
  const ss = SpreadsheetApp.create('Nous · données');
  P.setProperty('SHEET_ID', ss.getId());
  return ss;
}
function sheet_(ss) {
  ss = ss || book_();
  let sh = ss.getSheetByName(TAB);
  if (!sh) { sh = ss.insertSheet(TAB); sh.getRange(1, 1, 1, HDR.length).setValues([HDR]).setFontWeight('bold'); sh.setFrozenRows(1); P.setProperty('HDR_V', '2'); }
  if (P.getProperty('HDR_V') !== '2') { sh.getRange(1, 1, 1, HDR.length).setValues([HDR]).setFontWeight('bold'); P.setProperty('HDR_V', '2'); }
  return sh;
}
// Pas de rappel automatique d'attention (principe de l'appli) : seules les lettres et capsules qui s'ouvrent préviennent, à 9 h.
function installTriggers_() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('notifDue').timeBased().atHour(9).nearMinute(0).everyDays(1).inTimezone(TZ).create();
}

// ---------- stockage ----------
function readAll_() {
  const sh = sheet_();
  const last = sh.getLastRow();
  if (last < 2) return { rows: [], index: {} };
  const vals = sh.getRange(2, 1, last - 1, HDR.length).getValues();
  const index = {};
  vals.forEach((r, i) => { if (r[0]) index[String(r[0])] = { row: i + 2, i, updated: Number(r[3]) || 0 }; });
  return { rows: vals, index };
}
function rowItem_(r) { try { const o = JSON.parse(r[5]); if (r[4] === true || r[4] === 'TRUE') o.del = true; return o; } catch (e) { return null; } }
// since = horodatage serveur (colonne srv) : un élément arrivé en retard (réseau capricieux) n'est jamais sauté par l'autre téléphone.
function all_(since) {
  const { rows } = readAll_();
  const items = [];
  rows.forEach(r => {
    if (!r[0]) return;
    if (since && (Number(r[6]) || Number(r[3]) || 0) <= since) return;
    const o = rowItem_(r); if (o) items.push(o);
  });
  return { ok: true, items, now: Date.now() };
}
function upsert_(items, notes) {
  const newer = [];
  let n = 0;
  if (items.length) {
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const sh = sheet_();
      const { rows, index } = readAll_();
      const now = Date.now();
      const appends = [], appended = {};
      items.forEach(o => {
        if (!o || !o.id) return;
        const row = [o.id, o.t || '', o.d || '', Number(o.u) || now, !!o.del, JSON.stringify(o), now];
        const ex = index[o.id];
        if (o.id in appended) { if (appends[appended[o.id]][3] <= row[3]) appends[appended[o.id]] = row; return; }
        if (ex) {
          if (ex.updated > row[3]) { const cur = rowItem_(rows[ex.i]); if (cur) newer.push(cur); return; }
          sh.getRange(ex.row, 1, 1, HDR.length).setValues([row]);
        } else { appended[o.id] = appends.length; appends.push(row); }
        n++;
      });
      if (appends.length) sh.getRange(sh.getLastRow() + 1, 1, appends.length, HDR.length).setValues(appends);
      SpreadsheetApp.flush();
    } finally { lock.releaseLock(); }
  }
  let sent = 0;
  (notes || []).slice(0, 20).forEach(x => { try { sent += notify_(x).sent || 0; } catch (e) { P.setProperty('LAST_PUSH_ERR', 'note ' + String(e && e.message || e)); } });
  return { ok: true, n, now: Date.now(), newer, sent };
}
function itemsOf_(type) {
  const { rows } = readAll_();
  const res = [];
  rows.forEach(r => { if (r[1] !== type || (r[4] === true || r[4] === 'TRUE')) return; const o = rowItem_(r); if (o) res.push(o); });
  return res;
}
function saveItem_(o) { o.u = Date.now(); upsert_([o], []); }

// ---------- photos ----------
function folder_() {
  const id = P.getProperty('FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const it = DriveApp.getFoldersByName('Nous');
  const f = it.hasNext() ? it.next() : DriveApp.createFolder('Nous');
  P.setProperty('FOLDER_ID', f.getId());
  return f;
}
const safeId_ = s => String(s || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
const photoUrl_ = f => 'https://lh3.googleusercontent.com/d/' + f.getId() + '=w1400';
function photoPart_(p) {
  const pid = safeId_(p.pid), i = Number(p.i), data = String(p.data || '');
  if (!pid || !(i >= 0 && i < 400) || !data || data.length > 95000) return { ok: false, error: 'morceau invalide' };
  CacheService.getScriptCache().put('ph:' + pid + ':' + i, data, 21600);
  return { ok: true, i };
}
function photoFind_(pid) {
  pid = safeId_(pid);
  if (!pid) return { ok: false, error: 'pid' };
  const c = CacheService.getScriptCache().get('phd:' + pid);
  if (c) return { ok: true, url: c };
  const it = folder_().searchFiles("title contains '" + pid + "'");
  while (it.hasNext()) { const f = it.next(); if (f.getName().indexOf(pid) === 0) return { ok: true, url: photoUrl_(f) }; }
  return { ok: false, error: 'absente' };
}
function photoDone_(p) {
  const pid = safeId_(p.pid), n = Number(p.n);
  if (!pid || !(n >= 1 && n <= 400)) return { ok: false, error: 'photo invalide' };
  const cache = CacheService.getScriptCache();
  const known = cache.get('phd:' + pid);
  if (known) return { ok: true, url: known };
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const found = photoFind_(pid);
    if (found.ok) return found;
    const keys = [];
    for (let i = 0; i < n; i++) keys.push('ph:' + pid + ':' + i);
    const got = {};
    for (let i = 0; i < keys.length; i += 100) Object.assign(got, cache.getAll(keys.slice(i, i + 100)));
    const missing = [];
    keys.forEach((k, i) => { if (got[k] == null) missing.push(i); });
    if (missing.length) return { ok: false, missing };
    const mime = /^image\/[\w.+-]+$/.test(String(p.mime || '')) ? p.mime : 'image/jpeg';
    const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/heic': '.heic', 'image/heif': '.heif', 'image/webp': '.webp' }[mime] || '';
    const f = folder_().createFile(Utilities.newBlob(Utilities.base64Decode(keys.map(k => got[k]).join('')), mime, pid + ext));
    f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const url = photoUrl_(f);
    cache.put('phd:' + pid, url, 21600);
    try { cache.removeAll(keys); } catch (e) {}
    return { ok: true, url };
  } finally { lock.releaseLock(); }
}
function photo_(p) {
  const blob = Utilities.newBlob(Utilities.base64Decode(p.data), p.mime || 'image/jpeg', p.name || ('photo-' + Date.now() + '.jpg'));
  const f = folder_().createFile(blob);
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { ok: true, url: photoUrl_(f), id: f.getId() };
}

// ---------- notifications (Web Push, voir Push.js) ----------
function vapidKeys_() {
  let d = P.getProperty('VAPID_D'), pub = P.getProperty('VAPID_PUB');
  if (!d || !pub) {
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      d = P.getProperty('VAPID_D'); pub = P.getProperty('VAPID_PUB');
      if (!d || !pub) { const kp = ecKeyPair_(); d = kp.d.toString(16); pub = b64u_(kp.pub); P.setProperties({ VAPID_D: d, VAPID_PUB: pub }); }
    } finally { lock.releaseLock(); }
  }
  return { d: BigInt('0x' + d), pub: b64uDec_(pub) };
}
function pushSubs_() { try { return JSON.parse(P.getProperty('PUSH_SUBS') || '{}'); } catch (e) { return {}; } }
function pushStatus_() {
  const s = pushSubs_(), subs = {};
  PEOPLE.forEach(u => { subs[u] = (s[u] || []).length; });
  return { ok: true, vapid: P.getProperty('VAPID_PUB') || b64u_(vapidKeys_().pub), subs };
}
const PUSH_HOSTS = /^https:\/\/([a-z0-9-]+\.)*(push\.apple\.com|googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com)\//;
function pushSub_(p) {
  const s = p.sub || {}, k = s.keys || {};
  if (PUSH_USERS.indexOf(p.user) < 0 || !PUSH_HOSTS.test(String(s.endpoint || ''))) return { ok: false, error: 'abonnement invalide' };
  if (b64uDec_(k.p256dh || '').length !== 65 || b64uDec_(k.auth || '').length !== 16) return { ok: false, error: 'clés invalides' };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const all = pushSubs_();
    PUSH_USERS.forEach(u => { all[u] = (all[u] || []).filter(x => x.e !== s.endpoint); });
    all[p.user] = all[p.user].concat([{ e: s.endpoint, k: k.p256dh, a: k.auth, d: String(p.dev || '').slice(0, 30), t: Date.now() }]).slice(-4);
    P.setProperty('PUSH_SUBS', JSON.stringify(all));
    return { ok: true, n: all[p.user].length };
  } finally { lock.releaseLock(); }
}
function pushUnsub_(endpoint) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const all = pushSubs_();
    let n = 0;
    PUSH_USERS.forEach(u => { const before = (all[u] || []).length; all[u] = (all[u] || []).filter(x => [].concat(endpoint).indexOf(x.e) < 0); n += before - all[u].length; });
    P.setProperty('PUSH_SUBS', JSON.stringify(all));
    return { ok: true, removed: n };
  } finally { lock.releaseLock(); }
}
// Envoie une notif sur tous les téléphones de `user`. Renvoie le nombre de téléphones atteints.
function pushTo_(user, payload) {
  const subs = pushSubs_()[user] || [];
  if (!subs.length) return 0;
  const keys = vapidKeys_(), contact = P.getProperty('APP_URL') || APP_URL_DEF;
  let res;
  try { res = UrlFetchApp.fetchAll(subs.map(s => webPushRequest_(s, payload, keys, contact))); }
  catch (e) { P.setProperty('LAST_PUSH_ERR', new Date().toISOString() + ' ' + user + ' ' + String(e && e.message || e)); return 0; }
  let ok = 0;
  const dead = [];
  res.forEach((r, i) => {
    const code = r.getResponseCode();
    if (code < 300) { ok++; return; }
    if (code === 404 || code === 410) dead.push(subs[i].e);
    P.setProperty('LAST_PUSH_ERR', new Date().toISOString() + ' ' + user + ' ' + subs[i].e.slice(8, 40) + ' ' + code + ' ' + r.getContentText().slice(0, 200));
  });
  if (dead.length) pushUnsub_(dead);
  return ok;
}
function notify_(p) {
  const to = p.to === 'both' ? PEOPLE : [p.to];
  if (p.nid) {
    const c = CacheService.getScriptCache(), k = 'nid:' + safeId_(p.nid);
    if (c.get(k)) return { ok: true, dup: true, sent: 0 };
    c.put(k, '1', 21600);
  }
  const payload = { title: String(p.title || 'Nous').slice(0, 120), body: String(p.msg || '').slice(0, 500), kind: safeId_(p.kind).slice(0, 20), from: safeId_(p.from).slice(0, 10) };
  let sent = 0;
  to.forEach(u => { if (PUSH_USERS.indexOf(u) >= 0) sent += pushTo_(u, payload); });
  return { ok: true, sent };
}

// ---------- lettres et capsules qui s'ouvrent ----------
function today_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function name_(u) { const p = itemsOf_('profile').find(x => x.id === 'profile-' + u); return (p && p.name) || (u === 'alex' ? 'Alex' : 'Manon'); }
function notifDue() {
  const d = today_();
  itemsOf_('letter').forEach(l => {
    if (l.notified || l.open > d) return;
    pushTo_(l.to, { title: 'Lettre 💌', body: 'Une lettre de ' + name_(l.from) + " s'ouvre aujourd'hui. Elle t'attend dans Nous.", kind: 'letter' });
    l.notified = true; saveItem_(l);
  });
  itemsOf_('capsule').forEach(c => {
    if (c.notified || c.open > d) return;
    PEOPLE.forEach(u => pushTo_(u, { title: 'Capsule ouverte ⏳', body: 'La capsule « ' + c.title + " » s'ouvre aujourd'hui !", kind: 'capsule' }));
    c.notified = true; saveItem_(c);
  });
}
// Anciens rappels automatiques retirés (l'appli ne dicte rien). Gardés vides au cas où un ancien déclencheur traîne.
function notifMorning() {}
function notifMonday() {}
function notifSunday() {}

// ---------- Complice (API Claude) ----------
function ai_(p) {
  const key = P.getProperty('ANTHROPIC_KEY');
  if (!key) return { ok: false, error: 'no key' };
  const msgs = (p.messages || []).filter(m => m && (m.role === 'user' || m.role === 'assistant') && m.content).map(m => ({ role: m.role, content: String(m.content).slice(0, 4000) }));
  if (!msgs.length || msgs[0].role !== 'user') return { ok: false, error: 'bad messages' };
  const body = {
    model: 'claude-opus-5',
    max_tokens: 1024,
    system: [{ type: 'text', text: AI_SYSTEM, cache_control: { type: 'ephemeral' } }, { type: 'text', text: String(p.context || '') }],
    output_config: { effort: 'low' },
    messages: msgs,
  };
  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify(body),
  });
  const j = JSON.parse(res.getContentText());
  if (res.getResponseCode() !== 200) return { ok: false, error: (j.error && j.error.message) || ('HTTP ' + res.getResponseCode()) };
  if (j.stop_reason === 'refusal') return { ok: true, text: 'Je préfère ne pas répondre à ça. Une autre idée ?' };
  const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  return { ok: true, text: text || '…' };
}
