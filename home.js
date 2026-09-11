/* Nous · Accueil */
function nextMeet() { return all('meet').filter(m => !m.done && m.d >= today()).sort(byDate)[0] || null; }
function lastMeet() { return all('meet').filter(m => m.d < today()).sort(byDate).pop() || null; }

function renderHome(root) {
  const d = today();
  const greet = { nuit: 'Bonne nuit', aube: 'Bonjour', matin: 'Bonjour', jour: 'Hello', soir: 'Bonsoir', crepuscule: 'Bonsoir' }[document.body.dataset.sky] || 'Hello';
  let html = `<div class="hello"><h1>${greet} ${esc(myName())}</h1><div class="sub">${fmtLong(d)}</div></div>`;
  html += countdownCard();
  html += notifCard();
  html += pulseCard();
  html += questionCard(d);
  html += quoteCard(d);
  html += photosCard(d);
  html += numeroCard(d);
  html += memoryCard();
  root.innerHTML = html;
  wireHome(root);
}

// ---------- compte à rebours ----------
function countdownCard() {
  const m = nextMeet();
  if (!m) return `<div class="card tap" data-meet><div class="card-h"><h2>📅 Prochaines retrouvailles</h2></div><div class="muted">Aucune date pour l'instant. Touche pour en ajouter une, ça fait du bien de voir un chiffre.</div></div>`;
  const n = daysBetween(today(), m.d);
  const todos = m.todos || [];
  const done = todos.filter(t => t.done).length;
  return `<div class="card hero tap" data-meet="${m.id}">
    <div class="countdown"><div class="n">${n === 0 ? '🎉' : n}<small>${n === 0 ? '' : n === 1 ? 'jour' : 'jours'}</small></div>
    <div class="grow"><div style="font-weight:800;font-size:16px">${n === 0 ? "C'est aujourd'hui !" : 'avant de se retrouver'}</div><div class="muted">${fmtLong(m.d)}${m.place ? ' · ' + esc(m.place) : ''}</div>${todos.length ? `<div class="muted small mt">${done}/${todos.length} envies prévues ✓</div>` : ''}</div></div></div>`;
}
function meetSheet(id) {
  const m = (id && get(id)) || { id: uid('meet'), t: 'meet', d: '', place: '', todos: [], by: ME };
  const sh = openSheet('Retrouvailles', `
    <label class="f">Date</label><input class="in" type="date" data-d value="${m.d}">
    <label class="f">Où</label><input class="in" data-place placeholder="Chez toi, Lisbonne, la gare…" value="${esc(m.place || '')}">
    <div class="sec"><h2>À faire ensemble</h2></div>
    <div data-todos>${m.todos.map((t, i) => `<div class="li ${t.done ? 'done' : ''}"><button class="cb" data-tg="${i}">${t.done ? '✓' : ''}</button><div class="grow t">${esc(t.txt)}</div><button class="soft" data-rm="${i}">✕</button></div>`).join('') || '<div class="muted small">Chacun ajoute ses envies pour ces jours-là.</div>'}</div>
    <div class="row mt"><input class="in grow" data-new placeholder="Une envie pour ces jours-là" style="margin-top:0"><button class="btn" data-add>+</button></div>
    <div class="row mt2"><button class="btn danger" data-del>Supprimer</button><button class="btn p grow" data-save>Enregistrer</button></div>
    ${all('meet').filter(x => x.id !== m.id).length ? `<div class="sec"><h2>Historique</h2></div>${all('meet').filter(x => x.id !== m.id).sort(byDate).reverse().map(x => `<div class="li"><div class="grow"><div class="t">${fmtLong(x.d)}</div><div class="m">${esc(x.place || '')}</div></div></div>`).join('')}` : ''}`);
  const rerender = () => { meetSheet(m.id); };
  sh.querySelector('[data-add]').onclick = () => { const v = val(sh, '[data-new]'); if (!v) return; m.todos.push({ txt: v, done: false, by: ME }); m.d = val(sh, '[data-d]') || m.d; m.place = val(sh, '[data-place]'); put(m); rerender(); };
  sh.querySelectorAll('[data-tg]').forEach(b => b.onclick = () => { m.todos[+b.dataset.tg].done = !m.todos[+b.dataset.tg].done; put(m); rerender(); });
  sh.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { m.todos.splice(+b.dataset.rm, 1); put(m); rerender(); });
  sh.querySelector('[data-save]').onclick = () => { m.d = val(sh, '[data-d]'); if (!m.d) return toast('Il faut une date'); m.place = val(sh, '[data-place]'); const isNew = !get(m.id); put(m); sh.close(); render(); toast('Enregistré'); if (isNew) notify(YOU(), 'Retrouvailles 📅', myName() + ' a noté une date : ' + fmtLong(m.d) + (m.place ? ' · ' + m.place : ''), 'meet'); };
  sh.querySelector('[data-del]').onclick = async () => { if (get(m.id) && await confirmSheet('Supprimer ?', 'Cette date sera retirée.', 'Supprimer')) { remove(m.id); closeSheet(); render(); } else if (!get(m.id)) sh.close(); };
}

