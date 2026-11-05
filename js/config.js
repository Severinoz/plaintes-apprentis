/* Configuration, référentiel des problèmes et état de synchronisation */
const BASE = [];
const AUTRE="Autre";
const DEST={U:"UGP",A:"Cellule informatique de l'ACFPE"};
const PB=[
 {g:"UE",d:"",s:[["Distance entre l'apprenti et l'UE","A"],["Contrat pas encore signé par l'UE","U"],["L'UE ne fait pas le métier de l'apprenti","A"],["L'apprenti fait une formation différente de celle de l'UE","A"],["UE introuvable ou injoignable","A"],["UE non outillée","A"],["L'UE refuse l'apprenti","A"],["UE fermée ou en cessation d'activité","A"],["Problème de traitement de l'apprenti par l'UE",""],["Apprenti non encadré ou sans tâches dans l'UE",""],[AUTRE,""]]},
 {g:"Centre de formation",d:"",s:[["Distance entre l'apprenti et le centre","A"],["Le centre ne dispense pas le métier de l'apprenti","A"],["Apprenti absent de la liste du centre","A"],["Formation pas encore démarrée ou en retard",""],["Problème avec un formateur",""],["Manque de matériel pour la formation",""],[AUTRE,""]]},
 {g:"Métier",d:"A",s:[["Métier non choisi par l'apprenti",""],["L'apprenti veut changer de métier",""],["Métier erroné dans la liste",""],["Métier non disponible dans le centre",""],[AUTRE,""]]},
 {g:"MAR",d:"",s:[["MAR absent",""],["MAR injoignable",""],["MAR qui ne fait pas son travail de suivi",""],["MAR qui ne forme pas l'apprenti",""],["MAR au comportement déplacé envers l'apprenti",""],["MAR non attribué ou inconnu","A"],[AUTRE,""]]},
 {g:"Paiement",d:"U",s:[["Apprenti non payé",""],["Apprenti payé en partie",""],["Retard de paiement",""],["Erreur sur le montant",""],["Problème de numéro ou de compte Orange Money",""],["Paiement en espèces demandé",""],["Paiement envoyé à un autre numéro",""],[AUTRE,""]]},
 {g:"Contrat",d:"U",s:[["Contrat pas encore signé par l'apprenti",""],["Contrat pas encore signé par l'UE",""],["Contrat introuvable ou non remis",""],["Contrat à modifier après changement d'UE",""],["Erreur dans le contrat (nom, métier, montant)",""],[AUTRE,""]]},
 {g:"Badge",d:"A",s:[["Apprenti sans carte",""],["Carte pas encore distribuée",""],["Erreur sur la carte (nom, photo)",""],["Carte perdue ou détériorée",""],[AUTRE,""]]},
 {g:"Affectation",d:"A",s:[["Erreur d'affectation",""],["Apprenti pas encore affecté",""],["Affectation trop éloignée du domicile",""],["Changement d'UE demandé",""],["Changement de centre demandé",""],[AUTRE,""]]},
 {g:"Données de l'apprenti",d:"A",s:[["Nom erroné ou mal écrit",""],["Numéro de téléphone erroné",""],["Apprenti absent de la base",""],["Doublon dans la base",""],[AUTRE,""]]},
 {g:"Conseiller de suivi",d:"",s:[["Conseiller absent ou injoignable",""],["Suivi non effectué",""],["Comportement déplacé",""],[AUTRE,""]]},
 {g:"Abandon ou refus",d:"",s:[["L'apprenti veut abandonner",""],["L'apprenti refuse l'UE",""],["L'apprenti refuse la formation",""],["L'apprenti ne se présente plus",""],[AUTRE,""]]},
 {g:"Mauvais traitement ou discrimination",d:"",s:[["Mauvais traitement",""],["Harcèlement ou violence",""],["Discrimination",""],[AUTRE,""]]},
 {g:AUTRE,d:"",s:[]}
];
const LEG={"Paiement":[["Paiement"]],"Distance apprenti-UE":[["UE","Distance entre l'apprenti et l'UE"]],"UE introuvable ou non outillée":[["UE"]],"Erreur d'affectation":[["Affectation","Erreur d'affectation"]],"Problème avec l'UE":[["UE"]],"Problème avec le MAR":[["MAR"]],"Problème avec le conseiller":[["Conseiller de suivi"]],"Carte ou contrat":[["Badge"],["Contrat"]],"Nom erroné":[["Données de l'apprenti","Nom erroné ou mal écrit"]],"Abandon ou refus":[["Abandon ou refus"]],"Problème avec le centre de formation":[["Centre de formation"]],"Discrimination ou mauvais traitement":[["Mauvais traitement ou discrimination"]],"Autre":[["Autre"]]};
const pbOf=g=>PB.find(x=>x.g===g);
function destOf(g,sb){const b=pbOf(g);if(!b)return "";const it=sb?b.s.find(x=>x[0]===sb):null;return (it&&it[1])||b.d||"";}
function selOf(r){
  const out=[];
  if(r.gros){const ss=(r.sous||"").split(" ; ").filter(Boolean).map(x=>x.split(" > "));
    r.gros.split(", ").filter(Boolean).forEach(g=>{const m=ss.filter(x=>x[0]===g);if(m.length)m.forEach(x=>out.push({g,s:x[1]}));else out.push({g,s:null});});return out;}
  (r.nature||"").split(", ").forEach(n=>{n=n.trim();if(!n)return;const m=LEG[n];if(m)m.forEach(x=>out.push({g:x[0],s:x[1]||null}));else out.push({g:AUTRE,s:null});});
  return out;
}
function routeText(sel){const m={};sel.forEach(x=>{const d=destOf(x.g,x.s);if(d)(m[d]=m[d]||[]).push(x.s||x.g);});return Object.keys(m).map(d=>DEST[d]+" : "+[...new Set(m[d])].join(" ; "));}
const TD=["UGP","Cellule informatique de l'ACFPE","Autre"];
const STATUTS = ["Nouveau","En cours","En attente","Transmis à l'UGP","Transmis à l'ACFPE","Clôturé","Annulée"];
const KEY = "icompete_plaintes_v1";
const SEEDKEY = "icompete_plaintes_seed_v1";
const SHEET_URL = "https://script.google.com/macros/s/AKfycbyZicCHLGD1_DKnNREw4X-Mpx-DCJ2n8Bsz-mQelJGuBaIXOkhrjmgI-lNe-GrA04JtdA/exec";
let SU = SHEET_URL; try{ SU = SU || localStorage.getItem("icompete_sheet_url") || ""; }catch(e){}
const SYNC = {on:!!SU, role:"", ok:false, busy:false, pulling:false, nom:"", code:"", synced:{}, sc:{}, err:""};
/* Avec la base partagée, les données de travail restent dans la session de l'onglet (sessionStorage) :
   elles disparaissent à la fermeture. Seules les saisies non envoyées sont gardées dans localStorage, au nom de leur auteur. */
const DB=(()=>{try{return SYNC.on?sessionStorage:localStorage;}catch(e){return localStorage;}})();
try{ if(SYNC.on)["icompete_code","icompete_role","icompete_plaintes_v1","icompete_app_v1","icompete_contacts_v1","icompete_synced_v1","icompete_sc_v1"].forEach(k=>localStorage.removeItem(k)); }catch(e){}
try{ SYNC.role=sessionStorage.getItem("icompete_role")||""; SYNC.nom=sessionStorage.getItem("icompete_nom")||""; SYNC.code=sessionStorage.getItem("icompete_code")||""; SYNC.synced=JSON.parse(DB.getItem("icompete_synced_v1")||"{}")||{}; SYNC.sc=JSON.parse(DB.getItem("icompete_sc_v1")||"{}")||{}; }catch(e){}
SYNC.readonly=SYNC.role==="Lecture";
const SEED = [];

