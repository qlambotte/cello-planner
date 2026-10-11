/* ---------- audio : synthèse, bourdon, notes, métronome, carillon, diapason ---------- */
let actx=null;
function ctx(){if(!actx){actx=new (window.AudioContext||window.webkitAudioContext)()}if(actx.state==='suspended')actx.resume();return actx}
const NOTE_FR=['Do','Do♯','Ré','Mi♭','Mi','Fa','Fa♯','Sol','La♭','La','Si♭','Si'];
const midiName=m=>NOTE_FR[((m%12)+12)%12]+(Math.floor(m/12)-1);
const A4=()=>(state&&+state.diapason)||440;
const midiFreq=m=>A4()*Math.pow(2,(m-69)/12);
function parseNote(str){
  const m=String(str||'').trim().toLowerCase().replace(/\s+/g,'').match(/^(do|re|ré|mi|fa|sol|la|si)([#♯b♭]?)(-?\d)?$/);
  if(!m)return null;
  const base={do:0,re:2,'ré':2,mi:4,fa:5,sol:7,la:9,si:11}[m[1]];
  const pc=base+((m[2]==='#'||m[2]==='♯')?1:(m[2]==='b'||m[2]==='♭')?-1:0);
  return 12*((m[3]!==undefined?parseInt(m[3],10):3)+1)+pc;
}

/* timbre de corde frottée : spectre riche en harmoniques, trois voix légèrement désaccordées, résonances du corps,
   bruit d'archet très discret, vibrato qui s'installe doucement, petite réverbération de salle */
let CELLO_WAVE=null,NOISE_BUF=null,REVERB=null;
function celloWave(c){
  if(CELLO_WAVE)return CELLO_WAVE;
  const N=40,re=new Float32Array(N+1),im=new Float32Array(N+1);
  for(let k=1;k<=N;k++)im[k]=(1/Math.pow(k,1.05))*(k%2===0?.9:1)*(k>14?.5:1)*(k===3?1.15:1);
  CELLO_WAVE=c.createPeriodicWave(re,im);return CELLO_WAVE;
}
function celloVoice(c,f,dest,gain,detune){
  const o=c.createOscillator();o.setPeriodicWave(celloWave(c));o.frequency.value=f;o.detune.value=detune||0;
  const g=c.createGain();g.gain.value=gain;o.connect(g);g.connect(dest);o.start();return {o,g};
}
function noiseBuf(c){
  if(NOISE_BUF)return NOISE_BUF;
  const n=c.sampleRate*2,b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);
  for(let i=0;i<n;i++)d[i]=Math.random()*2-1;
  NOISE_BUF=b;return b;
}
function reverbNode(c){
  if(REVERB&&REVERB.ctx===c)return REVERB.node;
  const len=Math.floor(c.sampleRate*1.7),ir=c.createBuffer(2,len,c.sampleRate);
  for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);let lp=0;
    for(let i=0;i<len;i++){const t=i/len;lp+=((Math.random()*2-1)-lp)*(.55-.4*t);d[i]=lp*Math.pow(1-t,2.6)*(i<c.sampleRate*.012?i/(c.sampleRate*.012):1)}}
  const cv=c.createConvolver();cv.buffer=ir;const wet=c.createGain();wet.gain.value=1;cv.connect(wet);wet.connect(c.destination);
  REVERB={ctx:c,node:cv};return cv;
}
function celloBus(c,f,opt){
  opt=opt||{};f=f||220;
  const lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=Math.max(1400,Math.min(4200,f*7));lp.Q.value=.6;
  const chain=[[110,3,.9],[250,4,1.1],[520,3,1.4],[1000,2,1.2]].map(([fq,gn,q])=>{const p=c.createBiquadFilter();p.type='peaking';p.frequency.value=fq;p.Q.value=q;p.gain.value=gn;return p});
  const sh=c.createBiquadFilter();sh.type='highshelf';sh.frequency.value=2800;sh.gain.value=-5;
  let prev=lp;chain.concat([sh]).forEach(n=>{prev.connect(n);prev=n});
  const out=c.createGain();out.gain.value=0;prev.connect(out);out.connect(c.destination);
  if(opt.room!==false){const send=c.createGain();send.gain.value=opt.room||.2;out.connect(send);send.connect(reverbNode(c))}
  return {input:lp,out};
}
/* une note tenue : attaque douce, vibrato qui s'installe, bruit d'archet discret ; stop() la relâche */
function startTone(m,o){
  o=o||{};
  const c=ctx(),f=midiFreq(m),t=c.currentTime+(o.delay||0),bus=celloBus(c,f,{room:o.room}),lvl=o.level||.5;
  const vs=[celloVoice(c,f,bus.input,.34,-6),celloVoice(c,f,bus.input,.34,0),celloVoice(c,f,bus.input,.34,6)];
  const extra=[];
  if(o.vib!==false){
    const l=c.createOscillator(),lg=c.createGain();l.frequency.value=5.2+Math.random()*.5;lg.gain.setValueAtTime(0,t);lg.gain.setValueAtTime(0,t+(o.vibAfter||.45));lg.gain.linearRampToValueAtTime(o.vibDepth||7,t+(o.vibAfter||.45)+.9);
    l.connect(lg);vs.forEach(v=>lg.connect(v.o.detune));l.start(t);extra.push(l);
  }
  if(o.noise!==false){
    const n=c.createBufferSource();n.buffer=noiseBuf(c);n.loop=true;
    const bp=c.createBiquadFilter();bp.type='bandpass';bp.frequency.value=Math.min(3000,f*3);bp.Q.value=.8;
    const ng=c.createGain();ng.gain.setValueAtTime(.0001,t);ng.gain.linearRampToValueAtTime(.05,t+.04);ng.gain.exponentialRampToValueAtTime(.008,t+.35);
    n.connect(bp);bp.connect(ng);ng.connect(bus.input);n.start(t);extra.push(n);
  }
  const g=bus.out.gain,att=o.attack||.1;
  g.setValueAtTime(0,t);g.linearRampToValueAtTime(lvl*1.12,t+att*.7);g.linearRampToValueAtTime(lvl,t+att*1.6);
  const stopAll=(at)=>{vs.forEach(v=>v.o.stop(at));extra.forEach(e=>{try{e.stop(at)}catch(_){}})};
  let ended=false;
  return {stop(rel){
    if(ended)return;ended=true;const n=Math.max(c.currentTime,t),r=rel||.3;
    try{g.cancelScheduledValues(n);g.setValueAtTime(g.value,n);g.linearRampToValueAtTime(0,n+r);stopAll(n+r+.05)}catch(_){}
  },stopAt(at,rel){
    if(ended)return;ended=true;const r=rel||.4;
    g.setValueAtTime(lvl,t+at);g.linearRampToValueAtTime(0,t+at+r);stopAll(t+at+r+.1);
  }};
}
let drone=null;
function stopDrone(){
  if(!drone)return;const c=actx,t=c.currentTime,d=drone;drone=null;
  try{const g=d.bus.out.gain;g.cancelScheduledValues(t);g.setValueAtTime(g.value,t);g.linearRampToValueAtTime(0,t+.6);d.voices.forEach(v=>v.o.stop(t+.7))}catch(e){}
  document.querySelectorAll('[data-drone]').forEach(b=>{b.textContent='▶ Bourdon'});
  if(typeof paintTools==='function')paintTools();
}
function toggleDrone(slot){
  if(drone){const same=drone.slot===slot;stopDrone();if(same)return}
  const sel=document.getElementById('tonicSel-'+slot);if(!sel||!sel.value)return;
  startDrone(slot,sel.value,document.getElementById('octSel-'+slot).value==='1',+document.getElementById('extSel-'+slot).value);
}
/* bourdon : voix unique exactement à la hauteur (pas de désaccord, donc pas de battements parasites), timbre riche mais doux ;
   ext = 0 tonique seule, 1 avec la quinte pure (3:2), 2 avec l'octave. true = quinte. */