// ---------- activer les notifs (tant que ce n'est pas fait sur ce téléphone) ----------
function notifCard() {
  const st = PUSH.state();
  if (st !== 'default' && st !== 'install') return '';
  let later = 0; try { later = +localStorage.getItem('nous-notif-later') || 0; } catch (e) {}
  if (Date.now() < later) return '';
  const you = esc(yourName());
  return `<div class="card notif-card"><div class="card-h"><h2>🔔 Les notifs</h2><button class="btn sm ghost" data-nlater>Plus tard</button></div>
    ${st === 'install' ? `<div class="muted small">Pour savoir quand ${you} pense à toi : ajoute Nous à l'écran d'accueil (Safari → Partager → « Sur l'écran d'accueil »), puis ouvre-la depuis l'icône.</div>` : `<div class="muted small">Une notif quand ${you} pense à toi ou remplit quelque chose. Jamais de rappel de l'appli.</div><button class="btn p wide mt" data-non>Activer les notifications</button>`}</div>`;
}

// ---------- je pense à toi ----------
function pulseCard() {
  const pings = theirs('ping').sort(byNewest);
  const last = pings[0];
  const todayN = mine('ping').filter(p => p.d === today()).length;
  return `<button class="pulse-btn" data-pulse><div class="heart">💛</div><div class="grow"><div class="t">Je pense à toi</div><div class="s">${last ? esc(yourName()) + ' a pensé à toi ' + ago(last.u) : 'Une touche, et ' + esc(yourName()) + ' reçoit un petit signe de toi.'}${todayN ? ' · ' + todayN + ' envoyé' + (todayN > 1 ? 's' : '') + " aujourd'hui" : ''}</div></div><div style="font-size:22px">›</div></button>`;
}
const PING_MSGS = ['pense à toi 💛', 'pense à toi, là, maintenant 💛', 't\'envoie un petit signe 💛', 'a une pensée pour toi ✨', 'pense fort à toi 💛'];
function sendPulse(btn) {
  haptic();
  btn.classList.add('sent'); setTimeout(() => btn.classList.remove('sent'), 700);
  put({ id: uid('ping'), t: 'ping', by: ME, d: today() });
  notify(YOU(), myName() + ' 💛', myName() + ' ' + pick(PING_MSGS, Math.floor(Math.random() * 100)), 'ping');
  toast('Envoyé à ' + yourName() + ' 💛');
  burst();
}
function burst() { const c = h('<div class="confetti"></div>').firstChild; const cols = ['#e0507a', '#7b5cf5', '#f0b04a', '#2fb37e', '#ff8fb1']; for (let i = 0; i < 40; i++) { const s = document.createElement('i'); s.style.left = Math.random() * 100 + 'vw'; s.style.background = cols[i % cols.length]; s.style.animationDelay = Math.random() * .4 + 's'; s.style.animationDuration = 1.4 + Math.random() + 's'; c.appendChild(s); } document.body.appendChild(c); setTimeout(() => c.remove(), 2600); }

