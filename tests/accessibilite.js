/* Test d'accessibilité : contrôle automatique axe-core (WCAG A et AA) sur chaque écran, plus quelques vérifications au clavier.
   Usage : npm i, puis node tests/accessibilite.js */
const {chromium}=require('playwright');const path=require('path');const assert=require('assert');
const axe=require('axe-core').source;
(async()=>{
  const rows=[{uid:"t1",id:"1",date:"2026-10-01",nom:"Apprenti Test",ue:"UE",centre:"CFPT",metier:"M",mar:"",tel:"70000",nature:"Plainte",gros:"Paiement",sous:"x",statut:"Nouveau",desc:"d",maj:new Date().toISOString(),majPar:"T"}];
  const b=await chromium.launch();const p=await b.newPage({viewport:{width:1100,height:900}});const err=[];p.on('pageerror',e=>err.push(String(e)));
  await p.route('**/script.google.com/**',async r=>{const body=JSON.parse(r.request().postData());
    const out=body.action==="list"?{ok:true,nom:"Test",role:"Administrateur",plaintes:rows,contacts:[],apprentis:null,n:1}:body.action==="users"?{ok:true,users:[{nom:"A",code:"",actif:"Oui",role:"Utilisateur"}]}:{ok:true,nom:"Test",role:"Administrateur"};
    await r.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(out)});});
  await p.goto('file://'+path.resolve(__dirname,'..','index.html'));await p.waitForSelector('#lgCode',{state:'visible'});
  const ok=m=>console.log('ok -',m);
  const scan=async nom=>{await p.evaluate(axe);const r=await p.evaluate(()=>axe.run(document,{runOnly:['wcag2a','wcag2aa','best-practice']}));
    assert.deepStrictEqual(r.violations.map(v=>v.id+' ('+v.nodes.length+') '+v.nodes[0].target.join(' ')),[],'écran '+nom);ok('aucune violation axe : '+nom);};
  await scan('connexion');
  assert.strictEqual(await p.getAttribute('#login','role'),'dialog');
  assert.strictEqual(await p.evaluate(()=>document.querySelector('main').inert&&document.querySelector('header.top').inert),true,'page derrière la connexion désactivée');ok('connexion : fenêtre modale, reste de la page inaccessible au clavier');
  await p.fill('#lgCode','X');await p.keyboard.press('Enter');await p.waitForFunction(()=>typeof rows!=='undefined'&&rows.length>0);
  assert.strictEqual(await p.evaluate(()=>document.querySelector('main').inert),false,'page réactivée après connexion');
  for(const v of ['saisie','registre','traitement','tableau','admin']){
    await p.evaluate(x=>show(x),v);await p.waitForTimeout(300);
    assert.strictEqual(await p.getAttribute('#nav button[data-v="'+v+'"]','aria-current'),'page','onglet actif annoncé : '+v);
    await scan(v);}
  // 375 px : pas de défilement horizontal de la page
  await p.setViewportSize({width:375,height:800});
  for(const v of ['saisie','registre','traitement','tableau']){await p.evaluate(x=>show(x),v);await p.waitForTimeout(200);
    const w=await p.evaluate(()=>document.documentElement.scrollWidth);assert.ok(w<=376,'défilement horizontal sur '+v+' : '+w+' px');}
  ok('smartphone 375 px : aucun défilement horizontal de la page');
  assert.deepStrictEqual(err,[],'aucune erreur JavaScript');
  await b.close();console.log("accessibilité : tests réussis");
})().catch(e=>{console.error('ECHEC :',e.message);process.exit(1);});
