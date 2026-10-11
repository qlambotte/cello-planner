/* Test de fumée : sert le site en local, ouvre Chromium et vérifie les parcours principaux.
   Lancer : npm install && npx playwright install chromium && npm test */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((q, s) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); s.end(d); });
});
const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); console.log((cond ? 'ok   ' : 'ÉCHEC ') + msg); };

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://localhost:' + server.address().port + '/index.html';
  const opts = { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] };
  if (process.env.CHROMIUM_PATH) opts.executablePath = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(opts);
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, serviceWorkers: 'block', permissions: ['microphone'] });
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.print = () => { window.__printed = document.getElementById('printArea').innerText.length; }; });
  await p.goto(url);

  // programme d'exemple, semaine courante, 30 min par défaut
  await p.evaluate(() => {
    const ws = lastWednesday(todayStr());
    state = normalize({ weekStart: ws, created: ws, defaultMinutes: 30, items: [
      { id: 'pc', kind: 'piece', title: 'Pièce', short: 'Pièce', tonic: 'Sol', weight: 3, passages: [
        { id: 'a', label: 'Passage 1', start: 'Ré3' }, { id: 'b', label: 'Passage 2' }, { id: 'c', label: 'En continu', whole: true }] },
      { id: 'et', kind: 'etude', title: 'Étude', short: 'Étude', tonic: 'Ré', weight: 2, tempo: 96, target: 120, stage: 'par4', passages: [{ id: 'e', label: 'Étude entière' }] },
      { id: 'me', kind: 'methode', title: 'Méthode', short: 'Méthode', weight: 2, passages: [{ id: 'm1', label: 'Page 1' }, { id: 'm2', label: 'Page 2' }] }],
      reading: [{ id: 'r1', label: 'Lecture A', done: false }, { id: 'r2', label: 'Lecture B', done: false }, { id: 'r3', label: 'Lecture C', done: false }] });
    save(); selDate = state.weekStart; render();
  });

  // 1. séances de 30 min : chaque jour totalise 30 min, structure attendue
  const plan = await p.evaluate(() => planWeek().map(P => ({ lesson: P.lesson, blocks: buildBlocks(P).map(b => b.id + ':' + b.min) })));
  plan.forEach((d, i) => check(d.blocks.reduce((a, x) => a + +x.split(':')[1], 0) === 30, 'jour ' + (i + 1) + ' : 30 min (' + d.blocks.join(' ') + ')'));
  check(plan[0].blocks.join(' ') === 'chant:3 lect:4 cible:12 sec:5 continu:5 clot:1', 'structure d’une séance de 30 min');

  // 2. lecture chantée : premier jour sur le passage, puis matériel neuf
  const lect1 = await p.evaluate(() => { const P = planWeek()[0]; return lectureSource(P, P.date); });
  check(lect1.first === true, 'jour 1 : première lecture du passage principal');
  await p.evaluate(() => { const ps = planWeek(); window.__d4 = ps.find((P, i) => i > 0 && !P.lesson && P.pr.id === 'pc').date; });
  const lect4 = await p.evaluate(() => { const P = planWeek().find(x => x.date === window.__d4); return lectureSource(P, P.date); });
  check(!!lect4.entry && lect4.label === 'Lecture A' || lect4.first, 'jour suivant : matériel de lecture neuf (ou nouveau passage)');

  // 3. cocher le travail ciblé suffit pour que la journée compte
  await p.evaluate(() => { tick('cible', state.weekStart, true); });
  check(await p.evaluate(() => isDone(state.logs[state.weekStart]) && !!state.logs[state.weekStart].snap), 'journée comptée dès le travail ciblé coché');
  await p.evaluate(() => { tick('lect', state.weekStart, true); });
  check(await p.evaluate(() => state.logs[state.weekStart].mins === 16), 'minutes jouées = blocs cochés (12 + 4)');

  // 4. chrono et séance guidée
  await p.evaluate(() => openDay(addDays(state.weekStart, 1)));
  check(await p.locator('.prow').count() === 6, 'aperçu : une ligne par phase');
  await p.evaluate(() => gotoBlock('chant'));
  check(await p.locator('.chrono').count() === 1 && await p.locator('.phase .block').count() === 1, 'une seule phase affichée, avec son chrono');
  await p.evaluate(() => gotoPhase(0));
  await p.click('#guideBtn');
  await p.evaluate(() => { TM.end = Date.now() + 200; });
  await p.waitForTimeout(800);
  check(await p.evaluate(() => state.logs[addDays(state.weekStart, 1)].done.chant === true && TM && TM.bid) === 'lect' && await p.locator('#blk-lect').count() === 1, 'séance guidée : phase cochée puis phase suivante affichée et lancée');
  await p.evaluate(() => resetChrono());

  // 5. son : bourdon, note de départ, diapason ; changer d'onglet du navigateur ne coupe pas le bourdon
  await p.evaluate(() => gotoBlock('lect'));
  await p.click('#droneBtn-b');
  await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  check(await p.evaluate(() => !!drone), 'bourdon toujours actif après un changement de visibilité');
  await p.click('#droneBtn-b');
  await p.evaluate(() => gotoBlock('chant'));
  check(await p.locator('#tonicSel-a').isVisible() === false, 'réglages du bourdon repliés par défaut');
  await p.click('#tab-week'); await p.selectOption('#diapSel-w', '442');
  check(await p.evaluate(() => Math.round(midiFreq(57) * 10) / 10) === 221, 'diapason 442 → la de la corde à vide à 221 Hz');
  await p.evaluate(() => openDay(addDays(state.weekStart, 1)));
  const pitch = await p.evaluate(() => [98, 196, 440].map(f => { const sr = 48000, b = new Float32Array(4096); for (let i = 0; i < 4096; i++) { let v = 0; for (let k = 1; k <= 6; k++) v += Math.sin(2 * Math.PI * f * k * i / sr) / k; b[i] = .2 * v; } return Math.round(detectPitch(b, sr)); }));
  check(pitch.join() === '98,196,440', 'détection de hauteur sur sons de synthèse : ' + pitch.join(', '));

  // 6. micro et enregistrement (périphérique simulé)
  await p.evaluate(() => gotoBlock('lect'));
  await p.click('#blk-lect details:has(#micBtn) summary');
  await p.click('#micBtn'); await p.waitForTimeout(600); await p.click('#micBtn');
  await p.evaluate(() => gotoBlock('continu'));
  await p.click('#recBtn-continu'); await p.waitForTimeout(1200); await p.evaluate(() => gotoBlock('continu'));
  await p.click('#recBtn-continu');
  await p.waitForSelector('#aud-continu', { timeout: 5000 }).then(() => check(true, 'enregistrement puis lecteur audio'), () => check(false, 'enregistrement puis lecteur audio'));

  // 6 bis. bilan intégré au dernier bloc, statut de la journée
  await p.evaluate(() => gotoBlock('clot'));
  check(await p.locator('#blk-clot #r-co').count() === 1 && await p.locator('#finishBtn').count() === 0, 'bilan dans le dernier bloc, plus de bouton « Terminer »');
  await p.evaluate(() => tick('cible', addDays(state.weekStart, 1), true));
  check((await p.innerText('#dayStatus')).startsWith('Séance comptée'), 'statut : séance comptée dès le travail ciblé coché');
  const words = await p.evaluate(() => { let t = ''; for (const k of ['today', 'week', 'prog']) { tab = k; render(); t += document.getElementById('app').innerText; } tab = 'today'; render(); return t; });
  check(!/Poids|Principal|Reprise ·|Avant le début/.test(words), 'plus de vocabulaire interne');

  // 6 ter. outils : roulettes, accordeur, ajout de temps
  await p.setViewportSize({ width: 1180, height: 820 });
  await p.click('#mwSvg', { position: { x: 120, y: 120 } });
  check(await p.evaluate(() => !!metroT && !M.ramp), 'roulette du métronome : un tap démarre');
  const b0 = await p.evaluate(() => MT.bpm);
  await p.hover('#mwSvg'); await p.mouse.wheel(0, -100);
  check(await p.evaluate(b => MT.bpm === b + 1 && M.bpm === b + 1, b0), 'roulette du métronome : le tempo change en direct');
  await p.click('#mwSvg', { position: { x: 120, y: 120 } });
  check(await p.evaluate(() => !metroT), 'roulette du métronome : un tap arrête');
  await p.click('#ds-7');
  check(await p.evaluate(() => drone && drone.slot === 'w' && drone.ton === 'Sol'), 'roulette du bourdon : un secteur lance le bourdon');
  await p.evaluate(() => { tab = 'week'; render(); });
  check(await p.evaluate(() => !!drone), 'le bourdon continue quand on change d’écran');
  await p.click('#ds-7');
  check(await p.evaluate(() => !drone), 'roulette du bourdon : un second clic l’arrête');
  await p.click('#tuBtn'); await p.waitForTimeout(500);
  check(await p.evaluate(() => !!TU), 'accordeur : écoute démarrée');
  await p.click('#tuBtn'); await p.click('#tuClose');
  check(await p.locator('#tl-tuner .tbody').isVisible() === false, 'accordeur : se ferme');
  await p.click('#tuOpen');
  await p.setViewportSize({ width: 820, height: 1180 });
  check(await p.locator('#tl-metro').isVisible() === false && await p.locator('.ticon').count() === 3, 'portrait : trois icônes, outil replié');
  await p.click('#ti-metro');
  check(await p.locator('#tl-metro').isVisible(), 'portrait : l’icône ouvre l’outil');
  await p.click('#ti-metro');
  await p.evaluate(() => { tab = 'today'; selDate = addDays(state.weekStart, 2); render(); });
  const m0 = await p.evaluate(() => planWeek()[2].minutes);
  await p.evaluate(() => { tick('cible', selDate, true); tick('clot', selDate, true); });
  await p.click('#addTime');
  check(await p.evaluate(m => planWeek()[2].minutes === m + 15 && state.logs[selDate].done.cible === true && !state.logs[selDate].done.clot, m0), 'temps ajouté dans la journée : le travail déjà coché est gardé');

  // 7. impression, onglets
  await p.click('#tab-week'); await p.click('#printWeekBtn');
  check(await p.evaluate(() => window.__printed > 1000), 'impression de la semaine');
  await p.click('#tab-stats'); await p.click('#tab-prog');
  check(await p.locator('.rrow').count() === 3, 'liste de lecture affichée dans Programme');
  fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
  await p.screenshot({ path: path.join(__dirname, 'shots', 'programme.png'), fullPage: true });

  // 8. assistant de nouvelle semaine
  const ws0 = await p.evaluate(() => state.weekStart);
  await p.click('#tab-week'); await p.click('#newWeekBtn');
  await p.click('#wz-pc-new'); await p.fill('#wz-pc-t', 'Nouvelle pièce'); await p.fill('#wz-pc-0-l', 'Mesures 1 à 16'); await p.fill('#wz-pc-0-h', 'Lent, sans vibrato');
  await p.click('#wz-pc-more'); await p.fill('#wz-pc-1-l', 'Mesures 17 à 32');
  await p.click('#wz-me-done');
  await p.click('#wzAddEtude'); await p.fill('#wza-0-t', 'Étude n° 16'); await p.fill('#wza-0-0-l', 'Étude entière');
  await p.click('#wzOk');
  const after = await p.evaluate(() => ({ ws: state.weekStart, items: state.items.map(i => i.title + ':' + i.passages.map(x => x.label).join('|')), how: state.items[0].passages[0].how, tab }));
  check(after.ws === await p.evaluate(w => addDays(w, 7), ws0) || after.ws > ws0, 'assistant : semaine suivante démarrée');
  check(after.items.join(' / ') === 'Nouvelle pièce:Mesures 1 à 16|Mesures 17 à 32 / Étude:Étude entière / Étude n° 16:Étude entière', 'assistant : éléments mis à jour (' + after.items.join(' / ') + ')');
  check(after.how === 'Lent, sans vibrato' && after.tab === 'today', 'assistant : consigne reprise et retour au jour');

  // 8 bis. saisie rapide : texte libre, préremplissage
  await p.evaluate(() => { state.items[0].title = 'Pièce Matz'; state.items[1].title = 'Étude Dotzauer'; state.items[1].short = ''; state.items[0].short = ''; });
  await p.click('#tab-week'); await p.click('#newWeekBtn');
  check(await p.inputValue('#wz-et-0-l') === 'Étude entière', 'assistant : fiches préremplies avec la semaine en cours');
  await p.fill('#wzText', 'Blabla sans rapport\nDotzauer lié par 12, croche = 104\nMatz mes. 5 à 12 à ♩ = 80 sans vibrato');
  await p.click('#wzParse');
  check(await p.inputValue('#wz-et-et') === '104', 'texte libre : tempo de l’étude reconnu');
  check(await p.inputValue('#wz-et-es') === 'lie12', 'texte libre : étape « lié par 12 » reconnue');
  check(await p.inputValue('#wz-' + (await p.evaluate(() => state.items[0].id)) + '-0-b') === '5 à 12', 'texte libre : mesures reconnues');
  check((await p.inputValue('#wz-' + (await p.evaluate(() => state.items[0].id)) + '-0-tp')) === '♩ = 80', 'texte libre : tempo reconnu');
  check((await p.innerText('.banner')).includes('Blabla'), 'texte libre : ligne non reconnue signalée');
  await p.click('#wzOk');
  check(await p.evaluate(() => state.items[1].tempo === 104 && state.items[1].stage === 'lie12' && state.items[0].passages[0].bars === '5 à 12'), 'texte libre : appliqué à la semaine');

  check(errs.length === 0, 'aucune erreur dans la console' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await browser.close(); server.close();
  console.log(fails.length ? '\n' + fails.length + ' échec(s)' : '\nTout est passé.');
  process.exit(fails.length ? 1 : 0);
})();
