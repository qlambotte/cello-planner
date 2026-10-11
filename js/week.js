/* ---------- semaine ---------- */
function renderWeek(){
  const plans=planWeek(),today=todayStr();
  if(!plans.length)return '<p class="sub">Aucun programme.</p>';
  let h='<p class="eyebrow">Semaine du '+esc(fmtLong(state.weekStart))+' au '+esc(fmtLong(addDays(state.weekStart,6)))+'</p><div class="week" style="margin-top:10px">';
  plans.forEach(P=>{
    const l=(state.logs&&state.logs[P.date])||{};
    let st='',cl='';
    if(isDone(l)){st='Fait · '+(l.mins||P.minutes)+' min';cl='ok'}
    else if(P.skipped){st='Hors programme'}
    else if(P.missed){st='Manqué, reporté';cl='late'}
    else if(P.date===today){st='Aujourd’hui · '+P.minutes+' min'}
    else st=P.minutes+' min';
    const w=P.lesson?'<strong>Cours</strong> · répétition de ce que tu montres'
      :'<strong>'+esc(name(P.pr))+'</strong> · '+esc(P.pass?P.pass.label:'')+(P.sec&&P.minutes>=20?'<br><span class="sub">+ révision '+esc(name(P.sec))+'</span>':'');
    h+='<button class="row'+(P.date===today?' cur':'')+'" onclick="openDay(\''+P.date+'\')"><span class="d">'+esc(fmtShort(P.date))+'</span><span class="w">'+w+'</span><span class="st '+cl+'">'+st+'</span></button>';
  });
  h+='</div>';
  h+='<div class="card"><p>Nouveau programme reçu au cours ?</p><div class="btnrow"><button class="btn" id="newWeekBtn" onclick="openWizard()">Préparer la semaine suivante</button><button class="btn ghost" id="printWeekBtn" onclick="printDays(planWeek().filter(P=>!P.skipped).map(P=>P.date))">Imprimer la semaine</button></div></div>';
  h+='<div class="card"><h3>Réglages</h3><div class="grid2"><div class="fld"><label for="defMin">Durée habituelle d’une séance</label><select id="defMin" onchange="setDefMin(this.value)">'+[15,20,25,30,45,60].map(v=>'<option value="'+v+'"'+((state.defaultMinutes||15)===v?' selected':'')+'>'+v+' min</option>').join('')+'</select></div>'
    +diapHtml('diapSel-w')+'</div>'
    +'<div class="fld"><label for="tolSel">Zone verte de l’accordeur</label><select id="tolSel" onchange="setTolerance(this.value)">'+[3,5,10,15,20].map(v=>'<option value="'+v+'"'+(((+state.tolerance)||10)===v?' selected':'')+'>± '+v+' cents</option>').join('')+'</select></div>'
    +'<div class="fld"><label for="lookSel">Apparence</label><select id="lookSel" onchange="setLook(this.value)">'+LOOKS.map(([k,l])=>'<option value="'+k+'"'+((state.look||"")===k?' selected':'')+'>'+l+'</option>').join('')+'</select></div>'
    +'<p class="sub">La durée peut être changée pour un jour donné depuis l’onglet Aujourd’hui. Le diapason règle le bourdon, les notes jouées et le contrôle de justesse.</p></div>';
  h+='<div class="card"><h3>Sauvegarde</h3><p class="sub">Tes données restent sur cette tablette. Dernière sauvegarde : '+(state.lastExport?esc(fmtShort(state.lastExport)):'jamais')+'.</p>'
    +'<div class="btnrow"><button class="btn small" id="exportBtn" onclick="exportData()">Exporter (fichier JSON)</button><button class="btn ghost small" id="importBtn" onclick="chooseImport()">Importer un fichier</button></div>';
  if(pendingImport)h+='<div class="banner"><p>Remplacer les données de cet appareil par le fichier choisi ? Le programme et l’historique actuels seront perdus.</p><div class="btnrow"><button class="btn danger small" id="importYes" onclick="confirmImport()">Remplacer</button><button class="btn ghost small" id="importNo" onclick="cancelImport()">Annuler</button></div></div>';
  h+='<p class="sub">Pour utiliser un autre appareil : exporter ici, importer là-bas.</p></div>';
  return h;
}
function openDay(d){selDate=d;tab='today';render();window.scrollTo(0,0)}
function setDefMin(v){state.defaultMinutes=+v;save();render()}
