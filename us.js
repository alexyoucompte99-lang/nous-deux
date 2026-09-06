/* Nous · Nous : check-in hebdo, journal d'humeur, lettres différées, capsules temporelles */
const US_TABS = [{ v: 'checkin', l: '🗓️ Check-in' }, { v: 'mood', l: '🌤️ Humeur' }, { v: 'letters', l: '💌 Lettres' }, { v: 'capsules', l: '⏳ Capsules' }, { v: 'ideas', l: '💡 Idées' }];
function renderUs(root) {
  VIEW.us = VIEW.us || 'checkin';
  root.innerHTML = `<div class="hello"><h1>Nous</h1></div><div class="chips scroll mt" data-seg="us">${US_TABS.map(t => `<button type="button" class="chip ${t.v === VIEW.us ? 'on' : ''}" data-v="${t.v}">${t.l}</button>`).join('')}</div><div id="us-body"></div>`;
  wireSegs(root);
  root.querySelector('[data-seg=us]').addEventListener('change', () => { VIEW.us = segVal(root, 'us'); renderUsBody(); });
  renderUsBody();
}
function renderUsBody() { const b = document.getElementById('us-body'); if (!b) return; ({ checkin: renderCheckin, mood: renderMood, letters: renderLetters, capsules: renderCapsules, ideas: renderIdeas })[VIEW.us](b); }

// ---------- check-in hebdo ----------
function renderCheckin(b) {
  const wk = weekKey();
  const me = get('checkin-' + wk + '-' + ME), you = get('checkin-' + wk + '-' + YOU());
  const weeks = new Set(); all('checkin').forEach(c => weeks.add(c.id.split('-').slice(1, 4).join('-')));
  const hist = [...weeks].filter(w => w !== wk).sort().reverse();
  const show = (c, u) => `<div class="card"><div class="card-h"><h2>${avatar(u, 22)} ${esc(nameOf(u))}</h2><span class="chip">${c.a.note || '–'}/10</span></div>${CHECKIN.filter(q => !q.num).map(q => `<div class="mt"><div class="small muted" style="font-weight:800">${q.q}</div><div>${nl(c.a[q.k] || '–')}</div></div>`).join('')}</div>`;
  b.innerHTML = `<div class="muted small mt">Chaque semaine, 5 questions et une note. Les réponses se dévoilent quand vous avez répondu tous les deux. Idéal le dimanche soir, en appel.</div>
    <div class="card"><div class="card-h"><h2>Semaine du ${fmtDate(wk)}</h2><div class="row"><span class="chip ${me ? 'ok' : ''}">${esc(myName())}</span><span class="chip ${you ? 'ok' : ''}">${esc(yourName())}</span></div></div>
    ${me ? `<div class="muted small">Tu as répondu ✓${you ? '' : ' · en attente de ' + esc(yourName())}</div>` : CHECKIN.map(q => q.num ? `<label class="f">${q.q}</label>${scaleHtml('note', 10, null)}` : `<label class="f">${q.q}</label><textarea class="in" data-k="${q.k}"></textarea>`).join('') + `<button class="btn p wide mt2" data-ok>Envoyer mon check-in</button>`}</div>
    ${me && you ? show(me, ME) + show(you, YOU()) : ''}
    ${hist.length ? `<div class="sec"><h2>Semaines passées</h2></div>${hist.map(w => { const a = get('checkin-' + w + '-alex'), m = get('checkin-' + w + '-manon'); return `<div class="card tap" data-wk="${w}"><div class="row between"><div><div style="font-weight:800">Semaine du ${fmtDate(w)}</div><div class="small muted">${a ? nameOf('alex') + ' ' + (a.a.note || '–') + '/10' : ''}${a && m ? ' · ' : ''}${m ? nameOf('manon') + ' ' + (m.a.note || '–') + '/10' : ''}</div></div><span>›</span></div></div>`; }).join('')}` : ''}`;
  wireSegs(b);
  const ok = b.querySelector('[data-ok]'); if (ok) ok.onclick = () => {
    const a = {}; CHECKIN.forEach(q => { a[q.k] = q.num ? segVal(b, 'note') : val(b, `[data-k="${q.k}"]`); });
    if (!a.high && !a.low && !a.miss) return toast('Réponds au moins à quelques questions');
    put({ id: 'checkin-' + wk + '-' + ME, t: 'checkin', by: ME, a, d: today() });
    notify(YOU(), 'Check-in de la semaine 🗓️', you ? myName() + ' a répondu : vos check-ins sont dévoilés.' : myName() + ' a fait son check-in. À toi !', 'calendar');
    renderUsBody();
  };
  b.querySelectorAll('[data-wk]').forEach(x => x.onclick = () => { const w = x.dataset.wk; const a = get('checkin-' + w + '-alex'), m = get('checkin-' + w + '-manon'); openSheet('Semaine du ' + fmtDate(w), (a ? show(a, 'alex') : '') + (m ? show(m, 'manon') : '')); });
}

