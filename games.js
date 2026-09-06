/* Nous · Jeux : quiz, défi de la semaine, devine ma réponse, roue de la vie, ligne de vie */
const GAME_TABS = [{ v: 'english', l: '🇬🇧 Anglais' }, { v: 'quiz', l: '🧠 Quiz' }, { v: 'defi', l: '🏁 Défi' }, { v: 'guess', l: '🎯 Devine' }, { v: 'wheel', l: '🎡 Roue' }, { v: 'life', l: '📖 Ligne de vie' }];
function renderGames(root) {
  VIEW.game = VIEW.game || 'quiz';
  root.innerHTML = `<div class="hello"><h1>Jeux</h1></div><div class="chips scroll mt" data-seg="game">${GAME_TABS.map(t => `<button type="button" class="chip ${t.v === VIEW.game ? 'on' : ''}" data-v="${t.v}">${t.l}</button>`).join('')}</div><div id="game-body"></div>`;
  wireSegs(root);
  root.querySelector('[data-seg=game]').addEventListener('change', () => { VIEW.game = segVal(root, 'game'); renderGameBody(); });
  renderGameBody();
}
function renderGameBody() { const b = document.getElementById('game-body'); if (!b) return; ({ english: renderEnglish, quiz: renderQuiz, defi: renderDefi, guess: renderGuess, wheel: renderWheel, life: renderLife })[VIEW.game](b); }

