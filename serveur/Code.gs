/* Passerelle entre l'application "Gestion des plaintes des apprentis" et ce Google Sheet.
   Onglets : Plaintes, Contacts, Apprentis, Utilisateurs. Ne pas déplacer ni supprimer les colonnes. */

var PK = ["uid","id","date","nom","ue","centre","metier","mar","tel","autre","gros","sous","prec","nature","desc","statut","carte","paye","ctr","chg","contrat","integ","res","fait","voeu","trans","dest","destAutre","transDate","par","majPar","maj","suivi"];
var CK = ["id","tel","autre","maj","par"];
var AK = ["id","nom","ue","centre","metier","mar","tel","autre","tmar","tue","par"];

var MAXF = 30;                       // échecs en 10 min qui déclenchent l'alerte e-mail
var MAXH = 200;                      // échecs en 1 h : blocage de secours des nouveaux codes
var CODE_MIN = 10;                   // longueur minimale d'un code
var CODE_COURT_REFUSE_APRES = "2026-11-20";   // après cette date, un code plus court que CODE_MIN est refusé (réponse "faible")
/* Alerte e-mail à l'administrateur (le propriétaire du script), au plus une par heure, sans aucune donnée personnelle. */
function alerte_(sujet, texte) {
  try {
    var c = CacheService.getScriptCache();
    if (c.get("alerte")) return;
    c.put("alerte", "1", 3600);
    MailApp.sendEmail(Session.getEffectiveUser().getEmail(), "[Plaintes] " + sujet, texte);
  } catch (e) { console.error("alerte : " + String(e)); }
}
/* À lancer une seule fois depuis l'éditeur pour autoriser l'envoi des alertes. */
function autoriserAlertes() {
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(), "[Plaintes] Test des alertes", "Les alertes e-mail fonctionnent.");
  Logger.log("Message de test envoyé à " + Session.getEffectiveUser().getEmail());
}
function hash_(c) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(c || "").trim().toLowerCase()));
}

/* Sauvegarde quotidienne : copie du Sheet dans Drive, on garde les 14 dernières.
   À lancer une seule fois : exécuter installerSauvegarde (autoriser l'accès à Drive). */
var BKP = "Sauvegarde plaintes apprentis ", BKP_GARDER = 14;
function sauvegarde() {
  var d = Utilities.formatDate(new Date(), "Africa/Bangui", "yyyy-MM-dd HH:mm");
  DriveApp.getFileById(SSID).makeCopy(BKP + d);
  var l = sauvegardes_();
  for (var i = BKP_GARDER; i < l.length; i++) l[i].f.setTrashed(true);
}
function sauvegardes_() {
  var it = DriveApp.searchFiles('title contains "' + BKP + '" and trashed = false'), l = [];
  while (it.hasNext()) { var f = it.next(); l.push({ f: f, t: f.getDateCreated().getTime() }); }
  l.sort(function (x, y) { return y.t - x.t; });
  return l;
}
function installerSauvegarde() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "sauvegarde") ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("sauvegarde").timeBased().everyDays(1).atHour(5).create();
  sauvegarde();
}
/* Test de la sauvegarde : compare le nombre de lignes de la dernière copie avec le Sheet actuel.
   Exécuter verifierSauvegarde puis lire le journal d'exécution. */
function verifierSauvegarde() {
  var l = sauvegardes_();
  if (!l.length) { Logger.log("ECHEC : aucune sauvegarde trouvée"); return false; }
  var copie = SpreadsheetApp.openById(l[0].f.getId()), ok = true;
  ["Plaintes", "Contacts", "Apprentis", "Utilisateurs"].forEach(function (n) {
    var a = copie.getSheetByName(n), b = sh_(n);
    var ra = a ? a.getLastRow() : -1, rb = b ? b.getLastRow() : -1;
    Logger.log(n + " : sauvegarde " + ra + " lignes, actuel " + rb + " lignes" + (ra > rb ? "  <-- ATTENTION" : ""));
    if (!a || ra < 1) ok = false;
  });
  Logger.log((ok ? "OK" : "ECHEC") + " : sauvegarde du " + l[0].f.getName());
  return ok;
}
/* Restauration : remet l'onglet Plaintes tel qu'il était dans la dernière sauvegarde.
   Une copie de sécurité "Avant restauration" est faite d'abord. Exécuter restaurerPlaintes. */
