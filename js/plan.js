/* ---------- planification ---------- */
/* ordre d'ajout des blocs de 5 min au-delà de 15 min : 20 = reprise, 25 = ciblé +5, 30 = continu, 35 = déchiffrage, 40 = intervalles, 45 = 3e élément, 50 = enregistrement */
const EXT=['sec','cibleplus','continu','dechiff','chantext','tert','enreg'];
const dayMinutes=d=>(state.perDay&&state.perDay[d])||state.defaultMinutes||15;

function isDone(l){return !!(l&&(l.finished||(l.done&&(l.done.cible||l.done.repet))))}
function snapOf(P){return {minutes:P.minutes,lesson:!!P.lesson,pr:P.pr&&P.pr.id,pass:P.pass&&P.pass.id,sec:P.sec&&P.sec.id,spass:P.spass&&P.spass.id,ter:P.ter&&P.ter.id,tpass:P.tpass&&P.tpass.id}}
function planWeek(){
  const items=state.items||[]; if(!items.length)return [];
  let W=items.reduce((a,i)=>a+(+i.weight||0),0); const eq=W===0; if(eq)W=items.length;
  const wt=i=>(eq?1:(+i.weight||0))/W;
  const cnt={},scnt={},stuck={}; items.forEach(i=>{cnt[i.id]=0;scnt[i.id]=0});
  const byId=id=>items.find(i=>i.id===id)||null;
  const passOf=(it,id)=>it?((it.passages||[]).find(p=>p.id===id)||null):null;
  const pick=(it,n,stk)=>{if(!it)return null;const ps=it.passages||[];if(!ps.length)return null;
    const s=stk&&ps.find(p=>p.id===stk);return s||ps[Math.floor(n)%ps.length]};
  const today=todayStr(),out=[]; let slot=0;
  const seen=new Set(),key=(it,p)=>it&&p?it.id+'/'+p.id:'';
  /* passages déjà joués (principal ou reprise) : la lecture chantée n'y revient pas */
  const markSeen=P=>{seen.add(key(P.pr,P.pass));if(P.minutes>=20)seen.add(key(P.sec,P.spass));if(P.minutes>=45)seen.add(key(P.ter,P.tpass))};
  Object.keys(state.logs||{}).forEach(d=>{const l=state.logs[d],s=l&&l.snap;if(d<state.weekStart&&isDone(l)&&s&&s.pr){
    seen.add(s.pr+'/'+s.pass);if(s.minutes>=20&&s.sec)seen.add(s.sec+'/'+s.spass);if(s.minutes>=45&&s.ter)seen.add(s.ter+'/'+s.tpass)}});
  for(let k=0;k<7;k++){
    const date=addDays(state.weekStart,k),log=(state.logs||{})[date],m=dayMinutes(date),lesson=k===6;
    let P;
    if(isDone(log)&&log.snap){
      const s=log.snap,pr=byId(s.pr),sec=byId(s.sec),ter=byId(s.ter);
      P={date,k,lesson:!!s.lesson,minutes:s.minutes||m,pr,pass:passOf(pr,s.pass),sec,spass:passOf(sec,s.spass),ter,tpass:passOf(ter,s.tpass),finished:true};
      P.passFirst=!seen.has(key(P.pr,P.pass));markSeen(P);
      if(pr){cnt[pr.id]++;if(log.rating==='coince')stuck[pr.id]=s.pass;else delete stuck[pr.id]}
      if(sec)scnt[sec.id]++; if(ter)scnt[ter.id]++;
      if(!s.lesson)slot++;
    }else if(lesson){
      P={date,k,lesson:true,minutes:m,items};
    }else{
      const inactive=date<(state.created||state.weekStart);
      if(!inactive)slot++;
      const sc=items.map((i,ix)=>({i,ix,d:wt(i)*(inactive?slot+1:slot)-cnt[i.id]}))
        .sort((a,b)=>b.d-a.d||cnt[a.i.id]-cnt[b.i.id]||a.ix-b.ix);
      const ov=log&&log.pick?byId(log.pick.pr):null;       // morceau choisi à la main pour ce jour
      const pr=ov||sc[0].i,rest=sc.map(x=>x.i).filter(i=>i!==pr),sec=rest[0]||null,ter=rest[1]||null;
      const opass=ov?passOf(ov,log.pick.pass):null;
      P={date,k,lesson:false,minutes:m,pr,pass:opass||pick(pr,cnt[pr.id],stuck[pr.id]),chosen:!!ov,
         sec,spass:pick(sec,sec?cnt[sec.id]+scnt[sec.id]:0),ter,tpass:pick(ter,ter?cnt[ter.id]+scnt[ter.id]:0)};
      P.skipped=inactive;P.missed=date<today&&!inactive;P.passFirst=!seen.has(key(P.pr,P.pass));
      if(!P.missed&&!inactive){markSeen(P);cnt[pr.id]++;delete stuck[pr.id];if(sec)scnt[sec.id]++;if(ter)scnt[ter.id]++}
    }
    out.push(P);
  }
  return out;
}
const name=i=>i?(i.short||i.title):'';
const refText=(it,p)=>name(it)+(p?' · '+p.label+(p.bars?' ('+p.bars+')':''):'');

function buildBlocks(P){
  const m=P.minutes,B=[];
  if(P.lesson){
    const rep=Math.max(11,m-4);
    B.push({id:'chant',type:'chant',min:3});
    B.push({id:'repet',type:'repet',min:rep});
    B.push({id:'clot',type:'clot',min:1});
    return B;
  }
  const E=Math.max(0,m-15),n=Math.floor(E/5),rem=E-n*5;
  const ext=EXT.slice(0,Math.min(n,EXT.length)),extra=rem+Math.max(0,n-EXT.length)*5;
  B.push({id:'chant',type:'chant',min:ext.includes('chantext')?8:3});
  B.push({id:'lect',type:'lect',min:4});
  B.push({id:'cible',type:'cible',min:7+extra+(ext.includes('cibleplus')?5:0)});
  if(ext.includes('sec')&&P.sec)B.push({id:'sec',type:'rep',min:5,it:P.sec,p:P.spass});
  if(ext.includes('tert')&&P.ter)B.push({id:'tert',type:'rep',min:5,it:P.ter,p:P.tpass});
  if(ext.includes('dechiff'))B.push({id:'dechiff',type:'dechiff',min:5});
  if(ext.includes('continu'))B.push({id:'continu',type:'continu',min:5});
  if(ext.includes('enreg'))B.push({id:'enreg',type:'enreg',min:5});
  B.push({id:'clot',type:'clot',min:1});
  const tot=B.reduce((a,x)=>a+x.min,0);
  if(tot<m)B.find(x=>x.id==='cible').min+=m-tot;
  return B;
}
function wholePassage(){
  for(const it of state.items){const p=(it.passages||[]).find(p=>p.whole);if(p)return [it,p]}
  const it=state.items.find(i=>i.kind==='piece')||state.items[0];
  const ps=(it&&it.passages)||[];return [it,ps[ps.length-1]||null];
}
function lastFeedback(itemId,passId,beforeDate){
  const dates=Object.keys(state.logs||{}).filter(d=>d<beforeDate&&isDone(state.logs[d])&&state.logs[d].snap).sort().reverse();
  for(const d of dates){const l=state.logs[d];if(l.snap.pr===itemId&&l.snap.pass===passId)return {d,r:l.rating,n:l.note}}
  return null;
}