// ---------- quiz hebdo ----------
function quizQs(wk) { const seed = dayIndex(wk); return shuffle(QUIZ.map((q, i) => i), seed + 3).slice(0, 5); }
function quizA(wk, u) { return get('quizA-' + wk + '-' + u); }
function quizV(wk, u) { return get('quizV-' + wk + '-' + u); }
function quizScore(wk, u) { // score de u = nombre de ses devinettes validées par l'autre
  const v = quizV(wk, OTHER[u]); if (!v || !v.verdicts) return null; return v.verdicts.filter(x => x === true).length;
}
function renderQuiz(b) {
  const wk = weekKey();
  const qs = quizQs(wk);
  const me = quizA(wk, ME), you = quizA(wk, YOU());
  const weeks = {}; all('quizV').forEach(v => { const w = v.id.split('-').slice(1, 4).join('-'); weeks[w] = 1; });
  const hist = Object.keys(weeks).filter(w => w !== wk).sort().reverse();
  let html = `<div class="muted small mt">5 questions par semaine. Chacun répond pour lui et devine pour l'autre. Ensuite chacun valide les devinettes de l'autre. Qui connaît le mieux qui ?</div>`;
  if (!me) {
    html += `<div class="card"><div class="card-h"><h2>Semaine du ${fmtDate(wk)}</h2>${you ? `<span class="chip ok">${esc(yourName())} a joué</span>` : ''}</div>
      ${qs.map((qi, i) => `<div class="mt2"><div style="font-weight:800">${i + 1}. ${esc(QUIZ[qi])}</div><input class="in" data-self="${i}" placeholder="Ma réponse"><input class="in" data-guess="${i}" placeholder="Ce que ${esc(yourName())} va répondre"></div>`).join('')}
      <button class="btn p wide mt2" data-submit>Valider mes réponses</button></div>`;
  } else {
    const myV = quizV(wk, ME) || { verdicts: [] };
    const bothDone = !!you;
    const myScore = quizScore(wk, ME), yourScore = quizScore(wk, YOU());
    html += `<div class="card"><div class="card-h"><h2>Semaine du ${fmtDate(wk)}</h2></div>
      <div class="score"><div><div class="n">${myScore == null ? '–' : myScore}</div><div class="l">${esc(myName())}</div></div><div><div class="n">${yourScore == null ? '–' : yourScore}</div><div class="l">${esc(yourName())}</div></div></div>
      <div class="center muted small">${bothDone ? (myScore != null && yourScore != null ? (myScore === yourScore ? 'Égalité parfaite 🤝' : (myScore > yourScore ? myName() : yourName()) + ' connaît mieux l\'autre cette semaine 🏆') : 'Validez les devinettes de l\'autre pour avoir les scores.') : 'En attente de ' + esc(yourName()) + '…'}</div></div>`;
    if (bothDone) {
      html += qs.map((qi, i) => {
        const v = myV.verdicts[i];
        return `<div class="card"><div style="font-weight:800">${i + 1}. ${esc(QUIZ[qi])}</div>
          <div class="reveal"><div class="answer"><div class="who">${avatar(ME, 16)} moi</div>${esc(me.self[i])}</div><div class="answer"><div class="who">${avatar(YOU(), 16)} ${esc(yourName())} devine</div>${esc(you.guess[i])}</div></div>
          <div class="small muted mt">${esc(yourName())} a bon ?</div><div class="verdict"><button class="ok ${v === true ? 'on' : ''}" data-v="${i}" data-val="1">✓ Oui</button><button class="ko ${v === false ? 'on' : ''}" data-v="${i}" data-val="0">✗ Raté</button></div>
          <div class="reveal mt"><div class="answer"><div class="who">${avatar(YOU(), 16)} ${esc(yourName())}</div>${esc(you.self[i])}</div><div class="answer"><div class="who">${avatar(ME, 16)} j'ai deviné</div>${esc(me.guess[i])}</div></div></div>`;
      }).join('');
    } else {
      html += qs.map((qi, i) => `<div class="card"><div style="font-weight:800">${i + 1}. ${esc(QUIZ[qi])}</div><div class="reveal"><div class="answer"><div class="who">moi</div>${esc(me.self[i])}</div><div class="answer"><div class="who">je devine</div>${esc(me.guess[i])}</div></div></div>`).join('');
    }
  }
  if (hist.length) html += `<div class="sec"><h2>Semaines passées</h2></div><div class="card" style="padding:6px 16px">${hist.map(w => { const a = quizScore(w, 'alex'), m = quizScore(w, 'manon'); return `<div class="li"><div class="grow"><div class="t">Semaine du ${fmtDate(w)}</div></div><span class="chip">${esc(nameOf('alex'))} ${a == null ? '–' : a} · ${esc(nameOf('manon'))} ${m == null ? '–' : m}</span></div>`; }).join('')}</div>`;
  b.innerHTML = html;
  const sub = b.querySelector('[data-submit]');
  if (sub) sub.onclick = () => {
    const self = qs.map((_, i) => val(b, `[data-self="${i}"]`)), guess = qs.map((_, i) => val(b, `[data-guess="${i}"]`));
    if (self.some(x => !x) || guess.some(x => !x)) return toast('Remplis tout 🙂');
    put({ id: 'quizA-' + wk + '-' + ME, t: 'quizA', by: ME, self, guess, d: today() });
    notify(YOU(), 'Quiz de la semaine 🧠', you ? myName() + ' a joué : venez valider les devinettes !' : myName() + ' a répondu au quiz. À toi de jouer !', 'brain');
    renderGameBody(); toast(you ? 'À vous de valider !' : 'Envoyé, on attend ' + yourName());
  };
  b.querySelectorAll('[data-v]').forEach(x => x.onclick = () => {
    const v = quizV(wk, ME) || { id: 'quizV-' + wk + '-' + ME, t: 'quizV', by: ME, verdicts: [] };
    v.verdicts[+x.dataset.v] = x.dataset.val === '1'; put(v);
    if (v.verdicts.filter(z => z != null).length === qs.length) notify(YOU(), 'Score du quiz 🏆', myName() + ' a validé : tu as ' + v.verdicts.filter(z => z).length + '/5 bonnes devinettes.', 'trophy');
    renderGameBody();
  });
}

