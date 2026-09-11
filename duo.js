/* Nous · À deux : photos, soirée ciné, swipe d'envies, souhaits, coupons */
const DUO_TABS = [{ v: 'photos', l: '📸 Photos' }, { v: 'cine', l: '🎬 Ciné' }, { v: 'swipe', l: '🔥 Envies' }, { v: 'wish', l: '⭐ Souhaits' }, { v: 'coupon', l: '🎟️ Coupons' }];
function renderDuo(root) {
  VIEW.duo = VIEW.duo || 'photos';
  let html = `<div class="hello"><h1>À deux</h1></div><div class="chips scroll mt" data-seg="duo">${DUO_TABS.map(t => `<button type="button" class="chip ${t.v === VIEW.duo ? 'on' : ''}" data-v="${t.v}">${t.l}</button>`).join('')}</div><div id="duo-body"></div>`;
  root.innerHTML = html;
  wireSegs(root);
  root.querySelector('[data-seg=duo]').addEventListener('change', () => { VIEW.duo = segVal(root, 'duo'); renderDuoBody(); });
  renderDuoBody();
}
function renderDuoBody() {
  const b = document.getElementById('duo-body'); if (!b) return;
  ({ photos: renderPhotos, cine: renderCine, swipe: renderSwipe, wish: renderWish, coupon: renderCoupons })[VIEW.duo](b);
}

// ---------- photos ----------
function renderPhotos(b) {
  const day = all('photo').filter(p => p.kind === 'day').sort((a, c) => (c.d || '').localeCompare(a.d || '') || byNewest(a, c));
  const album = all('photo').filter(p => p.kind === 'album').sort(byNewest);
  const gal = list => `<div class="gal">${list.map(p => `<div class="g" data-view="${esc(p.url)}" data-cap="${esc((p.cap ? p.cap + ' · ' : '') + nameOf(p.by) + ' · ' + fmtDate(p.d))}"><img src="${esc(p.url)}" loading="lazy" alt=""><span class="d">${fmtDate(p.d)}</span></div>`).join('')}</div>`;
  b.innerHTML = `
    <div class="sec"><h2>Nos photos du jour</h2><span class="small">${day.length}</span></div>
    ${day.length ? gal(day) : empty('Une photo par jour, chacun. Sans filtre, sans like.', '📸')}
    <div class="sec"><h2>Album commun</h2><button class="btn sm" data-add-album>+ Ajouter</button></div>
    <div class="muted small">Vos souvenirs à deux : ils remontent sur l'accueil de temps en temps.</div>
    ${album.length ? gal(album) : empty('Ajoutez vos photos préférées de vous deux.', '🖼️')}`;
  b.querySelectorAll('[data-view]').forEach(g => g.onclick = () => viewPhoto(g.dataset.view, g.dataset.cap));
  b.querySelector('[data-add-album]').onclick = () => pickPhoto(file => {
    photoSheet(file, 'Album commun', `<label class="f">Quand ?</label><input class="in" type="date" data-d value="${today()}"><label class="f">Légende</label><input class="in" data-cap placeholder="Où, quand, quoi">`, 'Ajouter', (url, sh) => {
      put({ id: uid('photo'), t: 'photo', kind: 'album', d: val(sh, '[data-d]') || today(), by: ME, url, cap: val(sh, '[data-cap]') });
      notify(YOU(), 'Album 🖼️', myName() + ' a ajouté une photo à votre album', 'album');
      sh.close(); renderDuoBody(); toast('Ajoutée');
    });
  });
}

