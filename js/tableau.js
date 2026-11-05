/* Tableau de bord */
/* ---------- tableau de bord ---------- */
function count(list,keyFn){const m={};list.forEach(r=>{const k=keyFn(r);(Array.isArray(k)?k:[k]).forEach(x=>{if(x)m[x]=(m[x]||0)+1;});});return m;}
function bars(m,order){
  const keys=(order||Object.keys(m)).filter(k=>m[k]!==undefined||order);const max=Math.max(1,...keys.map(k=>m[k]||0));
  return keys.map(k=>`<div class="brow"><span>${esc(k)}</span><span class="tr"><span class="fl" style="display:block;width:${Math.round((m[k]||0)/max*100)}%"></span></span><span class="n">${m[k]||0}</span></div>`).join("")||`<div class="empty">Aucune donnée</div>`;
}
function renderDash(){
  const act=rows.filter(r=>r.statut!=="Annulée"),ann=rows.length-act.length;
  const k=(n,l)=>`<div class="kpi"><b>${n}</b><span>${l}</span></div>`;
  const apprentis=new Set(act.map(r=>norm(r.nom))).size;
  const clo=act.filter(r=>r.statut==="Clôturé").length;
  const reg=act.filter(r=>r.res==="Réglé").length;
  const aMod=act.filter(r=>r.chg==="Oui"&&r.contrat!=="Oui").length;
  const gc={},sc={};act.forEach(r=>{const sl=selOf(r);new Set(sl.map(x=>x.g)).forEach(g=>gc[g]=(gc[g]||0)+1);sl.forEach(x=>{const k=x.g+"|"+(x.s||"Non précisé");sc[k]=(sc[k]||0)+1;});});
  const detail=PB.filter(b=>gc[b.g]).map(b=>{const m={};const keys=b.s.map(x=>x[0]).concat(["Non précisé"]).filter(k=>sc[b.g+"|"+k]);keys.forEach(k=>m[k]=sc[b.g+"|"+k]);return `<h3 style="margin:14px 0 4px;font-size:14px;color:var(--primary)">${esc(b.g)} (${gc[b.g]})</h3>`+bars(m,keys);}).join("");
  const trn=count(act,r=>r.trans||"Non renseigné"),dst=count(act,r=>r.dest?r.dest.split(", "):[]);
  const rs={};act.forEach(r=>{const sv=suiviOf(r);Object.keys(sv).forEach(k=>{if(!sv[k].r)return;const q=k.split(" > "),g=q[0],sb=q[1]||"Général";(rs[g]=rs[g]||{});(rs[g][sb]=rs[g][sb]||{"Oui":0,"En cours":0,"Non":0})[sv[k].r]++;});});
  const resHtml=PB.filter(b=>rs[b.g]).map(b=>`<h3 style="margin:14px 0 4px;font-size:14px;color:var(--primary)">${esc(b.g)}</h3><div class="tablewrap"><table><thead><tr><th>Sous-problème</th><th>Réglé</th><th>En cours</th><th>Non réglé</th></tr></thead><tbody>`+Object.keys(rs[b.g]).map(x=>`<tr><td>${esc(x)}</td><td>${rs[b.g][x]["Oui"]}</td><td>${rs[b.g][x]["En cours"]}</td><td>${rs[b.g][x]["Non"]}</td></tr>`).join("")+`</tbody></table></div>`).join("");
  const centresC=count(act,r=>r.centre);
  const st=count(act,r=>r.statut);
  const res=count(act,r=>r.res||"Non renseigné");
  const yn=(f,vals)=>{const m=count(act,r=>r[f]||"Non renseigné");return bars(m,vals.concat(m["Non renseigné"]?["Non renseigné"]:[]));};
  const hors=act.filter(r=>!r.id);
  $("dash").innerHTML=`
  <div class="kpis">${k(act.length,"Plaintes enregistrées")}${k(apprentis,"Apprentis concernés")}${k(clo,"Plaintes clôturées")}${k(act.length-clo,"Plaintes en cours")}${k(reg,"Plaintes réglées")}${k(ann,"Plaintes annulées")}</div>
  <div class="grid g2">
    <div class="card"><h2>Plaintes par catégorie de problème</h2>${bars(gc,PB.map(b=>b.g).filter(g=>gc[g]))}<p class="note">Une plainte peut avoir plusieurs problèmes : le total peut dépasser le nombre de plaintes.</p></div>
    <div class="card"><h2>Transmission des plaintes</h2><p style="margin:0 0 6px;font-weight:600">Plainte transmise</p>${bars(trn,["Oui","Non"].concat(trn["Non renseigné"]?["Non renseigné"]:[]))}<p style="margin:14px 0 6px;font-weight:600">Transmise à</p>${bars(dst,TD)}</div>
    <div class="card" style="grid-column:1/-1"><h2>Détail par sous-problème</h2>${detail||'<div class="empty">Aucune donnée</div>'}</div>
    <div class="card" style="grid-column:1/-1"><h2>Résolution des problèmes</h2>${resHtml||'<div class="empty">Aucune réponse enregistrée dans le traitement</div>'}</div>
    <div class="card"><h2>Plaintes par centre de formation</h2>${bars(centresC)}</div>
    <div class="card"><h2>Plaintes par statut</h2>${bars(st,STATUTS.filter(s=>s!=="Annulée"))}</div>
    <div class="card"><h2>Résultat du traitement</h2>${bars(res,["Réglé","Non réglé","Injoignable"].concat(res["Non renseigné"]?["Non renseigné"]:[]))}<h2 style="margin-top:16px">Problème traité</h2>${yn("fait",["Oui","Non"])}<h2 style="margin-top:16px">Vœu de l'apprenti satisfait</h2>${yn("voeu",["Oui","Non"])}</div>
    <div class="card"><h2>Suivi des cartes, contrats et paiement</h2><p style="margin:0 0 6px;font-weight:600">L'apprenti a sa carte</p>${yn("carte",["Oui","Non","À vérifier"])}<p style="margin:14px 0 6px;font-weight:600">L'apprenti est contractualisé</p>${yn("ctr",["Oui","Non","À vérifier"])}<p style="margin:14px 0 6px;font-weight:600">L'apprenti est payé</p>${yn("paye",["Oui","Non","En partie"])}</div>
    <div class="card"><h2>Changements d'UE et contrats</h2>${bars({"Changements d'UE":act.filter(r=>r.chg==="Oui").length,"Contrats modifiés":act.filter(r=>r.chg==="Oui"&&r.contrat==="Oui").length,"Contrats à modifier":aMod},["Changements d'UE","Contrats modifiés","Contrats à modifier"])}
      <h2 style="margin-top:16px">Apprentis hors base</h2>${bars({"À intégrer":hors.filter(r=>r.integ==="À intégrer").length,"Ne pas intégrer":hors.filter(r=>r.integ==="Ne pas intégrer").length,"À vérifier":hors.filter(r=>r.integ==="À vérifier").length,"Non renseigné":hors.filter(r=>!r.integ).length},["À intégrer","Ne pas intégrer","À vérifier","Non renseigné"])}</div>
  </div>`;
}

