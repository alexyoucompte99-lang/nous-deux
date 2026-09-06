/* Nous · démarrage, navigation, onboarding, réglages */
const VIEW = { tab: 'home' };
function render() {
  const root = document.getElementById('view');
  applySky(); renderClocks();
  if (!ME) return renderOnboarding(root);
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === VIEW.tab));
  ({ home: renderHome, duo: renderDuo, games: renderGames, us: renderUs, ai: renderAI })[VIEW.tab](root);
  renderBadges();
}
function renderClocks() {
  const el = document.getElementById('clocks'); if (!el || !ME) { if (el) el.innerHTML = ''; return; }
  el.innerHTML = [ME, YOU()].map(u => { const tz = profile(u).tz; const hh = hourIn(tz); return `<span class="clock" title="${esc(tz || '')}">${avatar(u, 16)} ${timeIn(tz)} ${PHASE_ICON[phase(hh)]}</span>`; }).join('');
}
function renderBadges() {
  const d = today(), wk = weekKey();
  const n = {};
  n.home = (!get('qd-' + d + '-' + ME) && get('qd-' + d + '-' + YOU())) ? 1 : 0;
  const you = quizA(wk, YOU()), me = quizA(wk, ME), myV = quizV(wk, ME);
  n.games = ((you && !me) ? 1 : 0) + ((you && me && !(myV && myV.verdicts.filter(x => x != null).length >= 5)) ? 1 : 0) + all('guess').filter(g => g.by !== ME && !get('guessG-' + g.id.slice(6))).length + all('guess').filter(g => g.by === ME && get('guessG-' + g.id.slice(6)) && g.v == null).length;
  n.us = all('letter').filter(l => l.to === ME && l.open <= d && !localStorage.getItem('nous-read-' + l.id)).length + ((get('checkin-' + wk + '-' + YOU()) && !get('checkin-' + wk + '-' + ME)) ? 1 : 0);
  n.duo = all('coupon').filter(c => c.to === ME && !c.used).length ? 0 : 0;
  document.querySelectorAll('.tabs button').forEach(b => { const old = b.querySelector('.badge'); if (old) old.remove(); const k = n[b.dataset.tab]; if (k) b.insertAdjacentHTML('beforeend', `<span class="badge">${k}</span>`); });
  if (VIEW.tab === 'us' && VIEW.us === 'letters') all('letter').filter(l => l.to === ME && l.open <= d).forEach(l => localStorage.setItem('nous-read-' + l.id, '1'));
}

function renderOnboarding(root) {
  let who = null;
  root.innerHTML = `<div class="onb"><div><h1>Nous</h1><div class="sub muted" style="margin-top:6px">L'appli privée d'Alex et Manon. Ce téléphone, c'est celui de…</div></div>
    <div class="who">${['alex', 'manon'].map(u => `<button data-who="${u}">${avatar(u, 56)}<span>${USERS[u].name}</span></button>`).join('')}</div>
    <label class="f">Ta date de naissance (pour ton nombre du jour)</label><input class="in" type="date" data-birth>
    <button class="btn p wide mt2" data-go disabled>C'est parti 💛</button></div>`;
  root.querySelectorAll('[data-who]').forEach(b => b.onclick = () => { who = b.dataset.who; root.querySelectorAll('[data-who]').forEach(x => x.classList.toggle('on', x === b)); root.querySelector('[data-go]').disabled = false; });
  root.querySelector('[data-go]').onclick = () => {
    if (!who) return;
    ME = who; localStorage.setItem('nous-me', who);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';
    saveProfile(ME, { tz, birth: val(root, '[data-birth]') || profile(ME).birth });
    render(); pull(true);
    showTour(() => { render(); toast('Bienvenue ' + myName() + ' 💛'); });
  };
}