// ---------- soirée ciné ----------
function currentMovie() { return all('movie').filter(m => !m.ended).sort(byNewest)[0] || null; }
let cineTimer = null;
function renderCine(b) {
  clearInterval(cineTimer);
  const m = currentMovie();
  const past = all('movie').filter(x => x.ended).sort(byNewest).slice(0, 8);
  if (!m) {
    b.innerHTML = `<div class="card"><div class="card-h"><h2>🎬 Soirée ciné à distance</h2></div><div class="muted">Vous lancez le même film chacun de votre côté. L'appli donne le top départ synchronisé et un fil de réactions en direct.</div>
      <label class="f">Film ou série</label><input class="in" data-title placeholder="Titre">
      <label class="f">Où on le regarde</label><input class="in" data-where placeholder="Netflix, Disney+, un lien…">
      <button class="btn p wide mt" data-create>Préparer la soirée</button></div>
      ${past.length ? `<div class="sec"><h2>Déjà vus ensemble</h2></div>${past.map(x => `<div class="li"><div class="grow"><div class="t">${esc(x.title)}</div><div class="m">${fmtDate(x.d)} · ${all('mreact').filter(r => r.movie === x.id).length} réactions</div></div></div>`).join('')}` : ''}`;
    b.querySelector('[data-create]').onclick = () => { const title = val(b, '[data-title]'); if (!title) return toast('Un titre ?'); put({ id: uid('movie'), t: 'movie', title, where: val(b, '[data-where]'), by: ME, d: today(), startAt: null }); notify(YOU(), 'Soirée ciné 🎬', myName() + ' propose « ' + title + ' » ce soir. Prépare le popcorn.', 'cine'); renderDuoBody(); };
    return;
  }
  const reacts = all('mreact').filter(r => r.movie === m.id).sort((a, c) => a.at - c.at);
  const tick = () => { const t = b.querySelector('.timer'); if (!t || !m.startAt) return; const s = Math.max(0, Math.floor((Date.now() - m.startAt) / 1000)); t.textContent = pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60); };
  b.innerHTML = `<div class="card"><div class="card-h"><h2>🎬 ${esc(m.title)}</h2><span class="small muted">${esc(m.where || '')}</span></div>
    ${m.startAt ? `<div class="timer">00:00:00</div><div class="center muted small">Film lancé ${ago(m.startAt)} par ${esc(nameOf(m.startBy))}. Cale-toi sur ce chrono.</div>` : `<div class="center muted">Quand vous êtes prêts tous les deux : l'un appuie sur le top départ, le chrono tourne pour les deux.</div><button class="btn p wide mt" data-start>▶ Top départ (3, 2, 1…)</button>`}
    <div class="react">${['😂', '😱', '😭', '🥰', '🙄', '🔥', '👀', '🍿'].map(e => `<button data-r="${e}">${e}</button>`).join('')}</div>
    <div class="row mt"><input class="in grow" data-msg placeholder="Une réaction…" style="margin-top:0"><button class="btn" data-send>➤</button></div>
    <div class="feed">${reacts.length ? reacts.slice(-40).map(r => `<div class="msg">${avatar(r.by, 20)}<div><span class="who">${esc(nameOf(r.by))} · ${r.at ? new Date(r.at).toTimeString().slice(0, 5) : ''}</span><div>${esc(r.txt)}</div></div></div>`).join('') : '<div class="muted small center mt">Les réactions des deux apparaissent ici en direct.</div>'}</div>
    <div class="row mt2"><button class="btn ghost sm" data-end>Terminer la soirée</button></div></div>`;
  tick(); cineTimer = setInterval(tick, 1000);
  const feed = b.querySelector('.feed'); feed.scrollTop = feed.scrollHeight;
  const st = b.querySelector('[data-start]'); if (st) st.onclick = () => { let n = 3; st.disabled = true; const iv = setInterval(() => { st.textContent = n > 0 ? n : 'Go !'; if (n < 0) { clearInterval(iv); m.startAt = Date.now(); m.startBy = ME; put(m); notify(YOU(), 'Top départ 🎬', myName() + ' a lancé « ' + m.title + ' ». Appuie sur play !', 'cine'); renderDuoBody(); } n--; }, 1000); };
  const send = txt => { if (!txt) return; put({ id: uid('mreact'), t: 'mreact', movie: m.id, by: ME, txt, at: Date.now() }); renderDuoBody(); };
  b.querySelectorAll('[data-r]').forEach(x => x.onclick = () => send(x.dataset.r));
  b.querySelector('[data-send]').onclick = () => send(val(b, '[data-msg]'));
  b.querySelector('[data-msg]').onkeydown = e => { if (e.key === 'Enter') send(val(b, '[data-msg]')); };
  b.querySelector('[data-end]').onclick = async () => { if (await confirmSheet('Terminer ?', 'La soirée passe dans « déjà vus ».', 'Terminer')) { m.ended = true; put(m); renderDuoBody(); } };
}

// ---------- swipe d'envies ----------
function allEnvies() { return ENVIES.map((e, i) => ({ id: 'e' + i, c: e.c, t: e.t })).concat(all('envie').map(e => ({ id: e.id, c: e.cat || 'Autre', t: e.txt, by: e.by }))); }
function swipeOf(cardId, u) { return get('swipe-' + cardId + '-' + u); }
function renderSwipe(b) {
  const cards = allEnvies();
  const todo = shuffle(cards.filter(c => !swipeOf(c.id, ME)), dayIndex() + 11);
  const matches = cards.filter(c => { const a = swipeOf(c.id, 'alex'), m = swipeOf(c.id, 'manon'); return a && m && a.yes && m.yes; });
  const waiting = cards.filter(c => { const me = swipeOf(c.id, ME), you = swipeOf(c.id, YOU()); return me && me.yes && !you; }).length;
  const LIKES_MAX = 2;
  const likesToday = mine('swipe').filter(x => x.yes && x.d === today()).length;
  const likesLeft = Math.max(0, LIKES_MAX - likesToday);
  b.innerHTML = `<div class="muted small mt">Swipe à droite si ça te tente, 2 oui par jour maximum. Les matchs n'apparaissent que si vous avez dit oui tous les deux, sans savoir ce que l'autre a swipé.</div>
    ${todo.length ? `<div class="deck">${todo.slice(0, 3).reverse().map((c, i) => `<div class="sw" data-id="${c.id}" style="transform:scale(${1 - (2 - i) * 0.04}) translateY(${(2 - i) * -8}px);z-index:${i}"><span class="stamp yes">OUI</span><span class="stamp no">NON</span><div class="cat">${esc(c.c)}${c.by ? ' · idée de ' + esc(nameOf(c.by)) : ''}</div><div class="t">${esc(c.t)}</div></div>`).join('')}</div>
    <div class="sw-btns"><button data-no>👎</button><button data-yes ${likesLeft ? '' : 'disabled style="opacity:.4"'}>❤️</button></div><div class="center muted small mt">${likesLeft ? likesLeft + ' oui restant' + (likesLeft > 1 ? 's' : '') + " aujourd'hui" : 'Plus de oui pour aujourd\'hui, reviens demain 😉'} · ${todo.length} carte${todo.length > 1 ? 's' : ''}${waiting ? ' · ' + waiting + ' oui en attente de ' + esc(yourName()) : ''}</div>` : `<div class="card center"><div style="font-size:34px">🎉</div><div style="font-weight:800">Tu as tout swipé</div><div class="muted small">Ajoute tes propres envies, ${esc(yourName())} devra swiper dessus.</div></div>`}
    <div class="row mt2"><button class="btn wide" data-add-envie>+ Ajouter une envie</button></div>
    <div class="sec"><h2>Vos matchs</h2><span class="small">${matches.length}</span></div>
    <div class="card" style="padding:6px 16px">${matches.length ? matches.map(c => `<div class="match"><span style="font-size:20px">💞</span><div class="grow"><div class="t">${esc(c.t)}</div><div class="small muted">${esc(c.c)}</div></div><button class="btn sm" data-towish="${esc(c.t)}" data-cat="${esc(c.c)}">→ Souhaits</button></div>`).join('') : '<div class="muted small" style="padding:8px 0">Pas encore de match. Continuez à swiper 😉</div>'}</div>`;
  const top = () => b.querySelector('.deck .sw:last-child');
  const decide = yes => {
    const card = top(); if (!card) return;
    if (yes && !likesLeft) { toast('2 oui par jour max, garde-les pour les vraies envies 😉'); card.style.transform = ''; card.querySelectorAll('.stamp').forEach(s => s.style.opacity = 0); return; }
    haptic();
    const id = card.dataset.id;
    put({ id: 'swipe-' + id + '-' + ME, t: 'swipe', card: id, by: ME, yes, d: today() });
    card.classList.add(yes ? 'out-r' : 'out-l');
    const you = swipeOf(id, YOU());
    if (yes && you && you.yes) { const c = cards.find(x => x.id === id); setTimeout(() => { burst(); toast('Match ! ' + c.t + ' 💞'); }, 250); notify(YOU(), 'Match 💞', 'Vous avez dit oui tous les deux : ' + c.t, 'match'); }
    setTimeout(() => renderDuoBody(), 330);
  };
  b.querySelector('[data-yes]') && (b.querySelector('[data-yes]').onclick = () => decide(true));
  b.querySelector('[data-no]') && (b.querySelector('[data-no]').onclick = () => decide(false));
  // drag
  const card = top();
  if (card) {
    let x0 = null, dx = 0;
    card.addEventListener('pointerdown', e => { x0 = e.clientX; card.style.transition = 'none'; card.setPointerCapture(e.pointerId); });
    card.addEventListener('pointermove', e => { if (x0 == null) return; dx = e.clientX - x0; card.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`; card.querySelector('.stamp.yes').style.opacity = Math.min(1, Math.max(0, dx / 80)); card.querySelector('.stamp.no').style.opacity = Math.min(1, Math.max(0, -dx / 80)); });
    const end = () => { if (x0 == null) return; card.style.transition = ''; if (dx > 90) decide(true); else if (dx < -90) decide(false); else { card.style.transform = ''; card.querySelectorAll('.stamp').forEach(s => s.style.opacity = 0); } x0 = null; dx = 0; };
    card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
  }
  b.querySelector('[data-add-envie]').onclick = () => {
    const sh = openSheet('Une envie', `<label class="f">Envie</label><input class="in" data-txt placeholder="Un weekend à…, tester…"><label class="f">Catégorie</label>${chipsHtml('cat', ENVIE_CATS.map(c => ({ v: c, l: c })), 'Sorties')}<button class="btn p wide mt2" data-ok>Ajouter au jeu</button><div class="muted small mt">Elle arrivera dans les cartes de ${esc(yourName())}. Tu la swipes aussi.</div>`);
    wireSegs(sh);
    sh.querySelector('[data-ok]').onclick = () => { const txt = val(sh, '[data-txt]'); if (!txt) return; put({ id: uid('envie'), t: 'envie', txt, cat: segVal(sh, 'cat') || 'Autre', by: ME }); notify(YOU(), 'Nouvelle envie 🔥', myName() + ' a ajouté une envie à swiper', 'envie'); sh.close(); renderDuoBody(); toast('Ajoutée'); };
  };
  b.querySelectorAll('[data-towish]').forEach(x => x.onclick = () => { put({ id: uid('wish'), t: 'wish', txt: x.dataset.towish, cat: WISH_CATS.includes(x.dataset.cat) ? x.dataset.cat : 'Activité', by: ME, d: today(), done: false }); toast('Ajouté aux souhaits ⭐'); });
}