// ---------- question du jour ----------
function dayQuestion(d) { const idx = dayIndex(d); return shuffle(QUESTIONS, 7)[((idx % QUESTIONS.length) + QUESTIONS.length) % QUESTIONS.length]; }
function questionCard(d) {
  const q = dayQuestion(d);
  const me = get('qd-' + d + '-' + ME), you = get('qd-' + d + '-' + YOU());
  let body = '';
  if (me) {
    body += `<div class="answer"><div class="who">${avatar(ME, 18)} ${esc(myName())}</div>${nl(me.a)}</div>`;
    body += you ? `<div class="answer"><div class="who">${avatar(YOU(), 18)} ${esc(yourName())}</div>${nl(you.a)}</div>` : `<div class="muted small mt">En attente de ${esc(yourName())}… sa réponse apparaîtra ici.</div>`;
  } else {
    if (you) body += `<div class="answer locked"><div class="who">${esc(yourName())}</div>Réponds pour découvrir sa réponse…</div><div class="muted small mt">${esc(yourName())} a déjà répondu 👀</div>`;
    body += `<textarea class="in mt" data-qa placeholder="Ta réponse…"></textarea><button class="btn p wide mt" data-qsend>Répondre</button>`;
  }
  return `<div class="card q-card"><div class="card-h"><h2>💬 Question du jour</h2><button class="btn sm ghost" data-qhist>Historique</button></div><div class="q">${esc(q)}</div>${body}</div>`;
}
function answerQuestion(root) {
  const a = val(root, '[data-qa]'); if (!a) return toast('Écris quelque chose 🙂');
  const d = today();
  put({ id: 'qd-' + d + '-' + ME, t: 'qd', d, by: ME, a });
  const you = get('qd-' + d + '-' + YOU());
  notify(YOU(), 'Question du jour 💬', you ? myName() + ' a répondu : vos deux réponses sont dévoilées !' : myName() + ' a répondu à la question du jour. À toi !', 'qd');
  render(); toast(you ? 'Réponses dévoilées ✨' : 'Envoyé, on attend ' + yourName());
}
function questionHistory() {
  const days = {};
  all('qd').forEach(o => { days[o.d] = days[o.d] || {}; days[o.d][o.by] = o.a; });
  const keys = Object.keys(days).sort().reverse().filter(k => k !== today());
  openSheet('Vos réponses', keys.length ? keys.map(k => `<div class="card"><div class="small muted">${fmtLong(k)}</div><div class="q serif" style="font-size:16px;margin:4px 0 6px">${esc(dayQuestion(k))}</div>${['alex', 'manon'].map(u => days[k][u] ? `<div class="answer"><div class="who">${avatar(u, 18)} ${esc(nameOf(u))}</div>${nl(days[k][u])}</div>` : '').join('')}</div>`).join('') : empty('Vos premières réponses apparaîtront ici.', '💬'));
}

