/* Tests du script serveur (serveur/Code.gs) avec un Google Sheet simulé en mémoire.
   Usage : node tests/serveur.js */
const fs=require('fs'),vm=require('vm'),crypto=require('crypto'),assert=require('assert'),path=require('path');
function mkSheet(header,rows){const d=[header].concat(rows||[]);
  return {d,getLastRow:()=>d.length,getDataRange:()=>({getDisplayValues:()=>d.map(r=>r.map(String))}),
    getRange(r,c,nr,nc){nr=nr||1;nc=nc||1;const s=this;return {
      getDisplayValues:()=>{const o=[];for(let i=0;i<nr;i++){const row=[];for(let j=0;j<nc;j++)row.push(String((d[r-1+i]||[])[c-1+j]??""));o.push(row);}return o;},
      setNumberFormat(){return this;},
      clearContent(){for(let i=0;i<nr;i++)for(let j=0;j<nc;j++)if(d[r-1+i])d[r-1+i][c-1+j]="";},
      setValues(v){v.forEach((row,i)=>{d[r-1+i]=d[r-1+i]||[];row.forEach((x,j)=>{d[r-1+i][c-1+j]=x;});});},
      setValue(x){d[r-1]=d[r-1]||[];d[r-1][c-1]=x;}};}};}
function env(){
  const PK=["uid","id","date","nom","ue","centre","metier","mar","tel","autre","gros","sous","prec","nature","desc","statut","carte","paye","ctr","chg","contrat","integ","res","fait","voeu","trans","dest","destAutre","transDate","par","majPar","maj","suivi"];
  const sheets={Utilisateurs:mkSheet(["Nom","Code","Actif","Rôle"],[["Admin","ADMIN-CODE-1","Oui","Administrateur"],["Agent","AGENT-1","Oui","Utilisateur"],["Lecteur","LECT-1","Oui","Lecture"]]),
    Plaintes:mkSheet(PK),Contacts:mkSheet(["id","tel","autre","maj","par"]),Apprentis:mkSheet(["id","nom","ue","centre","metier","mar","tel","autre","tmar","tue","par"])};
  const bk={},copies=[],bkfiles=[];const cache={};const props={};let sleeps=0;
  const ctx={console,Logger:{log(){}},
    SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:n=>sheets[n],insertSheet:n=>{sheets[n]=mkSheet([]);return sheets[n];}}),openById:id=>({getSheetByName:n=>(id==='BKP'?bk[n]:sheets[n])})},
    DriveApp:{getFileById:()=>({makeCopy:n=>{copies.push(n);}}),searchFiles:()=>{let i=0;const l=bkfiles;return {hasNext:()=>i<l.length,next:()=>l[i++]};}},
    CacheService:{getScriptCache:()=>({get:k=>cache[k]??null,put:(k,v)=>{cache[k]=v;}})},
    LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]??null,setProperty:(k,v)=>{props[k]=v;}})},
    ContentService:{MimeType:{JSON:1},createTextOutput:s=>({s,setMimeType(){return this;}})},
    Utilities:{sleep(){sleeps++;},formatDate:()=>"2026-11-06 06:00",getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:"sha256"},
      computeDigest:(a,s)=>[...crypto.createHash("sha256").update(s).digest()].map(b=>b>127?b-256:b),
      base64EncodeWebSafe:b=>Buffer.from(b.map(x=>x<0?x+256:x)).toString("base64url")}};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.resolve(__dirname,'..','serveur','Code.gs'),'utf8'),ctx);
  const call=(code,body)=>JSON.parse(ctx.doPost({postData:{contents:JSON.stringify(Object.assign({code},body))}}).s);
  return {ctx,sheets,call,cache,bk,copies,bkfiles,mkSheet,sleeps:()=>sleeps};
}
const ok=(c,m)=>assert.ok(c,m);let n=0;const T=(nom,f)=>{f();n++;console.log("ok -",nom);};
T("connexion avec code valide, refus avec code faux (et ralentissement)",()=>{const e=env();
  assert.strictEqual(e.call("AGENT-1",{action:"login"}).ok,true);
  assert.strictEqual(e.call("agent-1",{action:"login"}).ok,true,"insensible à la casse");
  const r=e.call("FAUX",{action:"login"});assert.strictEqual(r.err,"code");ok(e.sleeps()>=1);});
