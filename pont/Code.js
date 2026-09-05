// Pont « Nous » : stockage des données de l'appli dans un Google Sheet + photos Drive + notifs ntfy + Complice (API Claude).
// KEY est aussi dans l'appli (page publique) : elle évite juste les appels accidentels.
// Secrets (sujets ntfy, clé Anthropic, id du Sheet) = ScriptProperties, jamais dans ce code.
//
// doGet  ?key=…&what=all&since=<ms>   -> { ok, items:[…], now }
// doPost { key, what, … } :
//   setup     { app_url?, ntfy_alex?, ntfy_manon? }  crée le Sheet, pose les secrets, installe les rappels
//   upsert    { items:[…] }                          écrit/écrase par id (dernier `u` gagne)
//   all       { since }
//   photo     { name, data(base64), mime }           -> { url } (dossier Drive « Nous »)
//   notify    { to:'alex'|'manon'|'both', title, msg, tags, prio }
//   ai        { messages:[{role,content}], context } -> { text }
//   ai_setup  { api_key }

const KEY = 'nous-3e7a91c4d2f85b60';
const P = PropertiesService.getScriptProperties();
const TAB = 'Items';
const HDR = ['id', 'type', 'date', 'updated', 'deleted', 'json'];
const TZ = 'Europe/Paris';

function doGet(e) {
  const q = (e && e.parameter) || {};
  if (q.key !== KEY) return out({ ok: true, pong: true, v: 1 });
  if (q.what === 'all') return out(all_(Number(q.since || 0)));
  return out({ ok: true, pong: true, v: 1 });
}

function doPost(e) {
  let p = {};
  try { p = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'bad json' }); }
  if (p.key !== KEY) return out({ ok: false, error: 'bad key' });
  try {
    if (p.what === 'setup') return out(setup_(p));
    if (p.what === 'upsert') return out(upsert_(p.items || []));
    if (p.what === 'all') return out(all_(Number(p.since || 0)));
    if (p.what === 'photo') return out(photo_(p));
    if (p.what === 'notify') return out({ ok: notifyTo_(p.to, p.title, p.msg, p.tags, p.prio) });
    if (p.what === 'ai') return out(ai_(p));
    if (p.what === 'ai_setup') { P.setProperty('ANTHROPIC_KEY', String(p.api_key || '').trim()); return out({ ok: true }); }
    return out({ ok: false, error: 'unknown what' });
  } catch (err) {
    return out({ ok: false, error: String(err && err.message || err) });
  }
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// ---------- setup ----------
function autoriser() { setup_({}); Logger.log('OK : ' + book_().getUrl()); }
function setup_(p) {
  if (p.app_url) P.setProperty('APP_URL', p.app_url);
  if (p.ntfy_alex) P.setProperty('NTFY_ALEX', p.ntfy_alex);
  if (p.ntfy_manon) P.setProperty('NTFY_MANON', p.ntfy_manon);
  const ss = book_();
  sheet_(ss);
  const def = ss.getSheetByName('Feuille 1') || ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
  installTriggers_();
  return { ok: true, sheet_url: ss.getUrl(), ntfy_alex: !!P.getProperty('NTFY_ALEX'), ntfy_manon: !!P.getProperty('NTFY_MANON'), ai: !!P.getProperty('ANTHROPIC_KEY') };
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
  if (!sh) { sh = ss.insertSheet(TAB); sh.getRange(1, 1, 1, HDR.length).setValues([HDR]).setFontWeight('bold'); sh.setFrozenRows(1); }
  return sh;
}
function installTriggers_() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('notifMorning').timeBased().atHour(9).nearMinute(0).everyDays(1).inTimezone(TZ).create();
  ScriptApp.newTrigger('notifDue').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('notifMonday').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).nearMinute(30).inTimezone(TZ).create();
  ScriptApp.newTrigger('notifSunday').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(19).nearMinute(0).inTimezone(TZ).create();
}

// ---------- stockage ----------
function readAll_() {
  const sh = sheet_();
  const last = sh.getLastRow();
  if (last < 2) return { rows: [], index: {} };
  const vals = sh.getRange(2, 1, last - 1, HDR.length).getValues();
  const index = {};
  vals.forEach((r, i) => { if (r[0]) index[String(r[0])] = { row: i + 2, updated: Number(r[3]) || 0 }; });
  return { rows: vals, index };
}
function all_(since) {
  const { rows } = readAll_();
  const items = [];
  rows.forEach(r => {
    if (!r[0]) return;
    if (since && Number(r[3]) <= since) return;
    try { const o = JSON.parse(r[5]); if (r[4] === true || r[4] === 'TRUE') o.del = true; items.push(o); } catch (e) {}
  });
  return { ok: true, items, now: Date.now() };
}
function upsert_(items) {
  if (!items.length) return { ok: true, n: 0 };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet_();
    const { index } = readAll_();
    let n = 0;
    const appends = [];
    items.forEach(o => {
      if (!o || !o.id) return;
      const row = [o.id, o.t || '', o.d || '', Number(o.u) || Date.now(), !!o.del, JSON.stringify(o)];
      const ex = index[o.id];
      if (ex) { if (ex.updated > row[3]) return; sh.getRange(ex.row, 1, 1, HDR.length).setValues([row]); }
      else appends.push(row);
      n++;
    });
    if (appends.length) sh.getRange(sh.getLastRow() + 1, 1, appends.length, HDR.length).setValues(appends);
    return { ok: true, n, now: Date.now() };
  } finally { lock.releaseLock(); }
}
function itemsOf_(type) {
  const { rows } = readAll_();
  const res = [];
  rows.forEach(r => { if (r[1] !== type || (r[4] === true || r[4] === 'TRUE')) return; try { res.push(JSON.parse(r[5])); } catch (e) {} });
  return res;
}
function saveItem_(o) { o.u = Date.now(); upsert_([o]); }

