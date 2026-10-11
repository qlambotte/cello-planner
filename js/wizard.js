/* ---------- assistant « semaine suivante » (carnet de cours) ----------
   1. Un texte libre (collé ou dicté) peut remplir les fiches.
   2. Les fiches sont préremplies avec la semaine en cours : on ne change que ce qui change.
   3. Une fiche par élément : mesures, tempo, consigne.
   Rien n'est modifié avant « Valider la semaine ». */
let WZ=null;
const blankDraft=()=>({pid:'',label:'',bars:'',tempo:'',how:''});
const fromPass=p=>({pid:p.id,label:p.label||'',bars:p.bars||'',tempo:p.tempo||'',how:p.how||''});
function nextWeekStart(){
  const t=todayStr();let w=addDays(state.weekStart,7);
  if(t>addDays(w,6))w=lastWednesday(t);
  return w;
}
function openWizard(){
  WZ={text:'',unk:[],dec:{},title:{},tonic:{},pass:{},etempo:{},estage:{},add:[]};
  state.items.forEach(it=>{WZ.dec[it.id]='keep';WZ.title[it.id]=it.title;WZ.tonic[it.id]=it.tonic||'';WZ.pass[it.id]=(it.passages||[]).map(fromPass);WZ.etempo[it.id]=it.tempo||''});
  resetChrono();tab='wizard';render();window.scrollTo(0,0);
}

/* ---- analyse du texte libre ---- */
const norm=s=>String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const STOP=['les','des','etude','piece','methode','concertino','mouvement','premier','pour','dans','avec','1er','nouvel','element'];
function itemWords(it){
  return norm([it.title,it.short].filter(Boolean).join(' ')).split(/[^a-z0-9]+/).filter(w=>w.length>=3&&!STOP.includes(w));
}
const RNG='(\\d+(?:\\s*(?:à|a|-|–|—)\\s*\\d+)?)';
const tidyRng=s=>s.replace(/\s*(?:à|a|-|–|—)\s*/,' à ');
function parseLine(rest,it){
  let bars='',page='',tempo='',stage='';
  rest=rest.replace(new RegExp('\\b(?:mesures?|mes|m)\\.?\\s*'+RNG,'i'),(m,a)=>{bars=tidyRng(a);return ' '});
  rest=rest.replace(new RegExp('\\b(?:pages?|pp?)\\.?\\s*'+RNG,'i'),(m,a)=>{page=tidyRng(a);return ' '});
  rest=rest.replace(/(?:♩|croche|noire)?\s*=\s*(\d{2,3})\b/i,(m,a)=>{tempo=a;return ' '});
  if(!tempo)rest=rest.replace(/\b(?:tempo|à|a)\s*(\d{2,3})\b/i,(m,a)=>{if(+a>=30&&+a<=240){tempo=a;return ' '}return m});
  if(/\bli[ée]s?\s*(?:par\s*)?12\b|\blie12\b/i.test(rest))stage='lie12';
  else if(/\bpar\s*4\b/i.test(rest))stage='par4';
  const how=rest.replace(/^[\s:;,.\-–—]+/,'').replace(/\s{2,}/g,' ').trim();
  return {bars:bars||(page?'p. '+page:''),page,tempo,stage,how,
    label:page?'Page '+page:bars?'Mesures '+bars:'Passage'};
}
function wzParse(){
  const ta=document.getElementById('wzText');WZ.text=ta?ta.value:WZ.text;
  const lines=WZ.text.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const words={};state.items.forEach(it=>{words[it.id]=itemWords(it)});
  const fresh={};WZ.unk=[];let cur=null,last=null;
  lines.forEach(line=>{
    const n=norm(line);let hit=null,hw='';
    state.items.some(it=>words[it.id].some(w=>{if(n.includes(w)){hit=it;hw=w;return true}return false}));
    if(!hit){
      const K={etude:'etude',piece:'piece',methode:'methode'};
      Object.keys(K).some(k=>{const l=state.items.filter(i=>i.kind===k);if(l.length===1&&n.includes(K[k])){hit=l[0];hw=K[k];return true}return false});
    }
    let rest=line;
    if(hit){cur=hit;rest=line.replace(new RegExp(hw.split('').join('[^ ]?'),'i'),' ')}
    else if(!cur){WZ.unk.push(line);return}
    const r=parseLine(rest,cur),hasData=r.bars||r.tempo;
    if(!hit&&last&&!hasData){if(r.how)last.how=(last.how?last.how+' ':'')+r.how;return}
    const d={pid:'',label:r.label,bars:r.bars,tempo:cur.kind==='etude'?'':(r.tempo?'♩ = '+r.tempo:''),how:r.how};
    if(!fresh[cur.id])fresh[cur.id]=[];fresh[cur.id].push(d);last=d;
    if(cur.kind==='etude'){if(r.tempo)WZ.etempo[cur.id]=+r.tempo;if(r.stage)WZ.estage[cur.id]=r.stage}
  });
  Object.keys(fresh).forEach(id=>{WZ.dec[id]='keep';WZ.pass[id]=fresh[id]});
  keepY(()=>{});
}