T("chiffrement des codes : plus de clair dans le Sheet, connexion toujours possible",()=>{const e=env();
  e.ctx.chiffrerCodes();const u=e.sheets.Utilisateurs.d;
  ok(u.slice(1).every(r=>/^h:[0-9a-f]{64}$/.test(r[1])),"tous chiffrés");
  assert.strictEqual(e.call("AGENT-1",{action:"login"}).ok,true);
  const l=e.call("ADMIN-CODE-1",{action:"users"});ok(l.users.every(x=>x.code===""&&x.chiffre===true),"codes non renvoyés");});
T("gestion des utilisateurs : droits, longueur minimale, code déjà pris, code conservé",()=>{const e=env();
  assert.strictEqual(e.call("AGENT-1",{action:"saveUser",user:{nom:"X",code:"ABCDEFGHIJKL"}}).err,"droits");
  assert.strictEqual(e.call("ADMIN-CODE-1",{action:"saveUser",user:{nom:"Neo",code:"court",actif:"Oui",role:"Utilisateur"}}).err,"court");
  assert.strictEqual(e.call("ADMIN-CODE-1",{action:"saveUser",user:{nom:"Neo",code:"ABCD-EFGH-JKLM",actif:"Oui",role:"Utilisateur"}}).ok,true);
  assert.strictEqual(e.call("ADMIN-CODE-1",{action:"saveUser",user:{nom:"Zed",code:"abcd-efgh-jklm",actif:"Oui",role:"Utilisateur"}}).err,"code_pris");
  const stored=e.sheets.Utilisateurs.d.find(r=>r[0]==="Neo")[1];ok(/^h:/.test(stored));
  assert.strictEqual(e.call("ADMIN-CODE-1",{action:"saveUser",user:{nom:"Neo",code:"",actif:"Oui",role:"Lecture"}}).ok,true);
  assert.strictEqual(e.sheets.Utilisateurs.d.find(r=>r[0]==="Neo")[1],stored,"code conservé");
  assert.strictEqual(e.call("ABCD-EFGH-JKLM",{action:"login"}).role,"Lecture");});
T("rôle Lecture : lecture permise, écriture refusée",()=>{const e=env();
  assert.strictEqual(e.call("LECT-1",{action:"list"}).ok,true);
  assert.strictEqual(e.call("LECT-1",{action:"upsert",rows:[{uid:"u1"}]}).err,"droits");
  assert.strictEqual(e.call("LECT-1",{action:"addApprenti",apprenti:["1","N"]}).err,"droits");});
T("validation des plaintes : uid, date, longueur, horloge, auteur",()=>{const e=env();
  const now=new Date().toISOString();
  const r=e.call("AGENT-1",{action:"upsert",rows:[
    {uid:'"><img src=x onerror=alert(1)>',nom:"mauvais uid"},
    {uid:"ok1",nom:"Bon",date:'"><b>',desc:"x".repeat(60000),maj:"9999-12-31T00:00:00.000Z",par:"Usurpateur"},
    {uid:"ok2",nom:"Deux",date:"2026-10-01",maj:"2026-10-01T10:00:00.000Z"}]});
  assert.strictEqual(r.ok,true);assert.strictEqual(r.rows.length,2,"uid piégé refusé");
  const a=r.rows.find(x=>x.uid==="ok1");
  assert.strictEqual(a.date,"","date invalide vidée");assert.strictEqual(a.desc.length,5000,"description plafonnée");
  ok(a.maj<"2100","maj future ramenée à l'heure du serveur");assert.strictEqual(a.par,"Agent","auteur non falsifiable");assert.strictEqual(a.majPar,"Agent");
  const b=e.call("ADMIN-CODE-1",{action:"upsert",rows:[{uid:"imp1",nom:"Import",par:"Ancien saisisseur"}]});assert.strictEqual(b.rows[0].par,"Ancien saisisseur","l'administrateur peut importer");
  assert.strictEqual(e.call("AGENT-1",{action:"upsert",rows:Array(501).fill({uid:"a"})}).err,"lot","lot trop gros refusé");});
T("une version plus récente du Sheet n'est pas écrasée",()=>{const e=env();
  e.call("AGENT-1",{action:"upsert",rows:[{uid:"c1",nom:"V2",maj:"2026-10-02T00:00:00.000Z"}]});
  const r=e.call("ADMIN-CODE-1",{action:"upsert",rows:[{uid:"c1",nom:"V1",maj:"2026-10-01T00:00:00.000Z"}]});
  assert.strictEqual(r.rows[0].nom,"V2");});
