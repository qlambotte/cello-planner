/* ---------- mode Lecture chantée : lire, écouter, reconnaître les degrés (sans instrument) ---------- */
const CH={ex:null,recent:[],timers:[],voices:[],deg:null,labels:false,revealed:false,touched:false,flag:''};
const CLEF_NAMES={bass:'Clé de fa',tenor:'Clé d’ut 4e ligne',treble:'Clé de sol'};
const LEV_PCS={1:[0,7,5],2:[0,7,5,2,10],3:[0,7,5,2,10,9,3],4:[0,1,2,3,4,5,6,7,8,9,10,11]};
function CS(){
  const c=state.chant=state.chant||{};
  const d={mode:'lire',clef:'bass',lev:1,x:4,y:2,ton:'rand',bpm:72};
  for(const k in d)if(c[k]===undefined)c[k]=d[k];
  return c;
}
const modeName=(pc,min)=>{const sp=(min?SP_MIN:SP_MAJ)[pc],n=FR_NOTE[LET.indexOf(sp[0])]+(sp[1]>0?'♯':sp[1]<0?'♭':'');return n+(min?' mineur':' majeur')};
function setCS(k,v){
  const c=CS();c[k]=(k==='x'||k==='y'||k==='lev'||k==='bpm')?+v:v;save();
  stopSeq();CH.ex=null;CH.deg=null;render();
}
function stepBpm(d){const c=CS();c.bpm=Math.max(40,Math.min(160,c.bpm+d));save();const e=document.getElementById('chBpm');if(e)e.textContent='♩ = '+c.bpm}

/* ---- choix de l'extrait ---- */
function pieces(){return CHANT.concat(customs())}
function singPool(){
  const c=CS(),out=[];
  pieces().forEach(p=>{for(let a=0;a+c.x<=p.bars.length;a+=c.x){if(p.nn&&p.nn.slice(a,a+c.x).reduce((s,v)=>s+v,0)<Math.max(3,c.x))continue;out.push({p,a,b:a+c.x})}});
  let pool=out.filter(w=>w.p.lev===c.lev);
  if(pool.length<4)pool=out.filter(w=>Math.abs(w.p.lev-c.lev)<=1);
  return pool.length?pool:out;
}
function pickTarget(p){
  const c=CS();let pc;
  if(c.ton==='rand'){const l=LEV_PCS[c.lev]||LEV_PCS[4];pc=l[Math.floor(Math.random()*l.length)]}
  else pc=PC[c.ton];
  const sp=(p.mode==='min'?SP_MIN:SP_MAJ)[pc];
  return {letter:sp[0],acc:sp[1],pc};
}
function newEx(){
  const c=CS();stopSeq();
  if(CH.ex&&CH.touched){const t=todayStr();if(!c.day||c.day.d!==t)c.day={d:t,n:0};c.day.n++;save()}
  const pool=singPool();let w,tries=0;
  do{w=pool[Math.floor(Math.random()*pool.length)];tries++}while(CH.recent.includes(w.p.id+w.a)&&tries<30);
  CH.recent.push(w.p.id+w.a);if(CH.recent.length>14)CH.recent.shift();
  const tg=pickTarget(w.p),model=buildModel(w.p,w.a,w.b,tg,c.clef);
  CH.ex={w,model,tg};CH.labels=false;CH.revealed=false;CH.touched=false;CH.flag='';
}

/* ---- sons ---- */
function stopSeq(){
  CH.timers.forEach(clearTimeout);CH.timers=[];
  CH.voices.forEach(v=>v.stop());CH.voices=[];
  document.querySelectorAll('.nt.on').forEach(e=>e.classList.remove('on'));
}
function playTonic(){
  if(!CH.ex)return;ctx();CH.touched=true;
  CH.voices.push(playMidi(CH.ex.model.refMidi,2.2));
}
function playEx(){
  if(!CH.ex)return;stopSeq();ctx();CH.touched=true;
  const c=CS(),m=CH.ex.model,sec=240/c.bpm;
  CH.voices.push(playMidi(m.refMidi,1.2));
  const off=1.6;
  const seq=[];m.notes.forEach(n=>{if(n.tied&&seq.length)seq[seq.length-1].dur+=n.dur;else seq.push({...n})});
  seq.forEach(n=>{
    const d=Math.max(.15,n.dur*sec*.95),at=off+n.start*sec;
    CH.voices.push(playMidi(n.midi,d,at));
    const id=n.nid;
    CH.timers.push(setTimeout(()=>{document.querySelectorAll('.nt.on').forEach(e=>e.classList.remove('on'));const e=document.getElementById(id);if(e)e.classList.add('on')},at*1000));
  });
  CH.timers.push(setTimeout(()=>document.querySelectorAll('.nt.on').forEach(e=>e.classList.remove('on')),(off+m.total*sec)*1000+200));
}
function toggleLabels(){CH.labels=!CH.labels;CH.touched=true;drawSing()}
function revealEx(){CH.revealed=true;CH.touched=true;render()}
function flagEx(){
  if(!CH.ex)return;const c=CS();(c.flags=c.flags||[]).push({id:CH.ex.w.p.id,a:CH.ex.w.a+1,b:CH.ex.w.b,d:todayStr()});
  CH.flag='Noté : '+CH.ex.w.p.t+', mesures '+(CH.ex.w.a+1)+' à '+CH.ex.w.b+'.';save();render();
}

