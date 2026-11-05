/* Test de charge et de bon fonctionnement avec un serveur simulé.
   Usage : npm i playwright, puis node tests/charge.js [nombre de plaintes]
   Vérifie la connexion, l'affichage du registre et du tableau de bord, et les temps de rendu. */
const {chromium}=require('playwright');
const path=require('path');
const assert=require('assert');
(async()=>{
  const N=+process.argv[2]||1500;
  const st=["Nouveau","En cours","En attente","Transmis à l'UGP","Transmis à l'ACFPE","Clôturé","Annulée"];
  const gros=["Paiement","Badge","Contrat","Formation","Santé"];
  const rows=[];
  for(let i=0;i<N;i++) rows.push({uid:"t"+i,id:String(1000+i%1900),date:"2026-10-"+String(1+i%28).padStart(2,"0"),nom:"Apprenti Test "+i,ue:"UE "+(i%294),centre:"CFPT "+(i%11),metier:"Métier "+(i%15),mar:"MAR "+(i%131),tel:"7000"+i,autre:"",nature:"Plainte",gros:gros[i%5],sous:gros[i%5]+" > sous "+(i%4),prec:"",ctr:"",desc:"Plainte "+i,statut:st[i%7],carte:"",paye:"",chg:"",contrat:"",res:"",integ:"",maj:new Date(Date.now()-i*1000).toISOString(),majPar:"Test"});
  const attendu={total:rows.filter(r=>r.statut!=="Annulée").length,clotures:rows.filter(r=>r.statut==="Clôturé").length};
  const b=await chromium.launch(); const p=await b.newPage(); const erreurs=[];
  p.on('pageerror',e=>erreurs.push(String(e)));
  await p.route('**/script.google.com/**',async r=>{
    const body=JSON.parse(r.request().postData());
    const out=body.action==="list"?{ok:true,nom:"Test",role:"Administrateur",plaintes:rows,contacts:[],apprentis:null}:{ok:true,nom:"Test",role:"Administrateur"};
    await r.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(out)});});
  await p.goto('file://'+path.resolve(__dirname,'..','index.html'));
  await p.waitForSelector('#lgCode',{state:'visible'});
  const t0=Date.now(); await p.fill('#lgCode','X'); await p.click('#lgGo');
  await p.waitForFunction(()=>typeof rows!=='undefined'&&rows.length>0,null,{timeout:60000});
  const m=await p.evaluate(()=>{const o={n:rows.length};
    const T=f=>{const a=performance.now();f();return Math.round(performance.now()-a);};
    const show=id=>document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!==id);
    show('v-registre');o.registre=T(()=>renderRegistre());
    show('v-tableau');o.tableau=T(()=>renderDash());
    o.kpis=[...document.querySelectorAll('.kpi')].map(k=>[k.querySelector('b').textContent,k.querySelector('span').textContent]);
    return o;});
  const kpi=Object.fromEntries(m.kpis.map(([n,l])=>[l,+n]));
  assert.strictEqual(m.n,N,'toutes les plaintes sont chargées');
  assert.strictEqual(kpi['Plaintes enregistrées'],attendu.total,'indicateur plaintes enregistrées');
  assert.strictEqual(kpi['Plaintes clôturées'],attendu.clotures,'indicateur plaintes clôturées');
  assert.deepStrictEqual(erreurs,[],'aucune erreur JavaScript');
  console.log(JSON.stringify({ok:true,plaintes:N,chargement_ms:Date.now()-t0,registre_ms:m.registre,tableau_ms:m.tableau}));
  await b.close();
})().catch(e=>{console.error('ECHEC :',e.message);process.exit(1);});
