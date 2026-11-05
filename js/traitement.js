/* Traitement d'une plainte */
/* ---------- traitement ---------- */
let T={uid:null,guide:null};
$("ts").innerHTML=`<option value="a">À traiter</option><option value="all">Toutes</option><option value="nt">Non transmises</option>`+STATUTS.map(s=>`<option value="s:${esc(s)}">${esc(s)}</option>`).join("");
["tq","ts"].forEach(id=>$(id).addEventListener("input",()=>renderTrait()));
function renderTrait(keep){
  const q=norm($("tq").value),f=$("ts").value;
  const list=rows.filter(r=>{
    if(f==="a"&&(r.statut==="Clôturé"||r.statut==="Annulée"))return false;
    if(f==="nt"&&(r.statut==="Clôturé"||r.statut==="Annulée"||r.trans==="Oui"))return false;
    if(f.startsWith("s:")&&r.statut!==f.slice(2))return false;
    return !q||norm([r.nom,r.centre,r.ue,r.nature,r.id].join(" ")).includes(q);
  }).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  $("tCount").textContent=list.length+" plainte(s)";
  $("tList").innerHTML=list.length?list.map(r=>`<button type="button" class="tcard" data-t="${r.uid}" aria-pressed="${T.uid===r.uid}"><b>${esc(r.nom)}</b><span class="m">${esc(r.nature)} · ${esc(r.centre)}</span><br>${badge(r.statut)} ${progBadge(r)} ${r.res?`<span class="badge ${r.res==="Réglé"?"ok":r.res==="Injoignable"?"bad":"warn"}">${esc(r.res)}</span>`:""}</button>`).join(""):`<div class="empty">Aucune plainte.</div>`;
  if(keep!==true)renderDetail();
}
const QR={
"UE > Distance entre l'apprenti et l'UE":"L'apprenti a-t-il été rapproché de son lieu de travail (changement d'UE) ?",
"UE > Contrat pas encore signé par l'UE":"Le contrat a-t-il été signé par l'UE ?",
"UE > L'UE ne fait pas le métier de l'apprenti":"L'apprenti a-t-il été affecté à une UE qui fait son métier ?",
"UE > L'apprenti fait une formation différente de celle de l'UE":"L'affectation a-t-elle été corrigée ?",
"UE > UE introuvable ou injoignable":"L'UE a-t-elle été retrouvée, ou l'apprenti réaffecté ?",
"UE > UE non outillée":"L'UE est-elle maintenant outillée, ou l'apprenti a-t-il changé d'UE ?",
"UE > L'UE refuse l'apprenti":"L'apprenti a-t-il été accepté ou réaffecté ?",
"UE > UE fermée ou en cessation d'activité":"L'apprenti a-t-il été réaffecté à une autre UE ?",
"UE > Problème de traitement de l'apprenti par l'UE":"L'UE a-t-elle été recadrée, ou l'apprenti a-t-il changé d'UE ?",
"UE > Apprenti non encadré ou sans tâches dans l'UE":"L'apprenti est-il maintenant encadré et occupé ?",
"Centre de formation > Distance entre l'apprenti et le centre":"L'apprenti a-t-il été rapproché de son centre (changement de centre) ?",
"Centre de formation > Le centre ne dispense pas le métier de l'apprenti":"L'apprenti a-t-il été affecté à un centre qui dispense son métier ?",
"Centre de formation > Apprenti absent de la liste du centre":"L'apprenti figure-t-il maintenant sur la liste du centre ?",
"Centre de formation > Formation pas encore démarrée ou en retard":"La formation a-t-elle démarré pour l'apprenti ?",
"Centre de formation > Problème avec un formateur":"Le problème avec le formateur est-il réglé ?",
"Centre de formation > Manque de matériel pour la formation":"Le matériel de formation est-il disponible ?",
"Métier > Métier non choisi par l'apprenti":"L'apprenti a-t-il obtenu le métier qu'il avait choisi ?",
"Métier > L'apprenti veut changer de métier":"L'apprenti a-t-il changé de métier ?",
"Métier > Métier erroné dans la liste":"Le métier a-t-il été corrigé dans la liste ?",
"Métier > Métier non disponible dans le centre":"L'apprenti a-t-il été orienté vers un centre qui dispense ce métier ?",
"MAR > MAR absent":"Le MAR est-il revenu, ou l'apprenti a-t-il un autre MAR ?",
"MAR > MAR injoignable":"Le MAR est-il maintenant joignable ?",
"MAR > MAR qui ne fait pas son travail de suivi":"Le MAR assure-t-il maintenant le suivi ?",
"MAR > MAR qui ne forme pas l'apprenti":"Le MAR forme-t-il maintenant l'apprenti ?",
"MAR > MAR au comportement déplacé envers l'apprenti":"Le MAR a-t-il été recadré ou remplacé ?",
"MAR > MAR non attribué ou inconnu":"Un MAR a-t-il été attribué à l'apprenti ?",
"Paiement > Apprenti non payé":"L'apprenti a-t-il été payé ?",
"Paiement > Apprenti payé en partie":"Le reste du paiement a-t-il été versé ?",
"Paiement > Retard de paiement":"Le paiement en retard a-t-il été effectué ?",
"Paiement > Erreur sur le montant":"Le montant a-t-il été corrigé ?",
"Paiement > Problème de numéro ou de compte Orange Money":"Le numéro Orange Money a-t-il été corrigé et le paiement effectué ?",
"Paiement > Paiement en espèces demandé":"L'apprenti a-t-il reçu son paiement en espèces ?",
"Paiement > Paiement envoyé à un autre numéro":"Le paiement est-il revenu à l'apprenti ?",
"Contrat > Contrat pas encore signé par l'apprenti":"L'apprenti a-t-il signé son contrat ?",
"Contrat > Contrat pas encore signé par l'UE":"L'UE a-t-elle signé le contrat ?",
"Contrat > Contrat introuvable ou non remis":"L'apprenti a-t-il reçu son contrat ?",
"Contrat > Contrat à modifier après changement d'UE":"Le contrat a-t-il été modifié ?",
"Contrat > Erreur dans le contrat (nom, métier, montant)":"Le contrat a-t-il été corrigé ?",
"Badge > Apprenti sans carte":"L'apprenti a-t-il reçu sa carte ou son badge ?",
"Badge > Carte pas encore distribuée":"La carte a-t-elle été distribuée ?",
"Badge > Erreur sur la carte (nom, photo)":"La carte a-t-elle été corrigée ?",
"Badge > Carte perdue ou détériorée":"Une nouvelle carte a-t-elle été remise ?",
"Affectation > Erreur d'affectation":"L'affectation a-t-elle été corrigée ?",
"Affectation > Apprenti pas encore affecté":"L'apprenti a-t-il été affecté ?",
"Affectation > Affectation trop éloignée du domicile":"L'apprenti a-t-il été rapproché de son domicile ?",
"Affectation > Changement d'UE demandé":"L'apprenti a-t-il changé d'UE ?",
"Affectation > Changement de centre demandé":"L'apprenti a-t-il changé de centre ?",
"Données de l'apprenti > Nom erroné ou mal écrit":"Le nom a-t-il été corrigé ?",
"Données de l'apprenti > Numéro de téléphone erroné":"Le numéro a-t-il été corrigé ?",
"Données de l'apprenti > Apprenti absent de la base":"L'apprenti a-t-il été ajouté à la base ?",
"Données de l'apprenti > Doublon dans la base":"Le doublon a-t-il été supprimé ?",
"Conseiller de suivi > Conseiller absent ou injoignable":"Le conseiller est-il maintenant joignable ?",
"Conseiller de suivi > Suivi non effectué":"Le suivi a-t-il été effectué ?",
"Conseiller de suivi > Comportement déplacé":"Le conseiller a-t-il été recadré ou remplacé ?",
"Abandon ou refus > L'apprenti veut abandonner":"L'apprenti a-t-il accepté de rester ?",
"Abandon ou refus > L'apprenti refuse l'UE":"L'apprenti a-t-il été réaffecté à une autre UE ?",
"Abandon ou refus > L'apprenti refuse la formation":"L'apprenti a-t-il repris la formation ?",
"Abandon ou refus > L'apprenti ne se présente plus":"L'apprenti a-t-il repris ?",
"Mauvais traitement ou discrimination > Mauvais traitement":"Une mesure a-t-elle été prise pour protéger l'apprenti ?",
"Mauvais traitement ou discrimination > Harcèlement ou violence":"Une mesure a-t-elle été prise pour protéger l'apprenti ?",
"Mauvais traitement ou discrimination > Discrimination":"Une mesure a-t-elle été prise pour protéger l'apprenti ?"};
function qOf(g,sb){return QR[g+" > "+sb]||(sb&&sb!==AUTRE?"Le problème « "+sb+" » est-il réglé ?":"Le problème « "+g+(sb?" : autre":"")+" » est-il réglé ?");}
function suiviOf(r){try{return JSON.parse(r.suivi||"{}")||{};}catch(e){return {};}}
function itemsOf(r){const seen=new Set(),out=[];selOf(r).forEach(x=>{const k=x.g+" > "+(x.s||"");if(seen.has(k))return;seen.add(k);out.push({k,g:x.g,s:x.s});});return out;}
function progress(r){const it=itemsOf(r),sv=suiviOf(r);return {n:it.length,oui:it.filter(x=>sv[x.k]&&sv[x.k].r==="Oui").length,rep:it.filter(x=>sv[x.k]&&sv[x.k].r).length};}
function progBadge(r){const p=progress(r);if(!p.rep)return "";return `<span class="badge ${p.oui===p.n?"ok":"warn"}">Réglé ${p.oui}/${p.n}</span>`;}
function resCard(r){
  const it=itemsOf(r),sv=suiviOf(r),p=progress(r),lab="font-weight:600;font-size:13px;color:var(--muted)";
  const rel=it.some(x=>["UE","Affectation","Centre de formation","Métier","Contrat"].includes(x.g));
  const yn=(id,opts,cur)=>`<div class="seg" id="${id}">${opts.map((o,i)=>`<span><input type="radio" name="${id}" id="${id}${i}" value="${esc(o)}" ${cur===o?"checked":""}><label for="${id}${i}">${esc(o)}</label></span>`).join("")}</div>`;
  return `<div class="card"><h2>Résolution du problème</h2><p class="note" style="margin:0 0 6px">${p.oui} sur ${p.n} réglé(s)</p>`+
    it.map((x,i)=>{const v=sv[x.k]||{};return `<div class="step rq" data-k="${esc(x.k)}"><div class="tx"><small class="muted">${esc(x.g)}</small><br><b>${esc(qOf(x.g,x.s))}</b></div>
      <div class="seg">${["Oui","En cours","Non"].map((o,j)=>`<span><input type="radio" name="rs${i}" id="rs${i}_${j}" value="${o}" ${v.r===o?"checked":""}><label for="rs${i}_${j}">${o}</label></span>`).join("")}</div>
      <input type="text" class="rnote" placeholder="Précision (ex. nouvelle UE, nouveau métier, date)" value="${esc(v.n||"")}" style="margin-top:6px"></div>`;}).join("")+
    (rel?`<div class="grid g2" style="margin-top:14px"><div><span class="f" style="${lab}">L'apprenti a-t-il changé d'UE ?</span>${yn("tChg",["Oui","Non"],r.chg)}</div>
      <div><span class="f" style="${lab}">Le contrat a-t-il été modifié ?</span>${yn("tContrat",["Oui","Non","Sans objet"],r.contrat)}</div></div><div id="tRappel" class="alert i" hidden></div>`:"")+`</div>`;
}
function updRappel(){
  const el=$("tRappel");if(!el)return;
  const g=document.querySelector("#tChg input:checked"),c=document.querySelector("#tContrat input:checked");
  if(g&&g.value==="Oui"){el.hidden=false;el.textContent=c&&c.value==="Oui"?"Contrat modifié : informer l'UGP pour le paiement.":"Changer le contrat de l'apprenti (SCI Capital et ACFPE) puis informer l'UGP.";}
  else el.hidden=true;
}
function transCard(r){
  const rt=routeText(selOf(r)),cur=(r.dest||"").split(", ").filter(Boolean),lab="font-weight:600;font-size:13px;color:var(--muted)";
  return `<div class="card"><h2>Transmission de la plainte</h2>
    ${rt.length?`<div class="alert i" style="margin:0 0 12px">Transmission suggérée<br>${rt.map(esc).join("<br>")}</div>`:""}
    <span class="f" style="${lab}">La plainte a-t-elle été transmise ?</span>
    <div class="seg" id="tTrans">${["Oui","Non"].map((o,i)=>`<span><input type="radio" name="tTrans" id="tTrans${i}" value="${o}" ${r.trans===o?"checked":""}><label for="tTrans${i}">${o}</label></span>`).join("")}</div>
    <div style="margin-top:14px"><span class="f" style="${lab}">Transmise à (plusieurs choix possibles)</span>
      <div class="chips" id="tDest">${TD.map(d=>`<button type="button" class="chip" aria-pressed="${cur.includes(d)}" data-d="${esc(d)}">${esc(d)}</button>`).join("")}</div>
      <input type="text" id="tDestAutre" placeholder="Préciser à qui (si Autre)" value="${esc(r.destAutre||"")}" style="margin-top:8px;max-width:420px;${cur.includes("Autre")?"":"display:none"}"></div>
    <div style="margin-top:12px;max-width:220px"><label class="f" for="tTransDate">Date de transmission</label><input type="date" id="tTransDate" value="${esc(r.transDate||"")}"></div></div>`;
}
function renderDetail(){
  const d=$("tDetail"),r=rows.find(x=>x.uid===T.uid);
  if(!r){d.innerHTML=`<div class="card"><h2>Traitement</h2><p class="muted" style="margin:0">Choisir une plainte dans la liste pour indiquer si elle a été traitée.</p></div>`;return;}
  T.shown=r.maj;
  d.innerHTML=`<div class="card"><h2>${esc(r.nom)}</h2>${r.par||r.majPar?`<div class="note" style="margin:0 0 8px">Saisi par ${esc(r.par||"-")} · dernière modification par ${esc(r.majPar||"-")}</div>`:""}
    <div class="contact"><div><small>Téléphone</small>${esc(r.tel)||"-"}</div><div><small>Autre numéro</small>${esc(r.autre)||"-"}</div><div><small>MAR</small>${esc(r.mar)||"-"}</div><div><small>UE</small>${esc(r.ue)||"-"}</div><div><small>Centre</small>${esc(r.centre)||"-"}</div></div>
    <div class="focus"><div class="ft">Problème signalé</div>${(r.gros?(r.nature||"").split(" ; "):(r.nature||"").split(", ")).filter(Boolean).map(x=>`<div class="fp">${esc(x)}</div>`).join("")||'<div class="fp muted">Non précisé</div>'}
      ${r.desc?`<div class="ft" style="margin-top:12px">Description</div><div class="fd">${esc(r.desc)}</div>`:""}</div>
    <div style="margin-top:12px"><button class="btn s" data-open2="${r.uid}">Ouvrir la plainte</button></div></div>
    ${transCard(r)}${resCard(r)}<div class="card"><h2>Suivi du traitement</h2>
      <span class="f" style="font-weight:600;font-size:13px;color:var(--muted)">Le problème a-t-il été traité ?</span>
      <div class="seg" id="tFait">${["Oui","Non"].map((o,i)=>`<span><input type="radio" name="tFait" id="tFait${i}" value="${o}" ${r.fait===o?"checked":""}><label for="tFait${i}">${o}</label></span>`).join("")}</div>
      <div style="margin-top:14px"><span class="f" style="font-weight:600;font-size:13px;color:var(--muted)">Résultat du traitement (l'apprenti est-il joignable ?)</span>
      <div class="seg" id="tRes">${["Réglé","Non réglé","Injoignable"].map((o,i)=>`<span><input type="radio" name="tRes" id="tRes${i}" value="${o}" ${r.res===o?"checked":""}><label for="tRes${i}">${o}</label></span>`).join("")}</div></div>
      <div style="margin-top:14px"><span class="f" style="font-weight:600;font-size:13px;color:var(--muted)">Le vœu de l'apprenti a-t-il été satisfait ?</span>
        <div class="seg" id="tVoeu">${["Oui","Non"].map((o,i)=>`<span><input type="radio" name="tVoeu" id="tVoeu${i}" value="${o}" ${r.voeu===o?"checked":""}><label for="tVoeu${i}">${o}</label></span>`).join("")}</div></div>
      <div style="margin-top:12px;max-width:320px"><label class="f" for="tStatut">Statut</label><select id="tStatut">${STATUTS.map(s=>`<option ${s===r.statut?"selected":""}>${esc(s)}</option>`).join("")}</select></div>
      <div style="margin-top:14px"><button class="btn p" id="tSave">Enregistrer le traitement</button></div></div>`;
  updRappel();
}
$("tDetail").addEventListener("change",e=>{if(e.target.name==="tChg"||e.target.name==="tContrat")updRappel();});
$("tList").addEventListener("click",e=>{const b=e.target.closest("[data-t]");if(!b)return;T.uid=T.uid===b.dataset.t?null:b.dataset.t;renderTrait();});
$("tDetail").addEventListener("click",e=>{
  const dc=e.target.closest("#tDest .chip");
  if(dc){const on=dc.getAttribute("aria-pressed")!=="true";dc.setAttribute("aria-pressed",on);if(dc.dataset.d==="Autre")$("tDestAutre").style.display=on?"":"none";return;}
  const g=e.target.closest("[data-g]");if(g){T.guide=T.guide===g.dataset.g?null:g.dataset.g;renderDetail();return;}
  const o=e.target.closest("[data-open2]");if(o){openRow(o.dataset.open2);return;}
  const rr=e.target.closest(".seg label");if(rr){const inp=$(rr.htmlFor);if(inp&&inp.checked){e.preventDefault();inp.checked=false;updRappel();}return;}
  if(e.target.id==="tSave"){
    const r=rows.find(x=>x.uid===T.uid);if(!r)return;
    const tr=document.querySelector("#tTrans input:checked");
    const ds=[...document.querySelectorAll("#tDest .chip")].filter(x=>x.getAttribute("aria-pressed")==="true").map(x=>x.dataset.d);
    if(tr&&tr.value==="Oui"&&!ds.length){toast("Choisir à qui la plainte a été transmise.");return;}
    r.trans=tr?tr.value:"";r.dest=ds.join(", ");r.destAutre=ds.includes("Autre")?$("tDestAutre").value.trim():"";
    r.transDate=$("tTransDate").value||(r.trans==="Oui"?today():"");
    const sv2={};document.querySelectorAll("#tDetail .rq").forEach(d=>{const ck=d.querySelector("input[type=radio]:checked"),nt=d.querySelector(".rnote").value.trim();if(ck||nt)sv2[d.dataset.k]={r:ck?ck.value:"",n:nt};});
    r.suivi=Object.keys(sv2).length?JSON.stringify(sv2):"";
    if($("tChg")){const cg=document.querySelector("#tChg input:checked"),ct=document.querySelector("#tContrat input:checked");r.chg=cg?cg.value:"";r.contrat=ct?ct.value:"";}
    const c=document.querySelector("#tRes input:checked");
    r.res=c?c.value:"";const v=document.querySelector("#tVoeu input:checked");r.voeu=v?v.value:"";
    const fa=document.querySelector("#tFait input:checked");r.fait=fa?fa.value:"";delete r.steps;
    r.statut=$("tStatut").value;
    if(r.trans==="Oui"&&["Nouveau","En cours","En attente"].includes(r.statut)){if(ds.length===1&&ds[0]==="UGP")r.statut="Transmis à l'UGP";else if(ds.length===1&&ds[0]==="Cellule informatique de l'ACFPE")r.statut="Transmis à l'ACFPE";}
    r.maj=new Date().toISOString();save();{const pg=progress(r);toast(pg.n&&pg.oui===pg.n&&r.statut!=="Clôturé"?"Traitement enregistré. Tous les problèmes sont réglés : penser à clôturer la plainte.":"Traitement enregistré.");}renderTrait();
  }
});