/* ---- degrés ---- */
const SCALE={maj:[0,2,4,5,7,9,11],min:[0,2,3,5,7,8,10]};
function newDeg(silent){
  const c=CS();stopSeq();
  const l=LEV_PCS[c.lev]||LEV_PCS[4],pc=c.ton==='rand'?l[Math.floor(Math.random()*l.length)]:PC[c.ton];
  const mode=c.lev>=3&&Math.random()<.4?'min':'maj',sp=(mode==='min'?SP_MIN:SP_MAJ)[pc];
  const maxD=c.lev===1?5:7;let d;do{d=1+Math.floor(Math.random()*maxD)}while(CH.deg&&d===CH.deg.d&&maxD>1);
  const ref=48+pc+(pc>5?-12:0)+12,midi=ref+SCALE[mode][d-1]+(c.lev>=3&&Math.random()<.3?12:0);
  const tl=LET.indexOf(sp[0]),L=(tl+d-1)%7,ac=((midi%12-NATM[L])%12+18)%12-6;
  const nm=FR_NOTE[L]+(ac>0?'♯':ac<0?'♭':'');
  CH.deg={d,ref,midi,mode,pc,name:nm,answered:null,score:CH.deg?CH.deg.score:{ok:0,n:0},ton:modeName(pc,mode==='min')};
  if(!silent)playDeg();
}
function playDeg(){
  if(!CH.deg)return;stopSeq();ctx();
  CH.voices.push(playMidi(CH.deg.ref,1.4),playMidi(CH.deg.midi,1.6,1.7));
}
function answerDeg(v){
  const D=CH.deg;if(!D||D.answered)return;
  D.answered=v;D.score.n++;if(v===D.d)D.score.ok++;
  const c=CS();const t=todayStr();if(!c.day||c.day.d!==t)c.day={d:t,n:0};c.day.n++;save();render();
}

