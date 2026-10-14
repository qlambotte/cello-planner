/* ---------- partage de la semaine entre appareils : QR codes (ou lien à coller) ---------- */
const SH={urls:[],idx:0,full:'',open:false,pend:null,msg:'',busy:false,scan:null,err:''};
const SH_KEY='cello-qr-in';
const b64u=u=>{let s='';for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const unb64u=t=>{t=t.replace(/-/g,'+').replace(/_/g,'/');while(t.length%4)t+='=';const s=atob(t),u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u};
async function pipe(u,S){const st=new S('deflate-raw'),w=st.writable.getWriter();w.write(u);w.close();return new Uint8Array(await new Response(st.readable).arrayBuffer())}
function weekPayload(){const s=state;return {v:1,w:s.weekStart,c:s.created,m:s.defaultMinutes,pd:s.perDay||{},rd:s.reading||[],ln:s.lessonNote||'',it:s.items}}
async function shBuild(){
  const u8=new TextEncoder().encode(JSON.stringify(weekPayload()));
  let tag='r',buf=u8;
  if(typeof CompressionStream!=='undefined'){try{buf=await pipe(u8,CompressionStream);tag='z'}catch(e){buf=u8;tag='r'}}
  const all=tag+b64u(buf),base=location.href.split('#')[0],id=rid('').slice(0,4);
  const per=Math.max(150,380-base.length-16),n=Math.ceil(all.length/per),urls=[];
  for(let i=0;i<n;i++)urls.push(base+'#q='+id+'.'+(i+1)+'.'+n+'.'+all.slice(i*per,(i+1)*per));
  SH.urls=urls;SH.idx=0;SH.full=base+'#q='+id+'.1.1.'+all;
}
async function shShow(){
  if(!state)return;SH.busy=true;SH.err='';render();
  try{await shBuild();SH.open=true}catch(e){SH.err='Impossible de préparer le QR code : '+e.message}
  SH.busy=false;render();
}
function shClose(){SH.open=false;render()}
function shNav(d){SH.idx=(SH.idx+d+SH.urls.length)%SH.urls.length;render()}
async function shCopy(){
  try{await navigator.clipboard.writeText(SH.full);SH.err='Lien copié : colle-le dans un message pour l’envoyer à la tablette.'}
  catch(e){SH.err='Copie impossible ici : utilise les QR codes.'}
  render();
}
/* ---- réception ---- */
function shParts(text){
  const re=/#q=([A-Za-z0-9]+)\.(\d+)\.(\d+)\.([A-Za-z0-9_-]+)/g;let m,got=0;
  while((m=re.exec(text))){
    let st=null;try{st=JSON.parse(localStorage.getItem(SH_KEY))}catch(e){}
    if(!st||st.id!==m[1]||st.n!==+m[3])st={id:m[1],n:+m[3],p:{}};
    st.p[m[2]]=m[4];got++;
    try{localStorage.setItem(SH_KEY,JSON.stringify(st))}catch(e){}
  }
  return got;
}
async function shCheck(){
  let st=null;try{st=JSON.parse(localStorage.getItem(SH_KEY))}catch(e){}
  if(!st)return;
  const have=Object.keys(st.p).length;
  if(have<st.n){SH.msg='QR code '+have+' sur '+st.n+' reçu. Scanne les autres (dans n’importe quel ordre).';return}
  try{
    const all=Array.from({length:st.n},(_,i)=>st.p[i+1]).join('');
    let u8=unb64u(all.slice(1));
    if(all[0]==='z')u8=await pipe(u8,DecompressionStream).catch(()=>{throw new Error('compression')});
    const d=JSON.parse(new TextDecoder().decode(u8));
    if(!d||!Array.isArray(d.it))throw new Error('format');
    SH.pend=d;SH.msg='';
  }catch(e){SH.msg='';SH.err='QR codes illisibles ou incomplets : recommence l’envoi depuis le téléphone.'}
  try{localStorage.removeItem(SH_KEY)}catch(e){}
}
async function shReceive(text){
  const n=shParts(text||'');
  if(!n){SH.err='Aucun lien de semaine reconnu.';render();return n}
  SH.err='';await shCheck();render();return n;
}
async function shFromHash(){
  if(!/^#q=/.test(location.hash))return;
  const h=location.hash;
  try{history.replaceState(null,'',location.pathname+location.search)}catch(e){}
  shParts(h);await shCheck();
}
function shPaste(){const e=document.getElementById('shPaste');if(e&&e.value.trim()){shReceive(e.value);e.value=''}}
function shCancelRecv(){try{localStorage.removeItem(SH_KEY)}catch(e){}SH.msg='';SH.pend=null;SH.err='';render()}
function shApply(){
  const d=SH.pend;if(!d)return;
  const old=state?state.weekStart:null;
  if(!state)state=blankState();
  state.items=d.it.map(it=>{it.id=it.id||rid('i');(it.passages||[]).forEach(p=>{p.id=p.id||rid('p')});return it});
  state.weekStart=d.w||state.weekStart;state.defaultMinutes=d.m||state.defaultMinutes;state.perDay=d.pd||{};
  if(Array.isArray(d.rd)&&d.rd.length)state.reading=d.rd;
  state.lessonNote=d.ln||'';
  if(old!==state.weekStart)state.created=d.c||todayStr();
  normalize(state);selDate=null;SH.pend=null;save();tab='today';render();window.scrollTo(0,0);
}
function shBanner(){
  if(SH.pend){
    const d=SH.pend,ws=d.w?fmtShort(d.w):'';
    return '<div class="banner" id="shBanner"><p>Semaine reçue'+(ws?' (à partir du '+esc(ws)+')':'')+' : '+d.it.length+' élément'+(d.it.length>1?'s':'')+' — '+esc(d.it.map(i=>i.short||i.title).join(', '))+'. Remplacer le programme de cet appareil ? L’historique est conservé.</p><div class="btnrow"><button class="btn small" id="shYes" onclick="shApply()">Remplacer</button><button class="btn ghost small" id="shNo" onclick="shCancelRecv()">Ignorer</button></div></div>';
  }
  if(SH.msg)return '<div class="banner" id="shBanner"><p>'+esc(SH.msg)+'</p><div class="btnrow"><button class="btn small" id="shScan2" onclick="shScan()"'+('BarcodeDetector' in window?'':' hidden')+'>Scanner</button><button class="btn ghost small" id="shNo" onclick="shCancelRecv()">Annuler</button></div></div>';
  return '';
}
/* ---- carte dans l'onglet Semaine ---- */
function shHtml(){
  let h='<div class="card" id="shCard"><h3>Envoyer ou recevoir la semaine</h3><p class="sub">Compose la semaine sur le téléphone, puis envoie-la à la tablette par QR code.</p>';
  if(SH.err)h+='<p class="sub" id="shErr" role="status">'+esc(SH.err)+'</p>';
  if(SH.busy)h+='<p class="sub">Préparation…</p>';
  if(SH.open&&SH.urls.length){
    const q=QR.encode(SH.urls[SH.idx]);
    h+='<div class="shqr" id="shQr">'+QR.svg(q,Math.min(340,Math.max(240,(window.innerWidth||360)-72)))+'</div>'
      +'<p class="sub" id="shCap" style="text-align:center">QR code '+(SH.idx+1)+' sur '+SH.urls.length+(SH.urls.length>1?' : scanne-les tous avec l’appareil photo de la tablette, dans n’importe quel ordre.':' : scanne-le avec l’appareil photo de la tablette.')+'</p>'
      +'<div class="btnrow" style="justify-content:center">'+(SH.urls.length>1?'<button class="btn ghost small" id="shPrev" onclick="shNav(-1)">◀ Précédent</button><button class="btn small" id="shNext" onclick="shNav(1)">Suivant ▶</button>':'')
      +'<button class="btn ghost small" id="shCopy" onclick="shCopy()">Copier le lien</button><button class="btn ghost small" id="shClose" onclick="shClose()">Fermer</button></div>';
  }else{
    h+='<div class="btnrow"><button class="btn small" id="shShow" onclick="shShow()"'+(state?'':' disabled')+'>Afficher le QR code de la semaine</button>'
      +('BarcodeDetector' in window?'<button class="btn ghost small" id="shScan" onclick="shScan()">Scanner un QR code</button>':'')+'</div>';
  }
  h+='<details class="adv"><summary>Recevoir sans scanner</summary><p class="sub">Sur la tablette, l’appareil photo ouvre le lien du QR code dans le navigateur. Tu peux aussi coller ici un lien copié sur le téléphone.</p>'
    +'<div class="fld"><label for="shPaste">Lien reçu</label><textarea id="shPaste" rows="2" placeholder="Colle le ou les liens ici"></textarea></div><div class="btnrow"><button class="btn small" id="shPasteBtn" onclick="shPaste()">Importer</button></div></details></div>';
  return h;
}
/* ---- scanner intégré (là où le navigateur sait lire les QR codes) ---- */
async function shScan(){
  if(!('BarcodeDetector' in window)||SH.scan)return;
  const ov=document.createElement('div');ov.id='shScanBox';ov.style.cssText='position:fixed;inset:0;z-index:98;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px';
  ov.innerHTML='<video id="shVideo" playsinline muted style="max-width:100%;max-height:75vh"></video><p style="color:#fff;font:15px system-ui;margin:0" id="shScanMsg">Place le QR code dans l’image.</p><button class="btn" id="shScanStop">Fermer</button>';
  document.body.appendChild(ov);
  const stop=()=>{if(SH.scan){clearInterval(SH.scan.iv);SH.scan.stream.getTracks().forEach(t=>t.stop());SH.scan=null}ov.remove()};
  ov.querySelector('#shScanStop').onclick=stop;
  try{
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}),v=ov.querySelector('#shVideo');
    v.srcObject=stream;await v.play();
    const det=new BarcodeDetector({formats:['qr_code']});
    SH.scan={stream,iv:setInterval(async()=>{
      try{const r=await det.detect(v);
        for(const c of r){if(c.rawValue&&c.rawValue.indexOf('#q=')>=0){
          if(shParts(c.rawValue)){await shCheck();ov.querySelector('#shScanMsg').textContent=SH.pend?'Semaine reçue.':(SH.msg||'Reçu.');
            if(SH.pend||SH.err){stop();render()}else render()}
          }}
      }catch(e){}
    },350)};
  }catch(e){stop();SH.err='Caméra indisponible : autorise-la pour ce site, ou utilise l’appareil photo du système.';render()}
}
window.addEventListener('hashchange',()=>{if(state!==undefined&&ready)shFromHash().then(()=>render())});