// ---------- souhaits partagés ----------
function renderWish(b) {
  VIEW.wishCat = VIEW.wishCat || 'Tous';
  const list = all('wish').filter(w => VIEW.wishCat === 'Tous' || w.cat === VIEW.wishCat).sort((a, c) => (a.done - c.done) || byNewest(a, c));
  b.innerHTML = `<div class="muted small mt">Idées de voyages, restos, films, cadeaux, activités. Tout ce qu'on ne veut pas oublier.</div>
    <div class="chips scroll mt" data-seg="wcat">${['Tous'].concat(WISH_CATS).map(c => `<button type="button" class="chip ${c === VIEW.wishCat ? 'on' : ''}" data-v="${c}">${c}</button>`).join('')}</div>
    <div class="row mt"><input class="in grow" data-new placeholder="Une envie, un lieu, un resto…" style="margin-top:0"><button class="btn p" data-add>+</button></div>
    <div class="card" style="padding:6px 16px">${list.length ? list.map(w => `<div class="li ${w.done ? 'done' : ''}"><button class="cb" data-tg="${w.id}">${w.done ? '✓' : ''}</button><div class="grow"><div class="t">${esc(w.txt)}</div><div class="m">${esc(w.cat)} · ${esc(nameOf(w.by))}${w.note ? ' · ' + esc(w.note) : ''}</div></div><button class="soft" data-edit="${w.id}">···</button></div>`).join('') : '<div class="muted small" style="padding:8px 0">Rien ici pour l\'instant.</div>'}</div>`;
  wireSegs(b);
  b.querySelector('[data-seg=wcat]').addEventListener('change', () => { VIEW.wishCat = segVal(b, 'wcat'); renderDuoBody(); });
  const add = () => { const txt = val(b, '[data-new]'); if (!txt) return; put({ id: uid('wish'), t: 'wish', txt, cat: VIEW.wishCat === 'Tous' ? 'Autre' : VIEW.wishCat, by: ME, d: today(), done: false }); notify(YOU(), 'Souhaits ⭐', myName() + ' a ajouté un souhait', 'wish'); renderDuoBody(); };
  b.querySelector('[data-add]').onclick = add;
  b.querySelector('[data-new]').onkeydown = e => { if (e.key === 'Enter') add(); };
  b.querySelectorAll('[data-tg]').forEach(x => x.onclick = () => { const w = get(x.dataset.tg); w.done = !w.done; put(w); renderDuoBody(); if (w.done) toast('Fait ✓'); });
  b.querySelectorAll('[data-edit]').forEach(x => x.onclick = () => {
    const w = get(x.dataset.edit);
    const sh = openSheet('Souhait', `<label class="f">Texte</label><input class="in" data-txt value="${esc(w.txt)}"><label class="f">Catégorie</label>${chipsHtml('cat', WISH_CATS.map(c => ({ v: c, l: c })), w.cat)}<label class="f">Note (lien, prix, détail)</label><input class="in" data-note value="${esc(w.note || '')}"><div class="row mt2"><button class="btn danger" data-del>Supprimer</button><button class="btn p grow" data-ok>Enregistrer</button></div>`);
    wireSegs(sh);
    sh.querySelector('[data-ok]').onclick = () => { w.txt = val(sh, '[data-txt]') || w.txt; w.cat = segVal(sh, 'cat') || w.cat; w.note = val(sh, '[data-note]'); put(w); sh.close(); renderDuoBody(); };
    sh.querySelector('[data-del]').onclick = () => { remove(w.id); sh.close(); renderDuoBody(); };
  });
}

