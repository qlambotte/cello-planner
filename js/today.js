/* ---------- aujourd’hui : séance du jour, blocs, bilan, impression ---------- */
/* une séance = une suite de phases ; on en voit une à la fois. Phase 0 : aperçu et temps disponible. */
let PH={date:null,i:0};
const PHASE_NAMES={chant:'Oreille',lect:'Lecture chantée',cible:'Travail ciblé',rep:'Révision',dechiff:'Déchiffrage',continu:'En continu',enreg:'Enregistrement',repet:'Répétition',clot:'Bilan'};
function phaseTitle(b){return b.type==='rep'&&b.it?PHASE_NAMES.rep+' · '+name(b.it):PHASE_NAMES[b.type]||b.type}
function gotoPhase(i){PH.i=i;guidedFollow(i);render();window.scrollTo(0,0)}
function gotoBlock(bid){
  if(!PH.date)return;
  const idx=daysBetween(state.weekStart,PH.date);if(idx<0||idx>6)return;
  const k=buildBlocks(planWeek()[idx]).findIndex(b=>b.id===bid);
  if(k>=0&&tab==='today'){PH.i=k+1;render();window.scrollTo(0,0)}
}
/* ajouter du temps le même jour (ex. 15 min le matin, 15 min de plus le soir) */
function addTime(date,v){
  const idx=daysBetween(state.weekStart,date),P=planWeek()[idx],l=logOf(date);
  if(!state.perDay)state.perDay={};
  state.perDay[date]=P.minutes+v;
  if(l.snap)l.snap.minutes=P.minutes+v;
  delete l.done.clot;delete l.finished;recalcMins(date);
  save();render();window.scrollTo(0,0);
}
function renderToday(){
  const plans=planWeek();
  if(!plans.length)return '<div class="empty"><p>Ajoute au moins un élément dans l’onglet Programme.</p><button class="btn" onclick="go(\'prog\')">Ouvrir le programme</button></div>';
  const today=todayStr(),end=addDays(state.weekStart,6);
  let date=selDate||today,banner='';
  if(!selDate&&today>end){
    date=end;
    banner='<div class="banner"><p>La semaine du '+esc(fmtLong(state.weekStart))+' est terminée.</p><button class="btn small" onclick="openWizard()">Préparer la semaine suivante</button></div>';
  }
  if(date<state.weekStart)date=state.weekStart; if(date>end)date=end;
  const P=plans[daysBetween(state.weekStart,date)];
  const log=(state.logs&&state.logs[date])||{};
  const blocks=buildBlocks(P),done=log.done||{};
  if(PH.date!==date){PH={date,i:0}}
  const n=blocks.length,i=Math.max(0,Math.min(n,PH.i));PH.i=i;
  let h=banner+backupBanner();
  h+='<div class="phbar" role="group" aria-label="Phases de la séance"><button class="seg'+(i===0?' cur':'')+'" id="seg-0" onclick="gotoPhase(0)">Aperçu</button>'
    +blocks.map((b,k)=>'<button class="seg'+(done[b.id]?' on':'')+(i===k+1?' cur':'')+'" id="seg-'+b.id+'" style="flex:'+b.min+'" onclick="gotoPhase('+(k+1)+')" aria-label="'+esc(phaseTitle(b))+'">'+b.min+'</button>').join('')+'</div>';
  h+='<div class="phase">';
  if(i===0)h+=overviewHtml(P,blocks,done,date,log);
  else h+='<p class="eyebrow">Phase '+i+' sur '+n+' · '+esc(fmtShort(date))+'</p><ol class="blocks">'+blockHtml(blocks[i-1],P,done,date)+'</ol>';
  h+='</div>';
  h+='<nav class="phnav" aria-label="Navigation entre les phases"><button class="arrow" id="phPrev" onclick="gotoPhase('+(i-1)+')"'+(i===0?' disabled':'')+' aria-label="Phase précédente">‹</button>'
    +'<span class="phlbl">'+(i===0?'Aperçu de la séance':esc(phaseTitle(blocks[i-1])))+'</span>'
    +'<button class="arrow" id="phNext" onclick="gotoPhase('+(i+1)+')"'+(i===n?' disabled':'')+' aria-label="Phase suivante">›</button></nav>';
  return h;
}
function overviewHtml(P,blocks,done,date,log){
  const end=addDays(state.weekStart,6),toLesson=daysBetween(date,end),total=blocks.reduce((a,b)=>a+b.min,0);
  const doneMin=blocks.filter(b=>done[b.id]).reduce((a,b)=>a+b.min,0);
  let h='<div class="dayhead"><div><p class="eyebrow">Jour '+(P.k+1)+' sur 7 · '+(P.lesson?'jour de cours':toLesson===1?'cours demain':'cours dans '+toLesson+' jours')+'</p><h2>'+esc(fmtLong(date))+'</h2></div></div>';
  h+='<p class="eyebrow" id="minlbl" >Temps disponible</p><div class="chips" role="group" aria-labelledby="minlbl">'+[15,20,25,30,45,60].map(v=>'<button class="chip" id="min-'+v+'" aria-pressed="'+(P.minutes===v)+'" onclick="setMin(\''+date+'\','+v+')">'+v+' min</button>').join('')+'</div>';
  h+='<div class="btnrow" style="margin-top:10px;margin-bottom:6px"><button class="btn ghost small" id="addTime" onclick="addTime(\''+date+'\',15)">+ 15 min plus tard dans la journée</button></div>';
  if(doneMin)h+='<p class="sub" style="margin-bottom:8px">Déjà fait aujourd’hui : '+doneMin+' min sur '+total+'. Ajouter du temps garde ce qui est coché et ajoute des phases à la suite.</p>';
  h+='<div style="height:10px"></div>';
  h+=focusHtml(P);
  h+='<ol class="plist">'+blocks.map((b,k)=>'<li><button class="prow'+(done[b.id]?' on':'')+'" id="pr-'+b.id+'" onclick="gotoPhase('+(k+1)+')"><span class="pn">'+(done[b.id]?'✓':(k+1))+'</span><span class="pt">'+esc(phaseTitle(b))+'</span><span class="pm">'+b.min+' min</span></button></li>').join('')+'</ol>';
  h+='<div class="guide" style="margin-top:14px"><button class="btn" id="guideBtn" onclick="toggleGuided(\''+date+'\')">Démarrer la séance guidée</button><span class="sub">Les chronos s’enchaînent, chaque phase est cochée à la fin. L’écran reste allumé.</span></div>';
  h+='<div style="margin-top:14px"><button class="btn ghost small" id="printDay" onclick="printDays([\''+date+'\'])">Imprimer la fiche du jour</button></div>';
  return h;
}
function focusHtml(P){
  if(P.lesson)return '<p class="focus">Avant le cours : tu repasses ce que tu vas montrer.</p>';
  return '<p class="focus">Au programme : <strong>'+esc(refText(P.pr,P.pass))+'</strong>'
    +(P.sec&&P.minutes>=20?' · révision : '+esc(refText(P.sec,P.spass)):'')
    +(P.missed&&!PRINT?' <span class="tag warn">jour manqué, reporté</span>':'')+'</p>';
}
function printDays(dates){
  const plans=planWeek();PRINT=true;
  let h='<h1>Planner violoncelle · semaine du '+esc(fmtLong(state.weekStart))+'</h1>';
  dates.forEach(d=>{
    const P=plans[daysBetween(state.weekStart,d)],blocks=buildBlocks(P);
    h+='<section class="pday"><div class="pdh"><h2>'+esc(fmtLong(d))+'</h2><span class="min">'+blocks.reduce((a,x)=>a+x.min,0)+' min</span></div>'+focusHtml(P)
      +'<ol class="blocks">'+blocks.map(x=>blockHtml(x,P,{},d)).join('')+'</ol></section>';
  });
  PRINT=false;
  document.getElementById('printArea').innerHTML=h;
  window.print();
}
window.addEventListener('afterprint',()=>{const pa=document.getElementById('printArea');if(pa)pa.innerHTML=''});
function setMin(d,v){
  if(!state.perDay)state.perDay={};
  if(v===(state.defaultMinutes||15))delete state.perDay[d];else state.perDay[d]=v;
  const sl=state.logs&&state.logs[d];if(sl&&sl.snap)sl.snap.minutes=v;
  resetChrono();save();render();
}

