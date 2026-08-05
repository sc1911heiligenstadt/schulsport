// Zugriff für die login-lose Bestätigungsseite der Schule.
//
// ⚠️ Bewusst NICHT db.js: es gibt hier keinen Sitzungstoken und keinen
// Authorization-Header. Der Ausweis ist allein das lange Zufallstoken aus der
// Adresszeile, das der Worker gegen den Nachweis-Vorgang prüft.
// ⚠️ Bewusst auch NICHT config.js: dort steht der Changelog und die ganze
// Konfiguration der App -- auf dieser Seite hat davon nichts etwas verloren.
// Vorbild: E:\vereinsverwaltung\db-antrag.js

const WORKER_URL = "https://landingpage.michel-brunner.workers.dev";

class TokenUnbekanntError extends Error {
  constructor() { super("Dieser Link ist nicht gültig."); this.name = "TokenUnbekanntError"; }
}
class TokenAbgelaufenError extends Error {
  constructor(m) { super(m || "Dieser Link ist abgelaufen."); this.name = "TokenAbgelaufenError"; }
}
class ZuVieleVersucheError extends Error {
  constructor() { super("Zu viele Versuche. Bitte später erneut probieren."); this.name = "ZuVieleVersucheError"; }
}
class SchonBestaetigtError extends Error {
  constructor() { super("Dieser Nachweis wurde bereits bestätigt."); this.name = "SchonBestaetigtError"; }
}

async function freigabeRequest(payload) {
  let resp;
  try {
    resp = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (_) {
    throw new Error("Der Server ist nicht erreichbar. Bitte die Internetverbindung prüfen.");
  }
  if (resp.status === 400) throw new TokenUnbekanntError();
  if (resp.status === 404) throw new TokenUnbekanntError();
  if (resp.status === 410) {
    let grund = "";
    try { const b = await resp.json(); grund = b && b.error ? b.error : ""; } catch (_) {}
    throw new TokenAbgelaufenError(grund);
  }
  if (resp.status === 429) throw new ZuVieleVersucheError();
  if (resp.status === 409) throw new SchonBestaetigtError();
  if (!resp.ok) throw new Error("Es ist ein Fehler aufgetreten (HTTP " + resp.status + ").");
  return resp.json();
}

// Liefert NUR diesen einen Nachweis -- nie die Datei, nie andere Vorgänge.
async function freigabeLesen(token) {
  const body = await freigabeRequest({ action: "schulsport-freigabe-lesen", token });
  return body.nachweis;
}

// daten: { art: "bestaetigen", name, funktion, unterschriftDataUrl }
//        oder { art: "rueckfrage", name, text }
async function freigabeSenden(token, daten) {
  return freigabeRequest(Object.assign({ action: "schulsport-freigabe-senden", token }, daten));
}
