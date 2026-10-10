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
  if(TM&&TM.bid===bid&&TM.date===date&&TM.left>0){
    if(TM.run){TM.left=Math.max(0,Math.ceil((TM.end-Date.now())/1000));TM.run=false;stopTick();releaseWake()}
    else{TM.end=Date.now()+TM.left*1000;TM.run=true;startTick();takeWake()}
    paintTimer();return;
  }
  const b=blocksFor(date).blocks.find(x=>x.id===bid);if(!b)return;
  TM={bid,date,total:b.min*60,left:b.min*60,end:Date.now()+b.min*60000,run:true};
  startTick();takeWake();paintTimer();
}
function resetChrono(){TM=null;guided=false;stopTick();releaseWake();paintTimer();paintGuided()}
function tmStep(){
  if(!TM||!TM.run)return;
  TM.left=Math.max(0,Math.ceil((TM.end-Date.now())/1000));paintTimer();
  if(TM.left<=0)tmDone();
}
function nextBlock(date,bid){
  const bl=blocksFor(date).blocks,l=(state.logs&&state.logs[date])||{},i=bl.findIndex(b=>b.id===bid);
  return bl.slice(i+1).find(b=>!(l.done&&l.done[b.id]))||null;
}
function scrollToEl(id){const e=document.getElementById(id);if(e)e.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'})}
function tmDone(){
  const bid=TM.bid,date=TM.date;stopTick();TM.run=false;TM.left=0;chime();
  if(guided){
    tick(bid,date,true);
    const nb=nextBlock(date,bid);
    if(nb){TM=null;chrono(nb.id,date);scrollToEl('blk-'+nb.id)}
    else{guided=false;TM=null;releaseWake();paintTimer();paintGuided();scrollToEl('blk-clot')}
  }else{releaseWake();paintTimer()}
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
    btn.textContent=act?(TM.left<=0?'Terminé ':TM.run?'⏸ ':'▶ ')+fmtT(TM.left):'▶ '+fmtT(+btn.dataset.min*60);
    btn.classList.toggle('on',act);
    const r=document.getElementById('tr-'+bid);if(r)r.hidden=!act;
    const li=btn.closest('.block');if(li)li.classList.toggle('active',act&&TM.run);
  });
}