// ---------- défi de la semaine ----------
function weekDefi(wk) { const c = get('defiCustom-' + wk); if (c) return { txt: c.txt, by: c.by }; return { txt: shuffle(DEFIS, 5)[((dayIndex(wk) / 7) | 0) % DEFIS.length] }; }
function renderDefi(b) {
  const wk = weekKey();
  const d = weekDefi(wk);
  const me = get('defiDone-' + wk + '-' + ME), you = get('defiDone-' + wk + '-' + YOU());
  const weeks = new Set(); all('defiDone').forEach(x => weeks.add(x.id.split('-').slice(1, 4).join('-')));
  const hist = [...weeks].filter(w => w !== wk).sort().reverse();
  b.innerHTML = `<div class="card gold"><div class="small" style="font-weight:800;text-transform:uppercase;letter-spacing:.06em;opacity:.8">Défi de la semaine · ${fmtDate(wk)}</div><div class="serif" style="font-size:22px;line-height:1.2;margin-top:6px">${esc(d.txt)}</div>${d.by ? `<div class="small mt" style="opacity:.8">proposé par ${esc(nameOf(d.by))}</div>` : ''}
    <div class="row mt2 wrap"><span class="chip ${me ? 'ok' : ''}">${me ? '✓' : '○'} ${esc(myName())}</span><span class="chip ${you ? 'ok' : ''}">${you ? '✓' : '○'} ${esc(yourName())}</span></div></div>
    ${me ? `<div class="card"><div class="card-h"><h2>Tu l'as fait 🎉</h2></div>${me.note ? `<div>${nl(me.note)}</div>` : ''}${me.url ? `<img src="${esc(me.url)}" style="width:100%;border-radius:12px;margin-top:8px" alt="">` : ''}</div>` : `<div class="card"><label class="f">Un mot sur comment ça s'est passé</label><textarea class="in" data-note placeholder="Facultatif"></textarea><div class="row mt"><button class="btn" data-photo>📷 Photo</button><button class="btn p grow" data-done>Défi relevé ✓</button></div><div class="small muted mt" data-pstat></div></div>`}
    ${you ? `<div class="card"><div class="card-h"><h2>${esc(yourName())} l'a fait aussi</h2></div>${you.note ? `<div>${nl(you.note)}</div>` : ''}${you.url ? `<img src="${esc(you.url)}" style="width:100%;border-radius:12px;margin-top:8px" alt="">` : ''}</div>` : ''}
    <div class="row mt2"><button class="btn wide" data-custom>Proposer un autre défi cette semaine</button></div>
    ${hist.length ? `<div class="sec"><h2>Défis passés</h2></div><div class="card" style="padding:6px 16px">${hist.map(w => { const dd = weekDefi(w); const a = get('defiDone-' + w + '-alex'), m = get('defiDone-' + w + '-manon'); return `<div class="li"><div class="grow"><div class="t">${esc(dd.txt)}</div><div class="m">${fmtDate(w)} · ${a ? '✓ ' + nameOf('alex') : ''} ${m ? '✓ ' + nameOf('manon') : ''}</div></div></div>`; }).join('')}</div>` : ''}`;
  let url = null;
  const ph = b.querySelector('[data-photo]'); if (ph) ph.onclick = () => pickPhoto(async f => { b.querySelector('[data-pstat]').textContent = 'Envoi…'; try { url = await uploadPhoto(f); b.querySelector('[data-pstat]').textContent = 'Photo prête ✓'; } catch (e) { b.querySelector('[data-pstat]').textContent = 'Échec : ' + e.message; } });
  const dn = b.querySelector('[data-done]'); if (dn) dn.onclick = () => { put({ id: 'defiDone-' + wk + '-' + ME, t: 'defiDone', by: ME, note: val(b, '[data-note]'), url, d: today() }); notify(YOU(), 'Défi relevé 🏁', myName() + ' a relevé le défi de la semaine !', 'checkered_flag'); burst(); renderGameBody(); };
  b.querySelector('[data-custom]').onclick = () => {
    const sh = openSheet('Défi maison', `<label class="f">Le défi</label><textarea class="in" data-txt placeholder="Quelque chose de fun et faisable à distance"></textarea><div class="muted small mt">Il remplace le défi de cette semaine pour vous deux.</div><button class="btn p wide mt2" data-ok>Lancer le défi</button>`);
    sh.querySelector('[data-ok]').onclick = () => { const txt = val(sh, '[data-txt]'); if (!txt) return; put({ id: 'defiCustom-' + wk, t: 'defiCustom', txt, by: ME }); notify(YOU(), 'Nouveau défi 🏁', myName() + ' lance un défi : ' + txt, 'checkered_flag'); sh.close(); renderGameBody(); };
  };
}

// ---------- devine ma réponse ----------
function renderGuess(b) {
  const open = all('guess').sort(byNewest);
  const gOf = g => get('guessG-' + g.id.slice(6));
  const card = g => {
    const gg = gOf(g);
    const mineQ = g.by === ME;
    let body = '';
    if (mineQ) {
      body = gg ? `<div class="reveal"><div class="answer"><div class="who">ma réponse</div>${nl(g.a)}</div><div class="answer"><div class="who">${esc(yourName())} devine</div>${nl(gg.g)}</div></div>` + (g.v == null ? `<div class="small muted mt">Proche ?</div><div class="verdict"><button class="ok" data-gv="${g.id}" data-val="1">✓ Bien vu</button><button class="ko" data-gv="${g.id}" data-val="0">✗ Pas du tout</button></div>` : `<div class="chip ${g.v ? 'ok' : ''} mt">${g.v ? '✓ Bien vu' : '✗ Raté, on en parle ?'}</div>`) : `<div class="answer"><div class="who">ma réponse</div>${nl(g.a)}</div><div class="muted small mt">En attente de la devinette de ${esc(yourName())}…</div>`;
    } else {
      body = gg ? `<div class="reveal"><div class="answer"><div class="who">${esc(yourName())}</div>${nl(g.a)}</div><div class="answer"><div class="who">j'ai deviné</div>${nl(gg.g)}</div></div>${g.v != null ? `<div class="chip ${g.v ? 'ok' : ''} mt">${g.v ? '✓ Bien vu' : '✗ Raté'}</div>` : '<div class="small muted mt">En attente du verdict.</div>'}` : `<div class="answer locked"><div class="who">${esc(yourName())}</div>Sa réponse est cachée.</div><textarea class="in mt" data-gtxt="${g.id}" placeholder="À ton avis, ${esc(yourName())} a répondu…"></textarea><button class="btn p wide mt" data-gsend="${g.id}">Je devine</button>`;
    }
    return `<div class="card"><div class="small muted">${esc(nameOf(g.by))} · ${fmtDate(g.d)}</div><div class="q serif" style="font-size:18px;margin:4px 0 8px">${esc(g.q)}</div>${body}</div>`;
  };
  b.innerHTML = `<div class="muted small mt">Tu réponds à une question intime, ${esc(yourName())} devine ta réponse, puis on compare. Et on en parle.</div>
    <button class="btn p wide mt" data-new>+ Poser une question et y répondre</button>
    ${open.length ? open.map(card).join('') : empty('Lance la première : une question, ta réponse, et ' + esc(yourName()) + ' devine.', '🎯')}`;
  b.querySelector('[data-new]').onclick = () => {
    const sugg = shuffle(DEEP, Date.now() % 1000).slice(0, 4);
    const sh = openSheet('Devine ma réponse', `<label class="f">La question</label><textarea class="in" data-q placeholder="Une question sur toi"></textarea><div class="muted small mt">Idées :</div>${sugg.map(s => `<button type="button" class="chip mt" data-s="${esc(s)}" style="white-space:normal;text-align:left">${esc(s)}</button>`).join('')}<label class="f">Ma réponse (cachée jusqu'à sa devinette)</label><textarea class="in" data-a></textarea><button class="btn p wide mt2" data-ok>Envoyer</button>`);
    sh.querySelectorAll('[data-s]').forEach(x => x.onclick = () => sh.querySelector('[data-q]').value = x.dataset.s);
    sh.querySelector('[data-ok]').onclick = () => { const q = val(sh, '[data-q]'), a = val(sh, '[data-a]'); if (!q || !a) return toast('Question et réponse'); put({ id: uid('guess'), t: 'guess', q, a, by: ME, d: today() }); notify(YOU(), 'Devine ma réponse 🎯', myName() + ' : « ' + q + ' ». Devine sa réponse !', 'dart'); sh.close(); renderGameBody(); };
  };
  b.querySelectorAll('[data-gsend]').forEach(x => x.onclick = () => { const id = x.dataset.gsend; const g = val(b, `[data-gtxt="${id}"]`); if (!g) return; put({ id: 'guessG-' + id.slice(6), t: 'guessG', by: ME, g, d: today() }); notify(YOU(), 'Devinette 🎯', myName() + ' a deviné ta réponse. Verdict ?', 'dart'); renderGameBody(); });
  b.querySelectorAll('[data-gv]').forEach(x => x.onclick = () => { const g = get(x.dataset.gv); g.v = x.dataset.val === '1'; put(g); notify(YOU(), 'Verdict 🎯', g.v ? myName() + ' : bien vu, tu avais deviné ! 🎉' : myName() + ' : raté… on en parle ?', g.v ? 'tada' : 'thinking_face'); renderGameBody(); });
}

