/* Données : apprentis, stockage local, contacts */
/* ---------- données ---------- */
let EXTRA=[],people=[],centres=[],metiers=[];
try{EXTRA=JSON.parse(DB.getItem("icompete_app_v1")||"[]")||[];}catch(e){EXTRA=[];}
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
function load(){try{const v=DB.getItem(KEY);if(v){rows=JSON.parse(v)||[];return}}catch(e){} if(mem)rows=mem;}
function saveLocal(){mem=rows;let ok=true;try{DB.setItem(KEY,JSON.stringify(rows));}catch(e){ok=false;}savePending();return ok;}
/* Saisies non envoyées : gardées sur l'appareil au nom de leur auteur, rechargées seulement pour lui, supprimées après 14 jours. */
const PKEY="icompete_pending_v1";
function pendRead(){try{return JSON.parse(localStorage.getItem(PKEY)||"{}")||{};}catch(e){return {};}}
function savePending(){
  if(!SYNC.on||!SYNC.nom)return;
  try{
    const all=pendRead(),lim=Date.now()-14*864e5;
    Object.keys(all).forEach(k=>{if(!all[k]||(all[k].at||0)<lim)delete all[k];});
    const dr=rows.filter(r=>SYNC.synced[r.uid]!==(r.maj||""));
    const dc={};Object.keys(contacts).forEach(id=>{if(SYNC.sc[id]!==JSON.stringify(contacts[id]))dc[id]=contacts[id];});
    if(dr.length||Object.keys(dc).length)all[SYNC.nom]={at:Date.now(),rows:dr,contacts:dc};else delete all[SYNC.nom];
    if(Object.keys(all).length)localStorage.setItem(PKEY,JSON.stringify(all));else localStorage.removeItem(PKEY);
  }catch(e){}
}
function restorePending(){
  if(!SYNC.on||!SYNC.nom)return;
  const mine=pendRead()[SYNC.nom];if(!mine)return;
  (mine.rows||[]).forEach(pr=>{if(!pr||!pr.uid)return;const i=rows.findIndex(r=>r.uid===pr.uid);
    if(i<0)rows.push(pr);else if((pr.maj||"")>(rows[i].maj||""))rows[i]=pr;});
  Object.keys(mine.contacts||{}).forEach(id=>{contacts[id]=mine.contacts[id];});
}
function save(){if(!saveLocal())toast("Enregistrement local impossible : exporter vos données.");if(SYNC.readonly)toast("Compte en lecture seule : modification non enregistrée sur la base partagée.");sched();}
load();
(function seedOnce(){let done=false;try{done=!!localStorage.getItem(SEEDKEY);}catch(e){}
  if(done||SU)return;
  const ex=new Set(rows.map(r=>r.uid));
  rows=SEED.map(r=>Object.assign({},r)).concat(rows.filter(r=>!/^x\d+$/.test(r.uid)||!ex.has(r.uid)));
  save();try{localStorage.setItem(SEEDKEY,"1");}catch(e){}
})();