// ---------- citation du jour ----------
function dayQuote(d) { return pick(shuffle(QUOTES, 3), dayIndex(d)); }
function quoteCard(d) {
  const q = dayQuote(d);
  const th = all('quoteR').filter(r => r.d === d).sort((a, b) => a.u - b.u);
  return `<div class="card"><div class="card-h"><h2>🪶 Citation du jour</h2><button class="btn sm ghost" data-qthist>Historique</button></div>
    <div class="quote">« ${esc(q.q)} »</div><div class="quote-a">${esc(q.a)}</div>
    <div class="quote-p">${esc(q.p)}</div>
    ${th.map(r => `<div class="answer"><div class="who">${avatar(r.by, 18)} ${esc(nameOf(r.by))}</div>${nl(r.txt)}</div>`).join('')}
    <div class="row mt"><input class="in grow" data-qr placeholder="Ta réflexion, si tu veux…" style="margin-top:0"><button class="btn" data-qrsend>➤</button></div>
    <div class="tiny muted mt">Aucune obligation. Juste un point de départ pour échanger.</div></div>`;
}
function sendQuoteReply(root) {
  const txt = val(root, '[data-qr]'); if (!txt) return;
  const d = today();
  put({ id: uid('quoteR'), t: 'quoteR', d, by: ME, txt });
  notify(YOU(), 'Citation du jour 🪶', myName() + ' : ' + txt, 'quote');
  render();
}
function quoteHistory() {
  const days = {}; all('quoteR').forEach(r => { if (r.d === today()) return; days[r.d] = days[r.d] || []; days[r.d].push(r); });
  const keys = Object.keys(days).sort().reverse();
  openSheet('Vos échanges', keys.length ? keys.map(k => { const q = dayQuote(k); return `<div class="card"><div class="small muted">${fmtLong(k)}</div><div class="quote" style="font-size:16px;margin-top:4px">« ${esc(q.q)} »</div><div class="quote-a">${esc(q.a)}</div>${days[k].sort((a, b) => a.u - b.u).map(r => `<div class="answer"><div class="who">${avatar(r.by, 18)} ${esc(nameOf(r.by))}</div>${nl(r.txt)}</div>`).join('')}</div>`; }).join('') : empty('Vos premiers échanges apparaîtront ici.', '🪶'));
}