function startDrone(slot,ton,hi,ext){
  if(drone)stopDrone();
  ext=ext===true?1:(+ext||0);
  const c=ctx(),f=midiFreq(36+PC[ton]+(hi?12:0)),bus=celloBus(c,f*2.2,{room:.1});
  const voices=[celloVoice(c,f,bus.input,.62,0),celloVoice(c,f*2,bus.input,.1,0)];
  if(ext===1)voices.push(celloVoice(c,f*1.5,bus.input,.36,0),celloVoice(c,f*3,bus.input,.05,0));
  if(ext===2)voices.push(celloVoice(c,f*2,bus.input,.3,0));
  const t=c.currentTime;bus.out.gain.setValueAtTime(0,t);bus.out.gain.linearRampToValueAtTime(.5,t+1);
  drone={slot,ton,bus,voices,ext};
  const b=document.getElementById('droneBtn-'+slot);if(b)b.textContent='■ Arrêter';
  if(typeof paintTools==='function')paintTools();
}
function redrone(slot){const l=document.getElementById('droneLbl-'+slot);if(l)l.textContent=droneLabel(slot);if(drone&&drone.slot===slot){stopDrone();toggleDrone(slot)}}
function playMidi(m,dur,delay,opt){
  opt=opt||{};
  const long=dur>=.8;
  const tn=startTone(m,Object.assign({delay:delay||0,attack:Math.min(.11,dur*.3),vib:long,vibAfter:Math.min(.45,dur*.4),level:.5},opt));
  tn.stopAt(dur,Math.min(.45,.15+dur*.12));
  return {stop(){tn.stop(.1)}};
}
/* La de référence tenu, sans vibrato : un second appui l'arrête */
let REFTONE=null,REFTIMER=null;
function stopRefTone(){
  if(!REFTONE)return;REFTONE.stop(.35);REFTONE=null;clearTimeout(REFTIMER);
  document.querySelectorAll('.refBtn').forEach(b=>{b.textContent=b.dataset.l});
}
function toggleRefTone(){
  if(REFTONE){stopRefTone();return}
  REFTONE=startTone(57,{vib:false,noise:false,attack:.25,level:.42,room:.12});
  REFTIMER=setTimeout(stopRefTone,30000);
  document.querySelectorAll('.refBtn').forEach(b=>{b.textContent='■ Arrêter le La'});
}
function droneLabel(slot){
  const t=document.getElementById('tonicSel-'+slot),f=document.getElementById('extSel-'+slot),o=document.getElementById('octSel-'+slot);
  if(!t)return '';
  return 'sur '+t.value+(f&&f.value==='1'?', avec la quinte':f&&f.value==='2'?', avec l’octave':'')+(o&&o.value==='1'?', registre médium':'');
}
function droneTools(slot,ton,extra){
  if(!PC.hasOwnProperty(ton))ton='Sol';
  return '<div class="tools"><button class="btn small" id="droneBtn-'+slot+'" data-drone="'+slot+'" onclick="toggleDrone(\''+slot+'\')">▶ Bourdon</button>'
    +'<span class="sub" id="droneLbl-'+slot+'">sur '+ton+', avec la quinte</span>'+(extra||'')+'</div>'
    +'<details class="adv"><summary>Réglages du bourdon</summary><div class="tools">'
    +'<div class="fld"><label for="tonicSel-'+slot+'">Tonique</label><select id="tonicSel-'+slot+'" onchange="redrone(\''+slot+'\')">'+TONICS.map(t=>'<option'+(t===ton?' selected':'')+'>'+t+'</option>').join('')+'</select></div>'
    +'<div class="fld"><label for="octSel-'+slot+'">Registre</label><select id="octSel-'+slot+'" onchange="redrone(\''+slot+'\')"><option value="0">Grave</option><option value="1">Médium</option></select></div>'
    +'<div class="fld"><label for="extSel-'+slot+'">Ajouter</label><select id="extSel-'+slot+'" onchange="redrone(\''+slot+'\')"><option value="0">Tonique seule</option><option value="1" selected>La quinte (pure)</option><option value="2">L’octave</option></select></div>'
    +'</div></details>';
}