// ---------- roue de la vie ----------
function monthKey(d) { return (d || today()).slice(0, 7); }
function renderWheel(b) {
  const mk = monthKey();
  const me = get('wheel-' + mk + '-' + ME), you = get('wheel-' + mk + '-' + YOU());
  const months = new Set(); all('wheel').forEach(w => months.add(w.id.split('-').slice(1, 3).join('-')));
  const hist = [...months].filter(m => m !== mk).sort().reverse();
  b.innerHTML = `<div class="muted small mt">Chaque mois, chacun note ses 8 domaines de vie sur 10. On superpose les deux roues et on voit où on en est, chacun et ensemble.</div>
    <div class="card"><div class="card-h"><h2>${MONTHS_L[+mk.slice(5, 7) - 1]} ${mk.slice(0, 4)}</h2><div class="row"><span class="chip ${me ? 'ok' : ''}">${esc(myName())}</span><span class="chip ${you ? 'ok' : ''}">${esc(yourName())}</span></div></div>
    ${(me || you) ? radarSvg(me && me.scores, you && you.scores) : ''}
    ${me ? `<div class="grid2 mt">${ROUE.map(k => `<div class="row between small"><span>${k}</span><b>${me.scores[k] || '–'}${you ? ' <span class="muted">/ ' + (you.scores[k] || '–') + '</span>' : ''}</b></div>`).join('')}</div><button class="btn sm ghost mt" data-edit>Modifier</button>` : `<button class="btn p wide mt" data-fill>Remplir ma roue</button>`}</div>
    ${hist.length ? `<div class="sec"><h2>Mois précédents</h2></div>${hist.map(m => { const a = get('wheel-' + m + '-alex'), mm = get('wheel-' + m + '-manon'); return `<div class="card"><div class="card-h"><h2>${MONTHS_L[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}</h2></div>${radarSvg(a && a.scores, mm && mm.scores)}</div>`; }).join('')}` : ''}`;
  const fill = () => {
    const cur = (me && me.scores) || {};
    const sh = openSheet('Ma roue de la vie', ROUE.map(k => `<label class="f">${k}</label>${scaleHtml('w-' + k, 10, cur[k] || null)}`).join('') + `<button class="btn p wide mt2" data-ok>Enregistrer</button>`);
    wireSegs(sh);
    sh.querySelector('[data-ok]').onclick = () => { const scores = {}; ROUE.forEach(k => scores[k] = segVal(sh, 'w-' + k) || 5); put({ id: 'wheel-' + mk + '-' + ME, t: 'wheel', by: ME, scores, d: today() }); notify(YOU(), 'Roue de la vie 🎡', myName() + ' a rempli sa roue du mois. À toi, et on compare.', 'ferris_wheel'); sh.close(); renderGameBody(); };
  };
  const f = b.querySelector('[data-fill]'); if (f) f.onclick = fill;
  const e = b.querySelector('[data-edit]'); if (e) e.onclick = fill;
}
function radarSvg(a, m) {
  const n = ROUE.length, cx = 170, cy = 170, R = 120;
  const pt = (i, v) => { const ang = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(ang) * R * v / 10, cy + Math.sin(ang) * R * v / 10]; };
  const poly = (s, col) => s ? `<polygon points="${ROUE.map((k, i) => pt(i, s[k] || 0).join(',')).join(' ')}" fill="${col}" fill-opacity=".25" stroke="${col}" stroke-width="2"/>` : '';
  let grid = ''; for (let r = 2; r <= 10; r += 2) grid += `<polygon points="${ROUE.map((k, i) => pt(i, r).join(',')).join(' ')}" fill="none" stroke="currentColor" stroke-opacity=".12"/>`;
  const labels = ROUE.map((k, i) => { const [x, y] = pt(i, 12.6); return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="700" fill="currentColor" fill-opacity=".75">${k}</text>`; }).join('');
  return `<svg class="radar" viewBox="0 0 340 340">${grid}${ROUE.map((k, i) => { const [x, y] = pt(i, 10); return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="currentColor" stroke-opacity=".12"/>`; }).join('')}${poly(a, USERS.alex.color)}${poly(m, USERS.manon.color)}${labels}</svg><div class="row" style="justify-content:center;gap:14px"><span class="small"><span class="av alex" style="--s:10px;display:inline-block;vertical-align:middle"></span> ${esc(nameOf('alex'))}</span><span class="small"><span class="av manon" style="--s:10px;display:inline-block;vertical-align:middle"></span> ${esc(nameOf('manon'))}</span></div>`;
}

// ---------- ligne de vie ----------
function renderLife(b) {
  VIEW.lifeWho = VIEW.lifeWho || ME;
  const who = VIEW.lifeWho;
  const chapters = all('life').filter(c => c.by === who).sort((x, y) => (x.age || 0) - (y.age || 0) || x.u - y.u);
  b.innerHTML = `<div class="muted small mt">Chacun raconte son histoire par épisodes. L'autre peut poser une question par épisode. Une façon douce de connaître d'où on vient.</div>
    <div class="chips mt" data-seg="who"><button type="button" class="chip ${who === ME ? 'on' : ''}" data-v="${ME}">Mon histoire</button><button type="button" class="chip ${who !== ME ? 'on' : ''}" data-v="${YOU()}">L'histoire de ${esc(yourName())}</button></div>
    ${who === ME ? `<button class="btn p wide mt" data-new>+ Un épisode de ma vie</button>` : ''}
    ${chapters.length ? chapters.map(c => { const qs = all('lifeQ').filter(q => q.chapter === c.id).sort((x, y) => x.u - y.u); return `<div class="chapter"><div class="age">${c.age != null && c.age !== '' ? c.age + ' ans' : 'un jour'}${c.year ? ' · ' + c.year : ''}</div><div class="t">${esc(c.title)}</div><div>${nl(c.txt)}</div>${c.url ? `<img src="${esc(c.url)}" style="width:100%;border-radius:12px;margin-top:8px" alt="">` : ''}
      ${qs.map(q => `<div class="qa"><div class="q">${esc(nameOf(q.by))} : ${esc(q.q)}</div>${q.a ? `<div class="mt">${nl(q.a)}</div>` : (c.by === ME ? `<div class="row mt"><input class="in grow" data-ans="${q.id}" placeholder="Ta réponse" style="margin-top:0"><button class="btn sm" data-ansok="${q.id}">OK</button></div>` : '<div class="muted small">Pas encore de réponse</div>')}</div>`).join('')}
      ${c.by !== ME && !qs.some(q => q.by === ME) ? `<div class="row mt"><input class="in grow" data-q="${c.id}" placeholder="Une question sur cet épisode" style="margin-top:0"><button class="btn sm" data-qok="${c.id}">?</button></div>` : ''}
      ${c.by === ME ? `<button class="btn sm ghost mt" data-edit="${c.id}">Modifier</button>` : ''}</div>`; }).join('') : empty(who === ME ? 'Commence par ton premier souvenir, ou par un moment qui a compté.' : esc(yourName()) + ' n\'a pas encore écrit d\'épisode.', '📖')}`;
  wireSegs(b);
  b.querySelector('[data-seg=who]').addEventListener('change', () => { VIEW.lifeWho = segVal(b, 'who'); renderGameBody(); });
  const edit = id => {
    const c = (id && get(id)) || { id: uid('life'), t: 'life', by: ME, title: '', txt: '', age: '', year: '', url: null };
    const sh = openSheet('Un épisode', `<label class="f">Titre</label><input class="in" data-title value="${esc(c.title)}" placeholder="Le déménagement, mon premier job…"><div class="grid2"><div><label class="f">Âge</label><input class="in" type="number" data-age value="${esc(c.age)}"></div><div><label class="f">Année</label><input class="in" type="number" data-year value="${esc(c.year || '')}"></div></div><label class="f">Raconte</label><textarea class="in" data-txt style="min-height:120px">${esc(c.txt)}</textarea><div class="row mt"><button class="btn" data-photo>📷 Photo</button><span class="small muted" data-pstat>${c.url ? 'Photo ✓' : ''}</span></div><div class="row mt2">${id ? '<button class="btn danger" data-del>Supprimer</button>' : ''}<button class="btn p grow" data-ok>Enregistrer</button></div>`);
    sh.querySelector('[data-photo]').onclick = () => pickPhoto(async f => { sh.querySelector('[data-pstat]').textContent = 'Envoi…'; try { c.url = await uploadPhoto(f); sh.querySelector('[data-pstat]').textContent = 'Photo ✓'; } catch (e) { sh.querySelector('[data-pstat]').textContent = 'Échec'; } });
    sh.querySelector('[data-ok]').onclick = () => { c.title = val(sh, '[data-title]'); c.txt = val(sh, '[data-txt]'); c.age = val(sh, '[data-age]'); c.year = val(sh, '[data-year]'); if (!c.title && !c.txt) return; const isNew = !get(c.id); put(c); if (isNew) notify(YOU(), 'Ligne de vie 📖', myName() + ' a écrit un épisode : ' + (c.title || '…'), 'book'); sh.close(); renderGameBody(); };
    const del = sh.querySelector('[data-del]'); if (del) del.onclick = () => { remove(c.id); sh.close(); renderGameBody(); };
  };
  const nw = b.querySelector('[data-new]'); if (nw) nw.onclick = () => edit(null);
  b.querySelectorAll('[data-edit]').forEach(x => x.onclick = () => edit(x.dataset.edit));
  b.querySelectorAll('[data-qok]').forEach(x => x.onclick = () => { const q = val(b, `[data-q="${x.dataset.qok}"]`); if (!q) return; put({ id: uid('lifeQ'), t: 'lifeQ', chapter: x.dataset.qok, by: ME, q, a: '' }); notify(YOU(), 'Ligne de vie 📖', myName() + ' te pose une question sur un épisode : ' + q, 'book'); renderGameBody(); });
  b.querySelectorAll('[data-ansok]').forEach(x => x.onclick = () => { const a = val(b, `[data-ans="${x.dataset.ansok}"]`); if (!a) return; const q = get(x.dataset.ansok); q.a = a; put(q); notify(YOU(), 'Ligne de vie 📖', myName() + ' a répondu à ta question.', 'book'); renderGameBody(); });
}
