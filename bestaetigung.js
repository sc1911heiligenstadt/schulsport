// Login-lose Bestätigungsseite für die Schule.
// Eigenständig: greift NICHT auf app.js oder config.js zu.

let signaturePad = null;
let aktuellerNachweis = null;
let aktuellerWeg = "bestaetigen";
let tokenAusUrl = "";

function esc(s) {
  return String(s === null || s === undefined ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function datumDe(iso) {
  const t = String(iso || "").split("-");
  if (t.length !== 3) return "";
  return t[2] + "." + t[1] + "." + t[0];
}

function zeitstempelDe(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0") + "." +
    d.getFullYear() + " um " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

function stundenTextLokal(minuten) {
  const m = Math.max(0, Math.round(minuten || 0));
  const h = Math.floor(m / 60), r = m % 60;
  if (!h) return r + " Min";
  if (!r) return h + " Std";
  return h + " Std " + r + " Min";
}

function zeigeSchirm(welcher) {
  ["lade-schirm", "zu-schirm", "inhalt", "danke"].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.style.display = id === welcher ? "" : "none";
  });
}

function zeigeFehlerSchirm(titel, text) {
  document.getElementById("zu-titel").textContent = titel;
  document.getElementById("zu-text").textContent = text;
  zeigeSchirm("zu-schirm");
}

function zeigeFehler(text) {
  const el = document.getElementById("fehler-text");
  el.textContent = text;
  el.style.display = text ? "" : "none";
}

// ---------------------------------------------------------------------------
// Anzeige
// ---------------------------------------------------------------------------

function renderNachweis(n) {
  const s = (n.snapshot && n.snapshot.summen) || {};
  const d = n.snapshot || {};

  document.getElementById("nw-titel").textContent = d.massnahmeTitel || "Durchführungsnachweis";

  const zeilen = [
    ["Maßnahme", (d.massnahmeTitel || "") + (d.typ === "camp" ? "  (Ferien-Camp)" : "")],
    ["Rahmen", [d.rahmen, d.zielgruppe].filter(Boolean).join(" · ")],
    ["Schule", [d.schuleName, d.schuleAnschrift].filter(Boolean).join(", ")],
    ["Ort", d.ortName || ""],
    ["Durchgeführt von", [d.verantwortlichName].concat(d.teamNamen || []).filter(Boolean).join(", ")],
    ["Zeitraum", datumDe(n.vonDatum) + " bis " + datumDe(n.bisDatum)]
  ].filter(function (z) { return z[1]; });

  document.getElementById("kopfdaten").innerHTML =
    '<div class="tabelle-scroll"><table class="daten"><tbody>' +
    zeilen.map(function (z) {
      return "<tr><th style=\"width:35%;\">" + esc(z[0]) + "</th><td>" + esc(z[1]) + "</td></tr>";
    }).join("") + "</tbody></table></div>";

  const rows = (d.zeilen || []).map(function (r) {
    const zahl = (r.teilnehmerzahl === null || r.teilnehmerzahl === undefined) ? "–" : String(r.teilnehmerzahl);
    return "<tr>" +
      "<td>" + esc((r.wochentag || "").slice(0, 2)) + ", " + datumDe(r.datum) + "</td>" +
      "<td>" + esc(r.startZeit) + "–" + esc(r.endZeit) + "</td>" +
      "<td>" + esc(r.statusName) + (r.ausfallgrund ? " (" + esc(r.ausfallgrund) + ")" : "") + "</td>" +
      "<td class=\"num\">" + esc(zahl) + "</td></tr>";
  }).join("");

  document.getElementById("terminliste").innerHTML =
    '<div class="tabelle-scroll"><table class="daten"><thead><tr>' +
    '<th style="width:30%;">Datum</th><th style="width:24%;">Uhrzeit</th>' +
    '<th style="width:30%;">Status</th><th class="num" style="width:16%;">Kinder</th>' +
    "</tr></thead><tbody>" + rows + "</tbody></table></div>";

  const summenZeilen = [
    ["Termine geplant", String(s.geplant || 0)],
    ["davon durchgeführt", String(s.durchgefuehrt || 0)],
    ["davon ausgefallen", String(s.ausgefallen || 0)],
    ["Teilnahmen gesamt", String(s.teilnahmen || 0)],
    ["Kinder im Schnitt je Einheit", String(s.schnitt || 0)],
    ["Zeitaufwand gesamt", stundenTextLokal(s.minutenGesamt || 0)]
  ];
  let summenHtml = '<div class="tabelle-scroll"><table class="daten"><tbody>' +
    summenZeilen.map(function (z) {
      return "<tr><th style=\"width:60%;\">" + esc(z[0]) + "</th><td class=\"num\">" + esc(z[1]) + "</td></tr>";
    }).join("") + "</tbody></table></div>";

  if (s.offen) {
    summenHtml += '<p class="hinweis warnung">Zu ' + s.offen + ' Terminen liegt noch keine Rückmeldung des Übungsleiters vor. ' +
      'Sie sind oben ohne Teilnehmerzahl ausgewiesen. Falls das nicht stimmt, nutzen Sie bitte „Etwas stimmt nicht“.</p>';
  }
  document.getElementById("summen").innerHTML = summenHtml;

  // Schon bearbeitet? Dann nur noch anzeigen.
  if (n.status === "bestaetigt") {
    document.getElementById("aktions-karte").innerHTML =
      '<h2>Bereits bestätigt</h2><p class="hinweis erfolg">Dieser Nachweis wurde am ' +
      esc(zeitstempelDe(n.bestaetigung && n.bestaetigung.bestaetigtAm)) + ' von ' +
      esc((n.bestaetigung && n.bestaetigung.name) || "") + ' bestätigt.</p>';
  } else if (n.status === "rueckfrage") {
    document.getElementById("aktions-karte").innerHTML =
      '<h2>Rückfrage ist eingegangen</h2><p class="hinweis warnung">Ihre Rückmeldung vom ' +
      esc(zeitstempelDe(n.rueckfrage && n.rueckfrage.gestelltAm)) +
      ' liegt beim Verein. Sobald der Nachweis korrigiert ist, erhalten Sie einen neuen Link.</p>';
  }

  zeigeSchirm("inhalt");
  // ⚠️ Erst NACHDEM die Karte sichtbar ist: ein Canvas hinter display:none ist
  // 0x0, und resize() bricht dann ab -- die Unterschrift wäre unsichtbar,
  // obwohl gezeichnet wurde.
  const canvas = document.getElementById("sig-canvas");
  if (canvas && !signaturePad) {
    signaturePad = createSignaturePad(canvas, null);
  }
  if (signaturePad) signaturePad.resize();
}

// ---------------------------------------------------------------------------
// Absenden
// ---------------------------------------------------------------------------

async function senden() {
  zeigeFehler("");
  const knopf = document.getElementById("btn-senden");
  let daten;

  if (aktuellerWeg === "bestaetigen") {
    const name = document.getElementById("f-name").value.trim();
    if (!name) { zeigeFehler("Bitte tragen Sie Ihren Namen ein."); return; }
    if (!signaturePad || signaturePad.isEmpty()) {
      zeigeFehler("Bitte unterschreiben Sie im dafür vorgesehenen Feld.");
      return;
    }
    daten = {
      art: "bestaetigen",
      name: name,
      funktion: document.getElementById("f-funktion").value.trim(),
      unterschriftDataUrl: signaturePad.toDataURL()
    };
  } else {
    const name = document.getElementById("f-rf-name").value.trim();
    const text = document.getElementById("f-rf-text").value.trim();
    if (!name) { zeigeFehler("Bitte tragen Sie Ihren Namen ein."); return; }
    if (!text) { zeigeFehler("Bitte beschreiben Sie kurz, was nicht stimmt."); return; }
    daten = { art: "rueckfrage", name: name, text: text };
  }

  knopf.disabled = true;
  const alt = knopf.textContent;
  knopf.textContent = "Wird gesendet …";
  try {
    await freigabeSenden(tokenAusUrl, daten);
    if (aktuellerWeg === "bestaetigen") {
      document.getElementById("danke-titel").textContent = "Vielen Dank für Ihre Bestätigung";
      document.getElementById("danke-text").textContent =
        "Der Nachweis ist damit bestätigt. Der Verein erhält eine Kopie mit Ihrer Unterschrift.";
    } else {
      document.getElementById("danke-titel").textContent = "Ihre Rückmeldung ist angekommen";
      document.getElementById("danke-text").textContent =
        "Die Leitung des Vereins prüft die Angaben und legt Ihnen den Nachweis danach erneut vor.";
    }
    zeigeSchirm("danke");
  } catch (e) {
    zeigeFehler(e.message || "Das Senden ist fehlgeschlagen.");
    knopf.disabled = false;
    knopf.textContent = alt;
  }
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

function setupWegWahl() {
  document.querySelectorAll("#weg-wahl button").forEach(function (b) {
    b.addEventListener("click", function () {
      aktuellerWeg = b.getAttribute("data-weg");
      document.querySelectorAll("#weg-wahl button").forEach(function (x) { x.classList.remove("active"); });
      b.classList.add("active");
      document.getElementById("weg-bestaetigen").style.display = aktuellerWeg === "bestaetigen" ? "" : "none";
      document.getElementById("weg-rueckfrage").style.display = aktuellerWeg === "rueckfrage" ? "" : "none";
      document.getElementById("btn-senden").textContent =
        aktuellerWeg === "bestaetigen" ? "Bestätigen und absenden" : "Rückmeldung senden";
      zeigeFehler("");
      // Beim Zurückwechseln muss das Canvas neu vermessen werden -- es war
      // zwischenzeitlich versteckt und damit 0x0.
      if (aktuellerWeg === "bestaetigen" && signaturePad) signaturePad.resize();
    });
  });
}

async function startBestaetigung() {
  setupWegWahl();
  document.getElementById("btn-senden").addEventListener("click", senden);
  const clr = document.getElementById("btn-sig-clear");
  if (clr) clr.addEventListener("click", function () { if (signaturePad) signaturePad.clear(); });

  const params = new URLSearchParams(window.location.search);
  tokenAusUrl = params.get("t") || "";
  if (!/^[0-9a-f]{64}$/.test(tokenAusUrl)) {
    zeigeFehlerSchirm("Dieser Link ist nicht vollständig",
      "Bitte rufen Sie den Link aus der E-Mail unverändert auf. Wurde er in zwei Zeilen umgebrochen, fügen Sie ihn bitte vollständig in die Adresszeile ein.");
    return;
  }

  try {
    const n = await freigabeLesen(tokenAusUrl);
    if (!n) { zeigeFehlerSchirm("Dieser Link ist nicht gültig", "Zu diesem Link liegt kein Nachweis vor."); return; }
    aktuellerNachweis = n;
    renderNachweis(n);
  } catch (e) {
    if (e instanceof TokenAbgelaufenError) {
      zeigeFehlerSchirm("Dieser Link ist abgelaufen",
        "Ein Bestätigungslink ist 30 Tage gültig. Bitte fordern Sie beim Verein einen neuen an.");
    } else if (e instanceof ZuVieleVersucheError) {
      zeigeFehlerSchirm("Zu viele Versuche", "Bitte versuchen Sie es in einer Stunde erneut.");
    } else if (e instanceof TokenUnbekanntError) {
      zeigeFehlerSchirm("Dieser Link ist nicht gültig",
        "Möglicherweise wurde er zurückgezogen oder der Nachweis wurde neu ausgestellt. Bitte fordern Sie beim Verein einen neuen Link an.");
    } else {
      zeigeFehlerSchirm("Der Nachweis konnte nicht geladen werden", e.message || "");
    }
  }
}

window.addEventListener("DOMContentLoaded", startBestaetigung);
