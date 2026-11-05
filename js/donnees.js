/* Données : apprentis, stockage local, contacts */
/* ---------- données ---------- */
let EXTRA=[],people=[],centres=[],metiers=[];
try{EXTRA=JSON.parse(localStorage.getItem("icompete_app_v1")||"[]")||[];}catch(e){EXTRA=[];}
function buildPeople(){
  const m=new Map();BASE.forEach(r=>m.set(String(r[0]),r));EXTRA.forEach(r=>{if(r&&r[0])m.set(String(r[0]),r);});
  people=[...m.values()].map(r=>({id:r[0],nom:r[1],ue:r[2],centre:r[3],metier:r[4],mar:r[5],tel:r[6],autre:r[7],tmar:r[8],tue:r[9],
    _n:norm([r[1],r[0],r[2],r[6]].join(" ")),_m:norm(r[1])}));
  centres=[...new Set(people.map(p=>p.centre).filter(Boolean))].sort();
  metiers=[...new Set(people.map(p=>p.metier).filter(Boolean))].sort();
}
buildPeople();
function norm(s){return String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").trim();}
const esc = s => String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let rows = [];
let mem = null;
function load(){try{const v=localStorage.getItem(KEY);if(v){rows=JSON.parse(v)||[];return}}catch(e){} if(mem)rows=mem;}
function saveLocal(){mem=rows;try{localStorage.setItem(KEY,JSON.stringify(rows));return true}catch(e){return false}}
function save(){if(!saveLocal())toast("Enregistrement local impossible : exporter vos données.");sched();}
load();
(function seedOnce(){let done=false;try{done=!!localStorage.getItem(SEEDKEY);}catch(e){}
  if(done||SU)return;
  const ex=new Set(rows.map(r=>r.uid));
  rows=SEED.map(r=>Object.assign({},r)).concat(rows.filter(r=>!/^x\d+$/.test(r.uid)||!ex.has(r.uid)));
  save();try{localStorage.setItem(SEEDKEY,"1");}catch(e){}
})();

