/* ---------- générateur de QR code (mode octets, correction d'erreur L), sans bibliothèque ---------- */
const QR=(function(){
  const ECC=[-1,7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,28,30,30,26,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30];
  const BLK=[-1,1,1,1,1,1,2,2,2,2,4,4,4,4,4,6,6,6,6,7,8,8,9,9,10,12,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25];
  const raw=v=>{let r=(16*v+128)*v+64;if(v>=2){const n=Math.floor(v/7)+2;r-=(25*n-10)*n-55;if(v>=7)r-=36}return r};
  const dataCw=v=>Math.floor(raw(v)/8)-ECC[v]*BLK[v];
  function capacity(v){return Math.floor((dataCw(v)*8-4-(v<=9?8:16))/8)}
  /* GF(256) */
  const EXP=new Uint8Array(512),LOG=new Uint8Array(256);
  (function(){let x=1;for(let i=0;i<255;i++){EXP[i]=x;LOG[x]=i;x<<=1;if(x&256)x^=0x11D}for(let i=255;i<512;i++)EXP[i]=EXP[i-255]})();
  const mul=(a,b)=>a&&b?EXP[LOG[a]+LOG[b]]:0;
  function rsGen(d){let g=[1];for(let i=0;i<d;i++){const n=new Array(g.length+1).fill(0);for(let j=0;j<g.length;j++){n[j]^=g[j];n[j+1]^=mul(g[j],EXP[i])}g=n}return g}
  function rsRem(data,d){const g=rsGen(d),r=new Array(d).fill(0);
    for(const b of data){const f=b^r.shift();r.push(0);for(let i=0;i<d;i++)r[i]^=mul(g[i+1],f)}return r}
  function bytesOf(s){const o=[];for(let i=0;i<s.length;i++)o.push(s.charCodeAt(i)&255);return o}
  function encode(text){
    const data=bytesOf(text);
    let v=1;while(v<=40&&capacity(v)<data.length)v++;
    if(v>40)throw new Error('QR trop long');
    const bits=[];const put=(val,n)=>{for(let i=n-1;i>=0;i--)bits.push((val>>>i)&1)};
    put(4,4);put(data.length,v<=9?8:16);data.forEach(b=>put(b,8));
    const cap=dataCw(v)*8;
    put(0,Math.min(4,cap-bits.length));while(bits.length%8)bits.push(0);
    for(let p=0xEC;bits.length<cap;p^=0xEC^0x11)put(p,8);
    const cw=[];for(let i=0;i<bits.length;i+=8){let b=0;for(let j=0;j<8;j++)b=b<<1|bits[i+j];cw.push(b)}
    /* blocs et correction d'erreur */
    const nb=BLK[v],el=ECC[v],rc=Math.floor(raw(v)/8),ns=nb-rc%nb,sl=Math.floor(rc/nb),blocks=[];
    for(let i=0,k=0;i<nb;i++){const dl=sl-el+(i<ns?0:1),dat=cw.slice(k,k+dl);k+=dl;const e=rsRem(dat,el);if(i<ns)dat.push(0);blocks.push(dat.concat(e))}
    const all=[];
    for(let i=0;i<blocks[0].length;i++)for(let j=0;j<nb;j++)if(i!==sl-el||j>=ns)all.push(blocks[j][i]);
    return build(v,all);
  }
  function build(v,all){
    const size=v*4+17,M=[],F=[];
    for(let y=0;y<size;y++){M.push(new Array(size).fill(false));F.push(new Array(size).fill(false))}
    const set=(x,y,d)=>{M[y][x]=d;F[y][x]=true};
    for(let i=0;i<size;i++){set(6,i,i%2===0);set(i,6,i%2===0)}
    const finder=(cx,cy)=>{for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const d=Math.max(Math.abs(dx),Math.abs(dy)),x=cx+dx,y=cy+dy;if(x>=0&&x<size&&y>=0&&y<size)set(x,y,d!==2&&d!==4)}};
    finder(3,3);finder(size-4,3);finder(3,size-4);
    if(v>1){
      const n=Math.floor(v/7)+2,step=v===32?26:Math.ceil((v*4+4)/(n*2-2))*2,pos=[6];
      for(let p=size-7;pos.length<n;p-=step)pos.splice(1,0,p);
      for(let a=0;a<n;a++)for(let b=0;b<n;b++){
        if((a===0&&b===0)||(a===0&&b===n-1)||(a===n-1&&b===0))continue;
        for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(pos[a]+dx,pos[b]+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);
      }
    }
    const fmt=m=>{
      const d=(1<<3)|m;let r=d;for(let i=0;i<10;i++)r=(r<<1)^((r>>>9)*0x537);
      const bits=((d<<10)|r)^0x5412,bit=i=>((bits>>>i)&1)!==0;
      for(let i=0;i<=5;i++)set(8,i,bit(i));set(8,7,bit(6));set(8,8,bit(7));set(7,8,bit(8));for(let i=9;i<15;i++)set(14-i,8,bit(i));
      for(let i=0;i<8;i++)set(size-1-i,8,bit(i));for(let i=8;i<15;i++)set(8,size-15+i,bit(i));set(8,size-8,true);
    };
    fmt(0);
    if(v>=7){
      let r=v;for(let i=0;i<12;i++)r=(r<<1)^((r>>>11)*0x1F25);
      const bits=(v<<12)|r;
      for(let i=0;i<18;i++){const bt=((bits>>>i)&1)!==0,a=size-11+i%3,b=Math.floor(i/3);set(a,b,bt);set(b,a,bt)}
    }
    /* placement des données */
    let k=0;const nbits=all.length*8;
    for(let right=size-1;right>=1;right-=2){
      if(right===6)right=5;
      for(let vert=0;vert<size;vert++)for(let j=0;j<2;j++){
        const x=right-j,up=((right+1)&2)===0,y=up?size-1-vert:vert;
        if(!F[y][x]&&k<nbits){M[y][x]=((all[k>>>3]>>>(7-(k&7)))&1)!==0;k++}
      }
    }
    const maskFn=[(x,y)=>(x+y)%2===0,(x,y)=>y%2===0,(x,y)=>x%3===0,(x,y)=>(x+y)%3===0,(x,y)=>(Math.floor(x/3)+Math.floor(y/2))%2===0,(x,y)=>x*y%2+x*y%3===0,(x,y)=>(x*y%2+x*y%3)%2===0,(x,y)=>((x+y)%2+x*y%3)%2===0];
    let best=null,bp=Infinity,bm=0;
    for(let m=0;m<8;m++){
      const T=M.map(r=>r.slice());
      for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(!F[y][x]&&maskFn[m](x,y))T[y][x]=!T[y][x];
      const p=penalty(T,size);
      if(p<bp){bp=p;best=T;bm=m}
    }
    for(let y=0;y<size;y++)for(let x=0;x<size;x++)M[y][x]=best[y][x];
    fmt(bm);
    return {size,version:v,modules:M};
  }
  function penalty(T,n){
    let p=0,dark=0;
    const line=(get)=>{
      let run=1,prev=get(0);
      for(let i=1;i<n;i++){const c=get(i);if(c===prev)run++;else{if(run>=5)p+=3+run-5;run=1;prev=c}}
      if(run>=5)p+=3+run-5;
      const s=[];for(let i=0;i<n;i++)s.push(get(i)?1:0);
      for(let i=0;i+11<=n;i++){
        const a=s.slice(i,i+11).join('');
        if(a==='10111010000'||a==='00001011101')p+=40;
      }
    };
    for(let y=0;y<n;y++)line(i=>T[y][i]);
    for(let x=0;x<n;x++)line(i=>T[i][x]);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      if(T[y][x])dark++;
      if(x<n-1&&y<n-1&&T[y][x]===T[y][x+1]&&T[y][x]===T[y+1][x]&&T[y][x]===T[y+1][x+1])p+=3;
    }
    p+=(Math.ceil(Math.abs(dark*20-n*n*10)/(n*n))-1)*10;
    return p;
  }
  function svg(qr,px){
    const q=4,n=qr.size+2*q;let d='';
    for(let y=0;y<qr.size;y++){let x=0;while(x<qr.size){if(qr.modules[y][x]){let e=x;while(e<qr.size&&qr.modules[y][e])e++;d+='M'+(x+q)+' '+(y+q)+'h'+(e-x)+'v1h-'+(e-x)+'z';x=e}else x++}}
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+n+' '+n+'" width="'+px+'" height="'+px+'" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="'+n+'" height="'+n+'" fill="#fff"/><path d="'+d+'" fill="#000"/></svg>';
  }
  return {encode,svg,capacity};
})();