/* ce que la lecture chantée et le déchiffrage proposent ce jour-là */
function lectureSource(P,date){
  const l=(state.logs&&state.logs[date])||{},R=state.reading||[];
  if(P.passFirst&&P.pass)return {first:true,label:refText(P.pr,P.pass)};
  let e=l.readId?R.find(r=>r.id===l.readId):null;
  if(!e)e=R.find(r=>!r.done&&r.id!==l.decId);
  return e?{entry:e,label:e.label}:{fallback:true,label:refText(P.pr,P.pass)};
}
function dechiffSource(P,date){
  const l=(state.logs&&state.logs[date])||{},R=state.reading||[];
  if(l.decId){const e=R.find(r=>r.id===l.decId);if(e)return e}
  const L=lectureSource(P,date),ex=L.entry?L.entry.id:null;
  return R.find(r=>!r.done&&r.id!==ex)||null;
}
function tonicFor(P){
  const c=[P.pr,P.sec,P.ter].filter(Boolean).concat(state.items);
  for(const it of c){if(it.tonic)return it}
  return null;
}

/* un bloc de séance */
function blockHtml(b,P,done,date){
  const d=!!done[b.id];
  let title='',body='';
  if(b.type==='chant'){
    const it=P.lesson?(wholePassage()[0]):tonicFor(P),ton=(it&&it.tonic)||'Sol';
    title='Oreille : gamme chantée sur bourdon';
    body='<p>Chante la gamme en montant puis en descendant, en nommant les notes. Joue-la ensuite et ajuste chaque note contre le bourdon. Termine par l’arpège (1-3-5-8).</p>'
      +(it&&it.key?'<p class="sub">Tonalité : '+esc(it.key)+' ('+esc(name(it))+')</p>':'')
      +(b.min>=8?'<p>Ajoute les intervalles : depuis la tonique, chante une tierce, une quinte, une octave, puis vérifie sur l’instrument.</p>':'')
      +(PRINT?'<p>Bourdon sur <strong>'+esc(ton)+'</strong></p>'
        :droneTools('a',ton,''));
  }else if(b.type==='lect'){
    title='Lecture chantée';
    const L=lectureSource(P,date),tf=tonicFor(P),dflt=(P.pr&&P.pr.tonic)||(tf&&tf.tonic)||'Sol';
    const tonL=L.entry?(L.entry.tonic||dflt):((P.pass&&P.pass.tonic)||dflt);
    const sm=L.entry?null:(P.pass?parseNote(P.pass.start):null);
    body=(L.entry?'<p class="sub">Passage jamais joué : c’est la démarche qui compte, pas le résultat.</p>'
        :L.first?'<p class="sub">Première lecture de ce passage. Les jours suivants, la lecture portera sur du neuf.</p>'
        :'<p class="todo">Plus de passages à lire : ajoutes-en dans Programme. En attendant, relis le passage du jour.</p>')
      +'<ol><li>Regarde <strong>'+esc(L.label)+'</strong> sans jouer : tonalité, premier degré, allure de la mélodie.</li>'
      +'<li>'+(sm!==null?'Lance le bourdon et écoute la note de départ.':'Lance le bourdon sur la tonique du passage.')+'</li>'
      +'<li>Chante 2 à 4 mesures en nommant les notes, ou sur « la ».</li>'
      +'<li>Joue ce que tu as chanté. La voix et le violoncelle disent-ils la même chose ? Corrige en réécoutant.</li></ol>';
    if(PRINT)body+='<p>Bourdon sur <strong>'+esc(tonL)+'</strong>'+(sm!==null?' · note de départ : <strong>'+esc(midiName(sm))+'</strong>':'')+'</p>';
    else{
      body+=droneTools('b',tonL,sm!==null?'<button class="btn ghost small" id="startBtn" onclick="playMidi('+sm+',2)">▶ Note de départ ('+esc(midiName(sm))+')</button>':'');
      body+=voiceHtml();
    }
  }else if(b.type==='cible'){
    title='Travail ciblé · '+esc(name(P.pr));
    body=cibleHtml(b,P,date);
  }else if(b.type==='rep'){
    title='Révision · '+esc(name(b.it));
    body='<p><strong>'+esc(b.p?b.p.label+(b.p.bars?' ('+b.p.bars+')':''):'')+'</strong></p>'+consigneHtml(b.p);
  }else if(b.type==='dechiff'){
    title='Déchiffrage';
    const e=dechiffSource(P,date);
    body=(e?'<p><strong>'+esc(e.label)+'</strong></p>':'')+'<p>Un passage jamais vu, plus facile que ton programme. Une ou deux lignes, sans t’arrêter. Avant de jouer, chante la première phrase.</p>'
      +(e?'':'<p class="sub">Ajoute des passages à lire dans Programme pour qu’un passage soit proposé ici.</p>');
  }else if(b.type==='continu'){
    const [it,p]=wholePassage();
    title='Jouer d’une traite';
    body='<p><strong>'+esc(refText(it,p))+'</strong></p><p>Au tempo indiqué, sans t’arrêter, même avec des erreurs. Repère l’endroit où tu aurais voulu t’arrêter.</p>'+(PRINT?'':'<div id="rec-'+b.id+'">'+recHtml(b.id)+'</div>');
  }else if(b.type==='enreg'){
    const [it,p]=wholePassage();
    title='Enregistrement';
    body='<p>Enregistre-toi sur <strong>'+esc(refText(it,p))+'</strong>. Réécoute en suivant la partition et note deux écarts de justesse ou de rythme.</p>'+(PRINT?'':'<div id="rec-'+b.id+'">'+recHtml(b.id)+'</div>');
  }else if(b.type==='repet'){
    title='Répétition avant le cours';
    const its=P.items||state.items,per=Math.max(3,Math.floor(b.min/Math.max(1,its.length)));
    body='<p>Joue dans l’ordre ce que tu vas montrer, une fois chacun, comme au cours.</p><ol>'
      +its.map(it=>{const w=(it.passages||[]).find(p=>p.whole)||(it.passages||[])[0];
        return '<li><strong>'+esc(refText(it,w))+'</strong> · environ '+per+' min'+(it.kind==='etude'&&it.tempo?' · croche = '+it.tempo:'')+'</li>'}).join('')+'</ol>';
  }else if(b.type==='clot'){
    title='Bilan';
    body=bilanHtml(P,date);
  }
  const mark=PRINT?'<span class="box"></span>':'<label class="chk"><input type="checkbox" id="chk-'+b.id+'"'+(d?' checked':'')+' onchange="tick(\''+b.id+'\',\''+date+'\',this.checked)" aria-label="Fait : '+esc(title.replace(/<[^>]+>/g,''))+'"><span></span></label>';
  const time=PRINT?'<span class="min">'+b.min+' min</span>'
    :'<span class="tm"><button class="chrono" id="tm-'+b.id+'" data-bid="'+b.id+'" data-min="'+b.min+'" data-date="'+date+'" onclick="chrono(\''+b.id+'\',\''+date+'\')" aria-label="Chrono de '+b.min+' minutes">▶ '+b.min+':00</button><button class="tmreset" id="tr-'+b.id+'" hidden onclick="resetChrono()" aria-label="Remettre le chrono à zéro">↺</button></span>';
  return '<li class="block'+(d?' done':'')+'"'+(PRINT?'':' id="blk-'+b.id+'"')+'>'+mark
    +'<div class="bbody"><div class="bhead"><h3>'+title+'</h3>'+time+'</div>'+body+'</div></li>';
}
function consigneHtml(p){
  if(!p)return '<p class="todo">Aucun passage défini.</p>';
  return p.how?'<div class="consigne">'+esc(p.how).replace(/\n/g,'<br>')+'</div>':'<p class="todo">Consigne de la prof à compléter dans Programme.</p>';
}

