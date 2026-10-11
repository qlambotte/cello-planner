/* ---------- chrono par bloc et séance guidée ---------- */
let TM=null,tmI=null,wake=null,guided=false;
const fmtT=s=>Math.floor(s/60)+':'+pad(Math.floor(s%60));
function blocksFor(date){const P=planWeek()[daysBetween(state.weekStart,date)];return {P,blocks:buildBlocks(P)}}
async function takeWake(){try{if('wakeLock' in navigator&&!wake){wake=await navigator.wakeLock.request('screen');wake.addEventListener('release',()=>{wake=null})}}catch(e){}}
function releaseWake(){try{if(wake){wake.release();wake=null}}catch(e){}}
function startTick(){stopTick();tmI=setInterval(tmStep,250)}
function stopTick(){if(tmI){clearInterval(tmI);tmI=null}}
function chrono(bid,date){
  ctx();
  if(TM&&TM.bid===bid&&TM.date===date){
    if(TM.run){TM.left=Math.ceil((TM.end-Date.now())/1000);TM.run=false;stopTick();releaseWake()}
    else{TM.end=Date.now()+TM.left*1000;TM.run=true;startTick();takeWake()}
    paintTimer();return;
  }
  const b=blocksFor(date).blocks.find(x=>x.id===bid);if(!b)return;
  TM={bid,date,total:b.min*60,left:b.min*60,end:Date.now()+b.min*60000,run:true,over:false};
  startTick();takeWake();paintTimer();
}
function resetChrono(){TM=null;guided=false;stopTick();releaseWake();paintTimer();paintGuided()}
function tmStep(){
  if(!TM||!TM.run)return;
  TM.left=Math.ceil((TM.end-Date.now())/1000);
  if(TM.left<=0&&!TM.over)tmDone();
  paintTimer();
}
function nextBlock(date,bid){
  const bl=blocksFor(date).blocks,l=(state.logs&&state.logs[date])||{},i=bl.findIndex(b=>b.id===bid);
  return bl.slice(i+1).find(b=>!(l.done&&l.done[b.id]))||null;
}
function scrollToEl(id){
  if(id.indexOf('blk-')===0&&typeof gotoBlock==='function'){gotoBlock(id.slice(4));return}const e=document.getElementById(id);if(e)e.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'})}
/* fin du temps : bip et vibration, puis le compteur continue en « + m:ss » ; seul un arrêt explicite ou un changement de phase le coupe */
function tmDone(){
  TM.over=true;chime();
  try{if(navigator.vibrate)navigator.vibrate([250,120,250,120,250])}catch(e){}
  if(guided)tick(TM.bid,TM.date,true);
}
/* en séance guidée, passer à une autre phase arrête le chrono précédent et lance celui de la nouvelle */
function guidedFollow(phaseIdx){
  if(!guided||!PH.date||phaseIdx<1)return;
  const idx=daysBetween(state.weekStart,PH.date);if(idx<0||idx>6)return;
  const b=buildBlocks(planWeek()[idx])[phaseIdx-1];
  if(b&&!(TM&&TM.bid===b.id&&TM.date===PH.date))chrono(b.id,PH.date);
}
function toggleGuided(date){
  if(guided){resetChrono();return}
  const {blocks}=blocksFor(date),l=(state.logs&&state.logs[date])||{};
  const first=blocks.find(b=>!(l.done&&l.done[b.id]))||blocks[0];
  guided=true;TM=null;chrono(first.id,date);paintGuided();scrollToEl('blk-'+first.id);
}
function paintGuided(){
  const b=document.getElementById('guideBtn');if(b)b.textContent=guided?'Arrêter la séance guidée':'Démarrer la séance guidée';
}
function paintTimer(){
  document.querySelectorAll('.chrono').forEach(btn=>{
    const bid=btn.dataset.bid,act=!!(TM&&TM.bid===bid&&TM.date===btn.dataset.date);
    btn.textContent=act?(TM.run?'⏸ ':'▶ ')+(TM.over||TM.left<0?'+'+fmtT(-TM.left):fmtT(TM.left)):'▶ '+fmtT(+btn.dataset.min*60);
    btn.classList.toggle('on',act);
    const r=document.getElementById('tr-'+bid);if(r)r.hidden=!act;
    const li=btn.closest('.block');if(li)li.classList.toggle('active',act&&TM.run);
  });
}
