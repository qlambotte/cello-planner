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

/* timbre de corde frottée : série harmonique riche, deux voix légèrement désaccordées, résonances du corps */
let CELLO_WAVE=null;
function celloWave(c){
  if(CELLO_WAVE)return CELLO_WAVE;
  const N=24,re=new Float32Array(N+1),im=new Float32Array(N+1);
  for(let k=1;k<=N;k++)im[k]=(1/Math.pow(k,1.15))*(k%2===0?.85:1)*(k>12?.6:1);
  CELLO_WAVE=c.createPeriodicWave(re,im);return CELLO_WAVE;
}
function celloVoice(c,f,dest,gain,detune){
  const o=c.createOscillator();o.setPeriodicWave(celloWave(c));o.frequency.value=f;o.detune.value=detune||0;
  const g=c.createGain();g.gain.value=gain;o.connect(g);g.connect(dest);o.start();return {o,g};
}
function celloBus(c){
  const lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=2200;lp.Q.value=.4;
  const p1=c.createBiquadFilter();p1.type='peaking';p1.frequency.value=230;p1.Q.value=1.1;p1.gain.value=4;
  const p2=c.createBiquadFilter();p2.type='peaking';p2.frequency.value=520;p2.Q.value=1.6;p2.gain.value=3;
  const out=c.createGain();out.gain.value=0;
  lp.connect(p1);p1.connect(p2);p2.connect(out);out.connect(c.destination);
  return {input:lp,out};
}
let drone=null;
function stopDrone(){
  if(!drone)return;const c=actx,t=c.currentTime,d=drone;drone=null;
  try{const g=d.bus.out.gain;g.cancelScheduledValues(t);g.setValueAtTime(g.value,t);g.linearRampToValueAtTime(0,t+.6);d.voices.forEach(v=>v.o.stop(t+.7))}catch(e){}
  document.querySelectorAll('[data-drone]').forEach(b=>{b.textContent='▶ Bourdon'});
}
function toggleDrone(slot){
  if(drone){const same=drone.slot===slot;stopDrone();if(same)return}
  const sel=document.getElementById('tonicSel-'+slot);if(!sel||!sel.value)return;
  const fifth=document.getElementById('fifthChk-'+slot).checked,hi=document.getElementById('octSel-'+slot).value==='1';
  const c=ctx(),bus=celloBus(c),f=midiFreq(36+PC[sel.value]+(hi?12:0));
  const voices=[celloVoice(c,f,bus.input,.45,-4),celloVoice(c,f,bus.input,.45,5),celloVoice(c,f*2,bus.input,.12,0)];
  if(fifth){const f5=f*Math.pow(2,7/12);voices.push(celloVoice(c,f5,bus.input,.3,-3),celloVoice(c,f5,bus.input,.3,4))}
  const t=c.currentTime;bus.out.gain.setValueAtTime(0,t);bus.out.gain.linearRampToValueAtTime(.55,t+.9);
  drone={slot,bus,voices};
  const b=document.getElementById('droneBtn-'+slot);if(b)b.textContent='■ Arrêter';
}
function redrone(slot){const l=document.getElementById('droneLbl-'+slot);if(l)l.textContent=droneLabel(slot);if(drone&&drone.slot===slot){stopDrone();toggleDrone(slot)}}
function playMidi(m,dur){
  const c=ctx(),bus=celloBus(c),t=c.currentTime,f=midiFreq(m);
  const vs=[celloVoice(c,f,bus.input,.5,-3),celloVoice(c,f,bus.input,.5,3)];
  const g=bus.out.gain;g.setValueAtTime(0,t);g.linearRampToValueAtTime(.55,t+.08);g.setValueAtTime(.55,t+dur);g.linearRampToValueAtTime(0,t+dur+.5);
  vs.forEach(v=>v.o.stop(t+dur+.6));
}
function droneLabel(slot){
  const t=document.getElementById('tonicSel-'+slot),f=document.getElementById('fifthChk-'+slot),o=document.getElementById('octSel-'+slot);
  if(!t)return '';
  return 'sur '+t.value+(f&&f.checked?', avec la quinte':'')+(o&&o.value==='1'?', registre médium':'');
}
function droneTools(slot,ton,extra){
  if(!PC.hasOwnProperty(ton))ton='Sol';
  return '<div class="tools"><button class="btn small" id="droneBtn-'+slot+'" data-drone="'+slot+'" onclick="toggleDrone(\''+slot+'\')">▶ Bourdon</button>'
    +'<span class="sub" id="droneLbl-'+slot+'">sur '+ton+', avec la quinte</span>'+(extra||'')+'</div>'
    +'<details class="adv"><summary>Réglages du bourdon</summary><div class="tools">'
    +'<div class="fld"><label for="tonicSel-'+slot+'">Tonique</label><select id="tonicSel-'+slot+'" onchange="redrone(\''+slot+'\')">'+TONICS.map(t=>'<option'+(t===ton?' selected':'')+'>'+t+'</option>').join('')+'</select></div>'
    +'<div class="fld"><label for="octSel-'+slot+'">Registre</label><select id="octSel-'+slot+'" onchange="redrone(\''+slot+'\')"><option value="0">Grave</option><option value="1">Médium</option></select></div>'
    +'<label class="sub" for="fifthChk-'+slot+'"><input type="checkbox" id="fifthChk-'+slot+'" checked onchange="redrone(\''+slot+'\')"> avec la quinte</label>'
    +'</div></details>';
}

/* métronome, avec montée automatique du tempo */
let metroT=null,metroUiT=null,M=null;
function metroUI(){
  const e=document.getElementById('rampInfo');if(!M||!M.ramp)return;
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
}
function keepTempo(id,v){
  setTempo(id,String(v));const b=document.getElementById('bpm');if(b)b.value=v;
  const e=document.getElementById('rampInfo');if(e)e.textContent='Tempo retenu : croche = '+v;
}
function numVal(id,def){const e=document.getElementById(id);const v=e?+e.value:NaN;return isNaN(v)||v<=0?def:v}
function toggleMetro(itemId){
  if(metroT){stopMetro();return}
  const bpm0=Math.max(20,Math.min(260,numVal('bpm',60)));
  const chk=document.getElementById('rampChk'),ramp=!!(chk&&chk.checked);
  M={bpm:bpm0,start:bpm0,ramp,step:numVal('rampStep',4),reps:Math.max(1,numVal('rampReps',4)),per:Math.max(1,numVal('rampBeats',12)),cap:Math.min(260,numVal('rampMax',120)),beats:0,rep:0,itemId:itemId||null};
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
  const b=document.getElementById('refA');if(b)b.textContent='▶ La de référence ('+(state.diapason/2)+' Hz)';
  if(drone)redrone(drone.slot);
}