/* bilan : remplace l'ancien « Terminer la séance » ; tout est enregistré au fil de l'eau */
function bilanHtml(P,date){
  const log=(state.logs&&state.logs[date])||{},r=log.rating||'ok';
  if(PRINT){
    let h=P.lesson?'<p class="sub">Consignes reçues au cours :</p>':'<p><span class="box"></span> ça passe <span class="box"></span> ça coince</p>';
    return h+'<div class="pnote"></div>';
  }
  let h='';
  if(P.lesson){
    h+='<div class="fld"><label for="lessonNote">Consignes reçues au cours</label><textarea id="lessonNote" oninput="state.lessonNote=this.value;save()">'+esc(state.lessonNote||'')+'</textarea></div>'
      +'<div><button class="btn small" id="wizFromLesson" onclick="openWizard()">Préparer la semaine suivante</button></div>';
    return h;
  }
  if(P.pr)h+='<p>Le passage du jour :</p><div class="chips" role="group" aria-label="Le passage du jour"><button class="chip" id="r-ok" aria-pressed="'+(r==='ok')+'" onclick="setRating(\''+date+'\',\'ok\')">Ça passe</button><button class="chip" id="r-co" aria-pressed="'+(r==='coince')+'" onclick="setRating(\''+date+'\',\'coince\')">Ça coince</button></div>'
    +'<p class="sub">« Ça coince » ramène ce passage à la prochaine séance de '+esc(name(P.pr))+'.</p>';
  h+='<div class="fld"><label for="note">Ce qui a coincé, en une ligne</label><textarea id="note" oninput="setNote(\''+date+'\',this.value)">'+esc(log.note||'')+'</textarea></div>';
  h+='<p class="sub" id="dayStatus">'+dayStatusText(date)+'</p>';
  return h;
}
function dayStatusText(date){
  return isDone(state.logs&&state.logs[date])?'Séance comptée pour la semaine. Tout est enregistré.':'La séance comptera dès que le travail ciblé sera coché. Tout est enregistré au fur et à mesure.';
}