// ---------- journal d'humeur ----------
const MOODS = ['😞', '😕', '😐', '🙂', '😄', '🥰'];
function renderMood(b) {
  const d = today();
  const me = get('mood-' + d + '-' + ME);
  const days = []; for (let i = 13; i >= 0; i--) days.push(addDays(d, -i));
  const strip = u => `<div class="mood-strip">${days.map(x => { const m = get('mood-' + x + '-' + u); const vis = m && (u === ME || m.shared); return `<div class="m" title="${x}">${vis ? MOODS[m.mood] : '<span class="soft">·</span>'}<div class="d">${x.slice(8)}</div></div>`; }).join('')}</div>`;
  const shared = theirs('mood').filter(m => m.shared).sort((a, c) => c.d.localeCompare(a.d)).slice(0, 10);
  const minePast = mine('mood').sort((a, c) => c.d.localeCompare(a.d)).slice(0, 14);
  b.innerHTML = `<div class="muted small mt">Ton humeur du jour, pour toi. Tu choisis ce que tu montres à ${esc(yourName())}. Pas pour rassurer, juste pour éviter les non-dits.</div>
    <div class="card"><div class="card-h"><h2>Aujourd'hui</h2></div>
    <div class="moods">${MOODS.map((m, i) => `<button class="${me && me.mood === i ? 'on' : ''}" data-m="${i}">${m}</button>`).join('')}</div>
    <textarea class="in mt" data-note placeholder="Un mot sur pourquoi (facultatif)">${esc(me ? me.note || '' : '')}</textarea>
    <label class="row mt" style="gap:10px"><input type="checkbox" data-share ${me && me.shared ? 'checked' : ''} style="width:20px;height:20px"> <span>Montrer à ${esc(yourName())}</span></label>
    <button class="btn p wide mt" data-ok>${me ? 'Mettre à jour' : 'Enregistrer'}</button></div>
    <div class="card"><div class="card-h"><h2>14 derniers jours</h2></div><div class="small muted">${esc(myName())}</div>${strip(ME)}<div class="small muted mt">${esc(yourName())} (ce qu'il/elle partage)</div>${strip(YOU())}</div>
    ${shared.length ? `<div class="sec"><h2>${esc(yourName())} partage</h2></div><div class="card" style="padding:6px 16px">${shared.map(m => `<div class="li"><span style="font-size:22px">${MOODS[m.mood]}</span><div class="grow"><div class="t">${fmtLong(m.d)}</div><div class="m">${nl(m.note || '')}</div></div></div>`).join('')}</div>` : ''}
    ${minePast.length ? `<div class="sec"><h2>Mon journal</h2></div><div class="card" style="padding:6px 16px">${minePast.map(m => `<div class="li"><span style="font-size:22px">${MOODS[m.mood]}</span><div class="grow"><div class="t">${fmtLong(m.d)} ${m.shared ? '<span class="chip ok" style="font-size:10px;padding:2px 7px">partagé</span>' : ''}</div><div class="m">${nl(m.note || '')}</div></div></div>`).join('')}</div>` : ''}`;
  let cur = me ? me.mood : null;
  b.querySelectorAll('[data-m]').forEach(x => x.onclick = () => { cur = +x.dataset.m; b.querySelectorAll('[data-m]').forEach(y => y.classList.toggle('on', y === x)); haptic(); });
  b.querySelector('[data-ok]').onclick = () => {
    if (cur == null) return toast('Choisis une humeur');
    const shared = b.querySelector('[data-share]').checked;
    const wasShared = me && me.shared;
    put({ id: 'mood-' + d + '-' + ME, t: 'mood', by: ME, d, mood: cur, note: val(b, '[data-note]'), shared });
    if (shared && !wasShared) notify(YOU(), 'Humeur du jour 🌤️', myName() + ' partage son humeur : ' + MOODS[cur] + (val(b, '[data-note]') ? ' · ' + val(b, '[data-note]') : ''), 'sun_behind_cloud');
    toast('Enregistré'); renderUsBody();
  };
}

