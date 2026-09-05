// Persistenz über das zentrale ToolsUebersicht-Login-Gateway.
// Übernommen aus E:\ausbildungsplan\db.js (gleiches Gateway-Muster), nur mit
// eigener GATEWAY_APP_ID. Darunter stehen die dünnen Aufrufer der schmalen
// Worker-Aktionen dieser App -- alle über dasselbe gatewayRequest.
const GATEWAY_URL = "https://landingpage.michel-brunner.workers.dev";
const TOKEN_STORAGE_KEY = "tu_session_token";
const GATEWAY_APP_ID = "schulsport";

class NotLoggedInError extends Error {
  constructor(message) {
    super(message || "Nicht angemeldet");
    this.name = "NotLoggedInError";
  }
}

class ConflictError extends Error {
  constructor(message) {
    super(message || "Daten wurden zwischenzeitlich von einem anderen Gerät geändert");
    this.name = "ConflictError";
  }
}

// ETag des zuletzt geladenen/geschriebenen Stands. Wird bei dav-save mitgeschickt,
// damit der Worker Konflikte (anderes Gerät hat inzwischen gespeichert) erkennt.
let gatewayRev = null;

function getSessionToken() {
  try { return localStorage.getItem(TOKEN_STORAGE_KEY); } catch (_) { return null; }
}

async function gatewayRequest(payload) {
  const token = getSessionToken();
  if (!token) { if (typeof raeumeBeiSitzungsverlust === "function") raeumeBeiSitzungsverlust(); throw new NotLoggedInError(); }
  const resp = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify(payload)
  });
  if (resp.status === 401) { if (typeof raeumeBeiSitzungsverlust === "function") raeumeBeiSitzungsverlust(); throw new NotLoggedInError("Sitzung abgelaufen"); }
  if (resp.status === 403) throw new Error("Kein Zugriff auf dieses Tool.");
  if (resp.status === 409) throw new ConflictError();
  if (!resp.ok) {
    let text = "";
    try { const b = await resp.json(); text = b && b.error ? ": " + b.error : ""; } catch (_) {}
    throw new Error(`Gateway-Fehler (HTTP ${resp.status})` + text);
  }
  return resp.json();
}

// Das "me" aus der letzten dav-load-Antwort. Der Worker legt es bei, weil er
// nutzer.json und die Rechte-Datei fuer diesen Request ohnehin gelesen hat --
// der erste fetchMe() nach dem Laden kommt damit ohne eigenen Roundtrip aus.
let gatewayMe = null;

async function gatewayLoad() {
  const body = await gatewayRequest({ action: "dav-load", app: GATEWAY_APP_ID });
  gatewayRev = typeof body.rev === "string" ? body.rev : null;
  gatewayMe = (body.me && typeof body.me === "object") ? body.me : null;
  return body.data; // Objekt oder null (Datei noch nicht vorhanden)
}

async function gatewaySave(dataObj) {
  const payload = { action: "dav-save", app: GATEWAY_APP_ID, data: dataObj };
  if (gatewayRev) payload.rev = gatewayRev;
  const body = await gatewayRequest(payload);
  gatewayRev = typeof body.rev === "string" ? body.rev : null;
}

// Speichern beim VERLASSEN der Seite. Ein normaler fetch wird beim Entladen
// abgebrochen -- nur ein keepalive-Request ueberlebt das Schliessen des Tabs.
// Byte-gleiches Muster wie in kadermanager/db.js und zwoelf weiteren Apps der
// Flotte (f-autosave-flush); schulsport hatte es als einzige Gateway-App nicht.
//
// Grenze: Browser erlauben fuer keepalive-Requests nur 64 KB Body. Groessere
// Datenbestaende gehen auf diesem Weg gar nicht raus -- deshalb meldet die
// Funktion zurueck, ob sie abschicken konnte; der Aufrufer (beforeunload in
// app.js) fragt dann stattdessen nach.
const KEEPALIVE_MAX_BYTES = 64 * 1024;

function gatewaySaveBeacon(dataObj) {
  const token = getSessionToken();
  if (!token) return false;
  const payload = { action: "dav-save", app: GATEWAY_APP_ID, data: dataObj };
  if (gatewayRev) payload.rev = gatewayRev;
  const body = JSON.stringify(payload);
  if (new Blob([body]).size > KEEPALIVE_MAX_BYTES) return false;
  try {
    fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body,
      keepalive: true
    });
    return true;
  } catch (_) {
    return false; // z.B. wenn der Browser den keepalive-Request doch ablehnt
  }
}