/* travail ciblé : passage, consigne, outils de tempo */
function cibleHtml(b,P,date){
  const it=P.pr,p=P.pass;let h='';
  if(!it)return '<p class="todo">Aucun élément.</p>';
  h+='<p><strong>'+esc(p?p.label:'')+'</strong>'+(p&&p.bars?' · '+esc(p.bars):(p&&it.kind!=='etude'?' · <span class="todo">mesures à préciser</span>':''))+(p&&p.tempo?' · '+esc(p.tempo):'')+'</p>';
  if(it.goal)h+='<p class="sub">Objectif : '+esc(it.goal)+'</p>';
  h+=consigneHtml(p);
  if(!PRINT&&!isDone(state.logs&&state.logs[date])){
    const cur=(P.chosen?it.id+'|'+(p?p.id:''):'auto');
    h+='<div class="fld pickf"><label for="pickSel">Morceau à travailler</label><select id="pickSel" onchange="pickPass(\''+date+'\',this.value)"><option value="auto"'+(cur==='auto'?' selected':'')+'>Choix automatique</option>'
      +state.items.map(x=>'<optgroup label="'+esc(x.title)+'">'+(x.passages||[]).map(q=>{const v=x.id+'|'+q.id;return '<option value="'+v+'"'+(cur===v?' selected':'')+'>'+esc(q.label)+(q.bars?' ('+esc(q.bars)+')':'')+'</option>'}).join('')+'</optgroup>').join('')+'</select></div>';
  }
  const fb=p?lastFeedback(it.id,p.id,date):null;
  if(fb)h+='<p class="sub">Dernière fois ('+esc(fmtShort(fb.d))+') : <span class="tag '+(fb.r==='coince'?'warn':'')+'">'+(fb.r==='coince'?'ça coinçait':'ça passait')+'</span>'+(fb.n?' « '+esc(fb.n)+' »':'')+'</p>';
  if(it.kind==='etude'){
    const t=it.tempo,tg=+it.target||120,pc=t?Math.min(100,Math.round(100*t/tg)):0,st=it.stage||'par4';
    const txt=st==='par4'
      ?'<p>Douze notes de suite, un coup d’archet pour 4 notes. Monte le tempo palier par palier tant que l’archet suit. Quand il ne peut plus aller assez vite, passe à l’étape 2.</p>'
      :'<p>Douze notes sur un seul coup d’archet. Reprends au tempo atteint, puis monte vers l’objectif : croche = '+tg+', davantage si possible.</p>';
    if(PRINT)return h+'<p><span class="tag">Étape '+(st==='par4'?'1 · par 4':'2 · lié par 12')+'</span></p>'+txt+'<p>Croche = <strong>'+(t||'____')+'</strong> (objectif '+tg+') · atteint aujourd’hui : ____</p>';
    h+='<div class="stage" role="group" aria-label="Étape"><button class="chip" id="st-1" aria-pressed="'+(st==='par4')+'" onclick="setStage(\''+it.id+'\',\'par4\')">Étape 1 · par 4</button><button class="chip" id="st-2" aria-pressed="'+(st==='lie12')+'" onclick="setStage(\''+it.id+'\',\'lie12\')">Étape 2 · lié par 12</button></div>';
    h+=txt;
    h+='<div class="tempo"><div class="fld"><label for="bpm">Croche =</label><input class="num" type="number" id="bpm" min="20" max="260" value="'+(t||'')+'" placeholder="—" oninput="setTempo(\''+it.id+'\',this.value)"></div>'
      +'<button class="btn ghost small" id="tm4" onclick="stepTempo(\''+it.id+'\',-4)">−4</button><button class="btn ghost small" id="tp4" onclick="stepTempo(\''+it.id+'\',4)">+4</button>'
      +'<div class="meter" role="img" aria-label="'+pc+' % de l’objectif"><i style="width:'+pc+'%"></i></div><span class="min">'+(t||'—')+' / '+tg+'</span>'
      +'<button class="btn small" id="metroBtn" onclick="toggleMetro(\''+it.id+'\')">▶ Métronome</button></div>';
    const R=state.ramp||{},rmax=R.max||tg;
    h+='<details class="adv"'+(R.on?' open':'')+'><summary>Montée automatique du tempo</summary>'
      +'<label class="sub" for="rampChk"><input type="checkbox" id="rampChk"'+(R.on?' checked':'')+' onchange="saveRamp()"> Activer pendant le métronome</label>'
      +'<div class="rampf"><span>+</span><input class="num" type="number" id="rampStep" min="1" max="20" value="'+(R.step||4)+'" oninput="saveRamp()" aria-label="Pas de montée">'
      +'<span>toutes les</span><input class="num" type="number" id="rampReps" min="1" max="20" value="'+(R.reps||4)+'" oninput="saveRamp()" aria-label="Répétitions par palier">'
      +'<span>répétitions de</span><input class="num" type="number" id="rampBeats" min="1" max="64" value="'+(R.per||12)+'" oninput="saveRamp()" aria-label="Croches par répétition">'
      +'<span>croches, jusqu’à</span><input class="num" type="number" id="rampMax" min="40" max="260" value="'+rmax+'" oninput="saveRamp()" aria-label="Tempo maximal"></div>'
      +'<p class="sub" id="rampInfo" aria-live="polite"></p></details>';
  }else if(!PRINT){
    const n=p?parseInt(String(p.tempo).replace(/\D+/g,' ').trim().split(' ').pop()):NaN;
    h+='<div class="tempo"><div class="fld"><label for="bpm">Métronome</label><input class="num" type="number" id="bpm" min="20" max="260" value="'+(isNaN(n)?60:n)+'"></div><button class="btn small" id="metroBtn" onclick="toggleMetro()">▶ Métronome</button></div>';
  }
  return h;
}
function pickPass(date,v){
  const l=logOf(date);
  if(v==='auto')delete l.pick;else{const a=v.split('|');l.pick={pr:a[0],pass:a[1]}}
  save();const keep=window.scrollY;render();window.scrollTo(0,keep);
}
function setStage(id,s){const it=itemOf(id);it.stage=s;save();const keep=window.scrollY;render();window.scrollTo(0,keep)}
function setTempo(id,v){
  const it=itemOf(id);it.tempo=v===''?null:Math.max(20,Math.min(260,+v));
  const l=state.logs&&state.logs[todayStr()];if(l&&l.snap&&l.snap.pr===id&&it.tempo)l.tempo=it.tempo;
  save();
  const m=document.querySelector('.tempo .min');if(m)m.textContent=(it.tempo||'—')+' / '+(+it.target||120);
  const bar=document.querySelector('.meter i');if(bar)bar.style.width=(it.tempo?Math.min(100,Math.round(100*it.tempo/(+it.target||120))):0)+'%';
  if(metroT){stopMetro();toggleMetro(id)}
}
function stepTempo(id,d){const it=itemOf(id);const v=Math.max(20,Math.min(260,(+it.tempo||60)+d));
  document.getElementById('bpm').value=v;setTempo(id,String(v))}

