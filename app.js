/* Nous · démarrage, navigation, onboarding, réglages */
const VIEW = { tab: 'home' };
function render() {
  const root = document.getElementById('view');
  applySky(); renderClocks();
  if (!ME) return renderOnboarding(root);
  const snap = keepDrafts(root);
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === VIEW.tab));
  ({ home: renderHome, duo: renderDuo, games: renderGames, us: renderUs, ai: renderAI })[VIEW.tab](root);
  restoreDrafts(root, snap);
  renderBadges();
}
// La synchro redessine l'écran quand l'autre fait quelque chose : on garde ce qui était en train d'être écrit (et le curseur).
const viewKey = () => [VIEW.tab, VIEW.duo, VIEW.game, VIEW.us].join('|');
const fieldKey = el => el.tagName + '|' + [...el.attributes].filter(a => a.name.startsWith('data-')).map(a => a.name + '=' + a.value).join('&') + '|' + (el.placeholder || '');
function keepDrafts(root) {
  const f = {};
  root.querySelectorAll('input:not([type=file]):not([type=checkbox]):not([type=radio]):not([type=date]), textarea').forEach(el => { if (el.value) f[fieldKey(el)] = { v: el.value, focus: el === document.activeElement, s: el.selectionStart, e: el.selectionEnd }; });
  return { view: viewKey(), f };
}
function restoreDrafts(root, snap) {
  if (!snap || snap.view !== viewKey()) return;
  root.querySelectorAll('input, textarea').forEach(el => {
    const x = snap.f[fieldKey(el)]; if (!x || el.value) return;
    el.value = x.v;
    if (x.focus) { el.focus({ preventScroll: true }); try { el.setSelectionRange(x.s, x.e); } catch (e) {} }
  });
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
  root.querySelectorAll('[data-who]').forEach(b => b.onclick = () => { who = b.dataset.who; root.querySelectorAll('[data-who]').forEach(x => x.classList.toggle('on', x === b)); const bi = root.querySelector('[data-birth]'); const known = profile(who).birth || USERS[who].birth; if (known) bi.value = known; root.querySelector('[data-go]').disabled = false; });
  root.querySelector('[data-go]').onclick = async () => {
    if (!who) return;
    if (!DB.lastSync && navigator.onLine) { toast('Un instant…'); await pull(true); }
    const pin = profile(who).pin;
    if (pin) { const okPin = await new Promise(res => { const sh = pinSheet('Code de ' + nameOf(who), 'Ce profil est protégé par un code.', async v => { const ok = (await sha(v)) === pin; if (ok) res(true); return ok; }); const obs = new MutationObserver(() => { if (!document.body.contains(sh)) { obs.disconnect(); res(false); } }); obs.observe(document.getElementById('sheet-root'), { childList: true }); }); if (!okPin) return; }
    ME = who; localStorage.setItem('nous-me', who);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';
    saveProfile(ME, { tz, birth: val(root, '[data-birth]') || profile(ME).birth || USERS[ME].birth });
    render(); pull(true); syncPush(true).catch(() => {});
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
    <div class="sec"><h2>🔒 Code de protection</h2></div>
    <div class="small muted">Un code demandé uniquement si quelqu'un essaie d'ouvrir ton profil depuis « Changer de personne ». Jamais au lancement.</div>
    <button class="btn sm mt" data-pin>${p.pin ? 'Changer mon code' : 'Définir un code'}</button>${p.pin ? ' <button class="btn sm ghost mt" data-pin-off>Retirer</button>' : ''}
    <div class="sec"><h2>🔔 Notifications</h2></div>
    <div data-push></div>
    <div class="sec"><h2>✨ Complice (IA, prise de recul)</h2></div>
    <div class="small muted">Clé API Anthropic (une seule pour vous deux, stockée dans le pont, jamais dans le téléphone). Compte sur <a href="https://console.anthropic.com" target="_blank">console.anthropic.com</a>.</div>
    <div class="row mt"><input class="in grow" data-key type="password" placeholder="sk-ant-…" style="margin-top:0"><button class="btn sm" data-key-save>OK</button></div>
    <div class="sec"><h2>💾 Données</h2></div>
    <div class="row wrap"><button class="btn sm" data-pull>Resynchroniser</button><button class="btn sm" data-export>Exporter</button><span class="small muted">${Object.keys(DB.items).length} éléments · ${DB.outbox.length} en attente</span></div>
    <div class="row mt2 wrap"><button class="btn sm ghost" data-tour>Revoir la visite guidée</button><button class="btn sm ghost" data-switch>Changer de personne sur ce téléphone</button></div>
    <div class="small soft mt2">Pont : ${BRIDGE.url.startsWith('__') ? 'non configuré' : 'connecté'} · v1</div>`);
  renderPushBox(sh.querySelector('[data-push]'));
  sh.querySelector('[data-save]').onclick = () => { saveProfile(ME, { name: val(sh, '[data-name]') || USERS[ME].name, birth: val(sh, '[data-birth]'), tz: val(sh, '[data-tz]') || p.tz }); sh.close(); render(); toast('Enregistré'); };
  const setPin = () => pinSheet('Nouveau code', 'Choisis un code (chiffres ou lettres). Retiens-le bien, il n\'y a pas de récupération.', async v => { if (v.length < 4) { toast('4 caractères minimum'); return false; } saveProfile(ME, { pin: await sha(v) }); toast('Code enregistré 🔒'); sh.close(); return true; });
  sh.querySelector('[data-pin]').onclick = () => { if (p.pin) pinSheet('Code actuel', 'Entre ton code actuel.', async v => { const ok = (await sha(v)) === p.pin; if (ok) setTimeout(setPin, 250); return ok; }); else setPin(); };
  const off = sh.querySelector('[data-pin-off]'); if (off) off.onclick = () => pinSheet('Code actuel', 'Entre ton code pour le retirer.', async v => { const ok = (await sha(v)) === p.pin; if (ok) { saveProfile(ME, { pin: '' }); toast('Code retiré'); sh.close(); } return ok; });
  sh.querySelector('[data-key-save]').onclick = async () => { const k = val(sh, '[data-key]'); if (!k) return; const r = await post({ what: 'ai_setup', api_key: k }).catch(() => ({})); toast(r.ok ? 'Complice branché ✨' : 'Échec : ' + (r.error || '')); sh.querySelector('[data-key]').value = ''; };
  sh.querySelector('[data-pull]').onclick = () => { pull(true); toast('Synchro…'); };
  sh.querySelector('[data-export]').onclick = () => { const a = document.createElement('a'); a.href = 'data:application/json,' + encodeURIComponent(JSON.stringify(all())); a.download = 'nous-' + today() + '.json'; a.click(); };
  sh.querySelector('[data-tour]').onclick = () => { closeSheet(); showTour(render); };
  sh.querySelector('[data-switch]').onclick = async () => { if (await confirmSheet('Changer de personne ?', 'Les données restent, seul le « qui suis-je » change.', 'Changer')) { localStorage.removeItem('nous-me'); ME = ''; closeSheet(); render(); } };
}

// Bloc « Notifications » des réglages : état de ce téléphone, activation (depuis un toucher), test, et état chez l'autre.
function renderPushBox(box) {
  if (!box) return;
  const st = PUSH.state(), you = esc(yourName());
  const txt = {
    install: `Sur iPhone, les notifs marchent quand Nous est ouverte depuis l'écran d'accueil : dans Safari, touche Partager puis « Sur l'écran d'accueil », et ouvre Nous depuis l'icône.`,
    unsupported: `Ce navigateur ne gère pas les notifications. Sur iPhone : iOS 16.4 minimum, et Nous ouverte depuis l'écran d'accueil.`,
    default: `Une notif quand ${you} pense à toi ou remplit quelque chose. Jamais de rappel de l'appli.`,
    granted: `Activées sur ce téléphone ✓`,
    denied: `Bloquées sur ce téléphone. Pour les réactiver : Réglages de l'iPhone → Notifications → Nous.`,
  }[st];
  box.innerHTML = `<div class="small ${st === 'granted' ? '' : 'muted'}">${txt}</div>
    <div class="row mt wrap">${st === 'default' ? '<button class="btn p sm" data-pon>Activer les notifications</button>' : ''}${st === 'granted' ? '<button class="btn sm" data-ptest>M\'envoyer une notif test</button><button class="btn sm ghost" data-pfix>Réparer</button>' : ''}</div>
    <div class="small muted mt" data-pother></div>`;
  const on = box.querySelector('[data-pon]');
  if (on) on.onclick = () => { on.disabled = true; enablePush().then(() => { toast('Notifications activées 🔔'); renderPushBox(box); }).catch(e => { toast(e.message === 'denied' ? 'Notifications refusées' : 'Échec : ' + e.message); renderPushBox(box); }); };
  const test = box.querySelector('[data-ptest]');
  if (test) test.onclick = async () => { test.disabled = true; try { await syncPush(true); const r = await post({ what: 'push_test', user: ME }); toast(r.sent ? 'Notif envoyée, elle arrive…' : 'Pas reçue ? Touche « Réparer »'); } catch (e) { toast('Échec : ' + e.message); } test.disabled = false; };
  const fix = box.querySelector('[data-pfix]');
  if (fix) fix.onclick = async () => { fix.disabled = true; try { localStorage.removeItem('nous-vapid'); await syncPush(true); toast('Abonnement renouvelé ✓'); } catch (e) { toast('Échec : ' + e.message); } fix.disabled = false; };
  pushInfo().then(j => { const el = box.querySelector('[data-pother]'); if (el) el.textContent = j.subs && j.subs[YOU()] ? yourName() + ' reçoit les notifs ✓' : yourName() + ' n\'a pas encore activé les notifs sur son téléphone.'; }).catch(() => {});
}