/* ---- fiches ---- */
const refS=ref=>typeof ref==='number'?String(ref):"'"+ref+"'";
const listOf=ref=>typeof ref==='number'?WZ.add[ref].pass:WZ.pass[ref];
function draftsHtml(prefix,ref,kind){
  const R=refS(ref),list=listOf(ref);
  const ph=kind==='methode'?'ex. Exercice 3':kind==='etude'?'ex. Étude entière':'ex. Thème, passage difficile';
  const pb=kind==='methode'?'ex. p. 38':'ex. 12 à 20';
  let h='';
  list.forEach((p,i)=>{
    const q=prefix+'-'+i;
    h+='<div class="pass"><div class="grid3"><div class="fld"><label for="'+q+'-l">Passage</label><input type="text" id="'+q+'-l" value="'+esc(p.label)+'" placeholder="'+ph+'" oninput="wzP('+R+','+i+',\'label\',this.value)"></div>'
      +'<div class="fld"><label for="'+q+'-b">Mesures ou pages</label><input type="text" id="'+q+'-b" value="'+esc(p.bars)+'" placeholder="'+pb+'" oninput="wzP('+R+','+i+',\'bars\',this.value)"></div>'
      +'<div class="fld"><label for="'+q+'-tp">Tempo</label><input type="text" id="'+q+'-tp" value="'+esc(p.tempo)+'" placeholder="ex. ♩ = 80" oninput="wzP('+R+','+i+',\'tempo\',this.value)"></div></div>'
      +'<div class="fld"><label for="'+q+'-h">Consigne de la prof</label><textarea id="'+q+'-h" placeholder="Quoi retravailler, comment" oninput="wzP('+R+','+i+',\'how\',this.value)">'+esc(p.how)+'</textarea></div>'
      +(list.length>1?'<div><button class="btn danger small" id="'+q+'-x" onclick="wzDel('+R+','+i+')">Retirer ce passage</button></div>':'')+'</div>';
  });
  return h+'<div><button class="btn ghost small" id="'+prefix+'-more" onclick="wzMore('+R+')">+ un passage</button></div>';
}
function renderWizard(){
  if(!WZ)openWizard();
  const w=nextWeekStart();
  let h='<p class="eyebrow">Préparer la semaine</p><h2 class="nocap">Du '+esc(fmtLong(w))+' au '+esc(fmtLong(addDays(w,6)))+'</h2>'
    +'<p class="sub" style="margin-block:6px 14px">Les fiches reprennent la semaine en cours : ne modifie que ce qui change. Rien n’est enregistré avant de valider.</p>';
  h+='<div class="card"><div class="fld"><label for="wzText">Notes du cours (à coller ou dicter)</label><textarea id="wzText" placeholder="ex.&#10;Matz mes. 12 à 20, à ♩ = 80, sans vibrato&#10;Dotzauer lié par 12, croche = 100&#10;Bex p. 38, ex. 3 lent" oninput="WZ.text=this.value">'+esc(WZ.text)+'</textarea></div>'
    +'<div class="btnrow"><button class="btn small" id="wzParse" onclick="wzParse()">Remplir les fiches avec ce texte</button></div>'
    +'<p class="sub">Une ligne par passage, avec le nom de l’élément (ex. Matz). Mesures, pages et tempo sont reconnus ; le reste devient la consigne. Vérifie les fiches ensuite.</p>';
  if(WZ.unk.length)h+='<div class="banner"><p>Lignes sans élément reconnu (gardées dans tes notes) :</p><p>'+WZ.unk.map(esc).join('<br>')+'</p></div>';
  h+='</div>';
  state.items.forEach(it=>{
    const d=WZ.dec[it.id],k='wz-'+it.id;
    h+='<div class="card"><h3>'+esc(it.title)+'</h3><div class="chips" role="group" aria-label="Suite pour '+esc(it.title)+'">'
      +[['keep','On continue'],['new','Nouveau contenu'],['done','Terminé']].map(([v,l])=>'<button class="chip" id="'+k+'-'+v+'" aria-pressed="'+(d===v)+'" onclick="wzDec(\''+it.id+'\',\''+v+'\')">'+l+'</button>').join('')+'</div>';
    if(d==='keep'){
      if(it.kind==='etude')h+='<div class="grid2"><div class="fld"><label for="'+k+'-et">Tempo actuel (croche)</label><input type="number" id="'+k+'-et" value="'+esc(WZ.etempo[it.id])+'" oninput="WZ.etempo[\''+it.id+'\']=this.value===\'\'?\'\':+this.value"></div>'
        +'<div class="fld"><label for="'+k+'-es">Étape</label><select id="'+k+'-es" onchange="WZ.estage[\''+it.id+'\']=this.value"><option value="">Inchangée</option><option value="par4"'+(WZ.estage[it.id]==='par4'?' selected':'')+'>Par 4</option><option value="lie12"'+(WZ.estage[it.id]==='lie12'?' selected':'')+'>Lié par 12</option></select></div></div>';
      h+=draftsHtml(k,it.id,it.kind);
    }
    if(d==='new'){
      h+='<div class="grid2"><div class="fld"><label for="'+k+'-t">Titre</label><input type="text" id="'+k+'-t" value="'+esc(WZ.title[it.id])+'" oninput="WZ.title[\''+it.id+'\']=this.value"></div>'
        +'<div class="fld"><label for="'+k+'-to">Tonique du bourdon</label><select id="'+k+'-to" onchange="WZ.tonic[\''+it.id+'\']=this.value">'+tonicOptions(WZ.tonic[it.id],'—')+'</select></div></div>'
        +draftsHtml(k,it.id,it.kind);
    }
    if(d==='done')h+='<p class="sub">Cet élément sera retiré du programme. Ses séances passées restent dans le suivi.</p>';
    h+='</div>';
  });
  WZ.add.forEach((a,i)=>{
    const k='wza-'+i;
    h+='<div class="card"><h3>Nouvel élément · '+KINDS[a.kind]+'</h3><div class="grid2"><div class="fld"><label for="'+k+'-t">Titre</label><input type="text" id="'+k+'-t" value="'+esc(a.title)+'" oninput="WZ.add['+i+'].title=this.value"></div>'
      +'<div class="fld"><label for="'+k+'-to">Tonique du bourdon</label><select id="'+k+'-to" onchange="WZ.add['+i+'].tonic=this.value">'+tonicOptions(a.tonic,'—')+'</select></div></div>'
      +draftsHtml(k,i,a.kind)
      +'<div><button class="btn danger small" id="'+k+'-x" onclick="WZ.add.splice('+i+',1);render()">Retirer</button></div></div>';
  });
  h+='<p class="sub">Ajouter un élément :</p><div class="chips"><button class="btn ghost small" id="wzAddPiece" onclick="wzAdd(\'piece\')">+ Pièce</button><button class="btn ghost small" id="wzAddEtude" onclick="wzAdd(\'etude\')">+ Étude</button><button class="btn ghost small" id="wzAddMet" onclick="wzAdd(\'methode\')">+ Méthode</button></div>';
  h+='<div class="btnrow" style="margin-top:18px"><button class="btn" id="wzOk" onclick="wzApply()">Valider la semaine</button><button class="btn ghost" id="wzCancel" onclick="WZ=null;go(\'week\')">Annuler</button></div>';
  return h;
}
/* les champs écrivent dans le brouillon sans redessiner la page (pas de perte de focus) */
function wzP(ref,i,f,v){listOf(ref)[i][f]=v}
function keepY(fn){const y=window.scrollY;fn();render();window.scrollTo(0,y)}
function wzDec(id,v){keepY(()=>{
  const was=WZ.dec[id];WZ.dec[id]=v;
  if(v==='new'&&was!=='new')WZ.pass[id]=[blankDraft()];
  if(v==='keep'&&was==='new')WZ.pass[id]=(itemOf(id).passages||[]).map(fromPass);
})}
function wzMore(ref){keepY(()=>listOf(ref).push(blankDraft()))}
function wzDel(ref,i){keepY(()=>{const l=listOf(ref);if(l.length>1)l.splice(i,1)})}
function wzAdd(kind){keepY(()=>WZ.add.push({kind,title:'',tonic:'',pass:[blankDraft()]}))}
function draftsToPassages(list,old){
  const ps=list.filter(p=>p.label.trim()||p.bars.trim()||p.tempo.trim()||p.how.trim()).map(p=>{
    const base=(old||[]).find(o=>o.id===p.pid);
    return Object.assign({},base||{id:rid('p')},{label:p.label.trim()||'Passage',bars:p.bars.trim(),tempo:p.tempo.trim(),how:p.how.trim()});
  });
  return ps.length?ps:[newPass()];
}
function wzApply(){
  const items=[];
  state.items.forEach(it=>{
    const d=WZ.dec[it.id];if(d==='done')return;
    const old=it.passages;
    if(d==='new'){
      const t=(WZ.title[it.id]||'').trim()||it.title;
      if(t!==it.title){it.title=t;it.short=''}
      it.tonic=WZ.tonic[it.id]||'';it.key='';it.goal='';
      it.passages=draftsToPassages(WZ.pass[it.id],[]);
      if(it.kind==='etude'){it.tempo=null;it.stage='par4'}
    }else{
      it.passages=draftsToPassages(WZ.pass[it.id],old);
      if(it.kind==='etude'){
        const t=WZ.etempo[it.id];it.tempo=t===''||t==null?null:+t;
        if(WZ.estage[it.id])it.stage=WZ.estage[it.id];
      }
    }
    items.push(it);
  });
  WZ.add.forEach(a=>{
    if(!a.title.trim())return;
    const it=newItem(a.kind);it.title=a.title.trim();it.tonic=a.tonic||'';
    it.passages=draftsToPassages(a.pass,[]);
    if(a.kind==='etude'){it.target=120;it.tempo=null;it.stage='par4'}
    items.push(it);
  });
  const w=nextWeekStart(),t=todayStr();
  if(WZ.text.trim())state.lessonNote=WZ.text;
  state.items=items;state.weekStart=w;state.created=t>w?t:w;
  WZ=null;selDate=null;save();tab='today';render();window.scrollTo(0,0);
}
