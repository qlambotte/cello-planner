/* ---------- import d'une œuvre : MusicXML (.musicxml, .xml, .mxl) et MuseScore (.mscz, .mscx) ----------
   Une seule voix par extrait : première voix de la partie choisie, note la plus haute des accords.
   Reprises, changements de mesure et ornements ne sont pas pris en compte. Le zip est lu à la main
   (DecompressionStream) : aucune bibliothèque. */
const IMP={raw:null,sel:0,mode:'maj',lev:2,title:'',comp:'',piece:null,err:'',busy:false,del:null};
const customs=()=>(state&&Array.isArray(state.chantCustom))?state.chantCustom:[];

/* ---- zip ---- */
function zipEntries(buf){
  const dv=new DataView(buf),u8=new Uint8Array(buf);
  let e=u8.length-22;while(e>=0&&dv.getUint32(e,true)!==0x06054b50)e--;
  if(e<0)throw new Error('Fichier zip illisible.');
  const n=dv.getUint16(e+10,true);let p=dv.getUint32(e+16,true);const out=[];
  for(let i=0;i<n;i++){
    if(dv.getUint32(p,true)!==0x02014b50)break;
    const nl=dv.getUint16(p+28,true),el=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true);
    out.push({name:new TextDecoder().decode(u8.subarray(p+46,p+46+nl)),method:dv.getUint16(p+10,true),csz:dv.getUint32(p+20,true),off:dv.getUint32(p+42,true)});
    p+=46+nl+el+cl;
  }
  return out;
}
async function zipRead(buf,ent){
  const dv=new DataView(buf),u8=new Uint8Array(buf),o=ent.off;
  const start=o+30+dv.getUint16(o+26,true)+dv.getUint16(o+28,true),data=u8.subarray(start,start+ent.csz);
  if(ent.method===0)return data;
  if(ent.method!==8)throw new Error('Compression zip non prise en charge.');
  if(typeof DecompressionStream==='undefined')throw new Error('Ce navigateur ne sait pas ouvrir les fichiers compressés : exporte en MusicXML (.musicxml).');
  const s=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
const utf8=u=>new TextDecoder('utf-8').decode(u);

/* ---- lecture du fichier ---- */
async function loadScoreFile(file){
  const buf=await file.arrayBuffer(),u8=new Uint8Array(buf),name=file.name.toLowerCase();
  let text,kind='xml';
  if(u8[0]===0x50&&u8[1]===0x4B){
    const ents=zipEntries(buf);
    if(/\.mxl$/.test(name)){
      const c=ents.find(e=>e.name==='META-INF/container.xml');
      let path=null;
      if(c){const cd=new DOMParser().parseFromString(utf8(await zipRead(buf,c)),'application/xml'),rf=cd.querySelector('rootfile');path=rf&&rf.getAttribute('full-path')}
      const ent=ents.find(e=>e.name===path)||ents.find(e=>/\.(xml|musicxml)$/i.test(e.name)&&!/^META-INF/.test(e.name));
      if(!ent)throw new Error('Aucune partition trouvée dans ce fichier .mxl.');
      text=utf8(await zipRead(buf,ent));
    }else{
      const ent=ents.find(e=>/\.mscx$/i.test(e.name)&&e.name.indexOf('/')<0)||ents.find(e=>/\.mscx$/i.test(e.name));
      if(!ent)throw new Error('Aucune partition trouvée dans ce fichier MuseScore.');
      text=utf8(await zipRead(buf,ent));kind='mscx';
    }
  }else{text=utf8(u8);if(/\.mscx$/.test(name))kind='mscx'}
  const doc=new DOMParser().parseFromString(text,'application/xml');
  if(doc.querySelector('parsererror'))throw new Error('Fichier illisible (XML invalide).');
  return kind==='mscx'?readMscx(doc):readMusicXml(doc);
}
const kids=(el,n)=>Array.from(el.children).filter(c=>c.localName===n);
const kid=(el,n)=>kids(el,n)[0]||null;
const ktxt=(el,n)=>{const k=el&&kid(el,n);return k?k.textContent.trim():''};
const STEPS={C:0,D:1,E:2,F:3,G:4,A:5,B:6};

/* MusicXML (partwise) */
function readMusicXml(doc){
  const root=doc.documentElement;
  if(root.localName!=='score-partwise')throw new Error('Ce MusicXML n’est pas au format « partwise ». Exporte-le de nouveau depuis MuseScore (Fichier, Exporter, MusicXML).');
  const wk=kid(root,'work'),title=(wk&&ktxt(wk,'work-title'))||ktxt(root,'movement-title')||'Sans titre';
  let comp='';const idn=kid(root,'identification');
  if(idn)kids(idn,'creator').forEach(c=>{if(c.getAttribute('type')==='composer')comp=c.textContent.trim()});
  const names={};const pl=kid(root,'part-list');
  if(pl)kids(pl,'score-part').forEach(sp=>{names[sp.getAttribute('id')]=ktxt(sp,'part-name')});
  const warn=new Set(),parts=[];
  kids(root,'part').forEach((pe,pi)=>{
    let div=1,fifths=0,mode='',beats=4,bt=4,timeSet=false,vo=null,st=null;const bars=[];
    kids(pe,'measure').forEach(me=>{
      const ev=[];
      Array.from(me.children).forEach(ch=>{
        const n=ch.localName;
        if(n==='attributes'){
          const d=ktxt(ch,'divisions');if(d)div=+d;
          const k=kid(ch,'key');if(k){fifths=+(ktxt(k,'fifths')||0);const m=ktxt(k,'mode');if(m)mode=m==='minor'?'min':'maj'}
          const t=kid(ch,'time');if(t){const b=+ktxt(t,'beats'),d2=+ktxt(t,'beat-type');if(b&&d2){if(!timeSet){beats=b;bt=d2;timeSet=true}else if(b!==beats||d2!==bt)warn.add('Changements de mesure ignorés.')}}
        }else if(n==='barline'&&kid(ch,'repeat'))warn.add('Reprises non développées.');
        else if(n==='note'){
          if(kid(ch,'grace')||kid(ch,'cue'))return;
          const v=ktxt(ch,'voice')||'1',s=ktxt(ch,'staff')||'1';
          if(vo===null){vo=v;st=s}
          if(v!==vo||s!==st)return;
          const dur=(+ktxt(ch,'duration'))/(div*4),isCh=!!kid(ch,'chord'),pe2=kid(ch,'pitch');
          let e;
          if(pe2){
            const step=STEPS[ktxt(pe2,'step')],alter=Math.round(+ktxt(pe2,'alter')||0),oct=+ktxt(pe2,'octave');
            e={r:false,l:step,alter,oct,dur,midi:12*(oct+1)+NATM[step]+alter};
            kids(ch,'tie').forEach(t=>{if(t.getAttribute('type')==='start')e.tieNext=true;if(t.getAttribute('type')==='stop')e.tied=true});
          }else e={r:true,dur};
          if(isCh){const last=ev[ev.length-1];if(last&&!last.r&&e.midi>last.midi)Object.assign(last,e,{dur:last.dur});return}
          ev.push(e);
        }else if(n==='forward'){if((ktxt(ch,'voice')||vo)===vo)ev.push({r:true,dur:(+ktxt(ch,'duration'))/(div*4)})}
      });
      bars.push({ev,implicit:me.getAttribute('implicit')==='yes'});
    });
    parts.push({name:names[pe.getAttribute('id')]||('Partie '+(pi+1)),fifths,mode,beats,bt,bars});
  });
  return {title,comp,parts,warn:[...warn]};
}

/* MuseScore (.mscx, versions 3 et 4) */
const DT={long:4,breve:2,whole:1,half:.5,quarter:.25,eighth:.125,'16th':1/16,'32nd':1/32,'64th':1/64,'128th':1/128};
function readMscx(doc){
  const score=doc.querySelector('Score');if(!score)throw new Error('Fichier MuseScore non reconnu.');
  let title='',comp='';
  score.querySelectorAll('metaTag').forEach(m=>{const n=m.getAttribute('name');if(n==='workTitle')title=m.textContent.trim();if(n==='composer')comp=m.textContent.trim()});
  if(!title){const t=score.querySelector('VBox Text style, Frame Text style');const tx=score.querySelector('Text');if(tx){const s=tx.querySelector('text');if(s)title=s.textContent.trim()}}
  const warn=new Set(),parts=[];
  const staffs={};kids(score,'Staff').forEach(s=>{staffs[s.getAttribute('id')]=s});
  let plist=kids(score,'Part');
  if(!plist.length)plist=Object.keys(staffs).map(id=>({id,_s:id}));
  plist.forEach((pe,pi)=>{
    let sid=null,name='';
    if(pe._s){sid=pe._s;name='Portée '+sid}
    else{const se=kid(pe,'Staff');sid=se&&se.getAttribute('id');name=ktxt(pe,'trackName')||(kid(pe,'Instrument')&&ktxt(kid(pe,'Instrument'),'longName'))||('Partie '+(pi+1))}
    const S=staffs[sid];if(!S)return;
    let fifths=0,mode='',beats=4,bt=4,timeSet=false,tup=1;const bars=[];
    kids(S,'Measure').forEach(me=>{
      const vo=kid(me,'voice')||me,ev=[];
      Array.from(vo.children).forEach(ch=>{
        const n=ch.localName;
        if(n==='KeySig'){const a=ktxt(ch,'accidental')||ktxt(ch,'concertKey');if(a!=='')fifths=+a;const m=ktxt(ch,'mode');if(m)mode=/minor|aeolian/i.test(m)?'min':'maj'}
        else if(n==='TimeSig'){const b=+ktxt(ch,'sigN'),d=+ktxt(ch,'sigD');if(b&&d){if(!timeSet){beats=b;bt=d;timeSet=true}else if(b!==beats||d!==bt)warn.add('Changements de mesure ignorés.')}}
        else if(n==='Tuplet'){const a=+ktxt(ch,'actualNotes'),b=+ktxt(ch,'normalNotes');if(a&&b)tup=b/a}
        else if(n==='endTuplet')tup=1;
        else if(n==='Chord'||n==='Rest'){
          if(n==='Chord'&&Array.from(ch.children).some(c=>/^(grace|acciaccatura|appoggiatura)/.test(c.localName)))return;
          const dt=ktxt(ch,'durationType');let dur;
          if(dt==='measure'){const f=ktxt(ch,'duration').split('/');dur=f.length===2?(+f[0])/(+f[1]):beats/bt}
          else{dur=(DT[dt]||.25)*(2-Math.pow(2,-(+ktxt(ch,'dots')||0)))*(n==='Chord'?tup:tup)}
          if(n==='Rest'){ev.push({r:true,dur});return}
          let best=null;
          kids(ch,'Note').forEach(nt=>{
            const midi=+ktxt(nt,'pitch'),tpc=ktxt(nt,'tpc');if(!midi)return;
            if(!best||midi>best.midi)best={nt,midi,tpc};
          });
          if(!best){ev.push({r:true,dur});return}
          const f=(+best.tpc||14)-14,fl=((f+1)%7+7)%7,L=['F','C','G','D','A','E','B'][fl],alter=Math.floor((f+1)/7),step=STEPS[L];
          const nat=best.midi-alter,oct=Math.floor(nat/12)-1;
          const e={r:false,l:step,alter,oct,dur,midi:best.midi};
          best.nt.querySelectorAll('Spanner[type="Tie"]').forEach(sp=>{if(kid(sp,'next'))e.tieNext=true;if(kid(sp,'prev'))e.tied=true});
          ev.push(e);
        }else if(n==='Spanner'&&ch.getAttribute('type')==='Volta')warn.add('Reprises non développées.');
      });
      bars.push({ev});
    });
    parts.push({name,fifths,mode,beats,bt,bars});
  });
  if(!parts.length)throw new Error('Aucune portée lisible dans ce fichier MuseScore.');
  return {title,comp,parts,warn:[...warn]};
}

/* ---- conversion vers le format du répertoire ---- */
const KEY_MAJ=['Cb','Gb','Db','Ab','Eb','Bb','F','C','G','D','A','E','B','F#','C#'];
const KEY_MIN=['Ab','Eb','Bb','F','C','G','D','A','E','B','F#','C#','G#','D#','A#'];
function guessMode(part){
  if(part.mode)return part.mode;
  let last=null;part.bars.forEach(b=>b.ev.forEach(e=>{if(!e.r)last=e}));
  if(!last)return 'maj';
  const pcMaj=((part.fifths*7)%12+12)%12;return last.midi%12===(pcMaj+9)%12?'min':'maj';
}
function toPiece(raw,pi,opt){
  const part=raw.parts[pi],warn=[...raw.warn];
  const f=Math.max(-7,Math.min(7,part.fifths)),mode=opt.mode,kn=(mode==='min'?KEY_MIN:KEY_MAJ)[f+7];
  const keyLetter=kn[0],keyAcc=kn[1]==='#'?1:kn[1]==='b'?-1:0;
  const KA=keyAccs(fifthsOf(keyLetter,keyAcc,mode));
  const need=part.beats/part.bt;
  /* unité de durée : la plus grande qui divise toutes les durées */
  let L=null;const durs=[];part.bars.forEach(b=>b.ev.forEach(e=>durs.push(e.dur)));
  for(const d of [4,8,16,32,64]){if(durs.every(x=>Math.abs(x*d-Math.round(x*d))<1e-6)){L=d;break}}
  if(!L){L=64;warn.push('Triolets ou durées irrégulières : notés approximativement.')}
  const sum=b=>b.ev.reduce((a,e)=>a+e.dur,0);
  const bars=part.bars.map(b=>b);
  let pick='';
  if(bars.length&&sum(bars[0])<need-1e-6&&sum(bars[0])>0){pick=bars.shift()}
  while(bars.length&&!bars[bars.length-1].ev.length)bars.pop();
  const suf=d=>{const m=Math.max(1,Math.round(d*L));return m===1?'':String(m)};
  let irregular=0,acc=0,notes=0,minD=1,lo=127,hi=0;
  const tok=b=>{
    const mem={};
    if(Math.abs(sum(b)-need)>1e-6)irregular++;
    const t=b.ev.map(e=>{
      if(e.r)return 'z'+suf(e.dur);
      notes++;minD=Math.min(minD,e.dur);lo=Math.min(lo,e.midi);hi=Math.max(hi,e.midi);
      const k=e.l+'_'+e.oct,eff=mem[k]!==undefined?mem[k]:KA[e.l];let a='';
      if(e.alter!==eff){acc++;a=e.alter===0?'=':e.alter===1?'^':e.alter===-1?'_':e.alter===2?'^^':'__'}
      mem[k]=e.alter;
      const ch='CDEFGAB'[e.l];let p;
      if(e.oct>=5)p=ch.toLowerCase()+"'".repeat(e.oct-5);else p=ch+','.repeat(4-e.oct);
      return a+p+suf(e.dur)+(e.tieNext?'-':'');
    });
    return t.length?t.join(' '):'z'+Math.max(1,Math.round(need*L));
  };
  const pickS=pick?tok(pick):'',strs=bars.map(tok);
  if(irregular>1)warn.push(irregular+' mesures de durée irrégulière (reprises ou changement de mesure ?).');
  const nn=bars.map(b=>b.ev.filter(e=>!e.r).length);
  /* niveau suggéré */
  let lev=2;
  if(Math.abs(f)<=1&&acc===0&&minD>=.125&&hi-lo<=12)lev=1;
  if(Math.abs(f)>=3||minD<=1/16||hi-lo>14)lev=3;
  if(notes&&acc/notes>.08)lev=4;
  const piece={id:rid('u'),t:opt.title||raw.title,c:opt.comp||raw.comp||'Œuvre importée',k:kn,mode,m:part.beats+'/'+part.bt,l:'1/'+L,lev:opt.lev||lev,bars:strs,nn,src:'import'};
  if(pickS)piece.pick=pickS;
  return {piece,warn,sugg:lev,notes};
}

/* ---- interface ---- */
function chooseScore(){const e=document.getElementById('scoreFile');if(e)e.click()}
async function onScoreFile(input){
  const f=input.files&&input.files[0];input.value='';if(!f)return;
  IMP.err='';IMP.raw=null;IMP.piece=null;IMP.busy=true;render();
  try{
    const raw=await loadScoreFile(f);
    IMP.raw=raw;IMP.sel=0;IMP.title=raw.title;IMP.comp=raw.comp;
    IMP.mode=guessMode(raw.parts[0]);IMP.lev=0;
    impRebuild();
  }catch(e){IMP.err=(e&&e.message)||'Fichier non lu.'}
  IMP.busy=false;render();
}
function impRebuild(){
  if(!IMP.raw)return;
  const r=toPiece(IMP.raw,IMP.sel,{mode:IMP.mode,lev:IMP.lev,title:IMP.title,comp:IMP.comp});
  IMP.piece=r.piece;IMP.warn=r.warn;IMP.sugg=r.sugg;IMP.notes=r.notes;
  if(!IMP.lev)IMP.lev=r.sugg;r.piece.lev=IMP.lev;
  if(!r.notes)IMP.err='Aucune note dans cette partie : choisis une autre partie.';else IMP.err='';
}
function impSet(k,v){
  if(k==='sel'){IMP.sel=+v;IMP.mode=guessMode(IMP.raw.parts[IMP.sel]);IMP.lev=0}
  else if(k==='mode'){IMP.mode=v}
  else if(k==='lev'){IMP.lev=+v}
  else IMP[k]=v;
  if(k!=='title'&&k!=='comp'){impRebuild();render()}
  else if(IMP.piece){IMP.piece[k==='title'?'t':'c']=v}
}
function impAdd(){
  if(!IMP.piece||!IMP.notes)return;
  IMP.piece.lev=IMP.lev;
  (state.chantCustom=state.chantCustom||[]).push(IMP.piece);save();
  IMP.raw=null;IMP.piece=null;IMP.keep=true;CH.ex=null;render();
}
function impCancel(){IMP.raw=null;IMP.piece=null;IMP.err='';render()}
function impDel(id){
  if(IMP.del!==id){IMP.del=id;render();return}
  state.chantCustom=customs().filter(p=>p.id!==id);IMP.del=null;save();CH.ex=null;render();
}
function importHtml(){
  let h='<details class="adv card" id="impSet"'+(IMP.raw||IMP.err||IMP.busy||IMP.del||IMP.keep?' open':'')+'><summary>Ajouter une œuvre (MuseScore, MusicXML)</summary>'
    +'<p class="sub" style="margin-block:8px">Choisis un fichier .mscz, .mscx, .mxl, .musicxml ou .xml. Seule la première voix de la partie choisie est gardée ; les reprises et les triolets ne sont pas gérés. Si un fichier MuseScore échoue, exporte-le en MusicXML.</p>'
    +'<input type="file" id="scoreFile" accept=".mscz,.mscx,.mxl,.musicxml,.xml" hidden onchange="onScoreFile(this)">'
    +'<div class="btnrow"><button class="btn small" id="impPick" onclick="chooseScore()">Choisir un fichier</button></div>';
  if(IMP.busy)h+='<p class="sub">Lecture du fichier…</p>';
  if(IMP.err)h+='<p class="chfb ko" id="impErr" role="alert">'+esc(IMP.err)+'</p>';
  if(IMP.raw&&IMP.piece){
    const R=IMP.raw;
    h+='<div class="impbox"><div class="grid2"><div class="fld"><label for="impT">Titre</label><input type="text" id="impT" value="'+esc(IMP.title)+'" oninput="impSet(\'title\',this.value)"></div>'
      +'<div class="fld"><label for="impC">Compositeur</label><input type="text" id="impC" value="'+esc(IMP.comp)+'" oninput="impSet(\'comp\',this.value)"></div></div>'
      +'<div class="grid3">'
      +(R.parts.length>1?'<div class="fld"><label for="impP">Partie</label><select id="impP" onchange="impSet(\'sel\',this.value)">'+R.parts.map((p,i)=>'<option value="'+i+'"'+(i===IMP.sel?' selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select></div>':'')
      +'<div class="fld"><label for="impM">Mode</label><select id="impM" onchange="impSet(\'mode\',this.value)"><option value="maj"'+(IMP.mode==='maj'?' selected':'')+'>Majeur</option><option value="min"'+(IMP.mode==='min'?' selected':'')+'>Mineur</option></select></div>'
      +'<div class="fld"><label for="impL">Niveau</label><select id="impL" onchange="impSet(\'lev\',this.value)">'+[1,2,3,4].map(v=>'<option value="'+v+'"'+(IMP.lev===v?' selected':'')+'>'+v+(v===IMP.sugg?' (suggéré)':'')+'</option>').join('')+'</select></div></div>'
      +'<p class="sub" id="impInfo">'+IMP.piece.bars.length+' mesures'+(IMP.piece.pick?' avec anacrouse':'')+' · '+IMP.piece.m+' · '+esc(modeName(pcOf(IMP.piece.k[0],IMP.piece.k[1]==='#'?1:IMP.piece.k[1]==='b'?-1:0),IMP.mode==='min'))+'</p>'
      +(IMP.warn&&IMP.warn.length?'<p class="chfb ko" id="impWarn">'+IMP.warn.map(esc).join(' ')+'</p>':'')
      +'<div id="impPrev" class="chscore"></div><p class="sub">Aperçu des premières mesures dans le ton d’origine. Vérifie la hauteur des notes, les altérations et les durées.</p>'
      +'<div class="btnrow"><button class="btn" id="impAdd" onclick="impAdd()"'+(IMP.notes?'':' disabled')+'>Ajouter au répertoire</button><button class="btn ghost" id="impCancel" onclick="impCancel()">Annuler</button></div></div>';
  }
  const C=customs();
  if(C.length){
    h+='<h3 style="margin-top:14px">Mes œuvres importées</h3><ul class="implist">'+C.map(p=>'<li><span><strong>'+esc(p.t)+'</strong> <span class="sub">'+esc(p.c)+' · '+p.bars.length+' mesures · niveau '+p.lev+'</span></span>'
      +(IMP.del===p.id?'<button class="btn danger small" id="impDel-'+p.id+'" onclick="impDel(\''+p.id+'\')">Retirer vraiment</button>':'<button class="btn ghost small" id="impDel-'+p.id+'" onclick="impDel(\''+p.id+'\')">Retirer</button>')+'</li>').join('')+'</ul>';
  }
  return h+'</details>';
}
function drawImpPreview(){
  const el=document.getElementById('impPrev');if(!el||!IMP.piece||!IMP.notes)return;
  const p=IMP.piece,n=Math.min(4,p.bars.length),W=Math.max(320,Math.round(el.clientWidth)||600);
  const tg={letter:p.k[0],acc:p.k[1]==='#'?1:p.k[1]==='b'?-1:0};
  try{el.innerHTML=drawScore(buildModel(p,0,n,tg,CS().clef),{width:W,lines:2,labels:false})}catch(e){el.textContent='Aperçu impossible : '+e.message}
}
