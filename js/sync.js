/* Synchronisation avec le Google Sheet, connexion, administration */
/* ---------- partage (Google Sheet) ---------- */
function isAdmin(){return !SYNC.on||SYNC.role==="Administrateur";}
function applyRole(){
  const a=isAdmin();SYNC.readonly=SYNC.role==="Lecture";$("actions").hidden=SYNC.readonly;
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
function persistSync(){try{DB.setItem("icompete_synced_v1",JSON.stringify(SYNC.synced));DB.setItem("icompete_sc_v1",JSON.stringify(SYNC.sc));}catch(e){}savePending();}
function pendingN(){return rows.filter(r=>SYNC.synced[r.uid]!==(r.maj||"")).length+Object.keys(contacts).filter(id=>SYNC.sc[id]!==JSON.stringify(contacts[id])).length;}
function status(){
  const el=$("sync");if(!SYNC.on){el.hidden=true;$("logout").hidden=true;return;}
  el.hidden=false;$("logout").hidden=false;const n=pendingN();let t;
  if(!SYNC.ok)t=SYNC.err?"Hors ligne"+(n?" : "+n+" en attente":""):"Connexion...";
  else t=(SYNC.readonly?"Lecture seule":n?"Envoi en cours ("+n+")":"En ligne")+" · "+SYNC.nom;
  el.textContent=t;el.className="theme sync "+(SYNC.ok&&!n?"ok":"w");el.title="Cliquer pour actualiser";
}
let ft;
function sched(){if(!SYNC.on||!SYNC.ok)return;clearTimeout(ft);ft=setTimeout(flush,600);status();}
function showLogin(msg){$("login").hidden=false;$("lgErr").textContent=msg||"";setTimeout(()=>$("lgCode").focus(),50);}
function wipeSession(){try{Object.keys(sessionStorage).filter(k=>k.indexOf("icompete_")===0).forEach(k=>sessionStorage.removeItem(k));}catch(e){}}
/* Accès refusé : on efface la session de l'onglet (les saisies non envoyées restent gardées au nom de leur auteur) puis on recharge. */
function lostAccess(){savePending();wipeSession();try{sessionStorage.setItem("icompete_msg","Code incorrect ou accès désactivé.");}catch(e){}location.reload();}
/* Une autre personne a modifié la même plainte avant l'envoi : la modification n'est pas enregistrée, la version à jour est affichée. */
function alerteConflit(l){
  const old=document.getElementById("conflit");if(old)old.remove();
  const d=document.createElement("div");d.id="conflit";d.className="conflit";d.setAttribute("role","alert");
  const h=m=>{try{return new Date(m).toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});}catch(e){return "";}};
  const t=document.createElement("strong");t.textContent=l.length>1?"Ces plaintes avaient déjà été modifiées par quelqu'un d'autre. Vos modifications n'ont pas été enregistrées :":"Cette plainte avait déjà été modifiée par quelqu'un d'autre. Votre modification n'a pas été enregistrée :";d.appendChild(t);
  const ul=document.createElement("ul");l.slice(0,10).forEach(c=>{const li=document.createElement("li");li.textContent=(c.nom||"Plainte")+(c.id?" (n° "+c.id+")":"")+" : modifiée par "+(c.par||"un collègue")+(c.maj?" le "+h(c.maj):"")+".";ul.appendChild(li);});
  if(l.length>10){const li=document.createElement("li");li.textContent="et "+(l.length-10)+" autre(s).";ul.appendChild(li);}
  d.appendChild(ul);
  const p=document.createElement("p");p.textContent="La version à jour est maintenant affichée. Vérifiez-la et refaites votre modification si elle est toujours nécessaire.";d.appendChild(p);
  const b=document.createElement("button");b.type="button";b.textContent="J'ai compris";b.onclick=()=>d.remove();d.appendChild(b);
  document.body.appendChild(d);
}
async function flush(){
  if(!SYNC.on||!SYNC.ok||SYNC.busy||SYNC.pulling||SYNC.readonly)return;
  const dr=rows.filter(r=>SYNC.synced[r.uid]!==(r.maj||""));
  const dc=Object.keys(contacts).filter(id=>SYNC.sc[id]!==JSON.stringify(contacts[id]));
  if(!dr.length&&!dc.length){status();return;}
  SYNC.busy=true;status();
  const sent=new Map(dr.map(r=>[r.uid,r.maj||""]));
  const sentC={};dc.forEach(id=>sentC[id]=JSON.stringify(contacts[id]));
  try{
    // Envoi par paquets : le serveur refuse plus de 500 lignes d'un coup ; en cas de refus "lot" on réduit la taille.
    let first=true;const conflitsAll=[];
    for(let i=0;i<dr.length||first;){
      const part=dr.slice(i,i+SYNC.chunk).map(r=>Object.assign({},r,{base:SYNC.synced[r.uid]||""}));
      let j;
      try{j=await api({action:"upsert",rows:part,contacts:first?dc.map(id=>Object.assign({id},contacts[id])):[]});}
      catch(e){if(e.code==="lot"&&SYNC.chunk>10){SYNC.chunk=Math.max(10,Math.floor(SYNC.chunk/2));continue;}throw e;}
      first=false;i+=part.length;
      if((j.conflits||[]).length)conflitsAll.push(...j.conflits);
      (j.rows||[]).forEach(sv=>{
        const k=rows.findIndex(x=>x.uid===sv.uid);
        if(k>=0&&(rows[k].maj||"")===sent.get(sv.uid))rows[k]=sv;
        SYNC.synced[sv.uid]=sv.maj||"";
      });
      persistSync();
    }
    dc.forEach(id=>{SYNC.sc[id]=sentC[id];});
    saveLocal();persistSync();SYNC.err="";
    if(conflitsAll.length){alerteConflit(conflitsAll);refreshViews();}
  }catch(e){
    if(e.code==="code"){SYNC.busy=false;lostAccess();return;}
    if(e.code==="droits"){SYNC.busy=false;SYNC.readonly=true;toast("Votre compte est en lecture seule : modification non enregistrée.");applyRole();status();return;}
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
    const delta=!full&&SYNC.since&&Date.now()-(SYNC.lastFull||0)<600000;   // relecture complète toutes les 10 min
    const j=await api({action:"list",noApp:!full&&SYNC.appLoaded,since:delta?SYNC.since:undefined});
    SYNC.nom=j.nom;SYNC.role=j.role||"Utilisateur";try{sessionStorage.setItem("icompete_role",SYNC.role);sessionStorage.setItem("icompete_nom",SYNC.nom);}catch(e){}SYNC.ok=true;SYNC.err="";
    if(j.apprentis){EXTRA=j.apprentis;SYNC.appLoaded=true;try{DB.setItem("icompete_app_v1",JSON.stringify(EXTRA));}catch(e){}buildPeople();fillLists();}
    (j.contacts||[]).forEach(c=>{const l=contacts[c.id];
      if(!l||SYNC.sc[c.id]===JSON.stringify(l)){contacts[c.id]={tel:c.tel,autre:c.autre};SYNC.sc[c.id]=JSON.stringify(contacts[c.id]);}});
    try{DB.setItem(CKEY,JSON.stringify(contacts));}catch(e){}
    restorePending();
    const okRow=r=>r&&/^[\w-]{1,60}$/.test(String(r.uid));
    const cleanRow=r=>{["date","transDate"].forEach(k=>{if(r[k]&&!/^\d{4}-\d{2}-\d{2}/.test(r[k]))r[k]="";});return r;};
    const srv=new Map((j.plaintes||[]).filter(okRow).map(r=>[r.uid,cleanRow(r)]));
    const loc=new Map(rows.map(r=>[r.uid,r]));
    const out=[];
    srv.forEach((r,uid)=>{
      const l=loc.get(uid),dirty=l&&SYNC.synced[uid]!==(l.maj||"");
      if(l&&dirty&&(l.maj||"")>(r.maj||""))out.push(l);else{out.push(r);SYNC.synced[uid]=r.maj||"";}
    });
    if(delta&&j.partiel)loc.forEach((l,uid)=>{if(!srv.has(uid))out.push(l);});   // lecture partielle : on garde tout le reste
    else loc.forEach((l,uid)=>{if(!srv.has(uid)&&(SYNC.synced[uid]===undefined||SYNC.synced[uid]!==(l.maj||"")))out.push(l);});
    rows=out;
    if(!(delta&&j.partiel))SYNC.lastFull=Date.now();
    srv.forEach(r=>{if(r.maj&&r.maj>(SYNC.since||""))SYNC.since=r.maj;});
    if(delta&&j.partiel&&typeof j.n==="number"&&j.n!==Object.keys(SYNC.synced).length)SYNC.lastFull=0;   // nombre différent : prochaine lecture complète
    saveLocal();persistSync();
  }catch(e){
    SYNC.pulling=false;
    if(e.code==="code"){lostAccess();return;}
    SYNC.ok=false;SYNC.err=e.message||"reseau";status();return;
  }
  SYNC.pulling=false;status();applyRole();refreshViews();flush();
}
$("lgGo").onclick=async()=>{
  const c=$("lgCode").value.trim();if(!c)return;SYNC.code=c;$("lgErr").textContent="Vérification...";
  try{const lj=await api({action:"login"});try{sessionStorage.setItem("icompete_code",c);}catch(e){}
    $("login").hidden=true;$("lgCode").value="";await pull(true);
    if(lj.faible)toast("Votre code est trop court (moins de 10 caractères). Demandez un nouveau code à l'administrateur avant le 20/11/2026.");}
  catch(e){SYNC.code="";$("lgErr").textContent=e.code==="code"?"Code incorrect ou accès désactivé.":e.code==="bloque"?"Trop d'essais incorrects. Réessayer dans une heure ou prévenir l'administrateur.":e.code==="faible"?"Ce code est trop court et n'est plus accepté. Demander un nouveau code (10 caractères minimum) à l'administrateur.":"Connexion impossible : vérifier internet.";}
};
$("lgCode").addEventListener("keydown",e=>{if(e.key==="Enter")$("lgGo").click();});
$("sync").onclick=()=>{if(SYNC.code)pull(true);else showLogin();};
$("logout").onclick=async()=>{
  try{if(SYNC.ok&&pendingN()>0)await Promise.race([flush(),new Promise(r=>setTimeout(r,8000))]);}catch(e){}
  savePending();wipeSession();location.reload();
};
$("bAdd").onclick=async()=>{
  const nom=(F.libre||"").trim();
  if(!nom||!F.centre.trim()||!F.metier.trim()){toast("Renseigner d'abord le centre et le métier.");return;}
  if(!SYNC.ok){toast("Connexion nécessaire pour ajouter à la base partagée.");return;}
  const id=$("iId").value.trim()||("AJ"+Date.now().toString(36).toUpperCase());
  if(people.some(p=>String(p.id)===id)){const c=await ask("Cet ID existe déjà dans la base. Remplacer ses informations par celles saisies ?",[["Remplacer","p"],["Retour",""]]);if(c!==0)return;}
  const a=[id,nom,F.ue.trim(),F.centre.trim(),F.metier.trim(),$("iMar").value.trim(),(F.tel||"").trim(),(F.autre||"").trim(),"",""];
  try{await api({action:"addApprenti",apprenti:a});}catch(e){if(e.code==="code")lostAccess();else toast(e.code==="invalide"?"Numéro d'apprenti invalide : 60 caractères au plus, sans commencer par = + @ ou -.":e.code==="droits"?"Votre compte est en lecture seule.":"Ajout impossible : vérifier la connexion.");return;}
  EXTRA=EXTRA.filter(r=>String(r[0])!==id).concat([a]);buildPeople();fillLists();
  const p=people.find(x=>String(x.id)===id);
  if(p){F.p=p;F.libre="";$("iId").value="";$("iMar").value="";renderApprenti();toast("Apprenti ajouté à la base partagée.");}
};
const MSGU={court:"Le code doit contenir au moins 10 caractères.",code_pris:"Ce code est déjà utilisé par quelqu'un d'autre.",self:"Impossible de retirer tes propres droits d'administrateur ou ton accès.",champs:"Renseigner le nom et le code.",droits:"Réservé aux administrateurs."};
function drawUsers(us){
  $("uBody").innerHTML=us.map(u=>`<tr data-n="${esc(u.nom)}"><td><strong>${esc(u.nom)}</strong></td><td><input type="text" class="uc" value="${esc(u.code)}" placeholder="${u.chiffre?"Code chiffré : saisir pour le changer":""}" autocomplete="off"></td>
    <td><select class="ur"><option ${u.role==="Utilisateur"?"selected":""}>Utilisateur</option><option ${u.role==="Administrateur"?"selected":""}>Administrateur</option><option ${u.role==="Lecture"?"selected":""}>Lecture</option></select></td>
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
$("uGen").onclick=()=>{const L="ABCDEFGHJKLMNPQRSTUVWXYZ23456789",a=new Uint32Array(12);crypto.getRandomValues(a);let c="";a.forEach((x,i)=>{c+=L[x%L.length];if(i%4===3&&i<11)c+="-";});$("uCode").value=c;};
$("uAdd").onclick=async()=>{const nom=$("uNom").value.trim(),code=$("uCode").value.trim();
  if(!nom||!code){toast("Renseigner le nom et le code (bouton Générer un code).");return;}
  if(await saveUser({nom,code,role:$("uRole").value,actif:"Oui"})){$("uNom").value="";$("uCode").value="";}};
function startSync(){
  applyRole();status();if(!SYNC.on)return;
  if(!SYNC.code){let m="";try{m=sessionStorage.getItem("icompete_msg")||"";sessionStorage.removeItem("icompete_msg");}catch(e){}showLogin(m);}else pull(true);
  setInterval(()=>{if(document.visibilityState==="visible"&&SYNC.code)pull();},45000);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&SYNC.code)pull();});
}

paintForm();show("saisie");startSync();