// ---------- lettres différées ----------
function renderLetters(b) {
  const d = today();
  const recv = all('letter').filter(l => l.to === ME).sort((a, c) => a.open.localeCompare(c.open));
  const sent = all('letter').filter(l => l.from === ME).sort((a, c) => a.open.localeCompare(c.open));
  const opened = recv.filter(l => l.open <= d), sealed = recv.filter(l => l.open > d);
  b.innerHTML = `<div class="muted small mt">Écris maintenant, ${esc(yourName())} lit à la date que tu choisis. Un anniversaire, un jour difficile, ou juste dans un mois.</div>
    <button class="btn p wide mt" data-new>✍️ Écrire une lettre à ${esc(yourName())}</button>
    ${sealed.length ? `<div class="sec"><h2>Scellées pour moi</h2></div>${sealed.map(l => `<div class="letter sealed"><div class="seal">💌</div><div style="font-weight:800;margin-top:6px">Une lettre de ${esc(nameOf(l.from))}</div><div class="small">À ouvrir ${fmtLong(l.open)} · J-${daysBetween(d, l.open)}</div></div>`).join('')}` : ''}
    <div class="sec"><h2>Mes lettres</h2><span class="small">${opened.length}</span></div>
    ${opened.length ? opened.slice().reverse().map(l => `<div class="letter"><div class="small" style="opacity:.7">De ${esc(nameOf(l.from))} · écrite le ${fmtDate(l.d)} · ouverte ${fmtLong(l.open)}</div><div class="body">${esc(l.txt)}</div></div>`).join('') : empty('Aucune lettre ouverte pour l\'instant.', '💌')}
    ${sent.length ? `<div class="sec"><h2>Envoyées à ${esc(yourName())}</h2></div><div class="card" style="padding:6px 16px">${sent.map(l => `<div class="li"><span style="font-size:20px">${l.open <= d ? '📬' : '📪'}</span><div class="grow"><div class="t">${l.open <= d ? 'Ouverte' : 'Scellée'} · ${fmtLong(l.open)}</div><div class="m">${esc(l.txt.slice(0, 60))}${l.txt.length > 60 ? '…' : ''}</div></div>${l.open > d ? `<button class="soft" data-del="${l.id}">✕</button>` : ''}</div>`).join('')}</div>` : ''}`;
  b.querySelector('[data-new]').onclick = () => {
    const sh = openSheet('Une lettre pour ' + esc(yourName()), `<label class="f">À ouvrir le</label><input class="in" type="date" data-open min="${addDays(d, 1)}" value="${addDays(d, 30)}"><div class="chips mt">${[[7, 'dans 1 semaine'], [30, 'dans 1 mois'], [90, 'dans 3 mois'], [365, 'dans 1 an']].map(([n, l]) => `<button type="button" class="chip" data-n="${n}">${l}</button>`).join('')}</div><label class="f">La lettre</label><textarea class="in" data-txt style="min-height:180px;font-family:var(--display);font-size:16px" placeholder="Chère…"></textarea><button class="btn p wide mt2" data-ok>Sceller 💌</button><div class="muted small mt">${esc(yourName())} saura qu'une lettre l'attend, sans pouvoir la lire avant la date.</div>`);
    sh.querySelectorAll('[data-n]').forEach(x => x.onclick = () => sh.querySelector('[data-open]').value = addDays(d, +x.dataset.n));
    sh.querySelector('[data-ok]').onclick = () => { const txt = val(sh, '[data-txt]'), open = val(sh, '[data-open]'); if (!txt || !open || open <= d) return toast('Texte et date future'); put({ id: uid('letter'), t: 'letter', from: ME, to: YOU(), txt, open, d, notified: false }); notify(YOU(), 'Une lettre scellée 💌', myName() + " t'a écrit une lettre. Ouverture " + fmtLong(open) + '.', 'love_letter'); sh.close(); renderUsBody(); toast('Scellée jusqu\'au ' + fmtDate(open)); };
  };
  b.querySelectorAll('[data-del]').forEach(x => x.onclick = async () => { if (await confirmSheet('Retirer la lettre ?', 'Elle ne sera jamais ouverte.', 'Retirer')) { remove(x.dataset.del); renderUsBody(); } });
}