// ---------- photo du jour ----------
function dayPhoto(d, u) { return all('photo').filter(p => p.kind === 'day' && p.d === d && p.by === u).sort(byNewest)[0]; }
function photosCard(d) {
  const slot = u => { const p = dayPhoto(d, u); const me = u === ME; return `<div class="pslot ${p ? 'has' : ''}" data-photo-slot="${u}" data-url="${p ? esc(p.url) : ''}">${p ? `<img src="${esc(p.url)}" alt="">${p.cap ? `<div class="cap">${esc(p.cap)}</div>` : ''}` : (me ? '📷<br>Ta photo du jour' : `<span>${esc(nameOf(u))} n'a pas encore posté</span>`)}<span class="lbl">${esc(nameOf(u))}</span></div>`; };
  return `<div class="card"><div class="card-h"><h2>📸 Photo du jour</h2><button class="btn sm ghost" data-gallery>Toutes</button></div><div class="photos2">${slot(ME)}${slot(YOU())}</div></div>`;
}
function addDayPhoto(file) {
  photoSheet(file, 'Photo du jour', `<label class="f">Légende (facultatif)</label><input class="in" data-cap placeholder="Un mot, un lieu, une vibe">`, 'Publier', (url, sh) => {
    put({ id: uid('photo'), t: 'photo', kind: 'day', d: today(), by: ME, url, cap: val(sh, '[data-cap]') });
    notify(YOU(), 'Photo du jour 📸', myName() + ' a posté sa photo du jour', 'photo');
    sh.close(); render(); toast('Publiée');
  });
}
function viewPhoto(url, cap) { const v = h(`<div class="viewer"><button class="x">✕</button><img src="${esc(url)}" alt=""><div class="c">${esc(cap || '')}</div></div>`).firstChild; v.onclick = () => v.remove(); document.body.appendChild(v); }

// ---------- numérologie ----------
function numeroCard(d) {
  const p = profile(ME);
  if (!p.birth) return `<div class="card tap" data-settings><div class="card-h"><h2>🔮 Ton nombre du jour</h2></div><div class="muted">Renseigne ta date de naissance dans les réglages pour voir ton nombre personnel du jour.</div></div>`;
  const n = personalDay(p.birth, d), info = NUMERO[n];
  const yn = profile(YOU()).birth ? personalDay(profile(YOU()).birth, d) : null;
  return `<div class="card"><div class="card-h"><h2>🔮 Ton nombre du jour</h2>${yn ? `<span class="chip">${esc(yourName())} : ${yn} · ${NUMERO[yn].k}</span>` : ''}</div>
    <div class="numero"><div class="n">${n}</div><div class="grow"><div style="font-weight:800;font-size:16px">${info.k}</div><div class="muted">${esc(info.e)}</div></div></div>
    <div class="answer mt"><div class="who">À deux</div>${esc(info.d)}</div></div>`;
}

// ---------- souvenir ----------
function memoryPick() {
  const photos = all('photo').filter(p => p.kind !== 'capsule');
  const d = today();
  const cands = [];
  [[365, 'Il y a un an'], [180, 'Il y a 6 mois'], [90, 'Il y a 3 mois'], [30, 'Il y a un mois'], [7, 'Il y a une semaine']].forEach(([n, l]) => {
    const dd = addDays(d, -n);
    photos.filter(p => p.d === dd).forEach(p => cands.push({ p, l }));
    all('qd').filter(q => q.d === dd).forEach(q => cands.push({ q, l }));
  });
  if (cands.length) return pick(cands, dayIndex(d));
  const old = photos.filter(p => p.d && daysBetween(p.d, d) >= 3);
  if (old.length) return { p: pick(old, dayIndex(d) * 7 + 3), l: 'Souvenir' };
  return null;
}
function memoryCard() {
  const m = memoryPick();
  if (!m) return '';
  if (m.p) return `<div class="memory tap" data-view="${esc(m.p.url)}" data-cap="${esc(m.p.cap || '')}"><img src="${esc(m.p.url)}" alt=""><div class="txt"><div class="lbl">${m.l} · ${fmtDate(m.p.d)}</div><div>${esc(m.p.cap || ('Photo de ' + nameOf(m.p.by)))}</div></div></div>`;
  return `<div class="card"><div class="small muted" style="text-transform:uppercase;letter-spacing:.06em;font-weight:800">${m.l} · ${fmtDate(m.q.d)}</div><div class="q serif" style="font-size:17px;margin:4px 0 6px">${esc(dayQuestion(m.q.d))}</div><div class="answer"><div class="who">${avatar(m.q.by, 18)} ${esc(nameOf(m.q.by))}</div>${nl(m.q.a)}</div></div>`;
}

function wireHome(root) {
  root.querySelectorAll('[data-meet]').forEach(c => c.onclick = () => meetSheet(c.dataset.meet || null));
  root.querySelector('[data-pulse]').onclick = e => sendPulse(e.currentTarget);
  const non = root.querySelector('[data-non]');
  if (non) non.onclick = () => { non.disabled = true; enablePush().then(() => { toast('Notifications activées 🔔'); render(); }).catch(e => { toast(e.message === 'denied' ? 'Notifications refusées' : 'Échec : ' + e.message); render(); }); };
  const nl8 = root.querySelector('[data-nlater]');
  if (nl8) nl8.onclick = () => { try { localStorage.setItem('nous-notif-later', String(Date.now() + 3 * 864e5)); } catch (e) {} render(); };
  const qs = root.querySelector('[data-qsend]'); if (qs) qs.onclick = () => answerQuestion(root);
  root.querySelector('[data-qhist]').onclick = questionHistory;
  root.querySelector('[data-qthist]').onclick = quoteHistory;
  root.querySelector('[data-qrsend]').onclick = () => sendQuoteReply(root);
  root.querySelector('[data-qr]').onkeydown = e => { if (e.key === 'Enter') sendQuoteReply(root); };
  root.querySelectorAll('[data-photo-slot]').forEach(s => s.onclick = () => { if (s.dataset.url) viewPhoto(s.dataset.url); else if (s.dataset.photoSlot === ME) pickPhoto(addDayPhoto); });
  root.querySelector('[data-gallery]').onclick = () => { VIEW.tab = 'duo'; VIEW.duo = 'photos'; render(); scrollTop(); };
  root.querySelectorAll('[data-settings]').forEach(c => c.onclick = settingsSheet);
  root.querySelectorAll('[data-view]').forEach(c => c.onclick = () => viewPhoto(c.dataset.view, c.dataset.cap));
}
