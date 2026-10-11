/* ---------- gravure : lecture d'un sous-ensemble d'ABC, transposition, dessin en SVG ----------
   Une seule voix, sans accords : clés de fa, d'ut 4e ligne (ténor) et de sol. Aucune dépendance. */
const LET='CDEFGAB',NATM=[0,2,4,5,7,9,11];
const natMidi=(l,o)=>12*(o+1)+NATM[l];
const FR_NOTE=['Do','Ré','Mi','Fa','Sol','La','Si'];
const fifthsOf=(letter,acc,mode)=>({F:-1,C:0,G:1,D:2,A:3,E:4,B:5}[letter]+7*acc-(mode==='min'?3:0));
function keyAccs(f){const o=f>=0?[3,0,4,1,5,2,6]:[6,2,5,1,4,0,3],m=[0,0,0,0,0,0,0];for(let i=0;i<Math.abs(f);i++)m[o[i]]=f>0?1:-1;return m}
/* tonique d'arrivée : épellation usuelle de chaque hauteur */
const SP_MAJ=[['C',0],['D',-1],['D',0],['E',-1],['E',0],['F',0],['F',1],['G',0],['A',-1],['A',0],['B',-1],['B',0]];
const SP_MIN=[['C',0],['C',1],['D',0],['E',-1],['E',0],['F',0],['F',1],['G',0],['G',1],['A',0],['B',-1],['B',0]];
const pcOf=(letter,acc)=>((NATM[LET.indexOf(letter)]+acc)%12+12)%12;

/* clés : ligne du bas, registre central visé (midi), contour du signe */
const CLEFS={
  bass:{bottom:18,center:50,low:36,high:67,sharps:[24,21,25,22,19,23,20],flats:[20,23,19,22,18,21,17]},
  tenor:{bottom:22,center:60,low:48,high:76,sharps:[24,28,25,29,26,30,27],flats:[27,30,26,29,25,28,24]},
  treble:{bottom:30,center:67,low:57,high:86,sharps:[38,35,39,36,33,37,34],flats:[34,37,33,36,32,35,31]}
};