function restaurerPlaintes() {
  var l = sauvegardes_();
  if (!l.length) { Logger.log("ECHEC : aucune sauvegarde"); return false; }
  DriveApp.getFileById(SSID).makeCopy("Avant restauration " + Utilities.formatDate(new Date(), "Africa/Bangui", "yyyy-MM-dd HH:mm"));
  var src = SpreadsheetApp.openById(l[0].f.getId()).getSheetByName("Plaintes"), dst = sh_("Plaintes");
  var n = src.getLastRow();
  if (dst.getLastRow() > 1) dst.getRange(2, 1, dst.getLastRow() - 1, PK.length).clearContent();
  if (n > 1) { var rg = dst.getRange(2, 1, n - 1, PK.length); rg.setNumberFormat("@"); rg.setValues(src.getRange(2, 1, n - 1, PK.length).getDisplayValues()); }
  Logger.log("Plaintes restaurées depuis " + l[0].f.getName() + " : " + Math.max(n - 1, 0) + " lignes");
  return true;
}

/* Historique : une ligne par champ modifié (date du serveur, personne, plainte, champ, avant, après). */
var HK = ["Date", "Utilisateur", "Action", "Plainte", "Apprenti", "Champ", "Avant", "Après"];
var HISTO_SKIP = { maj: 1, majPar: 1, par: 1 };
function histo_(lines) {
  if (!lines.length) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SSID), s = ss.getSheetByName("Historique");
  if (!s) { s = ss.insertSheet("Historique"); s.getRange(1, 1, 1, HK.length).setValues([HK]); }
  var start = Math.max(s.getLastRow(), 1) + 1, rg = s.getRange(start, 1, lines.length, HK.length);
  rg.setNumberFormat("@"); rg.setValues(lines);
}
function diff_(ex, o, user, now) {
  var out = [], act = ex ? "Modification" : "Création";
  if (!ex) { out.push([now, user, act, o.uid, o.id + " " + o.nom, "(nouvelle plainte)", "", ""]); return out; }
  PK.forEach(function (k) {
    if (HISTO_SKIP[k]) return;
    var a = String(ex[k] == null ? "" : ex[k]), b = String(o[k] == null ? "" : o[k]);
    if (a !== b) out.push([now, user, act, o.uid, o.id + " " + o.nom, k, a.slice(0, 300), b.slice(0, 300)]);
  });
  return out;
}