// ---------- capsules temporelles ----------
function renderCapsules(b) {
  const d = today();
  const caps = all('capsule').sort((a, c) => a.open.localeCompare(c.open));
  const items = c => all('capItem').filter(i => i.capsule === c.id).sort((x, y) => x.u - y.u);
  b.innerHTML = `<div class="muted small mt">Vous glissez des photos, des mots, des vocaux retranscrits. Tout est scellé jusqu'à la date choisie : 1 an de couple, la fin de la distance, un jour précis.</div>
    <button class="btn v wide mt" data-new>⏳ Créer une capsule</button>
    ${caps.length ? caps.map(c => { const its = items(c); const open = c.open <= d; const mineN = its.filter(i => i.by === ME).length; return `<div class="capsule ${open ? 'open' : ''} tap" data-cap="${c.id}"><div class="lock">${open ? '🔓' : '🔒'}</div><div class="t">${esc(c.title)}</div><div class="m">${open ? 'Ouverte ' + fmtLong(c.open) : 'Ouverture ' + fmtLong(c.open) + ' · J-' + daysBetween(d, c.open)}</div><div class="m mt">${its.length} souvenir${its.length > 1 ? 's' : ''} dedans${!open ? ' · ' + mineN + ' de toi' : ''}</div></div>`; }).join('') : empty('Créez votre première capsule à ouvrir dans le futur.', '⏳')}`;
  b.querySelector('[data-new]').onclick = () => {
    const sh = openSheet('Nouvelle capsule', `<label class="f">Titre</label><input class="in" data-title placeholder="Notre première année, Fin de la distance…"><label class="f">À ouvrir le</label><input class="in" type="date" data-open min="${addDays(d, 1)}" value="${addDays(d, 365)}"><button class="btn p wide mt2" data-ok>Créer</button>`);
    sh.querySelector('[data-ok]').onclick = () => { const title = val(sh, '[data-title]'), open = val(sh, '[data-open]'); if (!title || !open || open <= d) return toast('Titre et date future'); const id = uid('capsule'); put({ id, t: 'capsule', title, open, by: ME, d }); notify(YOU(), 'Capsule temporelle ⏳', myName() + ' a créé la capsule « ' + title + ' », ouverture ' + fmtLong(open) + '. Glisse-y des souvenirs.', 'hourglass'); sh.close(); capsuleSheet(id); renderUsBody(); };
  };
  b.querySelectorAll('[data-cap]').forEach(x => x.onclick = () => capsuleSheet(x.dataset.cap));
}
function capsuleSheet(id) {
  const c = get(id); if (!c) return;
  const d = today();
  const open = c.open <= d;
  const its = all('capItem').filter(i => i.capsule === id).sort((x, y) => x.u - y.u);
  const firstOpen = open && !localStorage.getItem('nous-capopen-' + id);
  const sh = openSheet(esc(c.title), `<div class="small muted">${open ? 'Ouverte ' + fmtLong(c.open) : 'Scellée jusqu\'au ' + fmtLong(c.open) + ' · J-' + daysBetween(d, c.open)}</div>
    ${open ? `<div class="${firstOpen ? 'unlocking' : ''}" style="text-align:center;font-size:54px;margin:10px 0">🔓</div>${its.length ? its.map(i => `<div class="cap-item"><div class="small muted">${avatar(i.by, 16)} ${esc(nameOf(i.by))} · ${fmtDate(i.d)}</div>${i.txt ? `<div class="mt" style="white-space:pre-wrap">${esc(i.txt)}</div>` : ''}${i.url ? `<img src="${esc(i.url)}" alt="">` : ''}</div>`).join('') : empty('Capsule vide.', '⏳')}` :
    `<div style="text-align:center;font-size:54px;margin:10px 0">🔒</div><div class="center muted small">${its.length} souvenir${its.length > 1 ? 's' : ''} dedans. Tu peux relire les tiens, pas ceux de ${esc(yourName())}.</div>
    <label class="f">Un mot, une pensée, une prédiction</label><textarea class="in" data-txt placeholder="Quand tu liras ça…"></textarea>
    <div class="row mt"><button class="btn" data-photo>📷 Photo</button><span class="small muted" data-pstat></span><button class="btn p grow" data-add>Glisser dans la capsule</button></div>
    ${its.filter(i => i.by === ME).length ? `<div class="sec"><h2>Mes souvenirs dedans</h2></div>${its.filter(i => i.by === ME).map(i => `<div class="cap-item"><div class="small muted">${fmtDate(i.d)}</div>${i.txt ? `<div style="white-space:pre-wrap">${esc(i.txt)}</div>` : ''}${i.url ? `<img src="${esc(i.url)}" alt="">` : ''}</div>`).join('')}` : ''}
    ${c.by === ME && !its.length ? `<button class="btn ghost sm mt2" data-del>Supprimer la capsule</button>` : ''}`}`, { cls: 'full' });
  if (firstOpen) { localStorage.setItem('nous-capopen-' + id, '1'); setTimeout(burst, 300); }
  let url = null;
  const ph = sh.querySelector('[data-photo]'); if (ph) ph.onclick = () => pickPhoto(async f => { sh.querySelector('[data-pstat]').textContent = 'Envoi…'; try { url = await uploadPhoto(f); sh.querySelector('[data-pstat]').textContent = 'Photo ✓'; } catch (e) { sh.querySelector('[data-pstat]').textContent = 'Échec'; } });
  const add = sh.querySelector('[data-add]'); if (add) add.onclick = () => { const txt = val(sh, '[data-txt]'); if (!txt && !url) return toast('Un mot ou une photo'); put({ id: uid('capItem'), t: 'capItem', capsule: id, by: ME, txt, url, d }); notify(YOU(), 'Capsule ⏳', myName() + ' a glissé un souvenir dans « ' + c.title + ' »', 'hourglass'); toast('Scellé ✓'); capsuleSheet(id); renderUsBody(); };
  const del = sh.querySelector('[data-del]'); if (del) del.onclick = () => { remove(id); sh.close(); renderUsBody(); };
}

