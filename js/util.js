/* ---------- utilitaires ---------- */
const LS_KEY='cello-planner-v1';
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parse=s=>{const a=s.split('-').map(Number);return new Date(a[0],a[1]-1,a[2])};
const addDays=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+n);return ymd(d)};
const todayStr=()=>ymd(new Date());
const fmtLong=s=>parse(s).toLocaleDateString('fr-BE',{weekday:'long',day:'numeric',month:'long'});
const fmtShort=s=>parse(s).toLocaleDateString('fr-BE',{weekday:'short',day:'numeric'});
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const rid=p=>p+Math.random().toString(36).slice(2,8);
const daysBetween=(a,b)=>Math.round((parse(b)-parse(a))/86400000);
function lastWednesday(s){const d=parse(s);while(d.getDay()!==3)d.setDate(d.getDate()-1);return ymd(d)}
const TONICS=['Do','Do♯','Ré','Mi♭','Mi','Fa','Fa♯','Sol','La♭','La','Si♭','Si'];
const PC={'Do':0,'Do♯':1,'Ré':2,'Mi♭':3,'Mi':4,'Fa':5,'Fa♯':6,'Sol':7,'La♭':8,'La':9,'Si♭':10,'Si':11};
const KINDS={piece:'Pièce',etude:'Étude',methode:'Méthode'};