/* métronome, avec montée automatique du tempo */
let metroT=null,metroUiT=null,M=null;
function metroUI(){
  const e=document.getElementById('rampInfo');if(!M||!M.ramp)return;
  if(typeof paintTools==='function')paintTools();
  if(e)e.textContent='Répétition '+(M.rep+1)+'/'+M.reps+' · croche = '+M.bpm;
  const b=document.getElementById('bpm');if(b)b.value=M.bpm;
}
function stopMetro(){
  if(metroT){clearInterval(metroT);clearInterval(metroUiT);metroT=null}
  const btn=document.getElementById('metroBtn');if(btn)btn.textContent='▶ Métronome';
  const e=document.getElementById('rampInfo');
  if(M&&M.ramp&&e){
    e.innerHTML=M.bpm!==M.start&&M.itemId?'Arrêté à croche = <strong>'+M.bpm+'</strong> <button class="btn ghost small" id="keepTempo" onclick="keepTempo(\''+M.itemId+'\','+M.bpm+')">Retenir ce tempo</button>':'';
  }
  M=null;
  if(typeof paintTools==='function')paintTools();
}
function keepTempo(id,v){
  setTempo(id,String(v));const b=document.getElementById('bpm');if(b)b.value=v;
  const e=document.getElementById('rampInfo');if(e)e.textContent='Tempo retenu : croche = '+v;
}
function numVal(id,def){const e=document.getElementById(id);const v=e?+e.value:NaN;return isNaN(v)||v<=0?def:v}
function toggleMetro(itemId){
  if(metroT){stopMetro();return}
  const chk=document.getElementById('rampChk');
  startMetro({bpm:Math.max(20,Math.min(260,numVal('bpm',60))),ramp:!!(chk&&chk.checked),step:numVal('rampStep',4),reps:Math.max(1,numVal('rampReps',4)),per:Math.max(1,numVal('rampBeats',12)),cap:Math.min(260,numVal('rampMax',120)),itemId});
}
function startMetro(o){
  if(metroT)stopMetro();
  M={bpm:o.bpm,start:o.bpm,ramp:!!o.ramp,step:o.step||4,reps:o.reps||4,per:o.per||12,cap:o.cap||120,beats:0,rep:0,itemId:o.itemId||null};
  const c=ctx();let next=c.currentTime+.08;
  const click=(t,acc)=>{const o=c.createOscillator(),g=c.createGain();o.frequency.value=acc?1500:1000;
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.45,t+.002);g.gain.exponentialRampToValueAtTime(.0001,t+.04);
    o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+.06)};
  metroT=setInterval(()=>{
    while(next<c.currentTime+.12&&M){
      click(next,M.ramp&&M.beats%M.per===0);M.beats++;
      if(M.ramp&&M.beats%M.per===0){M.rep++;if(M.rep>=M.reps){M.rep=0;M.bpm=Math.min(M.cap,M.bpm+M.step)}}
      next+=60/M.bpm;
    }
  },25);
  metroUiT=setInterval(metroUI,150);metroUI();
  const btn=document.getElementById('metroBtn');if(btn)btn.textContent='■ Arrêter';
  if(typeof paintTools==='function')paintTools();
}
function saveRamp(){
  const chk=document.getElementById('rampChk');
  state.ramp={on:!!(chk&&chk.checked),step:numVal('rampStep',4),reps:numVal('rampReps',4),per:numVal('rampBeats',12),max:numVal('rampMax',120)};save();
}