/* lecture ABC : mesures (tableau de chaînes), unité L (fraction), armure d'origine */
function parseBars(bars,L,key){
  const KA=keyAccs(fifthsOf(key.letter,key.acc,key.mode)),out=[];
  const re=/(\^\^|\^|__|_|=)?([A-Ga-gz])([,']*)(\d*)(\/*)(\d*)(-?)/g;
  bars.forEach(b=>{
    const mem={},ev=[];let m;re.lastIndex=0;
    while((m=re.exec(b))){
      const n=m[4]?+m[4]:1,c=m[5].length,d=m[6]?+m[6]:(c?Math.pow(2,c):1);
      const dur=L*(n/(c?d:1));
      if(m[2]==='z'){ev.push({r:true,dur});continue}
      const up=m[2]===m[2].toLowerCase(),l=LET.indexOf(m[2].toUpperCase());
      let o=up?5:4;for(const ch of m[3])o+=ch==="'"?1:-1;
      const ex=m[1]===undefined?null:m[1]==='^'?1:m[1]==='^^'?2:m[1]==='_'?-1:m[1]==='__'?-2:0;
      const k=l+'_'+o;let acc;
      if(ex!==null){acc=ex;mem[k]=ex}else acc=mem[k]!==undefined?mem[k]:KA[l];
      ev.push({r:false,l,o,dur,midi:natMidi(l,o)+acc,tieNext:m[7]==='-'});
    }
    out.push(ev);
  });
  return out;
}
/* durée en notes : base (puissance de 2) et points */
function durShape(d){
  let base=1;while(base>d+1e-9&&base>1/64)base/=2;
  if(Math.abs(d-base)<1e-9)return {base,dots:0};
  if(Math.abs(d-base*1.5)<1e-9)return {base,dots:1};
  return {base:Math.max(1/64,Math.pow(2,Math.round(Math.log2(d)))),dots:0};
}
/* transposition vers une tonique (letter,acc) et choix de l'octave autour du centre de la clé */
function buildModel(piece,a,b,target,clef){
  const key={letter:piece.k[0],acc:piece.k[1]==='b'?-1:piece.k[1]==='#'?1:0,mode:piece.mode};
  const [L1,L2]=piece.l.split('/').map(Number),L=L1/L2;
  const all=parseBars(piece.bars,L,key);
  const hasPick=!!piece.pick;
  const sel=all.slice(a,b);
  if(a===0&&piece.pick)sel.unshift(parseBars([piece.pick],L,key)[0]);
  const pcFrom=pcOf(key.letter,key.acc),pcTo=pcOf(target.letter,target.acc);
  const n0=((NATM[LET.indexOf(target.letter)]-NATM[LET.indexOf(key.letter)])%12+12)%12+(target.acc-key.acc),dl=((LET.indexOf(target.letter)-LET.indexOf(key.letter))%7+7)%7;
  const mids=[];sel.forEach(bar=>bar.forEach(e=>{if(!e.r)mids.push(e.midi)}));
  mids.sort((x,y)=>x-y);const med=mids.length?mids[mids.length>>1]:60;
  const C=CLEFS[clef],mid=mids.length?(mids[0]+mids[mids.length-1])/2:60;
  let k=Math.round((C.center-(mid+n0))/12);
  while(mids.length&&mids[0]+n0+12*k<C.low)k++;
  while(mids.length&&mids[mids.length-1]+n0+12*k>C.high)k--;
  const n=n0+12*k;
  const f=fifthsOf(target.letter,target.acc,piece.mode),KT=keyAccs(f);
  const notes=[];let t=0,prevN=null;
  const bs=sel.map(bar=>{
    const mem={};
    return bar.map(e=>{
      const o={r:e.r,dur:e.dur,start:t,...durShape(e.dur)};t+=e.dur;
      if(!e.r){
        const step=e.l+7*e.o+dl+7*k,nl=((step%7)+7)%7,no=Math.floor(step/7),midi=e.midi+n,acc=midi-natMidi(nl,no),mk=nl+'_'+no;
        const cur=mem[mk]!==undefined?mem[mk]:KT[nl];
        o.l=nl;o.o=no;o.midi=midi;o.acc=acc;o.pos=nl+7*no;o.show=acc!==cur;mem[mk]=acc;
        o.label=FR_NOTE[nl]+(acc>0?'♯'.repeat(acc):acc<0?'♭'.repeat(-acc):'');
        if(prevN&&prevN.tieNext&&prevN.midi===midi)o.tied=true;
        o.tieNext=e.tieNext;prevN=o;
        notes.push(o);
      }
      return o;
    });
  });
  return {bars:bs,notes,f,KT,clef,meter:piece.m,tonicPc:pcTo,tonicLetter:target.letter,total:t,mode:piece.mode,
    refMidi:(()=>{ // tonique de référence : la plus proche du centre du passage
      let m=12*5+pcTo;while(m-med-n>6)m-=12;while(med+n-m>6)m+=12;return m})()};
}

/* ---- dessin ---- */
const S=10;                                  // écart entre deux lignes
const glyph=(g,x,y,k,cls)=>'<path class="'+(cls||'')+'" transform="translate('+x.toFixed(1)+','+y.toFixed(1)+') scale('+k.toFixed(4)+','+(-k).toFixed(4)+')" d="'+GLY[g].d+'"/>';
function evWidth(e,beatsPerBar){
  const base=e.base>=1?64:e.base>=.5?46:e.base>=.25?32:e.base>=.125?22:15;
  return (base*(e.dots?1.3:1))+((!e.r&&e.show)?10:0);
}
function beatLen(meter){const [n,d]=meter.split('/').map(Number);return (d===8&&n%3===0)?3/8:1/d}
function drawScore(M,opt){
  const W=opt.width||720,perLine=opt.perLine||4,labels=!!opt.labels;
  const C=CLEFS[M.clef],s=S,half=s/2,nb=M.bars.length;
  const nLines=Math.max(1,Math.min(opt.lines||1,nb));
  /* répartition des mesures sur les portées */
  const lines=[];let i=0;
  for(let l=0;l<nLines;l++){const cnt=Math.ceil((nb-i)/(nLines-l));lines.push(M.bars.slice(i,i+cnt).map((b,j)=>({ev:b,idx:i+j})));i+=cnt}
  const nKey=Math.abs(M.f),keyW=nKey?nKey*s*1.0+s:0;
  const [tn,td]=M.meter.split('/');
  const headFirst=s*3.4+keyW+s*2.6,headNext=s*3.4+keyW;
  const lineH=s*(labels?14:12),top=s*5;
  let svg='',noteId=0,cursor=[];
  const yPos=(p,y0)=>y0-(p-C.bottom)*half;   // y0 = ligne du bas
  lines.forEach((bars,li)=>{
    const y0=li*lineH+top+4*s,head=li===0?headFirst:headNext;
    const left=head+8,right=W-6;
    /* largeurs naturelles */
    const nat=bars.map(b=>b.ev.reduce((a,e)=>a+evWidth(e),0)+18);
    const sum=nat.reduce((a,b)=>a+b,0),avail=right-left;
    const f=Math.max(.55,avail/sum);
    /* portée */
    for(let k=0;k<5;k++)svg+='<line class="sl" x1="4" x2="'+(W-2)+'" y1="'+(y0-k*s)+'" y2="'+(y0-k*s)+'"/>';
    svg+='<line class="bl" x1="4" x2="4" y1="'+(y0-4*s)+'" y2="'+y0+'"/>';
    /* clé */
    const k0=s/197;
    if(M.clef==='bass')svg+=glyph('bass',8,y0-4*s+757*k0,k0*1.02,'gl');
    else if(M.clef==='tenor')svg+=glyph('cclef',8,yPos(C.bottom+6,y0)+370*k0,k0,'gl');
    else svg+=glyph('treble',8,yPos(32,y0),k0*1.1,'gl');
    /* armure */
    let kx=s*3.4;const arr=M.f>0?C.sharps:C.flats;
    for(let j=0;j<nKey;j++){
      const yy=yPos(arr[j],y0);
      if(M.f>0)svg+=glyph('sharp',kx,yy+198*(3*s/954),3*s/954,'gl');
      else svg+=glyph('flat',kx,yy+130*(2.8*s/836),2.8*s/836,'gl');
      kx+=s*1.0;
    }
    if(li===0){
      svg+='<text class="ts" x="'+(headFirst-s*1.6)+'" y="'+(y0-2*s)+'" font-size="'+(s*2.9)+'" text-anchor="middle">'+tn+'</text>'
        +'<text class="ts" x="'+(headFirst-s*1.6)+'" y="'+y0+'" font-size="'+(s*2.9)+'" text-anchor="middle">'+td+'</text>';
    }
    /* mesures */
    let x=left,prevT=null;
    bars.forEach((b,bi)=>{
      const bw=nat[bi]*f;let ex=x+9*f;
      const items=[];
      b.ev.forEach(e=>{const w=evWidth(e)*f;items.push({e,x:ex+w*.35,w});ex+=w});
      /* groupes de croches */
      const bl=beatLen(M.meter),groups=[];let cur=null;
      items.forEach(it=>{
        const e=it.e;
        if(!e.r&&e.base<=.125){const beat=Math.floor((e.start+1e-9)/bl);
          if(cur&&cur.beat===beat)cur.list.push(it);else{cur={beat,list:[it]};groups.push(cur)}}
        else cur=null;
      });
      const beamOf=new Map();groups.filter(g=>g.list.length>1).forEach(g=>g.list.forEach(it=>beamOf.set(it,g)));
      const rx=s*.62,ry=s*.45;
      const gdir=new Map();
      beamOf.forEach((g,it)=>{if(!gdir.has(g)){const avg=g.list.reduce((a,t)=>a+t.e.pos,0)/g.list.length;gdir.set(g,avg>=C.bottom+4?'d':'u')}});
      items.forEach(it=>{
        const e=it.e,cx=it.x;
        if(e.r){
          const ym=y0-2*s;
          if(e.base>=1)svg+='<rect class="fl" x="'+(cx-s*.7)+'" y="'+(y0-2*s)+'" width="'+(s*1.4)+'" height="'+(s*.5)+'"/>';
          else if(e.base>=.5)svg+='<rect class="fl" x="'+(cx-s*.7)+'" y="'+(y0-2*s-s*.5)+'" width="'+(s*1.4)+'" height="'+(s*.5)+'"/>';
          else{const g=e.base>=.25?'rq':e.base>=.125?'r8':'r16',bb=GLY[g].b,mid=(bb[1]+bb[3])/2;svg+=glyph(g,cx-s*.45,ym+mid*k0,k0,'fl')}
          if(e.dots)svg+='<circle class="fl" cx="'+(cx+s*1.2)+'" cy="'+(y0-2*s-s*.5)+'" r="'+(s*.16)+'"/>';
          return;
        }
        const y=yPos(e.pos,y0),g=beamOf.get(it);
        const dir=g?gdir.get(g):(e.pos>=C.bottom+4?'d':'u');
        it.y=y;it.dir=dir;
        /* ledger lines */
        for(let p=C.bottom-2;p>=e.pos;p-=2)svg+='<line class="sl" x1="'+(cx-rx*1.5)+'" x2="'+(cx+rx*1.5)+'" y1="'+yPos(p,y0)+'" y2="'+yPos(p,y0)+'"/>';
        for(let p=C.bottom+10;p<=e.pos;p+=2)svg+='<line class="sl" x1="'+(cx-rx*1.5)+'" x2="'+(cx+rx*1.5)+'" y1="'+yPos(p,y0)+'" y2="'+yPos(p,y0)+'"/>';
      });
      /* tiges, faisceaux, têtes */
      const stemLen=s*3.4;
      const beamY=new Map();
      beamOf.forEach((g,it)=>{if(!beamY.has(g)){const d=gdir.get(g);
        beamY.set(g,d==='u'?Math.min(...g.list.map(t=>t.y))-stemLen:Math.max(...g.list.map(t=>t.y))+stemLen)}});
      items.forEach(it=>{
        const e=it.e;if(e.r)return;
        const cx=it.x,y=it.y,dir=it.dir,g=beamOf.get(it),id='nt-'+(noteId++);
        let sv='';
        if(e.show){const ac=e.acc,xa=cx-rx-s*1.0;
          if(ac===1)sv+=glyph('sharp',xa,y+198*(3*s/954),3*s/954,'gl');
          else if(ac===-1)sv+=glyph('flat',xa,y+130*(2.8*s/836),2.8*s/836,'gl');
          else if(ac===0)sv+=glyph('nat',xa,y+192*(3*s/954),3*s/954,'gl');
          else if(ac===2)sv+=glyph('sharp',xa,y+198*(3*s/954),3*s/954,'gl')+glyph('sharp',xa-s*.7,y+198*(3*s/954),3*s/954,'gl');
          else sv+=glyph('flat',xa,y+130*(2.8*s/836),2.8*s/836,'gl')+glyph('flat',xa-s*.7,y+130*(2.8*s/836),2.8*s/836,'gl');}
        sv+='<ellipse class="'+(e.base>=.5?'nh o':'nh')+'" cx="'+cx+'" cy="'+y+'" rx="'+(e.base>=.5?rx*1.05:rx)+'" ry="'+ry+'" transform="rotate(-20 '+cx+' '+y+')"/>';
        if(e.base<1){
          const sx=dir==='u'?cx+rx*.92:cx-rx*.92;
          let ye=g?beamY.get(g):(dir==='u'?y-stemLen:y+stemLen);
          if(!g){const mid=yPos(C.bottom+4,y0);if(dir==='u'&&ye>mid)ye=mid;if(dir==='d'&&ye<mid)ye=mid}
          sv+='<line class="st" x1="'+sx+'" x2="'+sx+'" y1="'+(dir==='u'?y-ry*.3:y+ry*.3)+'" y2="'+ye+'"/>';
          it.sx=sx;it.ye=ye;
          if(!g&&e.base<=.125){
            const sg=dir==='u'?1:-1,nfl=e.base<=.0625?2:1;
            for(let q=0;q<nfl;q++){const yy=ye+(dir==='u'?1:-1)*q*s*.9;
              sv+='<path class="fg" d="M'+sx+','+yy+' C'+(sx+s*.9)+','+(yy+sg*s*1.1)+' '+(sx+s*1.3)+','+(yy+sg*s*1.9)+' '+(sx+s*.5)+','+(yy+sg*s*2.9)+'"/>'}
          }
        }
        if(e.dots){const dy=((e.pos-C.bottom)%2===0)?y-s*.5:y;sv+='<circle class="fl" cx="'+(cx+rx+s*.55)+'" cy="'+dy+'" r="'+(s*.17)+'"/>'}
        if(labels)sv+='<text class="lb" x="'+cx+'" y="'+(y0+s*3.6+((e.pos<C.bottom-1)?(C.bottom-e.pos-1)*half:0))+'" font-size="'+(s*1.25)+'" text-anchor="middle">'+e.label+'</text>';
        svg+='<g class="nt" id="'+id+'">'+sv+'</g>';
        e.nid=id;
        if(e.tied&&prevT){const up=dir==='d',x1=prevT.x+rx*.7,x2=cx-rx*.7,yb=y+(up?-ry-1:ry+1),h=up?-s*1.1:s*1.1;
          svg+='<path class="tie" d="M'+x1+','+yb+' Q'+((x1+x2)/2)+','+(yb+h*1.6)+' '+x2+','+yb+'"/>'}
        prevT=e.tieNext?{x:cx}:null;
      });
      /* barres de faisceau */
      groups.filter(g=>g.list.length>1).forEach(g=>{
        const d=gdir.get(g),by=beamY.get(g),t=s*.5,l=g.list;
        const x1=l[0].sx,x2=l[l.length-1].sx,yb=d==='u'?by:by-t;
        svg+='<rect class="bm" x="'+Math.min(x1,x2)+'" y="'+yb+'" width="'+Math.abs(x2-x1)+'" height="'+t+'"/>';
        let q=0;
        while(q<l.length){
          if(l[q].e.base<=.0625){let r=q;while(r+1<l.length&&l[r+1].e.base<=.0625)r++;
            const off=(d==='u'?1:-1)*s*.8,xa=l[q].sx,xb=r>q?l[r].sx:(q<l.length-1?l[q].sx+s*1.2:l[q].sx-s*1.2);
            svg+='<rect class="bm" x="'+Math.min(xa,xb)+'" y="'+(yb+off)+'" width="'+Math.abs(xb-xa)+'" height="'+t+'"/>';q=r+1}
          else q++;
        }
      });
      x+=bw;
      const last=li===lines.length-1&&bi===bars.length-1;
      svg+=last?'<line class="bl" x1="'+(x-1)+'" x2="'+(x-1)+'" y1="'+(y0-4*s)+'" y2="'+y0+'"/><rect class="bm" x="'+(x+2)+'" y="'+(y0-4*s)+'" width="3" height="'+(4*s)+'"/>'
        :'<line class="bl" x1="'+x+'" x2="'+x+'" y1="'+(y0-4*s)+'" y2="'+y0+'"/>';
    });
  });
  const H=lines.length*lineH+top+s;
  return '<svg class="score" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Extrait à lire">'+svg+'</svg>';
}
