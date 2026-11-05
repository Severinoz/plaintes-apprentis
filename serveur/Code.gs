/* Passerelle entre l'application "Gestion des plaintes des apprentis" et ce Google Sheet.
   Onglets : Plaintes, Contacts, Apprentis, Utilisateurs. Ne pas déplacer ni supprimer les colonnes. */

var PK = ["uid","id","date","nom","ue","centre","metier","mar","tel","autre","gros","sous","prec","nature","desc","statut","carte","paye","ctr","chg","contrat","integ","res","fait","voeu","trans","dest","destAutre","transDate","par","majPar","maj","suivi"];
var CK = ["id","tel","autre","maj","par"];
var AK = ["id","nom","ue","centre","metier","mar","tel","autre","tmar","tue","par"];

var MAXF = 10;
function hash_(c) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(c || "").trim().toLowerCase()));
}

/* Sauvegarde hebdomadaire : copie du Sheet dans Drive, on garde les 8 dernières.
   À lancer une seule fois : exécuter installerSauvegarde (autoriser l'accès à Drive). */
function sauvegarde() {
  var d = Utilities.formatDate(new Date(), "Africa/Bangui", "yyyy-MM-dd");
  DriveApp.getFileById(SSID).makeCopy("Sauvegarde plaintes apprentis " + d);
  var it = DriveApp.searchFiles('title contains "Sauvegarde plaintes apprentis " and trashed = false'), l = [];
  while (it.hasNext()) { var f = it.next(); l.push({ f: f, t: f.getDateCreated().getTime() }); }
  l.sort(function (x, y) { return y.t - x.t; });
  for (var i = 8; i < l.length; i++) l[i].f.setTrashed(true);
}
function installerSauvegarde() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "sauvegarde") ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("sauvegarde").timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(6).create();
}

function doGet() { return out_({ ok: true, msg: "Passerelle plaintes apprentis active" }); }

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    var cache = CacheService.getScriptCache(), hk = hash_(req.code);
    // Anti-devinette : après MAXF essais ratés en 10 minutes, seuls les codes déjà validés récemment passent.
    if (Number(cache.get("fails") || 0) >= MAXF && !cache.get("ok_" + hk)) return out_({ ok: false, err: "bloque" });
    var me = auth_(req.code);
    if (!me) {
      cache.put("fails", String(Number(cache.get("fails") || 0) + 1), 600);
      Utilities.sleep(1000);
      return out_({ ok: false, err: "code" });
    }
    cache.put("ok_" + hk, "1", 21600);
    var user = me.nom;
    if (req.action === "login") return out_({ ok: true, nom: user, role: me.role });
    if (req.action === "users") return me.role === "Administrateur" ? out_({ ok: true, users: readUsers_() }) : out_({ ok: false, err: "droits" });
    if (req.action === "list") return out_({ ok: true, nom: user, role: me.role, plaintes: readObjs_("Plaintes", PK), contacts: readObjs_("Contacts", CK), apprentis: req.noApp ? undefined : readRows_("Apprentis", 10) });
    if (me.role === "Lecture" && (req.action === "upsert" || req.action === "addApprenti")) return out_({ ok: false, err: "droits" });
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      if (req.action === "upsert") {
        if ((req.rows || []).length > MAXROWS) return out_({ ok: false, err: "lot" });
        var rows = upsertPlaintes_(req.rows || [], user, me.role);
        upsertContacts_(req.contacts || [], user);
        return out_({ ok: true, rows: rows });
      }
      if (req.action === "saveUser") {
        if (me.role !== "Administrateur") return out_({ ok: false, err: "droits" });
        return out_(saveUser_(req.user || {}, user));
      }
      if (req.action === "addApprenti") {
        return out_({ ok: addApprenti_(req.apprenti || [], user) });
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
var LIM = { desc: 5000, suivi: 20000, prec: 2000, sous: 2000, gros: 1000, nature: 1000 }, LIMD = 300, MAXROWS = 500;
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

function upsertPlaintes_(rows, user, role) {
  var s = sh_("Plaintes"), last = s.getLastRow();
  var idx = {};
  var cur = {};
  if (last >= 2) {
    var all = s.getRange(2, 1, last - 1, PK.length).getDisplayValues();
    all.forEach(function (r, i) { idx[r[0]] = i + 2; var o = {}; PK.forEach(function (k, j) { o[k] = r[j]; }); cur[r[0]] = o; });
  }
  var result = [], toAppend = [], nowIso = new Date().toISOString();
  rows.forEach(function (r) {
    if (!r) return;
    var o = clean_(r);
    if (!o) return;
    var ex = cur[o.uid];
    o.maj = clampMaj_(o.maj, nowIso);
    if (ex && String(ex.maj || "") > o.maj) { result.push(ex); return; }   // la version du Sheet est plus récente
    o.par = ex ? ex.par : (role === "Administrateur" && o.par ? o.par : user);
    o.majPar = user;
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
  return result;
}

function upsertContacts_(list, user) {
  if (!list.length) return;
  var s = sh_("Contacts"), last = s.getLastRow(), idx = {};
  if (last >= 2) s.getRange(2, 1, last - 1, 1).getDisplayValues().forEach(function (r, i) { idx[r[0]] = i + 2; });
  var now = new Date().toISOString();
  list.forEach(function (c) {
    if (!c || !c.id) return;
    var row = [String(c.id), String(c.tel || ""), String(c.autre || ""), now, user];
    if (idx[c.id]) { var rg = s.getRange(idx[c.id], 1, 1, 5); rg.setNumberFormat("@"); rg.setValues([row]); }
    else { var n = Math.max(s.getLastRow(), 1) + 1; var rg2 = s.getRange(n, 1, 1, 5); rg2.setNumberFormat("@"); rg2.setValues([row]); idx[c.id] = n; }
  });
}

function addApprenti_(a, user) {
  if (!a.length || !String(a[0]).trim()) return false;
  var s = sh_("Apprentis"), last = s.getLastRow(), id = String(a[0]).trim();
  if (last >= 2) {
    var ids = s.getRange(2, 1, last - 1, 1).getDisplayValues();
    for (var i = 0; i < ids.length; i++) if (String(ids[i][0]).trim() === id) return true;
  }
  var row = []; for (var j = 0; j < 10; j++) row.push(a[j] == null ? "" : String(a[j]));
  row.push(user);
  var n = Math.max(s.getLastRow(), 1) + 1, rg = s.getRange(n, 1, 1, 11);
  rg.setNumberFormat("@"); rg.setValues([row]);
  return true;
}
