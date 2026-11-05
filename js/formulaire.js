/* Formulaire de saisie : état, recherche d'un apprenti, rendu */
/* ---------- état du formulaire ---------- */
let F;
function today(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
const CKEY="icompete_contacts_v1";let contacts={};
try{contacts=JSON.parse(localStorage.getItem(CKEY)||"{}")||{};}catch(e){contacts={};}
function saveContacts(){try{localStorage.setItem(CKEY,JSON.stringify(contacts));}catch(e){}sched();}
(function seedContacts(){let d=false;try{d=!!localStorage.getItem("icompete_seedc1");}catch(e){}
  if(d||SU)return;const S={"816150602":{tel:"73358351",autre:"72784178"}};
  Object.keys(S).forEach(id=>{if(!contacts[id])contacts[id]=S[id];rows.forEach(r=>{if(String(r.id)===id&&!r.autre){r.autre=S[id].autre;if(!r.tel)r.tel=S[id].tel;}});});
  saveContacts();save();try{localStorage.setItem("icompete_seedc1","1");}catch(e){}})();
function contactDe(p){const c=contacts[String(p.id)];return {tel:(c&&c.tel!=null)?c.tel:(p.tel||""),autre:(c&&c.autre!=null)?c.autre:(p.autre||"")};}
function blank(){return {uid:null,p:null,libre:"",centre:"",metier:"",ue:"",tel:"",autre:"",integ:"",carte:"",paye:"",date:today(),statut:"Nouveau",gros:[],sous:[],prec:{},legacy:false,ctr:"",desc:"",chg:"",contrat:"",res:""};}
F = blank();

const $ = id => document.getElementById(id);
function seg(id,opts,key,after){
  const el=$(id);el.innerHTML=opts.map((o,i)=>`<span><input type="radio" name="${id}" id="${id}${i}" value="${esc(o)}"><label for="${id}${i}">${esc(o)}</label></span>`).join("");
  el.addEventListener("change",e=>{F[key]=e.target.value;if(after)after();});
  el.addEventListener("click",e=>{ // re-cliquer désélectionne
    const lab=e.target.closest("label");if(!lab)return;const inp=$(lab.htmlFor);
    if(inp&&inp.checked&&F[key]===inp.value){e.preventDefault();inp.checked=false;F[key]="";if(after)after();}
  });
}
function setSeg(id,val){document.querySelectorAll(`#${id} input`).forEach(i=>i.checked=(i.value===val));}

seg("segInt",["À intégrer","Ne pas intégrer","À vérifier"],"integ");
seg("segCarte",["Oui","Non","À vérifier"],"carte");
seg("segPaye",["Oui","Non","En partie"],"paye");
seg("segCtr",["Oui","Non","À vérifier"],"ctr");
$("statut").innerHTML=STATUTS.map(s=>`<option>${s}</option>`).join("");
function fillLists(){$("dlCentres").innerHTML=centres.map(c=>`<option value="${esc(c)}">`).join("");$("dlMetiers").innerHTML=metiers.map(c=>`<option value="${esc(c)}">`).join("");}
fillLists();
$("pbs").addEventListener("click",e=>{const bt=e.target.closest(".chip");if(!bt)return;const g=bt.dataset.g;
  const i=F.gros.indexOf(g);if(i>=0){F.gros.splice(i,1);F.sous=F.sous.filter(x=>!x.startsWith(g+" > "));delete F.prec[g];}else F.gros.push(g);
  paintPb();renderHist();});
$("subs").addEventListener("click",e=>{const bt=e.target.closest(".chip");if(!bt)return;const k=bt.dataset.g+" > "+bt.dataset.s;
  const i=F.sous.indexOf(k);if(i>=0){F.sous.splice(i,1);if(bt.dataset.s===AUTRE)delete F.prec[bt.dataset.g];}else F.sous.push(k);
  paintPb();renderHist();});
$("subs").addEventListener("input",e=>{const t=e.target.closest(".prec");if(t)F.prec[t.dataset.p]=t.value;});
function routeInfo(){
  const sel=[];PB.filter(b=>F.gros.includes(b.g)).forEach(b=>{const ss=b.s.map(x=>x[0]).filter(x=>F.sous.includes(b.g+" > "+x));if(ss.length)ss.forEach(x=>sel.push({g:b.g,s:x}));else sel.push({g:b.g,s:null});});
  const rt=routeText(sel),r=$("route");
  if(!rt.length){r.hidden=true;return;}
  r.hidden=false;r.innerHTML="Transmission à prévoir<br>"+rt.map(esc).join("<br>");
}
function paintPb(){
  $("pbs").innerHTML=PB.map(b=>`<button type="button" class="chip" aria-pressed="${F.gros.includes(b.g)}" data-g="${esc(b.g)}">${esc(b.g)}</button>`).join("");
  let h=PB.filter(b=>F.gros.includes(b.g)&&b.s.length).map(b=>{
    const au=F.sous.includes(b.g+" > "+AUTRE);
    return `<div class="subbox"><div class="subt">${esc(b.g)} : quel est le problème ? (plusieurs choix possibles)</div><div class="chips">`+
      b.s.map(x=>`<button type="button" class="chip" aria-pressed="${F.sous.includes(b.g+" > "+x[0])}" data-g="${esc(b.g)}" data-s="${esc(x[0])}">${esc(x[0])}</button>`).join("")+`</div>`+
      (au?`<input type="text" class="prec" data-p="${esc(b.g)}" placeholder="Préciser le problème" value="${esc(F.prec[b.g]||"")}">`:"")+`</div>`;}).join("");
  if(F.gros.includes(AUTRE))h+=`<div class="subbox"><div class="subt">Autre problème : préciser</div><input type="text" class="prec" data-p="${AUTRE}" placeholder="Préciser le problème" value="${esc(F.prec[AUTRE]||"")}"></div>`;
  $("subs").innerHTML=h;routeInfo();
}
["iCentre","iMetier","iUE","iTel","iAutre"].forEach(id=>$(id).addEventListener("input",()=>{F.centre=$("iCentre").value;F.metier=$("iMetier").value;F.ue=$("iUE").value;F.tel=$("iTel").value;F.autre=$("iAutre").value;}));
$("date").addEventListener("change",e=>F.date=e.target.value);
$("statut").addEventListener("change",e=>F.statut=e.target.value);
$("desc").addEventListener("input",e=>F.desc=e.target.value);


/* ---------- recherche apprenti ---------- */
let suggIdx=-1,suggList=[];
$("q").addEventListener("input",()=>{
  const q=norm($("q").value);
  if(q.length<2){hideSugg();return;}
  const toks=q.split(" ");
  suggList=people.filter(p=>toks.every(t=>p._n.includes(t))).sort((x,y)=>(toks.every(t=>x._m.includes(t))?0:1)-(toks.every(t=>y._m.includes(t))?0:1));
  suggIdx=-1;drawSugg(q);
});
$("q").addEventListener("keydown",e=>{
  const items=[...document.querySelectorAll("#sugg button")];
  if(e.key==="ArrowDown"){e.preventDefault();suggIdx=Math.min(items.length-1,suggIdx+1);}
  else if(e.key==="ArrowUp"){e.preventDefault();suggIdx=Math.max(0,suggIdx-1);}
  else if(e.key==="Enter"){e.preventDefault();if(items[suggIdx])items[suggIdx].click();else if(items.length===1)items[0].click();return;}
  else if(e.key==="Escape"){hideSugg();return;}
  else return;
  items.forEach((b,i)=>b.classList.toggle("on",i===suggIdx));
  if(items[suggIdx])items[suggIdx].scrollIntoView({block:"nearest"});
});
document.addEventListener("click",e=>{if(!e.target.closest("#searchBox"))hideSugg();});
function hideSugg(){$("sugg").hidden=true;}
function drawSugg(q){
  const s=$("sugg");
  let h=suggList.length?`<div class="cnt">${suggList.length} apprenti(s) trouvé(s)${suggList.length>6?" : faire défiler la liste ou ajouter un mot pour préciser":""}</div>`:"";
  h+=suggList.map((p,i)=>`<button type="button" data-i="${i}"><b>${esc(p.nom)}</b><span>${esc(p.ue)} · ${esc(p.centre)} · ${esc(p.metier)}</span></button>`).join("");
  h+=`<button type="button" data-nf="1" class="none"><b class="none">${suggList.length?"Aucun de ceux-là : ":"Aucun résultat : "}apprenti introuvable</b><span>Renseigner son centre et son métier</span></button>`;
  s.innerHTML=h;s.hidden=false;
}
$("sugg").addEventListener("click",e=>{
  const b=e.target.closest("button");if(!b)return;
  if(b.dataset.nf){F.p=null;F.libre=$("q").value.trim();F.tel="";F.autre="";}
  else{F.p=suggList[+b.dataset.i];F.libre="";const k=contactDe(F.p);F.tel=k.tel;F.autre=k.autre;}
  $("q").value="";hideSugg();renderApprenti();
});

function renderApprenti(){
  const c=$("chosen"),nf=$("introuvable");
  if(F.p){
    const p=F.p;
    c.innerHTML=`<div class="chosen"><strong>${esc(p.nom)}</strong><button class="btn s" id="chg1" type="button">Changer d'apprenti</button></div>
    <div class="info">${[["ID apprenti",p.id],["UE",p.ue],["Centre de formation",p.centre],["Métier",p.metier],["MAR",p.mar],["Tél. MAR",p.tmar],["Tél. UE",p.tue]].map(([k,v])=>`<div><small>${k}</small>${esc(v)||"&nbsp;"}</div>`).join("")}</div>`;
    nf.hidden=true;$("contactBox").hidden=false;$("iTel").value=F.tel;$("iAutre").value=F.autre;
  }else if(F.libre){
    c.innerHTML=`<div class="chosen"><strong>${esc(F.libre)}</strong><span class="badge warn">Hors base</span><button class="btn s" id="chg1" type="button">Changer d'apprenti</button></div>`;
    nf.hidden=false;$("contactBox").hidden=false;$("addBox").hidden=!SYNC.on;
    $("iCentre").value=F.centre;$("iMetier").value=F.metier;$("iUE").value=F.ue;$("iTel").value=F.tel;$("iAutre").value=F.autre;setSeg("segInt",F.integ);
  }else{c.innerHTML="";nf.hidden=true;$("contactBox").hidden=true;}
  const b=$("chg1");if(b)b.onclick=()=>{if(F.uid){return;}F.p=null;F.libre="";renderApprenti();$("q").focus();};
  if(b&&F.uid)b.hidden=true;
  renderHist();
}
function nomCourant(){return F.p?F.p.nom:F.libre;}
function natStr(){return PB.filter(b=>F.gros.includes(b.g)).map(b=>{
  const ss=b.s.map(x=>x[0]).filter(x=>F.sous.includes(b.g+" > "+x));const pr=(F.prec[b.g]||"").trim();
  const lst=ss.map(x=>x===AUTRE&&pr?"Autre : "+pr:x);
  return b.g+(lst.length?" ("+lst.join(", ")+")":"")+(b.g===AUTRE&&pr?" : "+pr:"");}).join(" ; ");}
function grosStr(){return PB.filter(b=>F.gros.includes(b.g)).map(b=>b.g).join(", ");}
function sousStr(){const o=[];PB.filter(b=>F.gros.includes(b.g)).forEach(b=>b.s.map(x=>x[0]).forEach(x=>{if(F.sous.includes(b.g+" > "+x))o.push(b.g+" > "+x);}));return o.join(" ; ");}
function precStr(){return PB.filter(b=>(F.prec[b.g]||"").trim()&&F.gros.includes(b.g)).map(b=>b.g+" : "+F.prec[b.g].trim().replace(/;/g,",")).join(" ; ");}

function renderHist(){
  const h=$("hist"),nom=nomCourant();
  if(!nom){h.innerHTML="";return;}
  const mine=rows.filter(r=>norm(r.nom)===norm(nom));
  let html="";
  if(!mine.length){html=`<div class="alert i">Première plainte de cet apprenti</div>`;}
  else{
    const clo=mine.filter(r=>r.statut==="Clôturé").length;
    let t=`${mine.length} plainte(s) déjà enregistrée(s), dont ${clo} clôturée(s)`;
    const ns=natStr();
    if(ns&&mine.some(r=>r.statut==="Clôturé"&&r.nature===ns))t+=" ; ce même problème a déjà été traité";
    html=`<div class="alert i">${esc(t)}</div><div class="hist">`+mine.map(r=>`<div class="hrow"><div><strong>${esc(r.nature)}</strong><br><span class="muted">${fmt(r.date)}</span> ${badge(r.statut)}</div>${F.uid===r.uid?'<span class="badge warn">En cours de modification</span>':`<button class="btn s" data-open="${r.uid}">Actualiser la plainte</button>`}</div>`).join("")+`</div>`;
  }
  h.innerHTML=html;
}
$("hist").addEventListener("click",e=>{const b=e.target.closest("[data-open]");if(b)openRow(b.dataset.open);});

function badge(s){const c=s==="Clôturé"?"ok":s==="Annulée"?"bad":s==="Nouveau"?"":"warn";return `<span class="badge ${c}">${esc(s)}</span>`;}
function fmt(d){if(!d)return "";const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(d);return m?`${m[3]}/${m[2]}/${m[1]}`:d;}

/* ---------- rendu complet du formulaire ---------- */
function paintForm(){
  $("date").value=F.date;$("statut").value=F.statut;$("desc").value=F.desc;
  setSeg("segCarte",F.carte);setSeg("segPaye",F.paye);setSeg("segCtr",F.ctr);setSeg("segInt",F.integ);
  paintPb();renderApprenti();
  const ed=!!F.uid;
  $("saisieTitle").textContent=ed?"Actualiser une plainte":"Nouvelle plainte";
  $("editing").hidden=!ed;
  if(ed){$("editing").textContent="Plainte ouverte pour modification : "+nomCourant()+" ("+natStr()+"). Modifier les cases voulues puis enregistrer.";}
  $("bSave").textContent=ed?"Enregistrer les modifications":"Enregistrer la plainte";
  $("bCancel").hidden=!ed;
}
function newForm(){F=blank();$("q").value="";paintForm();window.scrollTo({top:0});}

function openRow(uid){
  const r=rows.find(x=>x.uid===uid);if(!r)return;
  const p=r.id?people.find(x=>String(x.id)===String(r.id)):null;
  F={uid:r.uid,p:p||null,libre:p?"":r.nom,centre:r.centre||"",metier:r.metier||"",ue:r.ue||"",tel:r.tel||"",autre:r.autre||"",integ:r.integ||"",
     carte:r.carte||"",paye:r.paye||"",date:r.date||today(),statut:r.statut||"Nouveau",gros:[],sous:[],prec:{},legacy:!r.gros,ctr:r.ctr||"",desc:r.desc||"",chg:r.chg||"",contrat:r.contrat||"",res:r.res||""};
  {const sl=selOf(r);F.gros=[...new Set(sl.map(x=>x.g))];F.sous=sl.filter(x=>x.s).map(x=>x.g+" > "+x.s);(r.prec||"").split(" ; ").filter(Boolean).forEach(x=>{const k=x.indexOf(" : ");if(k>0)F.prec[x.slice(0,k)]=x.slice(k+3);});}
  if(!p&&r.id){F.p={id:r.id,nom:r.nom,ue:r.ue,centre:r.centre,metier:r.metier,mar:r.mar,tel:r.tel,autre:r.autre||"",tmar:"",tue:""};F.libre="";}
  show("saisie");paintForm();window.scrollTo({top:0});
}