function doGet() { return out_({ ok: true, msg: "Passerelle plaintes apprentis active" }); }

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    var cache = CacheService.getScriptCache(), hk = hash_(req.code);
    // Anti-devinette : un code valide passe toujours, un faux code est ralenti, une série d'échecs déclenche une alerte.
    // Blocage de secours seulement après MAXH échecs en une heure (les codes déjà validés récemment passent quand même).
    if (Number(cache.get("failsH") || 0) >= MAXH && !cache.get("ok_" + hk)) return out_({ ok: false, err: "bloque" });
    var me = auth_(req.code);
    if (!me) {
      var nf = Number(cache.get("fails") || 0) + 1;
      cache.put("fails", String(nf), 600);
      cache.put("failsH", String(Number(cache.get("failsH") || 0) + 1), 3600);
      if (nf === MAXF) alerte_("Tentatives de connexion répétées", nf + " codes incorrects en moins de 10 minutes. Si ce n'est pas vous ou un collègue, changez les codes dans l'onglet Administration.");
      Utilities.sleep(Math.min(3000, 1000 + 100 * nf));
      return out_({ ok: false, err: "code" });
    }
    // Code trop court : accepté jusqu'à la date limite avec un avertissement, refusé ensuite.
    var faible = String(req.code || "").trim().length < CODE_MIN;
    if (faible && new Date().toISOString().slice(0, 10) > CODE_COURT_REFUSE_APRES) return out_({ ok: false, err: "faible" });
    cache.put("ok_" + hk, "1", 21600);
    var user = me.nom;
    if (req.action === "login") return out_({ ok: true, nom: user, role: me.role, faible: faible });
    if (req.action === "users") return me.role === "Administrateur" ? out_({ ok: true, users: readUsers_() }) : out_({ ok: false, err: "droits" });
    if (req.action === "list") {
      var since = typeof req.since === "string" && /^\d{4}-\d{2}-\d{2}T/.test(req.since) ? req.since : "";   // synchronisation partielle : seulement ce qui a changé
      var pl = readObjs_("Plaintes", PK), ct = readObjs_("Contacts", CK), n = pl.length;
      if (since) {
        pl = pl.filter(function (o) { return String(o.maj || "") >= since; });
        ct = ct.filter(function (o) { return String(o.maj || "") >= since; });
      }
      return out_({ ok: true, nom: user, role: me.role, faible: faible, plaintes: pl, contacts: ct, n: n, partiel: !!since, apprentis: req.noApp ? undefined : readRows_("Apprentis", 10) });
    }
    if (me.role === "Lecture" && (req.action === "upsert" || req.action === "addApprenti")) return out_({ ok: false, err: "droits" });
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      if (req.action === "upsert") {
        if ((req.rows || []).length > MAXROWS) return out_({ ok: false, err: "lot" });
        var conflits = [];
        var rows = upsertPlaintes_(req.rows || [], user, me.role, conflits);
        upsertContacts_(req.contacts || [], user);
        return out_({ ok: true, rows: rows, conflits: conflits });
      }
      if (req.action === "saveUser") {
        if (me.role !== "Administrateur") return out_({ ok: false, err: "droits" });
        return out_(saveUser_(req.user || {}, user));
      }
      if (req.action === "addApprenti") {
        return addApprenti_(req.apprenti || [], user) ? out_({ ok: true }) : out_({ ok: false, err: "invalide" });
      }
    } finally { lock.releaseLock(); }
    return out_({ ok: false, err: "action" });
  } catch (err) { console.error(String(err)); return out_({ ok: false, err: "serveur" }); }
}

function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
var SSID = "1zJy7RfxN_5Pghr-XbH4sGQWq8-7AmBXodHZsQIxitRA";
function sh_(n) { var ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SSID); return ss.getSheetByName(n); }

function auth_(code) {
  code = String(code || "").trim().toLowerCase();
  if (!code) return null;
  var v = sh_("Utilisateurs").getDataRange().getDisplayValues();
  for (var i = 1; i < v.length; i++) {
    if (codeOk_(v[i][1], code) && String(v[i][2]).trim().toLowerCase() === "oui")
      return { nom: String(v[i][0]).trim() || "Utilisateur", role: role_(v[i][3]) };
  }
  return null;
}
function role_(r) {
  var x = String(r || "").trim().toLowerCase();
  return x.indexOf("admin") === 0 ? "Administrateur" : (x.indexOf("lect") === 0 ? "Lecture" : "Utilisateur");
}

/* ---- Codes d'accès : stockés sous forme d'empreinte (SHA-256 avec sel secret), jamais en clair ---- */
function salt_() {
  var p = PropertiesService.getScriptProperties(), s = p.getProperty("SALT");
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty("SALT", s); }
  return s;
}
function hashCode_(code) {
  var d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt_() + "|" + String(code || "").trim().toLowerCase());
  return "h:" + d.map(function (b) { return ("0" + (b < 0 ? b + 256 : b).toString(16)).slice(-2); }).join("");
}
function isHash_(s) { return String(s || "").trim().indexOf("h:") === 0; }
function codeOk_(stored, code) {
  stored = String(stored || "").trim();
  return isHash_(stored) ? stored === hashCode_(code) : stored.toLowerCase() === String(code || "").trim().toLowerCase();
}
/* À lancer une fois dans l'éditeur Apps Script : remplace tous les codes en clair par leur empreinte. */
function chiffrerCodes() {
  var s = sh_("Utilisateurs"), v = s.getDataRange().getDisplayValues(), n = 0;
  for (var i = 1; i < v.length; i++) {
    var c = String(v[i][1]).trim();
    if (c && !isHash_(c)) { var rg = s.getRange(i + 1, 2); rg.setNumberFormat("@"); rg.setValue(hashCode_(c)); n++; }
  }
  Logger.log(n + " code(s) chiffré(s).");
}