/* ---- affichage ---- */
function chips(label,key,opts,cur){
  return '<div class="chrow"><span class="eyebrow">'+label+'</span><div class="chips" role="group" aria-label="'+label+'">'
    +opts.map(([v,l])=>'<button class="chip" id="ch-'+key+'-'+v+'" aria-pressed="'+(String(cur)===String(v))+'" onclick="setCS(\''+key+'\',\''+v+'\')">'+l+'</button>').join('')+'</div></div>';
}
function settingsHtml(){
  const c=CS();
  const sum=({lire:'Lire',oreille:'Oreille',deg:'Degrés'}[c.mode])+' · niveau '+c.lev+(c.mode==='deg'?'':' · '+CLEF_NAMES[c.clef].replace('Clé de ','clé de ')+' · '+c.x+' mes. · '+c.y+' portée'+(c.y>1?'s':''))+' · ton '+(c.ton==='rand'?'aléatoire':c.ton);
  let h='<details class="adv card" id="chSet"'+(CH.ex||CH.deg?'':' open')+'><summary>Réglages · '+esc(sum)+'</summary>'
    +chips('Exercice','mode',[['lire','Lire'],['oreille','Oreille'],['deg','Degrés']],c.mode)
    +chips('Niveau','lev',[[1,'1 · degrés conjoints'],[2,'2 · tierces, arpèges'],[3,'3 · toute la gamme'],[4,'4 · chromatisme, minor']],c.lev);
  if(c.mode!=='deg')h+=chips('Clé','clef',[['bass','Fa'],['tenor','Ut 4e'],['treble','Sol']],c.clef)
    +chips('Mesures','x',[[2,'2'],[4,'4'],[8,'8']],c.x)+chips('Portées','y',[[1,'1'],[2,'2'],[3,'3']],c.y);
  h+='<div class="chrow"><label class="eyebrow" for="chTon">Ton</label><select id="chTon" onchange="setCS(\'ton\',this.value)"><option value="rand"'+(c.ton==='rand'?' selected':'')+'>Aléatoire</option>'
    +TONICS.map(t=>'<option'+(c.ton===t?' selected':'')+'>'+t+'</option>').join('')+'</select></div></details>';
  return h;
}
function renderSing(){
  const c=CS();
  if(c.mode==='deg')return renderDeg();
  if(!CH.ex)newEx();
  const E=CH.ex,w=E.w,m=E.model,min=w.p.mode==='min';
  const hidden=c.mode==='oreille'&&!CH.revealed;
  let h='<p class="eyebrow">Lecture chantée · sans instrument'+(c.day&&c.day.d===todayStr()?' · aujourd’hui : '+c.day.n+' extrait'+(c.day.n>1?'s':''):'')+'</p>'+settingsHtml();
  h+='<div class="card chcard"><div class="chhead"><div><h3>'+esc(w.p.t)+'</h3><p class="sub">'+esc(w.p.c)+' · mesures '+(w.a+1)+' à '+w.b+'</p></div>'
    +'<p class="chkey"><strong>'+modeName(E.tg.pc,min)+'</strong><br><span class="sub">'+CLEF_NAMES[c.clef]+'</span></p></div>';
  h+=hidden?'<div class="chhide" id="chScore"><p>Écoute, puis rechante en nommant les notes.</p></div>':'<div id="chScore" class="chscore"></div>';
  h+='<div class="btnrow chbtn"><button class="btn" id="chTonic" onclick="playTonic()">Tonique</button><button class="btn" id="chPlay" onclick="playEx()">Écouter</button>'
    +(hidden?'<button class="btn ghost" id="chReveal" onclick="revealEx()">Voir la partition</button>':'<button class="btn ghost" id="chNames" onclick="toggleLabels()" aria-pressed="'+CH.labels+'">'+(CH.labels?'Cacher les noms':'Voir les noms')+'</button>')
    +'<button class="btn ghost" id="chNext" onclick="newEx();render()">Autre extrait ›</button></div>';
  h+='<div class="chtempo"><span class="sub">Tempo</span><button class="btn ghost small" onclick="stepBpm(-4)" aria-label="Plus lent">−</button><strong id="chBpm">♩ = '+c.bpm+'</strong><button class="btn ghost small" onclick="stepBpm(4)" aria-label="Plus vite">+</button></div></div>';
  h+='<ol class="chsteps">'+(c.mode==='lire'
    ?'<li>Regarde la clé, l’armure et la mesure. Repère le premier degré et l’allure de la mélodie.</li><li>Appuie sur « Tonique » et chante-la.</li><li>Chante l’extrait en nommant les notes, sans instrument.</li><li>Appuie sur « Écouter » et compare avec ta voix.</li>'
    :'<li>Appuie sur « Tonique », puis sur « Écouter ». Réécoute autant que nécessaire.</li><li>Rechante la mélodie en nommant les notes.</li><li>Affiche la partition et compare.</li>')+'</ol>';
  h+='<div class="btnrow"><button class="btn ghost small" id="chFlag" onclick="flagEx()">Signaler une erreur dans cet extrait</button></div>'+(CH.flag?'<p class="sub" id="chFlagMsg">'+esc(CH.flag)+'</p>':'');
  return h+importHtml();
}
function renderDeg(){
  const c=CS();if(!CH.deg)newDeg(true);
  const D=CH.deg;
  let h='<p class="eyebrow">Lecture chantée · degrés</p>'+settingsHtml();
  h+='<div class="card chcard"><h3>Quel degré entends-tu ?</h3><p class="sub">Tu entends la tonique, puis une note. Chante-la, puis donne son degré dans la gamme.</p>';
  if(D){
    h+='<div class="btnrow chbtn"><button class="btn" id="dgPlay" onclick="playDeg()">Réécouter</button><button class="btn ghost" id="dgNext" onclick="newDeg();render()">Autre note ›</button></div>';
    h+='<div class="chips chdeg" role="group" aria-label="Degré">'+[1,2,3,4,5,6,7].filter(v=>v<=(c.lev===1?5:7)).map(v=>'<button class="chip" id="dg-'+v+'" aria-pressed="'+(D.answered===v)+'" onclick="answerDeg('+v+')"'+(D.answered?' disabled':'')+'>'+v+'</button>').join('')+'</div>';
    if(D.answered)h+='<p class="chfb '+(D.answered===D.d?'ok':'ko')+'" id="dgFb" role="status">'+(D.answered===D.d?'Juste : ':'C’était le degré '+D.d+' : ')+esc(D.name)+' dans '+esc(D.ton)+'.</p>';
    h+='<p class="sub">Score : '+D.score.ok+' sur '+D.score.n+'</p>';
  }
  return h+'</div>';
}
function drawSing(){
  drawImpPreview();
  const el=document.getElementById('chScore');if(!el||!CH.ex||!el.classList.contains('chscore'))return;
  const c=CS(),W=Math.max(320,Math.round(el.clientWidth)||720);
  el.innerHTML=drawScore(CH.ex.model,{width:W,lines:c.y,labels:CH.labels});
}
let chRz=null;
window.addEventListener('resize',()=>{clearTimeout(chRz);chRz=setTimeout(()=>{if(tab==='sing')drawSing()},200)});
