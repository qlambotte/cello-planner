/* ---------- gamme et arpège : portée, écoute, contrôle de justesse au micro (voix) ---------- */
const SC={cfg:{ton:'Sol',key:''},model:null,chk:null,timers:[],voices:[],res:null,msg:''};
const SCALES={
  maj:{scale:{k:'C',mode:'maj',bars:['C D E F','G A B c','B A G F','E D C2']},arp:{k:'C',mode:'maj',bars:['C E G c','G E C2']}},
  min:{scale:{k:'A',mode:'min',bars:['A B c d','e ^f ^g a','g f e d','c B A2']},arp:{k:'A',mode:'min',bars:['A c e a','e c A2']}}
};
function scUi(){const u=state.scaleUi=state.scaleUi||{};if(!u.kind)u.kind='scale';if(!u.mode)u.mode='auto';return u}
const scMinor=()=>{const u=scUi();return u.mode==='min'||(u.mode==='auto'&&/min/i.test(SC.cfg.key||''))};
function scBuild(){
  const u=scUi(),mi=scMinor(),pc=PC[SC.cfg.ton]!==undefined?PC[SC.cfg.ton]:7;
  const def=SCALES[mi?'min':'maj'][u.kind];
  const piece={id:'sc',t:'',c:'',k:def.k,mode:def.mode,m:'4/4',l:'1/4',lev:1,bars:def.bars};
  const sp=(mi?SP_MIN:SP_MAJ)[pc];
  SC.model=buildModel(piece,0,piece.bars.length,{letter:sp[0],acc:sp[1],pc},CS().clef);
  SC.title=(u.kind==='scale'?'Gamme de ':'Arpège de ')+modeName(pc,mi);
  return SC.model;
}
function scaleHtml(ton,key){
  SC.cfg={ton,key:key||''};
  const u=scUi();scBuild();
  if(PRINT)return '<p><strong>'+esc(SC.title)+'</strong></p><div class="chscore">'+drawScore(SC.model,{width:700,lines:u.kind==='scale'?2:1,labels:true})+'</div>';
  const chip=(id,l,on,f)=>'<button class="chip" id="'+id+'" aria-pressed="'+on+'" onclick="'+f+'">'+l+'</button>';
  const mi=scMinor();
  return '<div class="scbox" id="scBox"><div class="stage" role="group" aria-label="Exercice">'
    +chip('scK-scale','Gamme',u.kind==='scale',"scSet('kind','scale')")+chip('scK-arp','Arpège 1-3-5-8',u.kind==='arp',"scSet('kind','arp')")
    +chip('scM-maj','Majeur',!mi,"scSet('mode','maj')")+chip('scM-min','Mineur',mi,"scSet('mode','min')")+'</div>'
    +'<p class="sub" id="scTitle">'+esc(SC.title)+'</p><div id="scScore" class="chscore"></div>'
    +'<div class="btnrow"><button class="btn small" id="scPlay" onclick="scPlay()">▶ Écouter</button>'
    +'<button class="btn ghost small" id="scTon" onclick="scTonic()">▶ Tonique</button>'
    +'<button class="btn small" id="scSing" onclick="scToggleCheck()">Contrôler mon chant</button>'
    +'<button class="btn ghost small" id="scSkip" onclick="scSkip()" hidden>Passer cette note</button></div>'
    +'<div class="vread"><span class="vnote" id="scNote">—</span><span class="sub" id="scCents"></span></div>'
    +'<div class="needle" aria-hidden="true"><i id="scNeedle"></i></div>'
    +'<p class="sub" id="scMsg" aria-live="polite">'+esc(SC.msg||'Chante la gamme note par note : l’appli suit ta voix et passe à la note suivante quand la hauteur est juste (à l’octave près). Casque conseillé si le bourdon joue.')+'</p></div>';
}
function scSet(k,v){scUi()[k]=v;save();scStop();SC.res=null;SC.msg='';const keep=window.scrollY;render();window.scrollTo(0,keep)}
function drawScale(){
  const el=document.getElementById('scScore');if(!el)return;
  const u=scUi(),W=Math.max(320,Math.round(el.clientWidth)||700);
  try{el.innerHTML=drawScore(scBuild(),{width:W,lines:u.kind==='scale'?2:1,labels:true})}catch(e){el.textContent='Portée impossible : '+e.message;return}
  if(SC.res)SC.res.forEach((r,i)=>{if(r){const g=document.getElementById(SC.model.notes[i].nid);if(g)g.classList.add(r)}});
  if(SC.chk){scMarkCur();const b=document.getElementById('scSing');if(b)b.textContent='Arrêter le contrôle';const k=document.getElementById('scSkip');if(k)k.hidden=false;scPaint(null)}
  if(SC.playing){const b=document.getElementById('scPlay');if(b)b.textContent='■ Arrêter'}
}
window.addEventListener('resize',()=>{if(tab==='today')setTimeout(drawScale,150)});
/* ---- écoute ---- */
function scStopPlay(){
  SC.timers.forEach(clearTimeout);SC.timers=[];SC.voices.forEach(v=>v.stop());SC.voices=[];
  document.querySelectorAll('#scScore .nt.on').forEach(e=>e.classList.remove('on'));
  const b=document.getElementById('scPlay');if(b)b.textContent='▶ Écouter';
}
function scTonic(){if(!SC.model)return;ctx();SC.voices.push(playMidi(SC.model.refMidi,2))}
function scPlay(){
  if(SC.playing){SC.playing=false;scStopPlay();return}
  if(SC.chk)scStopCheck();
  if(!SC.model)scBuild();
  ctx();const m=SC.model,sec=60/Math.min(96,CS().bpm||72);
  SC.playing=true;const b=document.getElementById('scPlay');if(b)b.textContent='■ Arrêter';
  m.notes.forEach((n,i)=>{
    const at=.2+n.start*4*sec,d=Math.max(.2,n.dur*4*sec*.95);
    SC.voices.push(playMidi(n.midi,d,at));
    SC.timers.push(setTimeout(()=>{document.querySelectorAll('#scScore .nt.on').forEach(e=>e.classList.remove('on'));const e=document.getElementById(n.nid);if(e)e.classList.add('on')},at*1000));
  });
  SC.timers.push(setTimeout(()=>{SC.playing=false;scStopPlay()},(.4+m.total*4*sec)*1000+300));
}
/* ---- contrôle de justesse : suit la voix note par note ---- */
const SC_TOL=25,SC_HOLD=8;               // cents ; images consécutives (≈ 0,5 s)
function scMarkCur(){
  document.querySelectorAll('#scScore .nt.on').forEach(e=>e.classList.remove('on'));
  const k=SC.chk;if(!k)return;const n=SC.model.notes[k.i];if(!n)return;
  const g=document.getElementById(n.nid);if(g)g.classList.add('on');
}
async function scToggleCheck(){
  if(SC.chk){scStopCheck();return}
  scStopPlay();SC.playing=false;
  if(!SC.model)scBuild();
  try{
    const stream=await navigator.mediaDevices.getUserMedia(MIC_OPTS);
    const c=ctx(),src=c.createMediaStreamSource(stream),an=c.createAnalyser();an.fftSize=4096;src.connect(an);
    SC.res=new Array(SC.model.notes.length).fill(null);SC.msg='';
    document.querySelectorAll('#scScore .nt').forEach(e=>e.classList.remove('ok','near','ko'));
    SC.chk={stream,src,an,buf:new Float32Array(an.fftSize),hist:[],i:0,hold:0,sum:[],devs:[],iv:setInterval(scStep,60)};
    const b=document.getElementById('scSing');if(b)b.textContent='Arrêter le contrôle';
    const s=document.getElementById('scSkip');if(s)s.hidden=false;
    scMarkCur();scPaint(null);
  }catch(e){const n=document.getElementById('scNote');if(n)n.textContent='Micro indisponible';const m=document.getElementById('scMsg');if(m)m.textContent='Autorise le micro pour ce site dans le navigateur.'}
}
function scStopCheck(){
  const k=SC.chk;if(!k)return;
  clearInterval(k.iv);try{k.src.disconnect();k.stream.getTracks().forEach(t=>t.stop())}catch(e){}
  SC.chk=null;
  const b=document.getElementById('scSing');if(b)b.textContent='Contrôler mon chant';
  const s=document.getElementById('scSkip');if(s)s.hidden=true;
  document.querySelectorAll('#scScore .nt.on').forEach(e=>e.classList.remove('on'));
  scPaint(null);
}
function scStop(){scStopPlay();SC.playing=false;scStopCheck()}
function scStep(){
  const k=SC.chk;if(!k)return;
  k.an.getFloatTimeDomainData(k.buf);
  k.hist.push(detectPitch(k.buf,actx.sampleRate));if(k.hist.length>4)k.hist.shift();
  const v=k.hist.filter(Boolean).sort((a,b)=>a-b);
  if(v.length<3){k.hold=0;k.sum=[];scPaint(null);return}
  const n=SC.model.notes[k.i],mf=69+12*Math.log2(v[v.length>>1]/A4());
  let dev=((mf-n.midi)%12+12)%12;if(dev>6)dev-=12;dev*=100;   // écart en cents, à l'octave près
  scPaint(dev);
  if(Math.abs(dev)<=SC_TOL){
    k.hold++;k.sum.push(dev);
    if(k.hold>=SC_HOLD){const m=k.sum.reduce((a,x)=>a+x,0)/k.sum.length;scDone(Math.abs(m)<=15?'ok':'near',m)}
  }else{k.hold=0;k.sum=[]}
}
function scSkip(){if(SC.chk)scDone('ko',null)}
function scDone(cls,dev){
  const k=SC.chk;if(!k)return;
  SC.res[k.i]=cls;if(dev!==null)k.devs.push(Math.abs(dev));
  const g=document.getElementById(SC.model.notes[k.i].nid);if(g){g.classList.remove('on');g.classList.add(cls)}
  k.i++;k.hold=0;k.sum=[];k.hist=[];
  if(k.i>=SC.model.notes.length){
    const n=SC.res.length,ok=SC.res.filter(r=>r==='ok').length,near=SC.res.filter(r=>r==='near').length,avg=k.devs.length?Math.round(k.devs.reduce((a,x)=>a+x,0)/k.devs.length):0;
    SC.msg=SC.title+' : '+ok+' notes justes sur '+n+(near?', '+near+' à peine hors zone':'')+(n-ok-near?', '+(n-ok-near)+' passées':'')+(k.devs.length?' · écart moyen ± '+avg+' cents.':'.')
      +(ok===n?' Bravo.':' Vert = juste (± 15 cents), jaune = proche, rouge = passée. Recommence pour améliorer.');
    scStopCheck();const m=document.getElementById('scMsg');if(m)m.textContent=SC.msg;
    const nt=document.getElementById('scNote');if(nt)nt.textContent='Terminé';
    return;
  }
  scMarkCur();scPaint(null);
}
function scPaint(dev){
  const note=document.getElementById('scNote'),cent=document.getElementById('scCents'),nd=document.getElementById('scNeedle'),msg=document.getElementById('scMsg');if(!note)return;
  const k=SC.chk;
  if(!k){note.textContent='—';cent.textContent='';nd.style.left='50%';nd.className='';return}
  const n=SC.model.notes[k.i];
  note.textContent=(n.label||'')+'  ('+(k.i+1)+'/'+SC.model.notes.length+')';
  if(dev===null){cent.textContent='chante cette note';nd.style.left='50%';nd.className='';msg.textContent='Note visée : '+(n.label||'')+'. Tiens-la une demi-seconde.';return}
  const a=Math.abs(dev);
  cent.textContent=(dev>=0?'+':'−')+Math.round(a)+' cents · '+(a<=15?'juste':dev>0?'trop haut':'trop bas');
  nd.style.left=(50+Math.max(-1,Math.min(1,dev/50))*50)+'%';nd.className=a<=15?'ok':a<=SC_TOL?'near':'';
}