/* carillon */
function chime(){
  try{const c=ctx(),t=c.currentTime;
    [[659.3,0],[880,.22]].forEach(([f,d])=>{const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=f;
      g.gain.setValueAtTime(.0001,t+d);g.gain.exponentialRampToValueAtTime(.25,t+d+.02);g.gain.exponentialRampToValueAtTime(.0001,t+d+1.2);
      o.connect(g);g.connect(c.destination);o.start(t+d);o.stop(t+d+1.3)});
    if(navigator.vibrate)navigator.vibrate(200)}catch(e){}
}


/* diapason */
const DIAPASONS=[415,430,432,435,438,440,441,442,443,444,445];
function diapHtml(id){
  const cur=A4(),list=DIAPASONS.includes(cur)?DIAPASONS:DIAPASONS.concat([cur]).sort((a,b)=>a-b);
  return '<div class="fld"><label for="'+id+'">Diapason (la)</label><select class="diapSel" id="'+id+'" onchange="setDiapason(this.value)">'
    +list.map(v=>'<option value="'+v+'"'+(v===cur?' selected':'')+'>'+v+' Hz</option>').join('')+'</select></div>';
}
function setDiapason(v){
  state.diapason=+v;save();
  document.querySelectorAll('.diapSel').forEach(e=>{e.value=String(v)});
  
  if(drone){if(drone.slot==='w')startDrone('w',drone.ton,false,DW.ext);else redrone(drone.slot)}
}
