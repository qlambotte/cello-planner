/* ---------- suivi ---------- */
function renderStats(){
  const today=todayStr(),logs=state.logs||{},mins=d=>(logs[d]&&logs[d].mins)||0;
  let streak=0,d=today;if(!mins(d))d=addDays(d,-1);
  while(mins(d)>0){streak++;d=addDays(d,-1)}
  const wk={};Object.keys(logs).forEach(k=>{if(mins(k)){const w=lastWednesday(k);wk[w]=(wk[w]||0)+mins(k)}});
  const cw=lastWednesday(today),weeks=[];for(let i=7;i>=0;i--)weeks.push(addDays(cw,-7*i));
  const total=Object.keys(logs).reduce((a,k)=>a+mins(k),0),days=Object.keys(logs).filter(k=>mins(k)>0).length;
  let h='<div class="card"><h3>Régularité</h3><p><strong>'+streak+'</strong> jour'+(streak>1?'s':'')+' de suite · '+(wk[cw]||0)+' min cette semaine · '+days+' jour'+(days>1?'s':'')+' joué'+(days>1?'s':'')+' · '+Math.floor(total/60)+' h '+pad(total%60)+' au total</p>';
  const dow=(parse(today).getDay()+6)%7,start=addDays(today,-dow-21);
  h+='<div class="cal" role="img" aria-label="Minutes jouées sur quatre semaines">'+['L','M','M','J','V','S','D'].map(x=>'<span class="ch">'+x+'</span>').join('');
  for(let i=0;i<28;i++){const dd=addDays(start,i),m=mins(dd);
    h+='<span class="cell'+(m?' on':'')+(dd===today?' now':'')+(dd>today?' fut':'')+'"><small>'+parse(dd).getDate()+'</small>'+(m||'')+'</span>'}
  h+='</div><p class="sub">Chaque case donne le jour du mois et les minutes jouées.</p></div>';
  const mx=Math.max.apply(null,[60].concat(weeks.map(w=>wk[w]||0)));
  let svg='<svg viewBox="0 0 320 130" width="100%" role="img" aria-label="Minutes jouées par semaine"><line x1="6" x2="314" y1="100.5" y2="100.5" style="stroke:var(--line)"/>';
  weeks.forEach((w,i)=>{const v=wk[w]||0,bh=Math.round(80*v/mx),x=10+i*38;
    svg+='<rect x="'+x+'" y="'+(100-bh)+'" width="28" height="'+bh+'" rx="2" style="fill:var(--accent)"/>'
      +(v?'<text x="'+(x+14)+'" y="'+(96-bh)+'" text-anchor="middle" font-size="11" style="fill:var(--ink)">'+v+'</text>':'')
      +'<text x="'+(x+14)+'" y="118" text-anchor="middle" font-size="10" style="fill:var(--muted)">'+parse(w).getDate()+'/'+(parse(w).getMonth()+1)+'</text>'});
  h+='<div class="card"><h3>Minutes par semaine</h3>'+svg+'</svg><p class="sub">Les semaines commencent le mercredi.</p></div>';
  const et=state.items.find(i=>i.kind==='etude'),pts=Object.keys(logs).filter(k=>logs[k].tempo).sort().map(k=>[k,logs[k].tempo]);
  if(et&&pts.length){
    const tg=+et.target||120,lo=Math.min.apply(null,pts.map(p=>p[1]))-8,hi=Math.max.apply(null,[tg].concat(pts.map(p=>p[1])))+8;
    const X=i=>pts.length>1?24+i*(272/(pts.length-1)):160,Y=v=>110-(v-lo)/(hi-lo)*90;
    let g='<svg viewBox="0 0 320 130" width="100%" role="img" aria-label="Tempo de l’étude à chaque séance">'
      +'<line x1="6" x2="314" y1="'+Y(tg)+'" y2="'+Y(tg)+'" stroke-dasharray="4 4" style="stroke:var(--muted)"/><text x="314" y="'+(Y(tg)-4)+'" text-anchor="end" font-size="10" style="fill:var(--muted)">objectif '+tg+'</text>'
      +(pts.length>1?'<polyline fill="none" stroke-width="2" style="stroke:var(--accent)" points="'+pts.map((p,i)=>X(i)+','+Y(p[1])).join(' ')+'"/>':'');
    pts.forEach((p,i)=>{g+='<circle cx="'+X(i)+'" cy="'+Y(p[1])+'" r="3.5" style="fill:var(--accent)"/>'+((i===0||i===pts.length-1)?'<text x="'+X(i)+'" y="'+(Y(p[1])-8)+'" text-anchor="middle" font-size="11" style="fill:var(--ink)">'+p[1]+'</text>':'')});
    h+='<div class="card"><h3>'+esc(et.title)+'</h3>'+g+'</svg><p class="sub">Tempo noté à chaque séance où l’étude est travaillée, en croches par minute.</p></div>';
  }
  return h;
}
