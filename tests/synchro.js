/* Test de la synchronisation partielle avec un serveur simulé.
   Usage : node tests/synchro.js */
const {chromium}=require('playwright');const path=require('path');const assert=require('assert');
(async()=>{
  const N=1500;let srv=[];for(let i=0;i<N;i++)srv.push({uid:"t"+i,id:String(i),date:"2026-10-01",nom:"A "+i,statut:"Nouveau",maj:new Date(Date.UTC(2026,9,1,0,0,i%60,i)).toISOString(),majPar:"T"});
  const reqs=[];const batches=[];let limit=500;let forceConflict=null;const bases=[];
  const b=await chromium.launch();const p=await b.newPage();const err=[];p.on('pageerror',e=>err.push(String(e)));
  await p.route('**/script.google.com/**',async r=>{
    const body=JSON.parse(r.request().postData());let out={ok:true,nom:"Test",role:"Administrateur"};
    if(body.action==="list"){const pl=body.since?srv.filter(x=>x.maj>=body.since):srv;reqs.push({since:body.since,n:pl.length});
      out={ok:true,nom:"Test",role:"Administrateur",plaintes:pl,contacts:[],n:srv.length,partiel:!!body.since,apprentis:null};}
    if(body.action==="upsert"){if(body.rows.length>limit)out={ok:false,err:"lot"};else if(forceConflict&&body.rows.some(x=>x.uid===forceConflict)){bases.push(body.rows.find(x=>x.uid===forceConflict).base);const sv=Object.assign({},srv.find(x=>x.uid===forceConflict),{statut:"Traité",majPar:"Collègue",maj:"2026-11-06T09:00:00.000Z"});out={ok:true,rows:[sv],conflits:[{uid:sv.uid,id:sv.id,nom:sv.nom,par:"Collègue",maj:sv.maj}]};forceConflict=null;}else{batches.push(body.rows.length);
      out={ok:true,rows:body.rows.map(x=>{const y=Object.assign({},x,{maj:new Date(Date.now()+1000).toISOString()});const i=srv.findIndex(z=>z.uid===x.uid);if(i>=0)srv[i]=y;else srv.push(y);return y;}),contacts:[]};}}
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
  // envoi par paquets : 1200 lignes modifiées hors ligne
  const dirty=async()=>p.evaluate(()=>{rows.forEach(r=>{r.statut="Clôturé";r.maj=new Date(Date.now()+500).toISOString();});return rows.length;});
  const nd=await dirty();await p.evaluate(()=>flush());await p.waitForTimeout(800);
  assert.ok(batches.length>=Math.ceil(nd/200),'plusieurs paquets : '+batches.length);assert.ok(Math.max(...batches)<=200,'paquets de 200 au plus');
  assert.strictEqual(batches.reduce((a,b)=>a+b,0),nd,'toutes les lignes envoyées une fois');ok('envoi par paquets : '+nd+' lignes en '+batches.length+' envois');
  // le serveur refuse les gros lots : la taille diminue seule et tout passe
  limit=60;batches.length=0;const nd2=await dirty();await p.evaluate(()=>{SYNC.chunk=200;flush();});await p.waitForTimeout(1500);
  ok(Math.max(...batches)<=60);assert.strictEqual(batches.reduce((a,b)=>a+b,0),nd2,'tout envoyé malgré la limite');
  assert.strictEqual(await p.evaluate(()=>pendingN()),0,'plus rien en attente');ok('refus "lot" : taille réduite automatiquement, rien perdu');
  // conflit : un collègue a modifié la même plainte, l'agent est prévenu et voit la version à jour
  limit=500;await p.evaluate(()=>{rows.forEach(r=>{SYNC.synced[r.uid]=r.maj;});const r=rows.find(x=>x.uid==="t3");r.statut="Rejeté";r.maj=new Date(Date.now()+5000).toISOString();});
  forceConflict="t3";await p.evaluate(()=>flush());await p.waitForSelector('#conflit',{timeout:5000});
  assert.ok(bases[0],'le site envoie la version de base');const txt=await p.textContent('#conflit');assert.ok(/Collègue/.test(txt)&&/A 3/.test(txt),'message : '+txt.slice(0,120));
  assert.strictEqual(await p.evaluate(()=>rows.find(r=>r.uid==="t3").statut),"Traité",'version du collègue affichée');ok('conflit : refus, avertissement avec le nom du collègue, version à jour affichée');
  await p.click('#conflit button');assert.strictEqual(await p.$('#conflit'),null);
  assert.deepStrictEqual(err,[],'aucune erreur JavaScript');
  await b.close();console.log('synchronisation : tests réussis');
})().catch(e=>{console.error('ECHEC :',e.message);process.exit(1);});
