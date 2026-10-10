/* ---------- état et stockage (navigateur de cet appareil) ---------- */
let state=null, tab='today', selDate=null, pendingDel=null, pendingImport=null, ready=false, PRINT=false, syncMsg='';

function blankState(){
  return {v:1,diapason:440,reading:[],weekStart:lastWednesday(todayStr()),created:todayStr(),defaultMinutes:15,perDay:{},logs:{},lessonNote:'',items:[newItem('piece')]};
}
function newPass(){return {id:rid('p'),label:'Passage',bars:'',tempo:'',how:''}}
function newItem(kind){return {id:rid('i'),kind:kind||'piece',title:'Nouvel élément',short:'',tonic:'',key:'',weight:2,goal:'',passages:[newPass()]}}
function normalize(d){
  d.v=1;d.perDay=d.perDay||{};d.logs=d.logs||{};d.lessonNote=d.lessonNote||'';d.defaultMinutes=d.defaultMinutes||15;
  d.weekStart=d.weekStart||lastWednesday(todayStr());d.created=d.created||todayStr();d.diapason=d.diapason||440;d.reading=Array.isArray(d.reading)?d.reading:[];
  d.items.forEach(i=>{i.passages=Array.isArray(i.passages)&&i.passages.length?i.passages:[newPass()]});
  return d;
}
function setSync(t){syncMsg=t;const e=document.getElementById('sync');if(e)e.textContent=t}
function save(){
  try{localStorage.setItem(LS_KEY,JSON.stringify(state));setSync('Enregistré sur cet appareil')}
  catch(e){setSync('Stockage du navigateur indisponible : exporte tes données')}
}
function init(){
  try{const s=localStorage.getItem(LS_KEY);state=s?JSON.parse(s):null}catch(e){state=null}
  if(state&&!Array.isArray(state.items))state=null;
  if(state)normalize(state);
  ready=true;setSync(state?'Enregistré sur cet appareil':'');
  try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist()}catch(e){}
  if('serviceWorker' in navigator&&/^https?:/.test(location.protocol))navigator.serviceWorker.register('sw.js').catch(()=>{});
  render();
}
function exportData(){
  state.lastExport=todayStr();save();
  const blob=new Blob([JSON.stringify(state,null,1)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='planner-violoncelle-'+todayStr()+'.json';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),3000);
  render();
}
function chooseImport(){document.getElementById('importFile').click()}
function onImport(inp){
  const f=inp.files&&inp.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const d=JSON.parse(r.result);if(!d||!Array.isArray(d.items))throw new Error('format');
      normalize(d);
      if(state){pendingImport=d;tab='week'}else{state=d;save()}
      render();
    }catch(e){pendingImport=null;setSync('Fichier illisible : ce n’est pas une sauvegarde du planner')}
  };
  r.readAsText(f);inp.value='';
}
function confirmImport(){state=pendingImport;pendingImport=null;selDate=null;save();render();window.scrollTo(0,0)}
function cancelImport(){pendingImport=null;render()}
function backupBanner(){
  if(!state)return '';
  const played=Object.keys(state.logs||{}).filter(d=>state.logs[d].mins>0||state.logs[d].finished).length;
  if(played<3)return '';
  const old=!state.lastExport||daysBetween(state.lastExport,todayStr())>=7;
  return old?'<div class="banner"><p>Aucune sauvegarde récente. Les données ne sont que dans ce navigateur.</p><button class="btn small" onclick="exportData()">Exporter une sauvegarde</button></div>':'';
}
