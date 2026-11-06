/* Registre des plaintes et export CSV */
/* ---------- registre ---------- */
function fillFilters(){
  const cs=[...new Set(rows.map(r=>r.centre).filter(Boolean))].sort();
  const keep=[$("rs").value,$("rc").value];
  $("rs").innerHTML=`<option value="">Tous</option>`+STATUTS.map(s=>`<option>${s}</option>`).join("");
  $("rc").innerHTML=`<option value="">Tous</option>`+cs.map(s=>`<option>${esc(s)}</option>`).join("");
  $("rs").value=keep[0]||"";$("rc").value=keep[1]||"";
}
function renderRegistre(){
  fillFilters();
  const q=norm($("rq").value),s=$("rs").value,c=$("rc").value;
  const list=rows.filter(r=>(!s||r.statut===s)&&(!c||r.centre===c)&&(!q||norm([r.nom,r.ue,r.centre,r.nature,r.desc,r.id,r.tel,r.autre].join(" ")).includes(q)))
    .sort((a,b)=>(b.date||"").localeCompare(a.date||"")||(b.maj||"").localeCompare(a.maj||""));
  $("regCount").textContent=list.length+" plainte(s) affichée(s) sur "+rows.length;
  $("regBody").innerHTML=list.length?list.map(r=>`<tr><td>${esc(fmt(r.date))}</td><td><strong>${esc(r.nom)}</strong><br><span class="muted">${esc(r.id)}${r.par?" · saisi par "+esc(r.par):""}</span></td><td>${esc(r.ue)}</td><td>${esc(r.centre)}</td><td>${esc(r.nature)}</td><td>${badge(r.statut)}</td><td>${esc(r.res)}</td>
  <td class="act"><button class="btn s" data-o="${esc(r.uid)}">Actualiser</button> ${r.statut==="Annulée"?"":`<button class="btn s d" data-c="${esc(r.uid)}">Annuler</button>`}</td></tr>`).join(""):`<tr><td colspan="8" class="empty">Aucune plainte enregistrée.</td></tr>`;
}
["rq","rs","rc"].forEach(id=>$(id).addEventListener("input",renderRegistre));
$("regBody").addEventListener("click",async e=>{
  const o=e.target.closest("[data-o]"),c=e.target.closest("[data-c]");
  if(o)openRow(o.dataset.o);
  if(c){const r=rows.find(x=>x.uid===c.dataset.c);if(!r)return;
    const k=await ask("Annuler la plainte ("+r.nature+") de "+r.nom+" ?\nElle reste dans le registre avec le statut Annulée.",[["Annuler la plainte","d"],["Retour",""]]);
    if(k===0){r.statut="Annulée";r.maj=stampMaj(r.maj);save();renderRegistre();toast("Plainte annulée.");}}
});

/* export / import */
const COLS=[["id","ID apprenti"],["date","Date réception"],["nom","Nom et prénom"],["ue","UE"],["centre","Centre"],["metier","Métier"],["mar","MAR"],["tel","Téléphone"],["autre","Autre numéro"],["nature","Nature plainte"],["gros","Gros problèmes"],["sous","Sous-problèmes"],["prec","Précisions"],["desc","Description"],["statut","Statut"],["carte","Carte ?"],["paye","Payé ?"],["ctr","Contractualisé ?"],["chg","Changement d'UE ?"],["contrat","Contrat modifié ?"],["res","Résultat du traitement"],["integ","Intégration de l'apprenti"],["fait","Traitement fait ?"],["voeu","Vœu de l'apprenti satisfait ?"],["trans","Transmise ?"],["dest","Transmise à"],["destAutre","Autre destinataire"],["transDate","Date de transmission"],["par","Saisi par"],["majPar","Modifié par"],["suivi","Suivi de la résolution"]];
function csvCell(v){v=String(v==null?"":v);if(/^[=+\-@\t\r]/.test(v)&&!/^[+\-]?[\d\s().,\-]+$/.test(v))v="'"+v;return /[;"\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}
$("exp").onclick=()=>{
    const lines=[COLS.map(c=>csvCell(c[1])).join(";")].concat(rows.map(r=>COLS.map(c=>csvCell((c[0]==="date"||c[0]==="transDate")?fmt(r[c[0]]):r[c[0]])).join(";")));
  const blob=new Blob(["﻿"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);
  const d=new Date();a.download="Registre_plaintes_"+String(d.getDate()).padStart(2,"0")+"-"+String(d.getMonth()+1).padStart(2,"0")+".csv";
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000);toast("Registre exporté.");
};
$("imp").onclick=()=>$("file").click();
$("file").addEventListener("change",async e=>{
  const f=e.target.files[0];if(!f)return;const txt=(await f.text()).replace(/^﻿/,"");e.target.value="";
  const data=parseCSV(txt);if(data.length<2){toast("Fichier vide ou illisible.");return;}
  const head=data[0].map(h=>norm(h));let add=0,skip=0;
  const idx={};COLS.forEach(c=>{const j=head.indexOf(norm(c[1]));if(j>=0)idx[c[0]]=j;});
  if(idx.nom==null){toast("Colonne « Nom et prénom » introuvable.");return;}
  if(data.length-1>2000){toast("Fichier trop gros : 2000 lignes au maximum par import. Le découper en plusieurs fichiers.");return;}
  data.slice(1).forEach(l=>{
    if(!l.some(x=>x&&x.trim()))return;
    const o={};COLS.forEach(c=>o[c[0]]=idx[c[0]]!=null?(l[idx[c[0]]]||"").trim():"");
    const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(o.date);if(m)o.date=m[3]+"-"+m[2]+"-"+m[1];const m2=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(o.transDate);if(m2)o.transDate=m2[3]+"-"+m2[2]+"-"+m2[1];
    if(rows.some(r=>norm(r.nom)===norm(o.nom)&&r.nature===o.nature&&r.date===o.date&&r.desc===o.desc)){skip++;return;}
    o.uid="u"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);o.maj=new Date().toISOString();rows.push(o);add++;
  });
  save();renderRegistre();toast(add+" plainte(s) importée(s)"+(skip?", "+skip+" déjà présente(s)":"")+".");
});
function parseCSV(t){
  const sep=(t.split("\n")[0].match(/;/g)||[]).length>=(t.split("\n")[0].match(/,/g)||[]).length?";":",";
  const out=[];let row=[],cur="",q=false;
  for(let i=0;i<t.length;i++){const ch=t[i];
    if(q){if(ch==='"'){if(t[i+1]==='"'){cur+='"';i++;}else q=false;}else cur+=ch;}
    else if(ch==='"')q=true;else if(ch===sep){row.push(cur);cur="";}
    else if(ch==="\n"){row.push(cur);out.push(row);row=[];cur="";}else if(ch!=="\r")cur+=ch;}
  if(cur.length||row.length){row.push(cur);out.push(row);}return out;
}

