/* Nous · visite guidée (onboarding) */
const NTFY_DEFAULT = { alex: 'nous-alex-9dafeb', manon: 'nous-manon-e89df3' };
function tourSlides() {
  const me = myName(), you = yourName();
  return [
    { ico: '💛', t: `Bienvenue ${esc(me)}`, h: `<p>Ceci est votre appli à deux, rien qu'à vous. Pas de compte, pas de réseau, pas de pub : juste ${esc(me)} et ${esc(you)}.</p><p class="mt">Une règle : <b>l'appli ne dicte rien</b>. Elle ne rappelle pas de faire une attention, elle ne note personne. Tout ce qui compte, c'est vous qui le faites. Elle sert juste de terrain de jeu.</p>` },
    { ico: '🏡', t: 'Accueil', h: `<ul><li><b>Compte à rebours</b> avant vos prochaines retrouvailles, avec la liste des envies pour ces jours-là.</li><li><b>Je pense à toi</b> : une touche, et ${esc(you)} reçoit une notif de toi. Zéro texte.</li><li><b>Question du jour</b> : la même pour vous deux, les réponses ne se dévoilent que quand les deux ont répondu.</li><li><b>Photo du jour</b> : une photo chacun, sans filtre.</li><li><b>Citation du jour</b> : une pensée philosophique et une question, pour échanger si vous en avez envie.</li><li><b>Ton nombre du jour</b> (numérologie) et un <b>souvenir</b> qui remonte du passé.</li></ul>` },
    { ico: '💞', t: 'À deux', h: `<ul><li><b>Photos</b> : vos photos du jour et un album commun.</li><li><b>Ciné</b> : vous lancez le même film chacun de votre côté, l'appli donne le top départ et un fil de réactions en direct.</li><li><b>Envies</b> : tu swipes des idées (sorties, voyages, projets, intime…), 2 oui par jour max. Les <b>matchs</b> n'apparaissent que si vous avez dit oui tous les deux, sans voir ce que l'autre a swipé.</li><li><b>Souhaits</b> : restos, voyages, films, cadeaux, pour ne rien oublier.</li><li><b>Coupons</b> : des bons à offrir et à encaisser à la prochaine visite. Que du temps et des gestes, jamais d'argent.</li></ul>` },
    { ico: '🎲', t: 'Jeux', h: `<ul><li><b>Anglais</b> à deux : un mot par jour, une phrase à écrire, des quiz express, des XP et des niveaux. Vous progressez côte à côte.</li><li><b>Quiz</b> chaque semaine : 5 questions, tu réponds pour toi et tu devines pour ${esc(you)}. Puis chacun valide les devinettes de l'autre. Qui connaît le mieux qui ?</li><li><b>Défi</b> de la semaine, à relever chacun avec une photo ou un mot.</li><li><b>Devine</b> : tu réponds à une question intime, ${esc(you)} devine ta réponse, on compare, on en parle.</li><li><b>Roue</b> de la vie : chaque mois, tes 8 domaines notés sur 10, superposés à ceux de ${esc(you)}.</li><li><b>Ligne de vie</b> : ton histoire par épisodes, l'autre pose une question par épisode.</li></ul>` },
    { ico: '💌', t: 'Nous', h: `<ul><li><b>Check-in</b> du dimanche : 5 questions et une note de la semaine, dévoilées quand les deux ont répondu.</li><li><b>Humeur</b> : ton journal, pour toi. Tu choisis ce que tu montres à ${esc(you)}.</li><li><b>Lettres</b> : tu écris maintenant, ${esc(you)} lit à la date que tu choisis.</li><li><b>Capsules</b> temporelles : photos et mots scellés jusqu'à une date. Le jour J, ça s'ouvre pour vous deux.</li><li><b>Idées</b> : la boîte à idées pour l'appli ou pour vous deux.</li></ul>` },
    { ico: '✨', t: 'Complice', h: `<p>Un espace privé pour <b>prendre du recul</b> : une émotion qui déborde, la distance qui pèse, une tension, un doute, une joie à savourer.</p><p class="mt">Il écoute, t'aide à nommer ce qui se passe et pose une bonne question. Il ne juge personne et ne décide rien à ta place. ${esc(you)} ne saura jamais que tu es passé·e ici : tout reste dans ton téléphone.</p>` },
    { ico: '📱', t: 'Sur ton écran d\'accueil', h: `<p>Pour que ça ressemble à une vraie appli :</p><ol><li>Dans <b>Safari</b>, touche le bouton <b>Partager</b> (le carré avec la flèche).</li><li>Choisis <b>« Sur l'écran d'accueil »</b>.</li><li>Ouvre <b>Nous</b> depuis l'icône, comme n'importe quelle appli.</li><li>Active les <b>notifications</b> (carte sur l'accueil ou ⚙︎) : tu sauras quand ${esc(you)} pense à toi ou remplit quelque chose. Jamais de rappel de l'appli.</li></ol><p class="small muted mt">Sur Android : menu ⋮ de Chrome → « Ajouter à l'écran d'accueil ».</p>` },
    { ico: '🚀', t: 'C\'est parti', h: `<p>Commence par répondre à la <b>question du jour</b> et envoie un <b>« je pense à toi »</b> à ${esc(you)}.</p><p class="mt">Dans ⚙︎ tu peux aussi définir un code pour protéger ton profil (demandé seulement si quelqu'un essaie d'ouvrir ton compte), et revoir cette visite quand tu veux.</p>` },
  ];
}
function showTour(onDone) {
  const slides = tourSlides();
  let i = 0;
  const root = document.getElementById('sheet-root');
  const el = h(`<div class="tour"><button class="skip" data-skip>Passer</button><div class="tour-body"></div><div class="tour-foot"><div class="dots"></div><button class="btn p" data-next>Suivant</button></div></div>`).firstChild;
  root.innerHTML = ''; root.appendChild(el); document.body.style.overflow = 'hidden';
  const done = () => { root.innerHTML = ''; document.body.style.overflow = ''; localStorage.setItem('nous-tour', '1'); if (onDone) onDone(); };
  const draw = () => {
    const s = slides[i];
    el.querySelector('.tour-body').innerHTML = `<div class="tour-slide"><div class="tour-ico">${s.ico}</div><h1>${s.t}</h1><div class="tour-txt">${s.h}</div></div>`;
    el.querySelector('.dots').innerHTML = slides.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('');
    el.querySelector('[data-next]').textContent = i === slides.length - 1 ? 'Commencer 💛' : 'Suivant';
    const cp = el.querySelector('[data-copy]'); if (cp) cp.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(cp.dataset.copy).then(() => toast('Copié ✓')).catch(() => toast('Sélectionne et copie le texte')); };
    el.querySelector('.tour-body').scrollTop = 0;
  };
  el.querySelector('[data-next]').onclick = () => { if (i < slides.length - 1) { i++; draw(); } else done(); };
  el.querySelector('[data-skip]').onclick = done;
  let x0 = null;
  el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  el.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (dx < -60 && i < slides.length - 1) { i++; draw(); } else if (dx > 60 && i > 0) { i--; draw(); } });
  draw();
}
