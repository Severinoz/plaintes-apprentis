/* Synchronisation avec le Google Sheet, connexion, administration */
/* ---------- partage (Google Sheet) ---------- */
function isAdmin(){return !SYNC.on||SYNC.role==="Administrateur";}
function applyRole(){
  const a=isAdmin();
  document.querySelector('#nav [data-v="tableau"]').hidden=!a;
  document.querySelector('#nav [data-v="admin"]').hidden=!(a&&SYNC.on);
  $("exp").hidden=!a;$("imp").hidden=!a;
  const v=[...document.querySelectorAll(".view")].find(x=>!x.hidden);
  if(v&&!a&&(v.id==="v-tableau"||v.id==="v-admin"))show("saisie");
}
async function api(body){
  const c=new AbortController();const t=setTimeout(()=>c.abort(),30000);
  try{
    const r=await fetch(SU,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(Object.assign({code:SYNC.code},body)),signal:c.signal});
    const j=await r.json();if(!j.ok){const e=new Error(j.err||"erreur");e.code=j.err;throw e;}return j;
  }finally{clearTimeout(t);}
}
function persistSync(){try{localStorage.setItem("icompete_synced_v1",JSON.stringify(SYNC.synced));localStorage.setItem("icompete_sc_v1",JSON.stringify(SYNC.sc));}catch(e){}}
function pendingN(){return rows.filter(r=>SYNC.synced[r.uid]!==(r.maj||"")).length+Object.keys(contacts).filter(id=>SYNC.sc[id]!==JSON.stringify(contacts[id])).length;}
function status(){
  const el=$("sync");if(!SYNC.on){el.hidden=true;$("logout").hidden=true;return;}
  el.hidden=false;$("logout").hidden=false;const n=pendingN();let t;
  if(!SYNC.ok)t=SYNC.err?"Hors ligne"+(n?" : "+n+" en attente":""):"Connexion...";
  else t=(n?"Envoi en cours ("+n+")":"En ligne")+" · "+SYNC.nom;
  el.textContent=t;el.className="theme sync "+(SYNC.ok&&!n?"ok":"w");el.title="Cliquer pour actualiser";
}
let ft;
function sched(){if(!SYNC.on||!SYNC.ok)return;clearTimeout(ft);ft=setTimeout(flush,600);status();}
function showLogin(msg){$("login").hidden=false;$("lgErr").textContent=msg||"";setTimeout(()=>$("lgCode").focus(),50);}
function lostAccess(){SYNC.ok=false;SYNC.code="";try{sessionStorage.removeItem("icompete_code");}catch(e){}showLogin("Code incorrect ou accès désactivé.");status();}
async function flush(){
  if(!SYNC.on||!SYNC.ok||SYNC.busy||SYNC.pulling)return;
  const dr=rows.filter(r=>SYNC.synced[r.uid]!==(r.maj||""));
  const dc=Object.keys(contacts).filter(id=>SYNC.sc[id]!==JSON.stringify(contacts[id]));
  if(!dr.length&&!dc.length){status();return;}
  SYNC.busy=true;status();
  const sent=new Map(dr.map(r=>[r.uid,r.maj||""]));
  const sentC={};dc.forEach(id=>sentC[id]=JSON.stringify(contacts[id]));
  try{
    const j=await api({action:"upsert",rows:dr,contacts:dc.map(id=>Object.assign({id},contacts[id]))});
    (j.rows||[]).forEach(sv=>{
      const i=rows.findIndex(x=>x.uid===sv.uid);
      if(i>=0&&(rows[i].maj||"")===sent.get(sv.uid))rows[i]=sv;
      SYNC.synced[sv.uid]=sv.maj||"";
    });
    dc.forEach(id=>{SYNC.sc[id]=sentC[id];});
    saveLocal();persistSync();SYNC.err="";
  }catch(e){
    if(e.code==="code"){SYNC.busy=false;lostAccess();return;}
    SYNC.ok=false;SYNC.err=e.message||"reseau";
  }
  SYNC.busy=false;status();
  if(SYNC.ok&&pendingN()>0){clearTimeout(ft);ft=setTimeout(flush,1500);}
}
function refreshViews(){
  const v=[...document.querySelectorAll(".view")].find(x=>!x.hidden);if(!v)return;
  if(v.id==="v-registre")renderRegistre();
  else if(v.id==="v-tableau")renderDash();
  else if(v.id==="v-traitement"){
    const r=rows.find(x=>x.uid===T.uid);
    if(r&&T.shown!==undefined&&r.maj!==T.shown){toast("Cette plainte vient d'être modifiée par "+(r.majPar||"un collègue")+" : la rouvrir pour voir les changements.");T.shown=r.maj;}
    renderTrait(true);
  }else if(v.id==="v-saisie")renderHist();
}
async function pull(full){
  if(!SYNC.on||!SYNC.code||SYNC.pulling||SYNC.busy)return;
  SYNC.pulling=true;
  try{
    const j=await api({action:"list",noApp:!full&&SYNC.appLoaded});
    SYNC.nom=j.nom;SYNC.role=j.role||"Utilisateur";try{sessionStorage.setItem("icompete_role",SYNC.role);}catch(e){}SYNC.ok=true;SYNC.err="";
    if(j.apprentis){EXTRA=j.apprentis;SYNC.appLoaded=true;try{localStorage.setItem("icompete_app_v1",JSON.stringify(EXTRA));}catch(e){}buildPeople();fillLists();}
    (j.contacts||[]).forEach(c=>{const l=contacts[c.id];
      if(!l||SYNC.sc[c.id]===JSON.stringify(l)){contacts[c.id]={tel:c.tel,autre:c.autre};SYNC.sc[c.id]=JSON.stringify(contacts[c.id]);}});
    try{localStorage.setItem(CKEY,JSON.stringify(contacts));}catch(e){}
    const srv=new Map((j.plaintes||[]).map(r=>[r.uid,r]));
    const loc=new Map(rows.map(r=>[r.uid,r]));
    const out=[];
    srv.forEach((r,uid)=>{
      const l=loc.get(uid),dirty=l&&SYNC.synced[uid]!==(l.maj||"");
      if(l&&dirty&&(l.maj||"")>(r.maj||""))out.push(l);else{out.push(r);SYNC.synced[uid]=r.maj||"";}
    });
    loc.forEach((l,uid)=>{if(!srv.has(uid)&&(SYNC.synced[uid]===undefined||SYNC.synced[uid]!==(l.maj||"")))out.push(l);});
    rows=out;saveLocal();persistSync();
  }catch(e){
    SYNC.pulling=false;
    if(e.code==="code"){lostAccess();return;}
    SYNC.ok=false;SYNC.err=e.message||"reseau";status();return;
  }
  SYNC.pulling=false;status();applyRole();refreshViews();flush();
}
$("lgGo").onclick=async()=>{
  const c=$("lgCode").value.trim();if(!c)return;SYNC.code=c;$("lgErr").textContent="Vérification...";
  try{await api({action:"login"});try{sessionStorage.setItem("icompete_code",c);}catch(e){}
    $("login").hidden=true;$("lgCode").value="";await pull(true);}
  catch(e){SYNC.code="";$("lgErr").textContent=e.code==="code"?"Code incorrect ou accès désactivé.":e.code==="bloque"?"Trop d'essais incorrects. Réessayer dans 10 minutes.":"Connexion impossible : vérifier internet.";}
};
$("lgCode").addEventListener("keydown",e=>{if(e.key==="Enter")$("lgGo").click();});
$("sync").onclick=()=>{if(SYNC.code)pull(true);else showLogin();};
$("logout").onclick=()=>{SYNC.ok=false;SYNC.code="";SYNC.role="";try{sessionStorage.removeItem("icompete_code");sessionStorage.removeItem("icompete_role");}catch(e){}status();applyRole();showLogin();};
$("bAdd").onclick=async()=>{
  const nom=(F.libre||"").trim();
  if(!nom||!F.centre.trim()||!F.metier.trim()){toast("Renseigner d'abord le centre et le métier.");return;}
  if(!SYNC.ok){toast("Connexion nécessaire pour ajouter à la base partagée.");return;}
  const id=$("iId").value.trim()||("AJ"+Date.now().toString(36).toUpperCase());
  if(people.some(p=>String(p.id)===id)){const c=await ask("Cet ID existe déjà dans la base. Remplacer ses informations par celles saisies ?",[["Remplacer","p"],["Retour",""]]);if(c!==0)return;}
  const a=[id,nom,F.ue.trim(),F.centre.trim(),F.metier.trim(),$("iMar").value.trim(),(F.tel||"").trim(),(F.autre||"").trim(),"",""];
  try{await api({action:"addApprenti",apprenti:a});}catch(e){if(e.code==="code")lostAccess();else toast("Ajout impossible : vérifier la connexion.");return;}
  EXTRA=EXTRA.filter(r=>String(r[0])!==id).concat([a]);buildPeople();fillLists();
  const p=people.find(x=>String(x.id)===id);
  if(p){F.p=p;F.libre="";$("iId").value="";$("iMar").value="";renderApprenti();toast("Apprenti ajouté à la base partagée.");}
};
const MSGU={code_pris:"Ce code est déjà utilisé par quelqu'un d'autre.",self:"Impossible de retirer tes propres droits d'administrateur ou ton accès.",champs:"Renseigner le nom et le code.",droits:"Réservé aux administrateurs."};
function drawUsers(us){
  $("uBody").innerHTML=us.map(u=>`<tr data-n="${esc(u.nom)}"><td><strong>${esc(u.nom)}</strong></td><td><input type="text" class="uc" value="${esc(u.code)}" autocomplete="off"></td>
    <td><select class="ur"><option ${u.role==="Utilisateur"?"selected":""}>Utilisateur</option><option ${u.role==="Administrateur"?"selected":""}>Administrateur</option></select></td>
    <td><select class="ua"><option ${u.actif==="Oui"?"selected":""}>Oui</option><option ${u.actif==="Non"?"selected":""}>Non</option></select></td>
    <td class="act"><button class="btn s" data-su="1" type="button">Enregistrer</button></td></tr>`).join("")||`<tr><td colspan="5" class="empty">Aucun utilisateur.</td></tr>`;
}
async function renderAdmin(){
  const b=$("uBody");
  if(!SYNC.on){b.innerHTML=`<tr><td colspan="5" class="empty">La gestion des utilisateurs est disponible avec la base partagée.</td></tr>`;return;}
  b.innerHTML=`<tr><td colspan="5" class="empty">Chargement...</td></tr>`;
  try{const j=await api({action:"users"});drawUsers(j.users);}
  catch(e){if(e.code==="code")lostAccess();else b.innerHTML=`<tr><td colspan="5" class="empty">${e.code==="droits"?"Réservé aux administrateurs.":"Chargement impossible : vérifier la connexion."}</td></tr>`;}
}
async function saveUser(u){
  try{const j=await api({action:"saveUser",user:u});drawUsers(j.users);toast("Utilisateur enregistré.");return true;}
  catch(e){if(e.code==="code")lostAccess();else toast(MSGU[e.code]||"Enregistrement impossible : vérifier la connexion.");return false;}
}
$("uBody").addEventListener("click",e=>{const b=e.target.closest("[data-su]");if(!b)return;const tr=b.closest("tr");
  saveUser({nom:tr.dataset.n,code:tr.querySelector(".uc").value.trim(),role:tr.querySelector(".ur").value,actif:tr.querySelector(".ua").value});});
$("uGen").onclick=()=>{const L="ABCDEFGHJKLMNPQRSTUVWXYZ";let c="";for(let i=0;i<3;i++)c+=L[Math.floor(Math.random()*L.length)];$("uCode").value=c+"-"+String(Math.floor(1000+Math.random()*9000));};
$("uAdd").onclick=async()=>{const nom=$("uNom").value.trim(),code=$("uCode").value.trim();
  if(!nom||!code){toast("Renseigner le nom et le code (bouton Générer un code).");return;}
  if(await saveUser({nom,code,role:$("uRole").value,actif:"Oui"})){$("uNom").value="";$("uCode").value="";}};
function startSync(){
  applyRole();status();if(!SYNC.on)return;
  if(!SYNC.code){showLogin();}else pull(true);
  setInterval(()=>{if(document.visibilityState==="visible"&&SYNC.code)pull();},45000);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&SYNC.code)pull();});
}

paintForm();show("saisie");startSync();
