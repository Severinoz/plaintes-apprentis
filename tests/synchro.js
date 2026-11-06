/* Test de la synchronisation partielle avec un serveur simulé.
   Usage : node tests/synchro.js */
const {chromium}=require('playwright');const path=require('path');const assert=require('assert');
(async()=>{
  const N=1500;let srv=[];for(let i=0;i<N;i++)srv.push({uid:"t"+i,id:String(i),date:"2026-10-01",nom:"A "+i,statut:"Nouveau",maj:new Date(Date.UTC(2026,9,1,0,0,i%60,i)).toISOString(),majPar:"T"});
  const reqs=[];
  const b=await chromium.launch();const p=await b.newPage();const err=[];p.on('pageerror',e=>err.push(String(e)));
  await p.route('**/script.google.com/**',async r=>{
    const body=JSON.parse(r.request().postData());let out={ok:true,nom:"Test",role:"Administrateur"};
    if(body.action==="list"){const pl=body.since?srv.filter(x=>x.maj>=body.since):srv;reqs.push({since:body.since,n:pl.length});
      out={ok:true,nom:"Test",role:"Administrateur",plaintes:pl,contacts:[],n:srv.length,partiel:!!body.since,apprentis:null};}
    await r.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(out)});});
  await p.goto('file://'+path.resolve(__dirname,'..','index.html'));await p.waitForSelector('#lgCode',{state:'visible'});
  await p.fill('#lgCode','X');await p.click('#lgGo');
  await p.waitForFunction(()=>typeof rows!=='undefined'&&rows.length>=1500,null,{timeout:30000});
  const ok=m=>console.log('ok -',m);
  assert.strictEqual(reqs[0].since,undefined);assert.strictEqual(reqs[0].n,N);ok('première lecture : complète');
  // un collègue modifie une plainte
  srv[10]=Object.assign({},srv[10],{statut:"Clôturé",maj:new Date().toISOString(),majPar:"Collègue"});
  await p.evaluate(()=>pull());await p.waitForTimeout(500);
  const r1=reqs[reqs.length-1];assert.ok(r1.since,'envoie since');assert.ok(r1.n<=5,'peu de lignes reçues : '+r1.n);
  assert.strictEqual(await p.evaluate(()=>rows.length),N,'aucune ligne perdue');
  assert.strictEqual(await p.evaluate(()=>rows.find(r=>r.uid==="t10").statut),"Clôturé",'modification reçue');ok('lecture partielle : '+r1.n+' ligne(s) reçue(s) sur '+N+', modification appliquée');
  // une nouvelle plainte arrive
  srv.push({uid:"neuve",id:"9999",date:"2026-11-06",nom:"Nouvelle",statut:"Nouveau",maj:new Date().toISOString(),majPar:"Collègue"});
  await p.evaluate(()=>pull());await p.waitForTimeout(500);
  assert.strictEqual(await p.evaluate(()=>rows.length),N+1);ok('nouvelle plainte ajoutée sans tout relire');
  // des lignes disparaissent du serveur : le nombre ne correspond plus, relecture complète au tour suivant
  srv=srv.slice(0,N-5);
  await p.evaluate(()=>pull());await p.waitForTimeout(500);await p.evaluate(()=>pull());await p.waitForTimeout(500);
  const dern=reqs[reqs.length-1];assert.strictEqual(dern.since,undefined,'relecture complète déclenchée');
  assert.strictEqual(await p.evaluate(()=>rows.length),N-5,'lignes supprimées retirées');ok('écart de nombre détecté, relecture complète');
  assert.deepStrictEqual(err,[],'aucune erreur JavaScript');
  await b.close();console.log('synchronisation : tests réussis');
})().catch(e=>{console.error('ECHEC :',e.message);process.exit(1);});
