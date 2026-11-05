/* Enregistrement d'une plainte */
/* ---------- enregistrement ---------- */
function toRow(uid){
  const p=F.p;
  if(p&&p.id!=null&&p.id!==""){contacts[String(p.id)]={tel:(F.tel||"").trim(),autre:(F.autre||"").trim()};saveContacts();}
  return {uid:uid||("u"+Date.now().toString(36)+Math.random().toString(36).slice(2,6)),
    id:p?p.id:"",date:F.date||today(),nom:nomCourant(),ue:p?p.ue:F.ue,centre:p?p.centre:F.centre,metier:p?p.metier:F.metier,mar:p?p.mar:"",tel:(F.tel||"").trim(),autre:(F.autre||"").trim(),
    nature:natStr(),gros:grosStr(),sous:sousStr(),prec:precStr(),ctr:F.ctr,desc:F.desc,statut:F.statut,carte:F.carte,paye:F.paye,chg:F.chg,contrat:F.contrat,res:F.res,integ:p?"":F.integ,maj:new Date().toISOString()};
}
$("bSave").onclick=async()=>{
  if(!nomCourant()){toast("Choisir d'abord l'apprenti.");$("q").focus();return;}
  if(!F.p&&(!F.centre.trim()||!F.metier.trim())){toast("Apprenti introuvable : renseigner au moins son centre et son métier.");(F.centre.trim()?$("iMetier"):$("iCentre")).focus();return;}
  if(!F.gros.length){toast("Choisir la catégorie du problème.");return;}
  if(!F.legacy){const miss=PB.filter(b=>F.gros.includes(b.g)&&b.s.length&&!F.sous.some(x=>x.startsWith(b.g+" > ")));
    if(miss.length){toast("Choisir le sous-problème pour : "+miss.map(b=>b.g).join(", ")+".");return;}}
  if(F.uid){
    const i=rows.findIndex(r=>r.uid===F.uid);
    if(i>=0){rows[i]=Object.assign({},rows[i],toRow(F.uid));save();toast("Plainte mise à jour.");newForm();return;}
    F.uid=null;
  }
  const ns=natStr();
  const same=rows.find(r=>norm(r.nom)===norm(nomCourant())&&r.nature===ns&&r.statut!=="Annulée");
  if(same){
    const c=await ask("Une plainte de même nature existe déjà pour cet apprenti.",[["Actualiser celle-ci","p"],["Créer une nouvelle plainte",""],["Retour","x"]]);
    if(c===0){openRow(same.uid);return;}
    if(c!==1)return;
  }
  rows.push(toRow());save();toast("Plainte enregistrée.");newForm();
};
$("bNew").onclick=newForm;
$("bCancel").onclick=async()=>{
  if(!F.uid)return;
  const c=await ask("Annuler la plainte ("+natStr()+") de "+nomCourant()+" ?\nElle reste dans le registre avec le statut Annulée.",[["Annuler la plainte","d"],["Retour",""]]);
  if(c!==0)return;
  const i=rows.findIndex(r=>r.uid===F.uid);
  if(i>=0){rows[i].statut="Annulée";rows[i].maj=new Date().toISOString();save();}
  toast("Plainte annulée.");newForm();
};

