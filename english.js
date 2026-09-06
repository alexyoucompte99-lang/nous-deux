/* Nous · Anglais à deux : mot du jour, phrase, quiz express, XP et niveaux, révision */
const ENG_ORDER = () => shuffle(ENGLISH.map((_, i) => i), 13);
function engWordOfDay(d) { const o = ENG_ORDER(); return o[((dayIndex(d) % o.length) + o.length) % o.length]; }
function engXP(u) {
  let xp = 0;
  all('engWord').forEach(w => { if (w.by === u) xp += 10; });
  all('engPhrase').forEach(p => { if (p.by === u) xp += 10; });
  all('engQuiz').forEach(q => { if (q.by === u) xp += (q.score || 0) * 5; });
  return xp;
}
function engLevel(xp) { return Math.floor(Math.sqrt(xp / 60)) + 1; }
function engNext(xp) { const l = engLevel(xp); return l * l * 60; }
const ENG_LEVELS = ['Débutant', 'Curieux', 'Apprenti', 'Confiant', 'À l\'aise', 'Fluide', 'Bilingue en devenir', 'Native vibes'];
function engLevelName(l) { return ENG_LEVELS[Math.min(ENG_LEVELS.length - 1, l - 1)]; }
function engStreak(u) {
  const days = new Set(); ['engWord', 'engPhrase', 'engQuiz'].forEach(t => all(t).forEach(o => { if (o.by === u && o.d) days.add(o.d); }));
  let n = 0, d = today(); if (!days.has(d)) d = addDays(d, -1);
  while (days.has(d)) { n++; d = addDays(d, -1); }
  return n;
}
function renderEnglish(b) {
  VIEW.eng = VIEW.eng || 'today';
  const d = today();
  const xpMe = engXP(ME), xpYou = engXP(YOU());
  const lvl = engLevel(xpMe), next = engNext(xpMe), prev = (lvl - 1) * (lvl - 1) * 60;
  const pct = Math.min(100, Math.round((xpMe - prev) / (next - prev) * 100));
  let html = `<div class="card"><div class="card-h"><h2>🇬🇧 English together</h2><span class="chip gold">🔥 ${engStreak(ME)} j</span></div>
    <div class="score"><div><div class="n">${lvl}</div><div class="l">${esc(myName())} · ${engLevelName(lvl)}</div><div class="tiny muted">${xpMe} XP</div></div><div><div class="n">${engLevel(xpYou)}</div><div class="l">${esc(yourName())} · ${engLevelName(engLevel(xpYou))}</div><div class="tiny muted">${xpYou} XP</div></div></div>
    <div class="bar mt"><i style="width:${pct}%"></i></div><div class="tiny muted center">${next - xpMe} XP avant le niveau ${lvl + 1}</div></div>
    <div class="chips scroll mt" data-seg="eng">${[['today', '📅 Aujourd\'hui'], ['quiz', '⚡ Quiz express'], ['review', '🃏 Réviser'], ['words', '📚 Tous les mots']].map(([v, l]) => `<button type="button" class="chip ${v === VIEW.eng ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}</div><div id="eng-body"></div>`;
  b.innerHTML = html;
  wireSegs(b);
  b.querySelector('[data-seg=eng]').addEventListener('change', () => { VIEW.eng = segVal(b, 'eng'); renderEngBody(); });
  renderEngBody();
}
function renderEngBody() {
  const b = document.getElementById('eng-body'); if (!b) return;
  ({ today: engToday, quiz: engQuiz, review: engReview, words: engWords })[VIEW.eng](b);
}
function engToday(b) {
  const d = today();
  const idx = engWordOfDay(d), w = ENGLISH[idx];
  const known = get('engWord-' + idx + '-' + ME), youKnown = get('engWord-' + idx + '-' + YOU());
  const me = get('engPhrase-' + d + '-' + ME), you = get('engPhrase-' + d + '-' + YOU());
  b.innerHTML = `<div class="card"><div class="small muted" style="text-transform:uppercase;letter-spacing:.06em;font-weight:800">Mot du jour · ${esc(w.c)} · niveau ${w.l}</div>
    <div class="serif" style="font-size:30px;line-height:1.15;margin-top:6px">${esc(w.en)}</div>
    <div style="font-weight:700;margin-top:4px">${esc(w.fr)}</div>
    <div class="answer mt"><div class="who">Exemple</div><i>${esc(w.ex)}</i></div>
    <div class="row mt wrap"><button class="btn ${known ? 'ghost' : 'p'} grow" data-learn ${known ? 'disabled' : ''}>${known ? '✓ Dans mes mots' : 'Appris, je le garde (+10 XP)'}</button><button class="btn" data-say title="Écouter">🔊</button></div>
    <div class="small muted mt">${youKnown ? esc(yourName()) + ' l\'a appris aussi ✓' : esc(yourName()) + ' ne l\'a pas encore vu'}</div></div>
    <div class="card"><div class="card-h"><h2>✍️ Ta phrase avec ce mot</h2><span class="tiny muted">+10 XP</span></div>
    ${me ? `<div class="answer"><div class="who">${avatar(ME, 16)} ${esc(myName())}</div><i>${esc(me.txt)}</i></div>` : `<textarea class="in" data-ptxt placeholder="Write a sentence in English using « ${esc(w.en)} »"></textarea><button class="btn p wide mt" data-psend>Envoyer</button>`}
    ${you ? `<div class="answer"><div class="who">${avatar(YOU(), 16)} ${esc(yourName())}</div><i>${esc(you.txt)}</i></div>` : `<div class="small muted mt">${esc(yourName())} n'a pas encore écrit sa phrase.</div>`}
    <div class="small muted mt">Pas de correction automatique : vous vous corrigez l'un l'autre en appel, c'est le jeu.</div></div>
    ${engPastPhrases()}`;
  const say = txt => { try { const u = new SpeechSynthesisUtterance(txt); u.lang = 'en-GB'; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { toast('Lecture indisponible'); } };
  b.querySelector('[data-say]').onclick = () => say(w.en + '. ' + w.ex);
  const learn = b.querySelector('[data-learn]'); if (learn && !known) learn.onclick = () => { put({ id: 'engWord-' + idx + '-' + ME, t: 'engWord', by: ME, w: idx, d }); burst(); toast('+10 XP'); renderGameBody(); };
  const ps = b.querySelector('[data-psend]'); if (ps) ps.onclick = () => { const txt = val(b, '[data-ptxt]'); if (!txt) return; put({ id: 'engPhrase-' + d + '-' + ME, t: 'engPhrase', by: ME, w: idx, txt, d }); notify(YOU(), 'English 🇬🇧', myName() + ' a écrit sa phrase avec « ' + w.en + ' » : ' + txt, 'uk'); toast('+10 XP'); renderGameBody(); };
}
function engPastPhrases() {
  const days = {}; all('engPhrase').forEach(p => { if (p.d === today()) return; days[p.d] = days[p.d] || {}; days[p.d][p.by] = p; });
  const keys = Object.keys(days).sort().reverse().slice(0, 7);
  if (!keys.length) return '';
  return `<div class="sec"><h2>Vos phrases passées</h2></div>${keys.map(k => { const any = days[k].alex || days[k].manon; const w = ENGLISH[any.w]; return `<div class="card"><div class="small muted">${fmtDate(k)} · <b>${esc(w.en)}</b> · ${esc(w.fr)}</div>${['alex', 'manon'].map(u => days[k][u] ? `<div class="answer"><div class="who">${avatar(u, 16)} ${esc(nameOf(u))}</div><i>${esc(days[k][u].txt)}</i></div>` : '').join('')}</div>`; }).join('')}`;
}
// ---------- quiz express ----------
function engQuiz(b) {
  const wk = weekKey();
  const mine = all('engQuiz').filter(q => q.by === ME && q.d >= wk), theirsQ = all('engQuiz').filter(q => q.by === YOU() && q.d >= wk);
  const sum = a => a.reduce((s, q) => s + (q.score || 0), 0);
  const best = a => a.reduce((m, q) => Math.max(m, q.score || 0), 0);
  b.innerHTML = `<div class="card"><div class="card-h"><h2>⚡ Duel de la semaine</h2><span class="tiny muted">depuis le ${fmtDate(wk)}</span></div>
    <div class="score"><div><div class="n">${sum(mine)}</div><div class="l">${esc(myName())} · ${mine.length} quiz · best ${best(mine)}/8</div></div><div><div class="n">${sum(theirsQ)}</div><div class="l">${esc(yourName())} · ${theirsQ.length} quiz · best ${best(theirsQ)}/8</div></div></div>
    <div class="small muted center mt">8 questions, 5 XP par bonne réponse. Autant de quiz que tu veux, le total de la semaine fait le duel.</div>
    <button class="btn p wide mt" data-start>Lancer un quiz</button></div>`;
  b.querySelector('[data-start]').onclick = () => engQuizRun(b);
}
function engQuizRun(b) {
  const learned = new Set(mine('engWord').map(w => w.w));
  const pool = shuffle(ENGLISH.map((_, i) => i), Date.now() % 100000);
  const qs = pool.slice(0, 8).map(i => { const dir = Math.random() < 0.5 ? 'en' : 'fr'; const wrong = shuffle(pool.filter(j => j !== i && ENGLISH[j].c === ENGLISH[i].c).concat(pool.filter(j => j !== i)), i + 7).slice(0, 3); const opts = shuffle([i].concat(wrong), i * 3 + 1); return { i, dir, opts }; });
  let k = 0, score = 0;
  const draw = () => {
    if (k >= qs.length) {
      put({ id: uid('engQuiz'), t: 'engQuiz', by: ME, score, n: qs.length, d: today() });
      notify(YOU(), 'English ⚡', myName() + ' vient de faire ' + score + '/8 au quiz express. À toi !', 'zap');
      if (score >= 6) burst();
      b.innerHTML = `<div class="card center"><div style="font-size:44px">${score >= 7 ? '🏆' : score >= 5 ? '👏' : '💪'}</div><div class="big">${score}/8</div><div class="muted">+${score * 5} XP</div><button class="btn p mt" data-again>Encore un</button> <button class="btn mt" data-back>Retour</button></div>`;
      b.querySelector('[data-again]').onclick = () => engQuizRun(b); b.querySelector('[data-back]').onclick = () => { renderGames(document.getElementById('view')); VIEW.game = 'english'; renderGameBody(); };
      return;
    }
    const q = qs[k], w = ENGLISH[q.i];
    b.innerHTML = `<div class="card"><div class="row between"><span class="small muted">Question ${k + 1}/8</span><span class="chip">${score} pt</span></div>
      <div class="small muted mt" style="text-transform:uppercase;letter-spacing:.06em;font-weight:800">${q.dir === 'en' ? 'Ça veut dire quoi ?' : 'Comment on dit ?'}${learned.has(q.i) ? ' · 📚 dans tes mots' : ''}</div>
      <div class="serif" style="font-size:26px;line-height:1.15;margin:6px 0 12px">${esc(q.dir === 'en' ? w.en : w.fr)}</div>
      ${q.opts.map(o => `<button class="btn wide mt" style="justify-content:flex-start;text-align:left" data-o="${o}">${esc(q.dir === 'en' ? ENGLISH[o].fr : ENGLISH[o].en)}</button>`).join('')}</div>`;
    b.querySelectorAll('[data-o]').forEach(x => x.onclick = () => {
      const ok = +x.dataset.o === q.i;
      b.querySelectorAll('[data-o]').forEach(y => { y.disabled = true; if (+y.dataset.o === q.i) y.classList.add('v'); });
      if (ok) { score++; haptic(); } else x.classList.add('danger');
      b.querySelector('.card').insertAdjacentHTML('beforeend', `<div class="answer mt"><div class="who">${ok ? '✓ Bien joué' : '✗ Raté'}</div><b>${esc(w.en)}</b> · ${esc(w.fr)}<br><i class="small">${esc(w.ex)}</i></div>`);
      setTimeout(() => { k++; draw(); }, ok ? 900 : 1800);
    });
  };
  draw();
}
// ---------- révision (flashcards) ----------
function engReview(b) {
  const words = mine('engWord').map(w => w.w);
  if (!words.length) { b.innerHTML = empty('Apprends d\'abord des mots (mot du jour ou liste complète), ils arriveront ici en cartes à retourner.', '🃏'); return; }
  const order = shuffle(words, Date.now() % 9999);
  let k = 0, flipped = false;
  const draw = () => {
    if (k >= order.length) { b.innerHTML = `<div class="card center"><div style="font-size:40px">🎉</div><div class="big">Tour terminé</div><div class="muted">${order.length} mots revus</div><button class="btn p mt" data-again>Encore</button></div>`; b.querySelector('[data-again]').onclick = () => engReview(b); return; }
    const w = ENGLISH[order[k]];
    b.innerHTML = `<div class="small muted center mt">${k + 1}/${order.length} · touche la carte pour la retourner</div>
      <div class="flash ${flipped ? 'on' : ''}" data-flip><div class="serif" style="font-size:28px">${esc(flipped ? w.fr : w.en)}</div>${flipped ? `<i class="small mt">${esc(w.ex)}</i>` : `<div class="small muted mt">${esc(w.c)}</div>`}</div>
      <div class="row mt"><button class="btn grow" data-hard>😬 Pas sûr</button><button class="btn p grow" data-easy>😎 Je sais</button></div>`;
    b.querySelector('[data-flip]').onclick = () => { flipped = !flipped; draw(); };
    b.querySelector('[data-easy]').onclick = () => { k++; flipped = false; draw(); };
    b.querySelector('[data-hard]').onclick = () => { order.push(order[k]); k++; flipped = false; draw(); };
  };
  draw();
}
// ---------- tous les mots ----------
function engWords(b) {
  VIEW.engCat = VIEW.engCat || 'Tous';
  const learned = new Set(mine('engWord').map(w => w.w)), yours = new Set(theirs('engWord').map(w => w.w));
  const list = ENGLISH.map((w, i) => ({ w, i })).filter(x => VIEW.engCat === 'Tous' || x.w.c === VIEW.engCat);
  b.innerHTML = `<div class="chips scroll mt" data-seg="ecat">${['Tous'].concat(ENGLISH_CATS).map(c => `<button type="button" class="chip ${c === VIEW.engCat ? 'on' : ''}" data-v="${c}">${c}</button>`).join('')}</div>
    <div class="small muted mt">${learned.size}/${ENGLISH.length} dans tes mots · ${yours.size} chez ${esc(yourName())}</div>
    <div class="card" style="padding:6px 16px">${list.map(({ w, i }) => `<div class="li"><button class="cb ${learned.has(i) ? 'on' : ''}" data-w="${i}" style="${learned.has(i) ? 'background:var(--green);border-color:var(--green)' : ''}">${learned.has(i) ? '✓' : ''}</button><div class="grow"><div class="t">${esc(w.en)} <span class="tiny muted">· ${w.c} · n${w.l}</span></div><div class="m">${esc(w.fr)}${yours.has(i) ? ' · <span class="' + YOU() + '" style="color:var(--' + YOU() + ')">✓ ' + esc(yourName()) + '</span>' : ''}</div></div></div>`).join('')}</div>`;
  wireSegs(b);
  b.querySelector('[data-seg=ecat]').addEventListener('change', () => { VIEW.engCat = segVal(b, 'ecat'); renderEngBody(); });
  b.querySelectorAll('[data-w]').forEach(x => x.onclick = () => { const i = +x.dataset.w; const id = 'engWord-' + i + '-' + ME; if (get(id)) remove(id); else { put({ id, t: 'engWord', by: ME, w: i, d: today() }); toast('+10 XP'); } renderGames(document.getElementById('view')); VIEW.game = 'english'; VIEW.eng = 'words'; renderGameBody(); });
}
