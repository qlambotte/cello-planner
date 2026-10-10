/* ---------- micro : hauteur (voix ou violoncelle), enregistrement ---------- */
function detectPitch(buf,sr){
  const N=buf.length,half=N>>1;let rms=0;for(let i=0;i<N;i++)rms+=buf[i]*buf[i];rms=Math.sqrt(rms/N);if(rms<.008)return null;
  const minLag=Math.floor(sr/1100),maxLag=Math.min(half-1,Math.floor(sr/65));
  const nsdf=new Float32Array(maxLag+2);
  for(let lag=minLag;lag<=maxLag;lag++){let acf=0,m=0;for(let i=0;i<half;i++){const a=buf[i],b=buf[i+lag];acf+=a*b;m+=a*a+b*b}nsdf[lag]=m>0?2*acf/m:0}
  const peaks=[];let lag=minLag;
  while(lag<=maxLag&&nsdf[lag]>0)lag++;
  while(lag<=maxLag){
    while(lag<=maxLag&&nsdf[lag]<=0)lag++;
    let best=lag,bv=-1;
    while(lag<=maxLag&&nsdf[lag]>0){if(nsdf[lag]>bv){bv=nsdf[lag];best=lag}lag++}
    if(bv>0)peaks.push([best,bv]);
  }
  if(!peaks.length)return null;
  const mx=Math.max.apply(null,peaks.map(p=>p[1])),pk=peaks.find(p=>p[1]>=.9*mx);
  if(!pk||pk[1]<.6||pk[0]<=minLag||pk[0]>=maxLag)return null;
  const l=pk[0],a=nsdf[l-1],b=nsdf[l],c=nsdf[l+1],den=a-2*b+c,sh=den?.5*(a-c)/den:0;
  return sr/(l+sh);
}
let MIC=null;
const MIC_OPTS={audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}};
function voiceHtml(){
  return '<details class="adv"><summary>Contrôle de justesse au micro</summary>'
    +'<div class="tools"><button class="btn small" id="micBtn" onclick="toggleMic()">Écouter</button>'
    +'<div class="fld"><label for="vTarget">Note visée</label><select id="vTarget"><option value="">aucune (mélodie)</option>'
    +NOTE_FR.map((n,i)=>'<option value="'+i+'">'+n+'</option>').join('')+'</select></div></div>'
    +'<div class="vread"><span class="vnote" id="vNote">—</span><span class="sub" id="vCents"></span></div>'
    +'<div class="needle" aria-hidden="true"><i id="vNeedle"></i></div>'
    +'<p class="sub">Chante ou joue : l’appli affiche la note entendue et son écart. Choisis une note visée pour vérifier une note tenue. L’octave n’a pas d’importance. Casque conseillé si le bourdon joue.</p></details>';
}
async function toggleMic(){
  if(MIC){stopMic();return}
  try{
    const stream=await navigator.mediaDevices.getUserMedia(MIC_OPTS);
    const c=ctx(),src=c.createMediaStreamSource(stream),an=c.createAnalyser();an.fftSize=4096;src.connect(an);
    MIC={stream,src,an,buf:new Float32Array(an.fftSize),hist:[],iv:setInterval(micStep,60)};
    const b=document.getElementById('micBtn');if(b)b.textContent='Arrêter l’écoute';
  }catch(e){const n=document.getElementById('vNote');if(n)n.textContent='Micro indisponible';const c=document.getElementById('vCents');if(c)c.textContent='Autorise le micro pour ce site dans le navigateur.'}
}
function stopMic(){
  if(!MIC)return;clearInterval(MIC.iv);try{MIC.src.disconnect()}catch(e){}MIC.stream.getTracks().forEach(t=>t.stop());MIC=null;
  const b=document.getElementById('micBtn');if(b)b.textContent='Écouter';paintVoice(null);
}
function micStep(){
  const m=MIC;if(!m)return;m.an.getFloatTimeDomainData(m.buf);
  m.hist.push(detectPitch(m.buf,actx.sampleRate));if(m.hist.length>5)m.hist.shift();
  const v=m.hist.filter(x=>x).sort((a,b)=>a-b);
  paintVoice(v.length>=3?v[v.length>>1]:null);
}
function paintVoice(f){
  const note=document.getElementById('vNote'),cent=document.getElementById('vCents'),nd=document.getElementById('vNeedle');if(!note)return;
  if(!f){note.textContent='—';cent.textContent='';nd.style.left='50%';nd.classList.remove('ok');return}
  const mf=69+12*Math.log2(f/A4()),tv=document.getElementById('vTarget').value;let dev,range,name_;
  if(tv!==''){const t=+tv,tm=t+12*Math.round((mf-t)/12);dev=(mf-tm)*100;range=100;name_=NOTE_FR[t]}
  else{const nr=Math.round(mf);dev=(mf-nr)*100;range=50;name_=midiName(nr)}
  const ok=Math.abs(dev)<=20;
  note.textContent=name_;
  cent.textContent=(dev>=0?'+':'−')+Math.abs(Math.round(dev))+' cents · '+(ok?'juste':dev>0?'trop haut':'trop bas');
  nd.style.left=(50+Math.max(-1,Math.min(1,dev/range))*50)+'%';nd.classList.toggle('ok',ok);
}

/* enregistrement et réécoute */
let REC=null,recURL=null,recOwner=null,recI=null;
function recHtml(bid){
  const on=REC&&REC.bid===bid;
  let h='<div class="tools"><button class="btn small" id="recBtn-'+bid+'" onclick="toggleRec(\''+bid+'\')">'+(on?'■ Arrêter ('+fmtT((Date.now()-REC.t0)/1000)+')':'● Enregistrer')+'</button></div>';
  if(recURL&&recOwner===bid&&!REC)h+='<audio id="aud-'+bid+'" controls src="'+recURL+'"></audio><div class="chips"><button class="chip" onclick="rate(\''+bid+'\',.75)">0,75×</button><button class="chip" onclick="rate(\''+bid+'\',1)">1×</button></div><p class="sub">L’enregistrement n’est pas conservé : il disparaît quand tu fermes la page.</p>';
  return h;
}
function rate(bid,r){const a=document.getElementById('aud-'+bid);if(a)a.playbackRate=r}
function paintRec(bid){const e=document.getElementById('rec-'+bid);if(e)e.innerHTML=recHtml(bid)}
async function toggleRec(bid){
  if(REC){REC.mr.stop();return}
  try{
    const stream=await navigator.mediaDevices.getUserMedia(MIC_OPTS),mr=new MediaRecorder(stream),chunks=[];
    mr.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
    mr.onstop=()=>{
      stream.getTracks().forEach(t=>t.stop());clearInterval(recI);
      if(recURL)URL.revokeObjectURL(recURL);
      recURL=URL.createObjectURL(new Blob(chunks,{type:mr.mimeType||'audio/webm'}));recOwner=bid;REC=null;paintRec(bid);
    };
    mr.start();REC={mr,bid,t0:Date.now()};paintRec(bid);
    recI=setInterval(()=>{const b=document.getElementById('recBtn-'+bid);if(b&&REC)b.textContent='■ Arrêter ('+fmtT((Date.now()-REC.t0)/1000)+')'},500);
  }catch(e){const el=document.getElementById('rec-'+bid);if(el)el.insertAdjacentHTML('beforeend','<p class="todo">Micro indisponible ou refusé : autorise-le pour ce site dans le navigateur.</p>')}
}