/* ---- Validation des plaintes reçues ---- */
var LIM = { desc: 5000, suivi: 20000, prec: 2000, sous: 2000, gros: 1000, nature: 1000 }, LIMD = 300, MAXROWS = 500, MAXAPP = 20000;
function clean_(r) {
  var o = {};
  PK.forEach(function (k) { var v = r[k] == null ? "" : String(r[k]), lim = LIM[k] || LIMD; o[k] = v.length > lim ? v.slice(0, lim) : v; });
  if (!/^[A-Za-z0-9_-]{1,60}$/.test(o.uid)) return null;
  if (o.date && !/^\d{4}-\d{2}-\d{2}$/.test(o.date)) o.date = "";
  if (o.transDate && !/^\d{4}-\d{2}-\d{2}$/.test(o.transDate)) o.transDate = "";
  return o;
}
function clampMaj_(m, nowIso) {
  var max = new Date(Date.now() + 5 * 60000).toISOString();
  return (!m || !/^\d{4}-\d{2}-\d{2}T/.test(m) || m > max) ? nowIso : m;   // une horloge en avance ne peut pas verrouiller une plainte
}

function readUsers_() {
  var v = sh_("Utilisateurs").getDataRange().getDisplayValues(), o = [];
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]).trim() === "") continue;
    o.push({ nom: String(v[i][0]).trim(), code: isHash_(v[i][1]) ? "" : String(v[i][1]).trim(), chiffre: isHash_(v[i][1]), actif: String(v[i][2]).trim().toLowerCase() === "oui" ? "Oui" : "Non", role: role_(v[i][3]) });
  }
  return o;
}

function saveUser_(u, me) {
  var nom = String(u.nom || "").trim(), code = String(u.code || "").trim();
  if (!nom) return { ok: false, err: "champs" };
  var actif = String(u.actif).toLowerCase() === "oui" ? "Oui" : "Non", role = role_(u.role);
  var s = sh_("Utilisateurs"), v = s.getDataRange().getDisplayValues(), row = -1, stored = "";
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]).trim().toLowerCase() === nom.toLowerCase()) { row = i + 1; stored = String(v[i][1]).trim(); }
    else if (code && codeOk_(v[i][1], code)) return { ok: false, err: "code_pris" };
  }
  if (code) {
    if (code.length < 10) return { ok: false, err: "court" };
    stored = hashCode_(code);
  } else if (row < 0 || !stored) return { ok: false, err: "champs" };   // code vide : seulement pour conserver le code existant
  if (row > 0 && nom.toLowerCase() === String(me).toLowerCase() && (actif !== "Oui" || role !== "Administrateur")) return { ok: false, err: "self" };
  if (row < 0) row = Math.max(s.getLastRow(), 1) + 1;
  var rg = s.getRange(row, 1, 1, 4); rg.setNumberFormat("@"); rg.setValues([[nom, stored, actif, role]]);
  return { ok: true, users: readUsers_() };
}

function readRows_(name, n) {
  var s = sh_(name), last = s.getLastRow();
  if (last < 2) return [];
  return s.getRange(2, 1, last - 1, n).getDisplayValues().filter(function (r) { return String(r[0]).trim() !== ""; });
}
function readObjs_(name, keys) {
  return readRows_(name, keys.length).map(function (r) { var o = {}; keys.forEach(function (k, i) { o[k] = r[i]; }); return o; });
}
function toRow_(o, keys) { return keys.map(function (k) { var v = o[k]; return v == null ? "" : String(v); }); }