function settingsSheet() {
  const p = profile(ME), o = profile(YOU());
  const sh = openSheet('Réglages', `
    <div class="row"><span>${avatar(ME, 40)}</span><div class="grow"><div style="font-weight:800">${esc(myName())}</div><div class="small muted">Ce téléphone</div></div></div>
    <label class="f">Prénom affiché</label><input class="in" data-name value="${esc(p.name || '')}">
    <label class="f">Date de naissance</label><input class="in" type="date" data-birth value="${esc(p.birth || '')}">
    <label class="f">Fuseau horaire</label><input class="in" data-tz value="${esc(p.tz || '')}" placeholder="Europe/Paris">
    <div class="small muted mt">${esc(yourName())} est en <b>${esc(o.tz || '?')}</b>${lifePath(p.birth) ? ' · ton chemin de vie : <b>' + lifePath(p.birth) + '</b>' : ''}</div>
    <button class="btn p wide mt" data-save>Enregistrer</button>
    <div class="sec"><h2>🔔 Notifications</h2></div>
    <div class="small muted">1. Installe l'appli <b>ntfy</b> (App Store / Play Store). 2. Abonne-toi au sujet ci-dessous. 3. Tu reçois les signes de ${esc(yourName())}, la question du jour à 9h, les lettres qui s'ouvrent, les défis, le check-in du dimanche.</div>
    <label class="f">Mon sujet ntfy</label><input class="in" data-ntfy value="${esc(p.ntfy || NTFY_DEFAULT[ME])}" placeholder="${NTFY_DEFAULT[ME]}">
    <div class="row mt"><button class="btn sm" data-ntfy-save>Enregistrer le sujet</button><button class="btn sm" data-ntfy-test>Notif de test</button></div>
    <div class="sec"><h2>✨ Complice (IA)</h2></div>
    <div class="small muted">Clé API Anthropic (une seule pour vous deux, stockée dans le pont, jamais dans le téléphone). Compte sur <a href="https://console.anthropic.com" target="_blank">console.anthropic.com</a>.</div>
    <div class="row mt"><input class="in grow" data-key type="password" placeholder="sk-ant-…" style="margin-top:0"><button class="btn sm" data-key-save>OK</button></div>
    <div class="sec"><h2>💾 Données</h2></div>
    <div class="row wrap"><button class="btn sm" data-pull>Resynchroniser</button><button class="btn sm" data-export>Exporter</button><span class="small muted">${Object.keys(DB.items).length} éléments · ${DB.outbox.length} en attente</span></div>
    <div class="row mt2 wrap"><button class="btn sm ghost" data-tour>Revoir la visite guidée</button><button class="btn sm ghost" data-switch>Changer de personne sur ce téléphone</button></div>
    <div class="small soft mt2">Pont : ${BRIDGE.url.startsWith('__') ? 'non configuré' : 'connecté'} · v1</div>`);
  sh.querySelector('[data-save]').onclick = () => { saveProfile(ME, { name: val(sh, '[data-name]') || USERS[ME].name, birth: val(sh, '[data-birth]'), tz: val(sh, '[data-tz]') || p.tz }); sh.close(); render(); toast('Enregistré'); };
  sh.querySelector('[data-ntfy-save]').onclick = async () => { const topic = val(sh, '[data-ntfy]'); if (!topic) return; saveProfile(ME, { ntfy: topic }); const r = await post({ what: 'setup', app_url: APP_URL, ['ntfy_' + ME]: topic }).catch(() => ({})); toast(r.ok ? 'Sujet enregistré' : 'Enregistré (pont : ' + (r.error || 'hors ligne') + ')'); };
  sh.querySelector('[data-ntfy-test]').onclick = async () => { const r = await post({ what: 'notify', to: ME, title: 'Nous 💛', msg: 'Notification de test : ça marche !', tags: 'yellow_heart' }).catch(() => ({})); toast(r.ok ? 'Envoyée' : 'Échec : ' + (r.error || '')); };
  sh.querySelector('[data-key-save]').onclick = async () => { const k = val(sh, '[data-key]'); if (!k) return; const r = await post({ what: 'ai_setup', api_key: k }).catch(() => ({})); toast(r.ok ? 'Complice branché ✨' : 'Échec : ' + (r.error || '')); sh.querySelector('[data-key]').value = ''; };
  sh.querySelector('[data-pull]').onclick = () => { pull(true); toast('Synchro…'); };
  sh.querySelector('[data-export]').onclick = () => { const a = document.createElement('a'); a.href = 'data:application/json,' + encodeURIComponent(JSON.stringify(all())); a.download = 'nous-' + today() + '.json'; a.click(); };
  sh.querySelector('[data-tour]').onclick = () => { closeSheet(); showTour(render); };
  sh.querySelector('[data-switch]').onclick = async () => { if (await confirmSheet('Changer de personne ?', 'Les données restent, seul le « qui suis-je » change.', 'Changer')) { localStorage.removeItem('nous-me'); ME = ''; closeSheet(); render(); } };
}

function init() {
  loadDB();
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => { VIEW.tab = b.dataset.tab; render(); scrollTop(); }));
  document.getElementById('btn-settings').addEventListener('click', () => { if (ME) settingsSheet(); });
  render();
  pull(!DB.lastSync);
  if (ME && !localStorage.getItem('nous-tour')) showTour(render);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { pull(); applySky(); renderClocks(); } });
  setInterval(() => { pull(); }, 30000);
  setInterval(() => { applySky(); renderClocks(); }, 60000);
  window.addEventListener('online', flush);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
document.addEventListener('DOMContentLoaded', init);