// ---------- photos ----------
function photo_(p) {
  const folders = DriveApp.getFoldersByName('Nous');
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder('Nous');
  const blob = Utilities.newBlob(Utilities.base64Decode(p.data), p.mime || 'image/jpeg', p.name || ('photo-' + Date.now() + '.jpg'));
  const f = folder.createFile(blob);
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { ok: true, url: 'https://lh3.googleusercontent.com/d/' + f.getId() + '=w1400', id: f.getId() };
}

// ---------- ntfy ----------
function topic_(u) { return P.getProperty(u === 'alex' ? 'NTFY_ALEX' : 'NTFY_MANON'); }
function ntfy_(topic, msg, title, tags, prio) {
  if (!topic) return false;
  const headers = { 'Title': title || 'Nous', 'Priority': String(prio || 3) };
  if (tags) headers['Tags'] = tags;
  const app = P.getProperty('APP_URL');
  if (app) headers['Click'] = app;
  try { UrlFetchApp.fetch('https://ntfy.sh/' + topic, { method: 'post', payload: msg, headers, muteHttpExceptions: true }); return true; } catch (e) { return false; }
}
function notifyTo_(to, title, msg, tags, prio) {
  const list = to === 'both' ? ['alex', 'manon'] : [to];
  let ok = false;
  list.forEach(u => { if (ntfy_(topic_(u), msg, title, tags, prio)) ok = true; });
  return ok;
}

// ---------- rappels ----------
function today_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function dayIndex_(s) { return Math.round((new Date(s + 'T12:00:00') - new Date('2026-01-01T12:00:00')) / 864e5); }
function shuffle_(arr, seed) { const a = arr.slice(); let s = seed || 1; for (let i = a.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor(s / 233280 * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function monday_(s) { const d = new Date(s + 'T12:00:00'); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return Utilities.formatDate(d, TZ, 'yyyy-MM-dd'); }
function daysBetween_(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5); }
function fmt_(s) { const d = new Date(s + 'T12:00:00'); const M = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']; return d.getDate() + ' ' + M[d.getMonth()]; }
function name_(u) { const p = itemsOf_('profile').find(x => x.id === 'profile-' + u); return (p && p.name) || (u === 'alex' ? 'Alex' : 'Manon'); }

function notifMorning() {
  const d = today_();
  const q = shuffle_(QUESTIONS, 7)[((dayIndex_(d) % QUESTIONS.length) + QUESTIONS.length) % QUESTIONS.length];
  const meet = itemsOf_('meet').filter(m => !m.done && m.d >= d).sort((a, b) => a.d.localeCompare(b.d))[0];
  const cd = meet ? (daysBetween_(d, meet.d) === 0 ? "C'est aujourd'hui qu'on se retrouve 🎉\n\n" : 'J-' + daysBetween_(d, meet.d) + ' avant de se retrouver 💛\n\n') : '';
  notifyTo_('both', 'Question du jour 💬', cd + q, 'speech_balloon');
}
function notifDue() {
  const d = today_();
  itemsOf_('letter').forEach(l => {
    if (l.notified || l.open > d) return;
    ntfy_(topic_(l.to), 'Une lettre de ' + name_(l.from) + " s'ouvre aujourd'hui. Elle t'attend dans Nous.", 'Lettre 💌', 'love_letter', 4);
    l.notified = true; saveItem_(l);
  });
  itemsOf_('capsule').forEach(c => {
    if (c.notified || c.open > d) return;
    notifyTo_('both', 'Capsule ouverte ⏳', 'La capsule « ' + c.title + " » s'ouvre aujourd'hui !", 'hourglass', 4);
    c.notified = true; saveItem_(c);
  });
}
function notifMonday() {
  const wk = monday_(today_());
  const custom = itemsOf_('defiCustom').find(x => x.id === 'defiCustom-' + wk);
  const txt = custom ? custom.txt : shuffle_(DEFIS, 5)[((dayIndex_(wk) / 7) | 0) % DEFIS.length];
  const qs = shuffle_(QUIZ.map((q, i) => i), dayIndex_(wk) + 3).slice(0, 5);
  notifyTo_('both', 'Nouvelle semaine 🏁', 'Défi de la semaine : ' + txt + '\n\nEt un nouveau quiz de 5 questions vous attend 🧠', 'checkered_flag');
}
function notifSunday() {
  const wk = monday_(today_());
  const done = itemsOf_('checkin').filter(c => c.id.indexOf('checkin-' + wk) === 0).map(c => c.by);
  ['alex', 'manon'].forEach(u => { if (done.indexOf(u) < 0) ntfy_(topic_(u), 'Check-in de la semaine : 5 questions, une note, et on se le dit en appel.', 'Dimanche soir 🗓️', 'calendar'); });
}

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