T("limite d'essais : blocage des nouveaux codes, pas des sessions déjà validées",()=>{const e=env();
  e.call("AGENT-1",{action:"login"});
  for(let i=0;i<10;i++)e.call("FAUX"+i,{action:"login"});
  assert.strictEqual(e.call("ADMIN-CODE-1",{action:"login"}).err,"bloque");
  assert.strictEqual(e.call("AGENT-1",{action:"list"}).ok,true,"session déjà validée conservée");});
T("erreur interne : message générique, pas de détail",()=>{const e=env();
  const bad=JSON.parse(e.ctx.doPost({postData:{contents:"{pas du json"}}).s);assert.strictEqual(bad.err,"serveur");});
T("historique : création, champs modifiés, rien si aucun changement",()=>{const e=env();
  e.call("AGENT-1",{action:"upsert",rows:[{uid:"h1",id:"7",nom:"Zed",statut:"Nouveau",desc:"a",maj:"2026-10-01T00:00:00.000Z"}]});
  let h=e.sheets.Historique.d;assert.strictEqual(h[0][0],"Date");assert.strictEqual(h.length,2,"1 ligne de création");assert.strictEqual(h[1][2],"Création");assert.strictEqual(h[1][1],"Agent");
  const r1=e.call("AGENT-1",{action:"upsert",rows:[{uid:"h1",id:"7",nom:"Zed",statut:"Nouveau",desc:"a",maj:"2026-10-02T00:00:00.000Z"}]});
  assert.strictEqual(e.sheets.Historique.d.length,2,"renvoi identique : rien d'écrit");
  e.call("ADMIN-CODE-1",{action:"upsert",rows:[{uid:"h1",id:"7",nom:"Zed",statut:"Clôturé",desc:"b",maj:new Date(Date.now()+60000).toISOString()}]});
  h=e.sheets.Historique.d;assert.strictEqual(h.length,4,"2 champs modifiés");
  const l=h.slice(2).map(x=>x[5]+":"+x[6]+">"+x[7]+":"+x[1]).sort();
  assert.deepStrictEqual(l,["desc:a>b:Admin","statut:Nouveau>Clôturé:Admin"]);});
T("l'heure du serveur fait foi et la plainte garde son auteur",()=>{const e=env();
  e.call("AGENT-1",{action:"upsert",rows:[{uid:"s1",id:"1",nom:"A",maj:"2020-01-01T00:00:00.000Z"}]});
  const r=e.call("ADMIN-CODE-1",{action:"upsert",rows:[{uid:"s1",id:"1",nom:"A",statut:"En cours",maj:new Date(Date.now()+60000).toISOString()}]});
  ok(r.rows[0].maj>"2026","maj posé par le serveur : "+r.rows[0].maj);assert.strictEqual(r.rows[0].par,"Agent");assert.strictEqual(r.rows[0].majPar,"Admin");});
T("sauvegarde : vérification et restauration de l'onglet Plaintes",()=>{const e=env();
  e.call("AGENT-1",{action:"upsert",rows:[{uid:"b1",id:"1",nom:"Avant",maj:"2026-10-01T00:00:00.000Z"},{uid:"b2",id:"2",nom:"Aussi",maj:"2026-10-01T00:00:00.000Z"}]});
  const copie=e.sheets.Plaintes.d.map(r=>r.slice());
  e.bk.Plaintes=e.mkSheet(copie[0],copie.slice(1));e.bk.Contacts=e.mkSheet(["id"]);e.bk.Apprentis=e.mkSheet(["id"]);e.bk.Utilisateurs=e.mkSheet(["Nom"]);
  e.bkfiles.push({getId:()=>"BKP",getName:()=>"Sauvegarde test",getDateCreated:()=>new Date(),setTrashed(){}});
  e.ctx.SpreadsheetApp.openById=(id)=>({getSheetByName:n=>(id==="BKP"?e.bk[n]:e.sheets[n])});
  assert.strictEqual(e.ctx.verifierSauvegarde(),true);
  e.call("ADMIN-CODE-1",{action:"upsert",rows:[{uid:"b1",id:"1",nom:"Abîmé",desc:"x",maj:new Date(Date.now()+60000).toISOString()}]});
  e.ctx.restaurerPlaintes();assert.ok(e.copies.some(x=>/Avant restauration/.test(x)),"copie de sécurité faite");
  const noms=e.sheets.Plaintes.d.slice(1).map(r=>r[3]).sort();assert.deepStrictEqual(noms,["Aussi","Avant"]);});
console.log(n+" tests serveur réussis");