function init() {
  loadDB();
  const qk = new URLSearchParams(location.search).get('k');
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => { VIEW.tab = b.dataset.tab; render(); scrollTop(); }));
  document.getElementById('btn-settings').addEventListener('click', () => { if (ME) settingsSheet(); });
  render();
  if (qk) { openKind(qk); history.replaceState(null, '', location.pathname); }
  pull(!DB.lastSync);
  if (ME && !localStorage.getItem('nous-tour')) showTour(render);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { pull(); flush(); applySky(); renderClocks(); } });
  setInterval(() => { if (!document.hidden) pull(); }, 15000);
  setInterval(() => { applySky(); renderClocks(); }, 60000);
  window.addEventListener('online', () => { flush(); pull(); });
  if (DB.outbox.length || DB.notes.length) flushSoon(1000);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    // notif reçue pendant que l'appli est ouverte : mise à jour immédiate
    navigator.serviceWorker.addEventListener('message', e => {
      const m = e.data || {};
      if (m.type === 'nous-push') { pull(); if (m.d && m.d.kind === 'ping' && !document.hidden) burst(); }
      if (m.type === 'nous-open') { openKind(m.kind); pull(); }
    });
    if (ME) setTimeout(() => syncPush().catch(() => {}), 2500);
  }
}
document.addEventListener('DOMContentLoaded', init);
