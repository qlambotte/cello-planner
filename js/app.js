/* ---------- coquille : onglets et rendu général ---------- */
function render(){
  const app=document.getElementById('app');
  stopMic();
  if(!ready){app.innerHTML='<p class="sub">Chargement…</p>';return}
  let h='<div class="top"><h1>Planner violoncelle</h1><span class="sync" id="sync">'+esc(syncMsg)+' · '+VERSION+'</span></div>';
  if(!state){
    h+='<div class="empty"><h2>Aucun programme pour l’instant</h2><p class="sub">Crée le programme de la semaine : pièces, études, pages de méthode et consignes de ta prof. Le planner répartit ensuite le travail sur sept jours.</p><div class="btnrow" style="justify-content:center"><button class="btn" id="startBlankBtn" onclick="startBlank()">Créer le programme</button><button class="btn ghost" id="importBtn0" onclick="chooseImport()">Importer une sauvegarde</button></div></div>';
    app.innerHTML=h;return;
  }
  const T=[['today','Aujourd’hui'],['week','Semaine'],['sing','Lecture chantée'],['stats','Suivi'],['prog','Programme']];
  h+='<div class="tabs" role="tablist">'+T.map(([k,l])=>'<button role="tab" id="tab-'+k+'" aria-selected="'+(tab===k)+'" onclick="go(\''+k+'\')">'+l+'</button>').join('')+'</div>';
  h+=tab==='today'?renderToday():tab==='week'?renderWeek():tab==='sing'?renderSing():tab==='stats'?renderStats():tab==='wizard'?renderWizard():renderProg();
  app.innerHTML=h;
  if(tab!=='sing')stopSeq();
  if(typeof scStop==='function'&&!document.getElementById('scBox'))scStop();
  paintTimer();paintGuided();syncAudioUi();
  if(tab==='sing')drawSing();
  if(tab==='today')drawScale();
}
function go(t){tab=t;pendingDel=null;render();window.scrollTo(0,0)}
function startBlank(){state=blankState();save();render()}
