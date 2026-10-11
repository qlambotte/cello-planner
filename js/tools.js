/* ---------- panneau d'outils : accordeur, métronome (roulette), bourdon (roulette) ----------
   Construit une seule fois, hors de #app : les outils continuent de sonner quand on change de phase. */
const TL={sel:null,tuner:true,metro:true,drone:true};           // sel : outil ouvert en mode portrait
const MT={bpm:60};
const DW={ext:1};              // 0 tonique, 1 + quinte pure, 2 + octave
const SVGNS='http://www.w3.org/2000/svg';
const polar=(r,deg)=>{const a=(deg-90)*Math.PI/180;return [100+r*Math.cos(a),100+r*Math.sin(a)]};
const pt=a=>a[0].toFixed(1)+' '+a[1].toFixed(1);

function metroSvg(){
  let ticks='';
  for(let i=0;i<60;i++){const long=i%5===0,a=polar(long?80:84,i*6),b=polar(92,i*6);ticks+='<line x1="'+a[0].toFixed(1)+'" y1="'+a[1].toFixed(1)+'" x2="'+b[0].toFixed(1)+'" y2="'+b[1].toFixed(1)+'" stroke-width="'+(long?2.5:1.2)+'"/>'}
  return '<svg id="mwSvg" viewBox="0 0 200 200" role="slider" aria-label="Métronome : tourne pour changer le tempo, touche pour démarrer ou arrêter" tabindex="0" aria-valuemin="30" aria-valuemax="240">'
    +'<circle class="wbg" cx="100" cy="100" r="96"/><circle id="mwPulse" class="wpulse" cx="100" cy="100" r="66"/>'
    +'<g id="mwRot" class="wticks">'+ticks+'<circle class="wdot" cx="100" cy="14" r="6"/></g>'
    +'<text id="mwBpm" class="wnum" x="100" y="112" text-anchor="middle">60</text>'
    +'<text id="mwSub" class="wsub" x="100" y="134" text-anchor="middle">toucher pour démarrer</text></svg>';
}
function droneSvg(){
  let h='<svg id="dwSvg" viewBox="0 0 200 200" aria-label="Bourdon : choisis une fondamentale">';
  TONICS.forEach((t,i)=>{
    const a0=i*30-15,a1=i*30+15,o0=polar(96,a0),o1=polar(96,a1),i1=polar(50,a1),i0=polar(50,a0),m=polar(73,i*30);
    h+='<g class="dsec" id="ds-'+i+'" role="button" tabindex="0" aria-label="Bourdon sur '+t+'" onclick="droneWheel(\''+t+'\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();droneWheel(\''+t+'\')}">'
      +'<path d="M'+pt(o0)+' A96 96 0 0 1 '+pt(o1)+' L'+pt(i1)+' A50 50 0 0 0 '+pt(i0)+' Z"/>'
      +'<text x="'+m[0].toFixed(1)+'" y="'+(m[1]+4).toFixed(1)+'" text-anchor="middle">'+t+'</text></g>';
  });
  h+='<g id="dwFifth" class="dfifth" role="button" tabindex="0" aria-label="Changer : tonique seule, avec quinte, avec octave" onclick="toggleFifth()"><circle cx="100" cy="100" r="42"/><text id="dwName" class="wnum2" x="100" y="102" text-anchor="middle">—</text><text id="dwQ" class="wsub" x="100" y="124" text-anchor="middle">+ quinte</text></g></svg>';
  return h;
}
function toolsHtml(){
  const ic=(k,l,p)=>'<button class="ticon" id="ti-'+k+'" onclick="selTool(\''+k+'\')" aria-pressed="false" aria-label="'+l+'"><svg viewBox="0 0 24 24" aria-hidden="true">'+p+'</svg><span>'+l+'</span></button>';
  return '<div class="tbar">'
    +ic('tuner','Accordeur','<path d="M12 3v10M7 8v5M17 8v5M4 20h16M12 13l-4 7M12 13l4 7"/>')
    +ic('metro','Métronome','<path d="M8 21h8l-2-17h-4zM12 14l5-7M9 17h6"/>')
    +ic('drone','Bourdon','<path d="M3 12c3-6 5-6 6 0s3 6 6 0 4-6 6 0"/>')
    +'</div>'
    +'<section class="tool" data-tool="tuner" id="tl-tuner"><div class="thead"><h3><button class="topen" id="tuOpen" onclick="toggleTool(\'tuner\')" aria-label="Accordeur : ouvrir ou fermer">Accordeur</button></h3><button class="tclose" id="tuClose" onclick="closeTuner()" aria-label="Fermer l’accordeur">✕</button></div>'
    +'<div class="tbody tuner"><div class="turead"><span class="tunote" id="tuNote">—</span><span class="tustr" id="tuStr">&nbsp;</span></div>'
    +'<div class="tugauge" aria-hidden="true"><span class="tuflat">♭</span><div class="needle"><span class="tuzone" id="tuZone"></span><b class="tick" style="left:25%"></b><b class="tick" style="left:75%"></b><i id="tuNeedle"></i></div><span class="tusharp">♯</span></div>'
    +'<div class="tucents" id="tuCents" aria-live="polite">Joue une note</div><div class="tuhz" id="tuHz">&nbsp;</div>'
    +'<div class="tuctl"><button class="btn small" id="tuBtn" onclick="toggleTuner()">Écouter</button><button id="tuRef" class="btn ghost small refBtn" data-l="▶ Jouer un La" onclick="toggleRefTone()" title="La 220 Hz (corde à vide), d’après le diapason">▶ Jouer un La</button>'+diapHtml('diapSel-t')+'</div></div></section>'
    +'<section class="tool" data-tool="metro" id="tl-metro"><div class="thead"><h3><button class="topen" id="meOpen" onclick="toggleTool(\'metro\')" aria-label="Métronome : ouvrir ou fermer">Métronome</button></h3></div><div class="tbody wheel">'+metroSvg()+'</div></section>'
    +'<section class="tool" data-tool="drone" id="tl-drone"><div class="thead"><h3><button class="topen" id="drOpen" onclick="toggleTool(\'drone\')" aria-label="Bourdon : ouvrir ou fermer">Bourdon</button></h3></div><div class="tbody wheel">'+droneSvg()+'</div></section>';
}
function initTools(){
  const el=document.getElementById('tools');if(!el)return;
  el.innerHTML=toolsHtml();
  MT.bpm=Math.max(30,Math.min(240,(state&&+state.toolBpm)||60));
  wheelGesture(document.getElementById('mwSvg'));
  paintTools();
}
function selTool(k){
  TL[k]=true;
  if(k==='tuner'&&TL.sel!=='tuner')TL.tuner=true;
  TL.sel=TL.sel===k?null:k;paintTools();
  if(TL.sel==='tuner'&&!TU)toggleTuner();
}
/* ---- métronome : roulette ---- */
function setBpm(v){
  v=Math.max(30,Math.min(240,Math.round(v)));MT.bpm=v;
  if(M&&!M.ramp)M.bpm=v;
  if(state){state.toolBpm=v;save()}
  paintTools();
}
function wheelMetro(){
  if(metroT){stopMetro();return}
  startMetro({bpm:MT.bpm,ramp:false});
}
function wheelGesture(svg){
  let st=null;
  const ang=e=>{const r=svg.getBoundingClientRect();return Math.atan2(e.clientY-(r.top+r.height/2),e.clientX-(r.left+r.width/2))*180/Math.PI};
  svg.addEventListener('pointerdown',e=>{svg.setPointerCapture(e.pointerId);st={a:ang(e),acc:0,f:MT.bpm,t:Date.now(),x:e.clientX,y:e.clientY,moved:false}});
  svg.addEventListener('pointermove',e=>{
    if(!st)return;
    let d=ang(e)-st.a;if(d>180)d-=360;if(d<-180)d+=360;st.a=ang(e);
    if(Math.hypot(e.clientX-st.x,e.clientY-st.y)>8)st.moved=true;
    if(st.moved){st.f+=d/3;setBpm(st.f)}
  });
  const end=e=>{if(!st)return;const tap=!st.moved&&Date.now()-st.t<600;st=null;if(tap)wheelMetro()};
  svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',()=>{st=null});
  svg.addEventListener('wheel',e=>{e.preventDefault();setBpm(MT.bpm+(e.deltaY<0?1:-1))},{passive:false});
  svg.addEventListener('keydown',e=>{
    if(e.key==='ArrowUp'||e.key==='ArrowRight'){e.preventDefault();setBpm(MT.bpm+1)}
    else if(e.key==='ArrowDown'||e.key==='ArrowLeft'){e.preventDefault();setBpm(MT.bpm-1)}
    else if(e.key===' '||e.key==='Enter'){e.preventDefault();wheelMetro()}
  });
}
/* ---- bourdon : roulette ---- */
function droneWheel(t){
  if(drone&&drone.slot==='w'&&drone.ton===t){stopDrone();return}
  startDrone('w',t,false,DW.ext);
}
function toggleFifth(){
  DW.ext=(DW.ext+1)%3;
  if(drone&&drone.slot==='w')startDrone('w',drone.ton,false,DW.ext);else paintTools();
}
/* ---- accordeur ---- */
let TU=null;
async function toggleTuner(){
  if(TU){stopTuner();return}
  try{
    const stream=await navigator.mediaDevices.getUserMedia(MIC_OPTS);
    const c=ctx(),src=c.createMediaStreamSource(stream),an=c.createAnalyser();an.fftSize=4096;src.connect(an);
    TU={stream,src,an,buf:new Float32Array(an.fftSize),hist:[],iv:setInterval(tunerStep,60)};
    paintTools();
  }catch(e){const n=document.getElementById('tuNote');if(n)n.textContent='Micro indisponible';const c=document.getElementById('tuCents');if(c)c.textContent='Autorise le micro pour ce site.'}
}
function stopTuner(){
  if(!TU)return;clearInterval(TU.iv);try{TU.src.disconnect();TU.stream.getTracks().forEach(t=>t.stop())}catch(e){}
  TU=null;showPitch(null);paintTools();
}
/* toucher le nom d'un outil l'ouvre ou le ferme (fermer = l'arrêter) */
function toggleTool(k){
  const portrait=window.matchMedia('(orientation:portrait)').matches;
  if(k==='tuner'){TL.tuner&&(!portrait||TL.sel==='tuner')?closeTuner():(portrait&&(TL.sel='tuner'),openTuner());return}
  if(TL[k]){
    if(k==='metro')stopMetro();else stopDrone();
    TL[k]=false;if(TL.sel===k)TL.sel=null;
  }else{TL[k]=true;if(portrait)TL.sel=k}
  paintTools();
}
function openTuner(){TL.tuner=true;paintTools();if(!TU)toggleTuner()}
function closeTuner(){stopTuner();TL.tuner=false;if(TL.sel==='tuner')TL.sel=null;paintTools()}
const tol=()=>Math.max(1,Math.min(40,(state&&+state.tolerance)||10));
function setTolerance(v){state.tolerance=+v;save();paintTools();if(TU&&TU.lastF)showPitch(TU.lastF)}
const CORDES={36:'Do (corde grave)',43:'Sol (corde)',50:'Ré (corde)',57:'La (corde)'};
function tunerStep(){
  if(!TU)return;
  TU.an.getFloatTimeDomainData(TU.buf);
  const f=detectPitch(TU.buf,actx.sampleRate);
  TU.hist.push(f);if(TU.hist.length>5)TU.hist.shift();
  const v=TU.hist.filter(Boolean).sort((a,b)=>a-b);
  if(v.length>=2){TU.last=Date.now();showPitch(v[v.length>>1])}
  else if(!TU.last||Date.now()-TU.last>1500)showPitch(null);   // garde la dernière mesure 1,5 s après la fin du son
}
function pitchInfo(f){
  const m=69+12*Math.log2(f/A4()),r=Math.round(m),c=(m-r)*100;
  return {midi:r,name:midiName(r),cents:c,target:A4()*Math.pow(2,(r-69)/12)};
}
function showPitch(f){
  const n=document.getElementById('tuNote'),hz=document.getElementById('tuHz'),cs=document.getElementById('tuCents'),nd=document.getElementById('tuNeedle'),st=document.getElementById('tuStr');
  if(!n)return;
  if(!f){n.textContent='—';hz.innerHTML='&nbsp;';cs.textContent=TU?'Joue une note':'Appuie sur Écouter';st.innerHTML='&nbsp;';nd.style.left='50%';nd.className='';return}
  TU&&(TU.lastF=f);
  const i=pitchInfo(f),c=Math.round(i.cents),a=Math.abs(i.cents),T=tol();
  n.textContent=i.name;st.textContent=CORDES[i.midi]||'';
  hz.textContent=f.toFixed(1)+' Hz · cible '+i.target.toFixed(1)+' Hz';
  cs.textContent=a<=T?'Juste ('+(c>0?'+':'')+c+' cents)':Math.abs(c)+' cents '+(c>0?'trop haut ↓ baisse':'trop bas ↑ monte');
  nd.style.left=(50+Math.max(-50,Math.min(50,i.cents)))+'%';
  nd.className=a<=T?'ok':a<=2*T?'near':'';
}
/* ---- affichage ---- */
function paintTools(){
  const el=document.getElementById('tools');if(!el||!document.getElementById('mwSvg'))return;
  el.dataset.sel=TL.sel||'';el.dataset.tuner=TL.tuner?'1':'0';el.dataset.openMetro=TL.metro?'1':'0';el.dataset.openDrone=TL.drone?'1':'0';
  ['tuner','metro','drone'].forEach(k=>{const b=document.getElementById('ti-'+k);if(b)b.setAttribute('aria-pressed',String(TL.sel===k||(k==='tuner'&&!TL.sel&&false)))});
  const on=!!metroT,bpm=M?M.bpm:MT.bpm;
  document.getElementById('mwBpm').textContent=bpm;
  document.getElementById('mwSub').textContent=on?'toucher pour arrêter':'toucher pour démarrer';
  const rot=document.getElementById('mwRot');rot.style.transform='rotate('+(bpm*3%360)+'deg)';
  const pu=document.getElementById('mwPulse');pu.classList.toggle('on',on);pu.style.animationDuration=(60/bpm)+'s';
  document.getElementById('mwSvg').setAttribute('aria-valuenow',bpm);
  const dw=drone&&drone.slot==='w'?drone.ton:null;
  TONICS.forEach((t,i)=>{const g=document.getElementById('ds-'+i);if(g)g.classList.toggle('on',t===dw)});
  document.getElementById('dwName').textContent=drone?drone.ton:'—';
  document.getElementById('dwQ').textContent=['tonique seule','+ quinte','+ octave'][DW.ext];
  const zn=document.getElementById('tuZone');if(zn){zn.style.left=(50-tol())+'%';zn.style.width=(2*tol())+'%'}
  const tb=document.getElementById('tuBtn');if(tb)tb.textContent=TU?'Arrêter':'Écouter';
  const ti=document.getElementById('ti-metro');if(ti)ti.classList.toggle('live',on);
  const td=document.getElementById('ti-drone');if(td)td.classList.toggle('live',!!drone);
  const tt=document.getElementById('ti-tuner');if(tt)tt.classList.toggle('live',!!TU);
}
/* après un rendu de #app, les boutons de phase retrouvent l'état réel du son */
function syncAudioUi(){
  if(typeof REFTONE!=='undefined'&&REFTONE)document.querySelectorAll('.refBtn').forEach(b=>{b.textContent='■ Arrêter le La'});
  if(drone&&drone.slot!=='w'){const b=document.getElementById('droneBtn-'+drone.slot);if(b)b.textContent='■ Arrêter'}
  if(metroT){const b=document.getElementById('metroBtn');if(b)b.textContent='■ Arrêter'}
  paintTools();
}
