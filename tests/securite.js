/* Tests de sécurité côté navigateur avec un serveur simulé.
   Usage : node tests/securite.js */
const {chromium}=require('playwright');const path=require('path');const assert=require('assert');
const URL='file://'+path.resolve(__dirname,'..','index.html');
const XSS='"><img src=x onerror="window.__xss=1">';
let n=0;const ok=(m)=>{n++;console.log('ok -',m);};
(async()=>{
  const b=await chromium.launch();
  async function ouvrir(role,nom,rows,envoyes){
    const ctx=await b.newContext();const p=await ctx.newPage();const err=[];p.on('pageerror',e=>err.push(String(e)));
    await p.route('**/script.google.com/**',async r=>{
      const body=JSON.parse(r.request().postData());
      if(body.action==="upsert"&&envoyes)envoyes.push({code:body.code,rows:body.rows});
      const out=body.action==="list"?{ok:true,nom,role,plaintes:rows||[],contacts:[],apprentis:null}
        :body.action==="upsert"?{ok:true,rows:body.rows}:{ok:true,nom,role};
      await r.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(out)});});
    await p.goto(URL);await p.waitForSelector('#lgCode',{state:'visible'});return {ctx,p,err};}
  const login=async(p,code)=>{await p.fill('#lgCode',code);await p.click('#lgGo');await p.waitForFunction(()=>typeof rows!=='undefined'&&typeof SYNC!=='undefined'&&SYNC.on&&sessionStorage.getItem('icompete_nom'),null,{timeout:15000});};

  // 1. XSS : uid et date piégés ne s'exécutent dans aucune vue
  {const piege={uid:'a1',id:'1',date:'2026-10-01',nom:XSS,statut:'Nouveau',desc:XSS,maj:new Date().toISOString(),majPar:'T'};
   const {ctx,p,err}=await ouvrir('Administrateur','Admin',[piege,Object.assign({},piege,{uid:'a2',date:XSS})]);
   await login(p,'X');
   await p.evaluate(()=>{rows.push({uid:'x"><img src=x onerror=window.__xss=1>',id:'9',date:'2026-10-02',nom:'N',statut:'Nouveau',maj:new Date().toISOString()});});
   await p.evaluate(()=>{const show=id=>document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!==id);
     ['v-registre','v-traitement','v-tableau'].forEach(id=>{show(id);try{renderRegistre();}catch(e){}try{renderDash();}catch(e){}try{window.renderTraitement&&renderTraitement();}catch(e){}});});
   await p.waitForTimeout(500);
   assert.strictEqual(await p.evaluate(()=>window.__xss||0),0,'aucun script exécuté');ok('XSS uid/date/nom/desc neutralisés');
   await ctx.close();}

  // 2. Déconnexion : plus rien dans le stockage
  {const {ctx,p}=await ouvrir('Utilisateur','Agent',[{uid:'z1',id:'1',date:'2026-10-01',nom:'Secret',statut:'Nouveau',maj:new Date().toISOString()}]);
   await login(p,'X');
   const avant=await p.evaluate(()=>JSON.stringify([Object.entries(localStorage),Object.entries(sessionStorage)]));
   assert.ok(/Secret/.test(avant),'données présentes pendant la session');
   await p.evaluate(()=>wipeSession());
   const apres=await p.evaluate(()=>JSON.stringify([Object.entries(localStorage),Object.entries(sessionStorage)]));
   assert.ok(!/Secret|SYNC|icompete_code/.test(apres),'rien après déconnexion : '+apres.slice(0,200));ok('déconnexion efface données et code');
   await ctx.close();}

  // 3. Lignes en attente : jamais envoyées sous le code d'un autre
  {const envoyes=[];const A=await ouvrir('Utilisateur','Agent A',[],null);
   await login(A.p,'CODE-A');
   await A.p.evaluate(()=>{rows.push({uid:'p1',id:'5',date:'2026-10-03',nom:'Hors ligne A',statut:'Nouveau',maj:new Date().toISOString()});saveLocal(true);});
   const pend=await A.p.evaluate(()=>localStorage.getItem('icompete_pending_v1'));
   assert.ok(/Hors ligne A/.test(pend||''),'ligne en attente conservée pour son auteur');
   await A.p.evaluate(()=>wipeSession());
   const B=await ouvrir('Utilisateur','Agent B',[],envoyes);
   // même origine file:// : on recopie le stockage persistant de A dans le contexte B
   await B.p.evaluate(v=>localStorage.setItem('icompete_pending_v1',v),pend);
   await login(B.p,'CODE-B');await B.p.waitForTimeout(1500);
   const vuB=await B.p.evaluate(()=>rows.some(r=>r.uid==='p1'));
   assert.strictEqual(vuB,false,'B ne récupère pas les lignes de A');
   assert.ok(!envoyes.some(e=>e.rows.some(r=>r.uid==='p1')),'rien de A envoyé avec le code de B');ok('lignes en attente liées à leur propriétaire');
   // retour de A : récupère ses lignes
   const A2=await ouvrir('Utilisateur','Agent A',[],null);
   await A2.p.evaluate(v=>localStorage.setItem('icompete_pending_v1',v),pend);
   await login(A2.p,'CODE-A');
   assert.strictEqual(await A2.p.evaluate(()=>rows.some(r=>r.uid==='p1')),true,'A retrouve ses lignes');ok('le propriétaire retrouve ses lignes');
   await A.ctx.close();await B.ctx.close();await A2.ctx.close();}

  // 4. Rôle Lecture : pas d'envoi, actions masquées
  {const envoyes=[];const {ctx,p}=await ouvrir('Lecture','Lecteur',[],envoyes);await login(p,'L');
   assert.strictEqual(await p.evaluate(()=>SYNC.readonly),true);
   await p.evaluate(()=>{rows.push({uid:'l1',id:'1',date:'2026-10-01',nom:'x',statut:'Nouveau',maj:new Date().toISOString()});save&&save();});
   await p.waitForTimeout(1200);assert.strictEqual(envoyes.length,0,'aucun envoi en lecture seule');ok('rôle Lecture : aucun envoi');await ctx.close();}

  // 5. CSV : formules neutralisées
  {const {ctx,p}=await ouvrir('Administrateur','Admin',[]);await login(p,'X');
   const r=await p.evaluate(()=>[csvCell('=HYPERLINK("x")'),csvCell('+cmd'),csvCell('@SUM(1)'),csvCell('70001234'),csvCell('+23670001234'),csvCell('Texte')]);
   assert.ok(r[0].includes("'=")&&r[1].includes("'+")&&r[2].includes("'@"),'formules préfixées : '+r);
   assert.ok(!r[3].includes("'")&&!r[4].includes("'"),'téléphones intacts : '+r);ok('export CSV sans injection de formule');await ctx.close();}

  // 6. Mise à jour : bandeau si saisie en cours, rechargement sinon, jamais de retour en arrière
  {const http=require('http'),fs=require('fs');
   const srv=http.createServer((q,r)=>{const f=path.join(__dirname,'..',q.url.split('?')[0]==='/'?'index.html':q.url.split('?')[0]);
     fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end();}const t=f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html';r.writeHead(200,{'content-type':t});r.end(d);});}).listen(8799);
   async function essai(build,saisie){
     const ctx=await b.newContext();const p=await ctx.newPage();
     await p.route('**/script.google.com/**',r=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({ok:true,nom:'A',role:'Utilisateur',plaintes:[],contacts:[],apprentis:null})}));
     let nouveau=false;
     await p.route('http://localhost:8799/index.html*',async r=>{const u=r.request().url();
       if(u.includes('_=')){if(!nouveau)return r.continue();const t=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8').replace(/APP_BUILD="[^"]+"/,'APP_BUILD="'+build+'"');return r.fulfill({status:200,contentType:'text/html',body:t});}
       if(u.includes('v=')&&nouveau){const t=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8').replace(/APP_BUILD="[^"]+"/,'APP_BUILD="'+build+'"');return r.fulfill({status:200,contentType:'text/html',body:t});}
       r.continue();});
     await p.goto('http://localhost:8799/index.html');await p.waitForSelector('#lgCode',{state:'visible'});
     if(saisie){await login(p,'X');await p.evaluate(()=>{const i=[...document.querySelectorAll('input[type=text],input:not([type]),textarea')].find(x=>x.offsetParent&&x.id!=='lgCode');if(i)i.focus();window.__foc=!!i;});}
     nouveau=true;
     await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await p.waitForTimeout(1200);
     const r={banner:!!(await p.$('#majbar')),url:p.url(),foc:saisie?await p.evaluate(()=>window.__foc):null};await ctx.close();return r;}
   const a=await essai('29991231-1',true);assert.ok(a.banner&&!/v=2999/.test(a.url),'bandeau pendant la saisie, pas de rechargement : '+JSON.stringify(a));ok('nouvelle version pendant la saisie : bandeau, pas de rechargement');
   const c=await essai('29991231-1',false);assert.ok(/v=29991231-1/.test(c.url),'rechargement hors saisie : '+JSON.stringify(c));ok('nouvelle version hors saisie : rechargement');
   const d=await essai('20000101-1',false);assert.ok(!d.banner&&!/v=2000/.test(d.url),'pas de retour en arrière');ok('version plus ancienne ignorée');
   srv.close();}
  await b.close();console.log(n+' tests de sécurité réussis');
})().catch(e=>{console.error('ECHEC :',e.message);process.exit(1);});