function upsertPlaintes_(rows, user, role, conflits) {
  var s = sh_("Plaintes"), last = s.getLastRow();
  var idx = {};
  var cur = {};
  if (last >= 2) {
    var all = s.getRange(2, 1, last - 1, PK.length).getDisplayValues();
    all.forEach(function (r, i) { idx[r[0]] = i + 2; var o = {}; PK.forEach(function (k, j) { o[k] = r[j]; }); cur[r[0]] = o; });
  }
  var result = [], toAppend = [], nowIso = new Date().toISOString(), lines = [];
  rows.forEach(function (r) {
    if (!r) return;
    var o = clean_(r);
    if (!o) return;
    var ex = cur[o.uid];
    o.maj = clampMaj_(o.maj, nowIso);
    // Ancien site (sans "base") : on compare les horloges. Site à jour : "base" = version que l'agent avait reçue.
    var hasBase = r.base !== undefined && r.base !== null;
    if (ex && !hasBase && String(ex.maj || "") > o.maj) { result.push(ex); return; }
    o.par = ex ? ex.par : (role === "Administrateur" && o.par ? o.par : user);
    var d = diff_(ex, o, user, nowIso);
    if (ex && !d.length) { result.push(ex); return; }                      // rien n'a changé : on n'écrit pas
    if (ex && hasBase && String(ex.maj || "") !== String(r.base)) {        // quelqu'un a modifié la plainte entre-temps : refus
      if (conflits) conflits.push({ uid: ex.uid, id: ex.id, nom: ex.nom, par: ex.majPar, maj: ex.maj });
      result.push(ex); return;
    }
    o.maj = (ex && ex.maj && nowIso <= ex.maj) ? new Date(Date.parse(ex.maj) + 1).toISOString() : nowIso;   // l'heure du serveur fait foi, toujours strictement croissante
    o.majPar = user;
    lines = lines.concat(d);
    if (ex) {
      var rg = s.getRange(idx[o.uid], 1, 1, PK.length);
      rg.setNumberFormat("@"); rg.setValues([toRow_(o, PK)]);
    } else {
      toAppend.push(o);
    }
    cur[o.uid] = o;
    result.push(o);
  });
  if (toAppend.length) {
    var start = Math.max(s.getLastRow(), 1) + 1;
    var rg2 = s.getRange(start, 1, toAppend.length, PK.length);
    rg2.setNumberFormat("@"); rg2.setValues(toAppend.map(function (o) { return toRow_(o, PK); }));
  }
  histo_(lines);
  return result;
}

function upsertContacts_(list, user) {
  if (!Array.isArray(list) || !list.length) return;
  list = list.slice(0, MAXROWS);
  var s = sh_("Contacts"), last = s.getLastRow(), idx = {};
  if (last >= 2) s.getRange(2, 1, last - 1, 1).getDisplayValues().forEach(function (r, i) { idx[r[0]] = i + 2; });
  var now = new Date().toISOString();
  list.forEach(function (c) {
    if (!c || typeof c !== "object" || !/^[A-Za-z0-9_-]{1,60}$/.test(String(c.id || ""))) return;   // identifiant invalide : ignoré
    var row = [String(c.id), String(c.tel || "").slice(0, 100), String(c.autre || "").slice(0, 300), now, user];
    if (idx[c.id]) { var rg = s.getRange(idx[c.id], 1, 1, 5); rg.setNumberFormat("@"); rg.setValues([row]); }
    else { var n = Math.max(s.getLastRow(), 1) + 1; var rg2 = s.getRange(n, 1, 1, 5); rg2.setNumberFormat("@"); rg2.setValues([row]); idx[c.id] = n; }
  });
}

function addApprenti_(a, user) {
  if (!Array.isArray(a) || !a.length || !String(a[0]).trim()) return false;
  var id = String(a[0]).trim();
  if (id.length > 60 || /[\u0000-\u001f]/.test(id) || /^[=+@-]/.test(id)) return false;                  // numéro d'apprenti invalide
  var s = sh_("Apprentis"), last = s.getLastRow();
  if (last > MAXAPP) return false;                                           // plafond de sécurité
  if (last >= 2) {
    var ids = s.getRange(2, 1, last - 1, 1).getDisplayValues();
    for (var i = 0; i < ids.length; i++) if (String(ids[i][0]).trim() === id) return true;
  }
  var row = []; for (var j = 0; j < 10; j++) row.push(a[j] == null ? "" : String(a[j]).slice(0, 200));
  row.push(user);
  var n = Math.max(s.getLastRow(), 1) + 1, rg = s.getRange(n, 1, 1, 11);
  rg.setNumberFormat("@"); rg.setValues([row]);
  return true;
}
