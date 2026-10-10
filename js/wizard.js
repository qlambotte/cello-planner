/* ---------- assistant « semaine suivante » ----------
   Pour chaque élément : on continue / nouveau contenu / terminé. Seuls les champs utiles s'ouvrent.
   Rien n'est modifié avant « Valider la semaine ». */
let WZ=null;
const blankDraft=()=>({label:'',bars:'',how:''});
function nextWeekStart(){
  const t=todayStr();let w=addDays(state.weekStart,7);
  if(t>addDays(w,6))w=lastWednesday(t);
  return w;
}
function openWizard(){
  WZ={dec:{},title:{},tonic:{},pass:{},add:[]};
  state.items.forEach(it=>{WZ.dec[it.id]='keep';WZ.title[it.id]=it.title;WZ.tonic[it.id]=it.tonic||'';WZ.pass[it.id]=[blankDraft()]});
  resetChrono();tab='wizard';render();window.scrollTo(0,0);
}
function draftsHtml(prefix,list,setFn,addFn,kind){
  const ph=kind==='methode'?'ex. Exercice 3':kind==='etude'?'ex. Étude entière':'ex. Thème, passage difficile';
  const pb=kind==='methode'?'ex. p. 38':kind==='etude'?'':'ex. 12 à 20';
  let h='';
  list.forEach((p,i)=>{
    const q=prefix+'-'+i;
    h+='<div class="pass"><div class="grid2"><div class="fld"><label for="'+q+'-l">Passage '+(i+1)+'</label><input type="text" id="'+q+'-l" value="'+esc(p.label)+'" placeholder="'+ph+'" oninput="'+setFn+'('+i+',\'label\',this.value)"></div>'
      +'<div class="fld"><label for="'+q+'-b">Mesures ou pages</label><input type="text" id="'+q+'-b" value="'+esc(p.bars)+'" placeholder="'+pb+'" oninput="'+setFn+'('+i+',\'bars\',this.value)"></div></div>'
      +'<div class="fld"><label for="'+q+'-h">Consigne de la prof</label><textarea id="'+q+'-h" placeholder="Quoi retravailler, comment, à quel tempo" oninput="'+setFn+'('+i+',\'how\',this.value)">'+esc(p.how)+'</textarea></div></div>';
  });
  return h+'<div><button class="btn ghost small" id="'+prefix+'-more" onclick="'+addFn+'">+ un passage</button></div>';
}
function renderWizard(){
  if(!WZ)openWizard();
  const w=nextWeekStart();
  let h='<p class="eyebrow">Préparer la semaine</p><h2 class="nocap">Du '+esc(fmtLong(w))+' au '+esc(fmtLong(addDays(w,6)))+'</h2>'
    +'<p class="sub" style="margin-block:6px 14px">Pour chaque élément, indique ce que ta prof a demandé. Rien n’est modifié avant de valider.</p>';
  h+='<div class="card"><div class="fld"><label for="wzNote">Consignes notées au cours</label><textarea id="wzNote" oninput="state.lessonNote=this.value;save()">'+esc(state.lessonNote||'')+'</textarea></div></div>';
  state.items.forEach(it=>{
    const d=WZ.dec[it.id],k='wz-'+it.id;
    h+='<div class="card"><h3>'+esc(it.title)+'</h3><div class="chips" role="group" aria-label="Suite pour '+esc(it.title)+'">'
      +[['keep','On continue'],['new','Nouveau contenu'],['done','Terminé']].map(([v,l])=>'<button class="chip" id="'+k+'-'+v+'" aria-pressed="'+(d===v)+'" onclick="wzDec(\''+it.id+'\',\''+v+'\')">'+l+'</button>').join('')+'</div>';
    if(d==='keep')h+='<p class="sub">Mêmes passages : '+esc((it.passages||[]).map(p=>p.label).join(', '))+'. Les consignes se modifient dans Programme.</p>';
    if(d==='new'){
      h+='<div class="grid2"><div class="fld"><label for="'+k+'-t">Titre</label><input type="text" id="'+k+'-t" value="'+esc(WZ.title[it.id])+'" oninput="WZ.title[\''+it.id+'\']=this.value"></div>'
        +'<div class="fld"><label for="'+k+'-to">Tonique du bourdon</label><select id="'+k+'-to" onchange="WZ.tonic[\''+it.id+'\']=this.value">'+tonicOptions(WZ.tonic[it.id],'—')+'</select></div></div>'
        +draftsHtml(k,WZ.pass[it.id],'wzP.bind(null,\''+it.id+'\')','wzMore(\''+it.id+'\')',it.kind);
    }
    if(d==='done')h+='<p class="sub">Cet élément sera retiré du programme. Ses séances passées restent dans le suivi.</p>';
    h+='</div>';
  });
  WZ.add.forEach((a,i)=>{
    const k='wza-'+i;
    h+='<div class="card"><h3>Nouvel élément · '+KINDS[a.kind]+'</h3><div class="grid2"><div class="fld"><label for="'+k+'-t">Titre</label><input type="text" id="'+k+'-t" value="'+esc(a.title)+'" oninput="WZ.add['+i+'].title=this.value"></div>'
      +'<div class="fld"><label for="'+k+'-to">Tonique du bourdon</label><select id="'+k+'-to" onchange="WZ.add['+i+'].tonic=this.value">'+tonicOptions(a.tonic,'—')+'</select></div></div>'
      +draftsHtml(k,a.pass,'wzAP.bind(null,'+i+')','wzAMore('+i+')',a.kind)
      +'<div><button class="btn danger small" id="'+k+'-x" onclick="WZ.add.splice('+i+',1);render()">Retirer</button></div></div>';
  });
  h+='<p class="sub">Ajouter un élément :</p><div class="chips"><button class="btn ghost small" id="wzAddPiece" onclick="wzAdd(\'piece\')">+ Pièce</button><button class="btn ghost small" id="wzAddEtude" onclick="wzAdd(\'etude\')">+ Étude</button><button class="btn ghost small" id="wzAddMet" onclick="wzAdd(\'methode\')">+ Méthode</button></div>';
  h+='<div class="btnrow" style="margin-top:18px"><button class="btn" id="wzOk" onclick="wzApply()">Valider la semaine</button><button class="btn ghost" id="wzCancel" onclick="WZ=null;go(\'week\')">Annuler</button></div>';
  return h;
}
/* les champs écrivent dans le brouillon sans redessiner la page (pas de perte de focus) */
function wzP(id,i,f,v){WZ.pass[id][i][f]=v}
function wzAP(i,j,f,v){WZ.add[i].pass[j][f]=v}
function keepY(fn){const y=window.scrollY;fn();render();window.scrollTo(0,y)}
function wzDec(id,v){keepY(()=>{WZ.dec[id]=v})}
function wzMore(id){keepY(()=>WZ.pass[id].push(blankDraft()))}
function wzAMore(i){keepY(()=>WZ.add[i].pass.push(blankDraft()))}
function wzAdd(kind){keepY(()=>WZ.add.push({kind,title:'',tonic:'',pass:[blankDraft()]}))}
function draftsToPassages(list){
  return list.filter(p=>p.label.trim()||p.bars.trim()).map(p=>({id:rid('p'),label:p.label.trim()||'Passage',bars:p.bars.trim(),tempo:'',how:p.how.trim()}));
}
function wzApply(){
  const items=[];
  state.items.forEach(it=>{
    const d=WZ.dec[it.id];if(d==='done')return;
    if(d==='new'){
      const t=(WZ.title[it.id]||'').trim()||it.title;
      if(t!==it.title){it.title=t;it.short=''}
      it.tonic=WZ.tonic[it.id]||'';it.key='';it.goal='';
      const ps=draftsToPassages(WZ.pass[it.id]);it.passages=ps.length?ps:[newPass()];
      if(it.kind==='etude'){it.tempo=null;it.stage='par4'}
    }
    items.push(it);
  });
  WZ.add.forEach(a=>{
    if(!a.title.trim())return;
    const it=newItem(a.kind);it.title=a.title.trim();it.tonic=a.tonic||'';
    const ps=draftsToPassages(a.pass);it.passages=ps.length?ps:[newPass()];
    if(a.kind==='etude'){it.target=120;it.tempo=null;it.stage='par4'}
    items.push(it);
  });
  const w=nextWeekStart(),t=todayStr();
  state.items=items;state.weekStart=w;state.created=t>w?t:w;
  WZ=null;selDate=null;save();tab='today';render();window.scrollTo(0,0);
}