/* cocher un bloc : seule façon de valider (à la main, ou par la séance guidée) */
function tick(bid,date,on){
  const l=logOf(date);if(!l.done)l.done={};
  const idx=daysBetween(state.weekStart,date),P=idx>=0&&idx<7?planWeek()[idx]:null;
  if(P&&bid==='lect'){
    const L=lectureSource(P,date);
    if(on&&L.entry){L.entry.done=true;l.readId=L.entry.id}
    else if(!on&&l.readId){const e=(state.reading||[]).find(r=>r.id===l.readId);if(e)e.done=false;delete l.readId}
  }
  if(P&&bid==='dechiff'){
    const e=dechiffSource(P,date);
    if(on&&e){e.done=true;l.decId=e.id}
    else if(!on&&l.decId){const x=(state.reading||[]).find(r=>r.id===l.decId);if(x)x.done=false;delete l.decId}
  }
  l.done[bid]=on;
  if(P&&(bid==='cible'||bid==='repet')){
    if(on&&!l.snap){l.snap=snapOf(P);if(P.pr&&P.pr.kind==='etude'&&P.pr.tempo)l.tempo=P.pr.tempo}
    else if(!on&&!l.finished)delete l.snap;
  }
  recalcMins(date);save();
  const cb=document.getElementById('chk-'+bid);if(cb)cb.checked=on;
  const li=document.getElementById('blk-'+bid);if(li)li.classList.toggle('done',on);
  const sg=document.getElementById('seg-'+bid);if(sg)sg.classList.toggle('on',on);
  const st=document.getElementById('dayStatus');if(st)st.textContent=dayStatusText(date);
}
function recalcMins(date){
  const idx=daysBetween(state.weekStart,date);if(idx<0||idx>6)return;
  const l=logOf(date),bl=buildBlocks(planWeek()[idx]);
  l.mins=bl.filter(b=>l.done&&l.done[b.id]).reduce((a,b)=>a+b.min,0);
}
function logOf(date){if(!state.logs)state.logs={};return state.logs[date]||(state.logs[date]={done:{}})}
function setRating(d,v){logOf(d).rating=v;save();const a=document.getElementById('r-ok'),b=document.getElementById('r-co');
  if(a)a.setAttribute('aria-pressed',String(v==='ok'));if(b)b.setAttribute('aria-pressed',String(v==='coince'))}
function setNote(d,v){logOf(d).note=v;save()}