// ---------- coupons ----------
function renderCoupons(b) {
  const recv = all('coupon').filter(c => c.to === ME).sort((a, c) => (a.used - c.used) || byNewest(a, c));
  const given = all('coupon').filter(c => c.from === ME).sort((a, c) => (a.used - c.used) || byNewest(a, c));
  const cp = c => `<div class="coupon ${c.used ? 'used' : ''}"><div class="t">🎟️ ${esc(c.txt)}</div><div class="m">${c.to === ME ? 'offert par ' + esc(nameOf(c.from)) : 'pour ' + esc(nameOf(c.to))} · ${fmtDate(c.d)}${c.used ? ' · utilisé le ' + fmtDate(c.used) : ''}</div>${!c.used && c.to === ME ? `<button class="btn sm p mt" data-use="${c.id}">Je l'utilise !</button>` : ''}</div>`;
  b.innerHTML = `<div class="muted small mt">Des bons à offrir et à encaisser à la prochaine visite : du temps, des gestes, de l'attention. Jamais d'argent. C'est toi qui les crées, l'appli ne fait que les garder au chaud.</div>
    <button class="btn p wide mt" data-new>+ Offrir un coupon à ${esc(yourName())}</button>
    <div class="sec"><h2>Mes coupons</h2><span class="small">${recv.filter(c => !c.used).length} à utiliser</span></div>${recv.length ? recv.map(cp).join('') : empty('Aucun coupon reçu pour l\'instant.', '🎟️')}
    <div class="sec"><h2>Offerts à ${esc(yourName())}</h2></div>${given.length ? given.map(cp).join('') : '<div class="muted small">Rien offert pour l\'instant.</div>'}`;
  b.querySelector('[data-new]').onclick = () => {
    const sh = openSheet('Offrir un coupon', `<label class="f">Le coupon</label><input class="in" data-txt placeholder="Un massage, un petit-déj au lit, une soirée sans téléphone…"><div class="muted small mt">Ou pioche :</div><div class="chips mt">${COUPONS.map(c => `<button type="button" class="chip" data-pick="${esc(c)}">${esc(c)}</button>`).join('')}</div><button class="btn p wide mt2" data-ok>Offrir 🎁</button>`);
    sh.querySelectorAll('[data-pick]').forEach(x => x.onclick = () => { sh.querySelector('[data-txt]').value = x.dataset.pick; });
    sh.querySelector('[data-ok]').onclick = () => { const txt = val(sh, '[data-txt]'); if (!txt) return; put({ id: uid('coupon'), t: 'coupon', txt, from: ME, to: YOU(), d: today(), used: null }); notify(YOU(), 'Un coupon pour toi 🎟️', myName() + " t'offre : " + txt, 'coupon'); sh.close(); renderDuoBody(); toast('Offert 🎁'); };
  };
  b.querySelectorAll('[data-use]').forEach(x => x.onclick = () => { const c = get(x.dataset.use); c.used = today(); put(c); notify(YOU(), 'Coupon utilisé 🎟️', myName() + ' encaisse son coupon : ' + c.txt, 'coupon'); burst(); renderDuoBody(); });
}
