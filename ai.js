/* Nous · Complice : chat IA privé (historique local uniquement, jamais synchronisé). */
function aiHistory() { try { return JSON.parse(localStorage.getItem('nous-ai-' + ME) || '[]'); } catch (e) { return []; } }
function aiSave(h) { try { localStorage.setItem('nous-ai-' + ME, JSON.stringify(h.slice(-40))); } catch (e) {} }
const AI_SUGG = ["Une idée d'attention pour aujourd'hui", "Comment lui faire une surprise à distance ?", "Idées pour nos retrouvailles", "Aide-moi à écrire un mot doux", "Un défi fun à lui proposer", "Comment aborder un sujet délicat ?", "Idée de cadeau", "On s'appelle ce soir, on fait quoi ?"];
function aiContext() {
  const m = nextMeet();
  const p = profile(YOU());
  return `Contexte : la personne qui te parle est ${myName()}. Son/sa partenaire est ${yourName()}.` + (m ? ` Prochaines retrouvailles ${fmtLong(m.d)} (dans ${daysBetween(today(), m.d)} jours)${m.place ? ' à ' + m.place : ''}.` : ' Aucune date de retrouvailles fixée pour le moment.') + (p.birth ? ` Anniversaire de ${yourName()} : ${p.birth.slice(5)} (jour-mois).` : '') + ` Nous sommes le ${fmtLong(today())}.` + (all('wish').length ? ` Souhaits notés dans l'appli : ${all('wish').filter(w => !w.done).slice(0, 8).map(w => w.txt).join(', ')}.` : '');
}
function renderAI(root) {
  const hist = aiHistory();
  root.innerHTML = `<div class="hello"><h1>Complice</h1><div class="sub">Des idées quand tu en veux. ${esc(yourName())} ne saura jamais que tu es passé·e ici.</div></div>
    <div class="sugg">${AI_SUGG.map(s => `<button data-s="${esc(s)}">${esc(s)}</button>`).join('')}</div>
    <div class="chat" id="chat">${hist.length ? hist.map(m => `<div class="bubble ${m.role === 'user' ? 'me' : 'ai'}">${esc(m.content)}</div>`).join('') : `<div class="bubble ai">Salut ${esc(myName())} ✨ Je suis là pour te souffler des idées : une attention, une surprise, un mot à écrire, un truc à préparer pour les retrouvailles. C'est toi qui fais, moi je souffle. Tu veux quoi ?</div>`}</div>
    <div class="chat-in"><textarea data-in rows="1" placeholder="Écris ici…"></textarea><button data-send>➤</button></div>
    <div class="row mt" style="justify-content:flex-end"><button class="btn sm ghost" data-clear>Effacer la conversation</button></div>`;
  const ta = root.querySelector('[data-in]');
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; });
  const send = async text => {
    text = (text || '').trim(); if (!text) return;
    const chat = root.querySelector('#chat');
    const h = aiHistory(); h.push({ role: 'user', content: text }); aiSave(h);
    chat.insertAdjacentHTML('beforeend', `<div class="bubble me">${esc(text)}</div><div class="bubble ai" data-wait>…</div>`);
    ta.value = ''; ta.style.height = 'auto';
    chat.lastElementChild.scrollIntoView({ block: 'end' });
    try {
      const r = await post({ what: 'ai', messages: h.slice(-16), context: aiContext() });
      const w = chat.querySelector('[data-wait]');
      if (!r.ok) { w.textContent = r.error === 'no key' ? 'Le Complice n\'est pas encore branché : ajoute une clé API Anthropic dans les réglages ⚙︎.' : 'Oups : ' + (r.error || 'erreur'); w.removeAttribute('data-wait'); return; }
      w.textContent = r.text; w.removeAttribute('data-wait');
      h.push({ role: 'assistant', content: r.text }); aiSave(h);
      chat.lastElementChild.scrollIntoView({ block: 'end' });
    } catch (e) { const w = chat.querySelector('[data-wait]'); if (w) { w.textContent = 'Pas de réseau ?'; w.removeAttribute('data-wait'); } }
  };
  root.querySelector('[data-send]').onclick = () => send(ta.value);
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(ta.value); } });
  root.querySelectorAll('[data-s]').forEach(b => b.onclick = () => send(b.dataset.s));
  root.querySelector('[data-clear]').onclick = () => { aiSave([]); render(); };
  setTimeout(() => { const c = root.querySelector('#chat'); if (c.lastElementChild) c.lastElementChild.scrollIntoView({ block: 'end' }); }, 50);
}