// Liefert {username, isAdmin, groupIds, vorname, nachname, mannschaften, canEdit, canAdmin}.
async function fetchMe() {
  // Genau EINMAL aus dem letzten dav-load bedienen, danach wieder echt fragen:
  // ein spaeterer Aufruf will den aktuellen Stand (etwa nach einem Rechte-
  // wechsel), nicht eine beliebig alte Kopie.
  if (gatewayMe) { const me = gatewayMe; gatewayMe = null; return me; }
  return gatewayRequest({ action: "me", app: GATEWAY_APP_ID });
}

// ---------------------------------------------------------------------------
// Schmale Aktionen dieser App
// ---------------------------------------------------------------------------

// Auswahlquelle für Verantwortliche und Team einer Maßnahme.
// ⚠️ NICHT list-tool-editors: das liefert nur editGroupIds+adminGroupIds, und die
// Übungsleiter stehen hier bewusst NUR in der Sehen-Gruppe (sonst gäbe ihnen
// resolveEditPermission das volle dav-save auf die ganze Datei). schulsport-personen
// wertet zusätzlich groupIds aus.
async function ladeTeamKandidaten() {
  const body = await gatewayRequest({ action: "schulsport-personen", app: GATEWAY_APP_ID });
  return Array.isArray(body.users) ? body.users : [];
}

// Meldung eines einzelnen Termins. Läuft NICHT über dav-save -- der Worker prüft
// selbst, ob der Angemeldete im Team der Maßnahme steht, und schreibt nur die
// sechs Meldefelder. Damit können Übungsleiter melden, ohne Schreibrecht auf das
// ganze Dokument zu haben.
async function meldeTermin(felder) {
  const body = await gatewayRequest(Object.assign(
    { action: "schulsport-meldung", app: GATEWAY_APP_ID }, felder
  ));
  if (typeof body.rev === "string") gatewayRev = body.rev;
  return body.termin;
}

// Stellt einen Nachweis aus: der Worker baut den Snapshot aus der Datei (nie aus
// dem Body), erzeugt das Token und gibt den fertigen Link zurück.
async function erstelleNachweis(felder) {
  const body = await gatewayRequest(Object.assign(
    { action: "schulsport-nachweis-erstellen", app: GATEWAY_APP_ID }, felder
  ));
  if (typeof body.rev === "string") gatewayRev = body.rev;
  return body;
}

// Schickt den Bestätigungslink an die Schule. Die Adresse holt sich der Worker
// aus schulen[].bestaetigungEmail, der Body trägt nur die Vorgangs-Id.
async function sendeNachweis(nachweisId) {
  const body = await gatewayRequest({
    action: "schulsport-nachweis-senden", app: GATEWAY_APP_ID, nachweisId
  });
  if (typeof body.rev === "string") gatewayRev = body.rev;
  return body;
}

// was: "widerrufen" | "verlaengern" | "neu-ausstellen"
async function nachweisStatus(nachweisId, was) {
  const body = await gatewayRequest({
    action: "schulsport-nachweis-status", app: GATEWAY_APP_ID, nachweisId, was
  });
  if (typeof body.rev === "string") gatewayRev = body.rev;
  return body;
}

async function archiviereSchuljahr(schuljahr) {
  const body = await gatewayRequest({
    action: "schulsport-schuljahr-archivieren", app: GATEWAY_APP_ID, schuljahr
  });
  if (typeof body.rev === "string") gatewayRev = body.rev;
  return body;
}

// Handy-Erinnerung an alle, die noch offene Meldungen haben. Die Empfänger
// bestimmt der Worker aus den Maßnahmen, nie der Client.
async function erinnerungPush(massnahmeId) {
  const payload = { action: "schulsport-erinnerung-push", app: GATEWAY_APP_ID };
  if (massnahmeId) payload.massnahmeId = massnahmeId;
  return gatewayRequest(payload);
}

// Legt eine Datei im dateien/-Unterordner der App ab (unterschriebene Nachweis-PDFs).
// ⚠️ Die Id erzeugt der CLIENT und schickt sie mit -- der Worker gibt keine zurück.
// Sie muss FILE_ID_RE erfüllen, deshalb uuid() aus app.js.
async function dateiPut(id, name, contentType, dataBase64) {
  return gatewayRequest({
    action: "dav-file-put", app: GATEWAY_APP_ID, id, name: name || "",
    contentType, dataBase64
  });
}

