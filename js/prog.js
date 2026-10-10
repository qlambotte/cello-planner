/* ---------- programme ---------- */
function tonicOptions(cur,emptyLabel){
  return '<option value="">'+emptyLabel+'</option>'+TONICS.map(t=>'<option'+(cur===t?' selected':'')+'>'+t+'</option>').join('');
}
function renderProg(){
  const plans=planWeek(),perWeek={};
  plans.forEach(P=>{if(!P.lesson&&P.pr)perWeek[P.pr.id]=(perWeek[P.pr.id]||0)+1});
  let h='<div class="card"><div class="fld"><label for="lessonNoteP">Consignes notées au dernier cours</label><textarea id="lessonNoteP" oninput="state.lessonNote=this.value;save()">'+esc(state.lessonNote||'')+'</textarea></div>'
    +'<div><button class="btn ghost small" id="wizFromProg" onclick="openWizard()">Préparer la semaine suivante</button></div></div>';

  const R=state.reading||[];
  h+='<div class="card"><h3>Passages à lire</h3><p class="sub">Des passages jamais joués, plus faciles que ton programme, pour la lecture chantée : un par séance. Un passage est barré quand tu coches le bloc de lecture.</p>';
  R.forEach(r=>{
    h+='<div class="rrow'+(r.done?' lu':'')+'"><label class="sub" for="rd-'+r.id+'"><input type="checkbox" id="rd-'+r.id+'"'+(r.done?' checked':'')+' onchange="setR(\''+r.id+'\',\'done\',this.checked,1)"> lu</label>'
      +'<input type="text" id="rl-'+r.id+'" value="'+esc(r.label)+'" oninput="setR(\''+r.id+'\',\'label\',this.value)" aria-label="Passage à lire">'
      +'<select id="rt-'+r.id+'" onchange="setR(\''+r.id+'\',\'tonic\',this.value)" aria-label="Tonique du passage">'+tonicOptions(r.tonic,'Tonique')+'</select>'
      +'<button class="btn danger small" id="rx-'+r.id+'" onclick="delR(\''+r.id+'\')" aria-label="Retirer ce passage">×</button></div>';
  });
  h+='<div class="fld"><label for="rBulk">Ajouter des passages (un par ligne)</label><textarea id="rBulk" placeholder="Bex p. 36, ex. 1&#10;Bex p. 36, ex. 2"></textarea></div>'
    +'<div class="btnrow"><button class="btn ghost small" id="rAdd" onclick="addReadings()">Ajouter à la liste</button>'+(R.some(r=>r.done)?'<button class="btn ghost small" id="rClean" onclick="cleanReadings()">Retirer les passages lus</button>':'')+'</div></div>';

  state.items.forEach(it=>{
    const k='f-'+it.id,n=perWeek[it.id]||0;
    h+='<div class="card" id="'+k+'"><div class="grid2"><div class="fld"><label for="'+k+'-t">Titre</label><input type="text" id="'+k+'-t" value="'+esc(it.title)+'" oninput="setI(\''+it.id+'\',\'title\',this.value)"></div>'
      +'<div class="fld"><label for="'+k+'-k">Type</label><select id="'+k+'-k" onchange="setI(\''+it.id+'\',\'kind\',this.value,1)">'+Object.keys(KINDS).map(x=>'<option value="'+x+'"'+(it.kind===x?' selected':'')+'>'+KINDS[x]+'</option>').join('')+'</select></div></div>'
      +'<div class="grid2"><div class="fld"><label for="'+k+'-w">Importance dans la semaine</label><select id="'+k+'-w" onchange="setI(\''+it.id+'\',\'weight\',+this.value,1)">'
        +[[1,'Faible'],[2,'Normale'],[3,'Forte'],[4,'Prioritaire']].map(([v,l])=>'<option value="'+v+'"'+((+it.weight||2)===v?' selected':'')+'>'+l+'</option>').join('')+'</select>'
        +'<span class="sub">Cette semaine : '+n+' séance'+(n>1?'s':'')+' de travail ciblé</span></div>'
      +'<div class="fld"><label for="'+k+'-to">Tonique du bourdon</label><select id="'+k+'-to" onchange="setI(\''+it.id+'\',\'tonic\',this.value)">'+tonicOptions(it.tonic,'—')+'</select></div></div>'
      +'<div class="fld"><label for="'+k+'-g">Objectif</label><input type="text" id="'+k+'-g" value="'+esc(it.goal)+'" oninput="setI(\''+it.id+'\',\'goal\',this.value)"></div>';
    if(it.kind==='etude')h+='<div class="grid3"><div class="fld"><label for="'+k+'-tp">Tempo actuel (croche)</label><input type="number" id="'+k+'-tp" value="'+(it.tempo||'')+'" oninput="setI(\''+it.id+'\',\'tempo\',this.value===\'\'?null:+this.value)"></div>'
      +'<div class="fld"><label for="'+k+'-tg">Tempo visé</label><input type="number" id="'+k+'-tg" value="'+(it.target||120)+'" oninput="setI(\''+it.id+'\',\'target\',+this.value)"></div>'
      +'<div class="fld"><label for="'+k+'-st">Étape</label><select id="'+k+'-st" onchange="setI(\''+it.id+'\',\'stage\',this.value)"><option value="par4"'+(it.stage!=='lie12'?' selected':'')+'>Par 4</option><option value="lie12"'+(it.stage==='lie12'?' selected':'')+'>Lié par 12</option></select></div></div>';
    h+='<details class="adv"><summary>Plus de réglages</summary><div class="fld"><label for="'+k+'-key">Tonalité, en toutes lettres (affichée dans le bloc d’oreille)</label><input type="text" id="'+k+'-key" value="'+esc(it.key)+'" oninput="setI(\''+it.id+'\',\'key\',this.value)"></div></details>';
    (it.passages||[]).forEach(p=>{
      const q=k+'-'+p.id;
      h+='<div class="pass"><div class="grid2"><div class="fld"><label for="'+q+'-l">Passage</label><input type="text" id="'+q+'-l" value="'+esc(p.label)+'" oninput="setP(\''+it.id+'\',\''+p.id+'\',\'label\',this.value)"></div>'
        +'<div class="fld"><label for="'+q+'-b">Mesures ou pages</label><input type="text" id="'+q+'-b" value="'+esc(p.bars)+'" placeholder="à préciser" oninput="setP(\''+it.id+'\',\''+p.id+'\',\'bars\',this.value)"></div></div>'
        +'<div class="fld"><label for="'+q+'-h">Consigne de la prof</label><textarea id="'+q+'-h" placeholder="Quoi retravailler, comment, à quel tempo" oninput="setP(\''+it.id+'\',\''+p.id+'\',\'how\',this.value)">'+esc(p.how)+'</textarea></div>'
        +'<details class="adv"><summary>Plus de détails</summary>'
          +'<div class="grid2"><div class="fld"><label for="'+q+'-t">Tempo</label><input type="text" id="'+q+'-t" value="'+esc(p.tempo)+'" placeholder="ex. ♩ = 80" oninput="setP(\''+it.id+'\',\''+p.id+'\',\'tempo\',this.value)"></div>'
          +'<div class="fld"><label for="'+q+'-s">Note de départ</label><input type="text" id="'+q+'-s" value="'+esc(p.start||'')+'" placeholder="ex. Ré3" oninput="setP(\''+it.id+'\',\''+p.id+'\',\'start\',this.value)"></div></div>'
          +'<div class="grid2"><div class="fld"><label for="'+q+'-pt">Tonique du bourdon pour ce passage</label><select id="'+q+'-pt" onchange="setP(\''+it.id+'\',\''+p.id+'\',\'tonic\',this.value)">'+tonicOptions(p.tonic,'Comme l’élément')+'</select></div>'
          +'<label class="sub" style="align-self:end" for="'+q+'-w"><input type="checkbox" id="'+q+'-w"'+(p.whole?' checked':'')+' onchange="setP(\''+it.id+'\',\''+p.id+'\',\'whole\',this.checked)"> à jouer d’une traite</label></div>'
          +((it.passages||[]).length>1?'<div><button class="btn danger small" id="'+q+'-d" onclick="delPass(\''+it.id+'\',\''+p.id+'\')">Retirer ce passage</button></div>':'')
        +'</details></div>';
    });
    h+='<div class="btnrow"><button class="btn ghost small" id="'+k+'-add" onclick="addPass(\''+it.id+'\')">Ajouter un passage</button>'
      +(pendingDel===it.id
        ?'<button class="btn danger small" id="'+k+'-yes" onclick="delItem(\''+it.id+'\')">Supprimer vraiment</button><button class="btn ghost small" id="'+k+'-no" onclick="pendingDel=null;render()">Annuler</button>'
        :'<button class="btn danger small" id="'+k+'-del" onclick="pendingDel=\''+it.id+'\';render()">Supprimer l’élément</button>')+'</div></div>';
  });
  h+='<div class="chips"><button class="btn ghost" id="add-piece" onclick="addItem(\'piece\')">+ Pièce</button><button class="btn ghost" id="add-etude" onclick="addItem(\'etude\')">+ Étude</button><button class="btn ghost" id="add-met" onclick="addItem(\'methode\')">+ Méthode</button></div>';
  return h;
}
function itemOf(id){return state.items.find(i=>i.id===id)}
function setR(id,f,v,re){const r=state.reading.find(x=>x.id===id);if(!r)return;r[f]=v;save();if(re)render()}
function delR(id){state.reading=state.reading.filter(x=>x.id!==id);save();render()}
function addReadings(){
  const t=document.getElementById('rBulk');const lines=(t?t.value:'').split('\n').map(x=>x.trim()).filter(Boolean);
  lines.forEach(label=>state.reading.push({id:rid('r'),label,tonic:'',done:false}));if(lines.length){save();render()}
}
function cleanReadings(){state.reading=state.reading.filter(x=>!x.done);save();render()}
function setI(id,f,v,re){const it=itemOf(id);it[f]=v;if(f==='title')it.short='';if(f==='kind'&&v==='etude'){it.target=it.target||120;it.stage=it.stage||'par4'}save();if(re){const y=window.scrollY;render();window.scrollTo(0,y)}}
function setP(id,pid,f,v){const p=itemOf(id).passages.find(p=>p.id===pid);p[f]=v;save()}
function addPass(id){itemOf(id).passages.push(newPass());save();const y=window.scrollY;render();window.scrollTo(0,y)}
function delPass(id,pid){const it=itemOf(id);if(it.passages.length>1){it.passages=it.passages.filter(p=>p.id!==pid);save();const y=window.scrollY;render();window.scrollTo(0,y)}}
function addItem(k){const it=newItem(k);if(k==='etude'){it.target=120;it.tempo=null;it.stage='par4'}state.items.push(it);save();render()}
function delItem(id){state.items=state.items.filter(i=>i.id!==id);pendingDel=null;save();render()}