// ---------- boîte à idées ----------
function renderIdeas(b) {
  const list = all('idea').sort((a, c) => (a.done - c.done) || byNewest(a, c));
  b.innerHTML = `<div class="muted small mt">Une idée pour l'appli, une envie de fonctionnalité, un truc qui bug, ou une idée pour nous deux. Chacun peut en poser, chacun peut cocher.</div>
    <div class="card"><textarea class="in" data-txt placeholder="Mon idée…"></textarea><div class="row mt">${chipsHtml('icat', [{ v: 'Appli', l: '📱 Appli' }, { v: 'Nous', l: '💞 Nous deux' }, { v: 'Bug', l: '🐛 Bug' }], 'Appli')}<button class="btn p" data-add>Ajouter</button></div></div>
    <div class="card" style="padding:6px 16px">${list.length ? list.map(i => `<div class="li ${i.done ? 'done' : ''}"><button class="cb" data-tg="${i.id}">${i.done ? '✓' : ''}</button><div class="grow"><div class="t">${nl(i.txt)}</div><div class="m">${esc(i.cat || 'Appli')} · ${esc(nameOf(i.by))} · ${fmtDate(i.d)}</div></div>${i.by === ME ? `<button class="soft" data-rm="${i.id}">✕</button>` : ''}</div>`).join('') : '<div class="muted small" style="padding:8px 0">La boîte est vide. La première idée est pour toi.</div>'}</div>`;
  wireSegs(b);
  b.querySelector('[data-add]').onclick = () => { const txt = val(b, '[data-txt]'); if (!txt) return; put({ id: uid('idea'), t: 'idea', txt, cat: segVal(b, 'icat') || 'Appli', by: ME, d: today(), done: false }); notify(YOU(), 'Boîte à idées 💡', myName() + ' : ' + txt, 'bulb'); toast('Dans la boîte 💡'); renderUsBody(); };
  b.querySelectorAll('[data-tg]').forEach(x => x.onclick = () => { const i = get(x.dataset.tg); i.done = !i.done; put(i); renderUsBody(); });
  b.querySelectorAll('[data-rm]').forEach(x => x.onclick = () => { remove(x.dataset.rm); renderUsBody(); });
}
