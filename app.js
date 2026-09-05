// Schulsport-Planer -- Oberfläche und Zustand.

let appData = null;
let currentUser = { username: "", isAdmin: false, canEdit: false, canAdmin: false, vorname: "", nachname: "" };
let currentIsAdmin = false, currentCanEdit = false, currentCanAdmin = false;
let teamKandidaten = [];
let aktuellerTab = "woche";

// Anzeigezustand
let wochenAnker = null;          // Montag der angezeigten Woche
let meldeFilter = "offen";
let adminBereich = "schulen";
let offeneMassnahmeId = null;    // im Dialog bearbeitete Maßnahme
let offenerTerminId = null;
let offenerAbgleich = null;

// ---------------------------------------------------------------------------
// Rechte
// ---------------------------------------------------------------------------
// ⚠️ canEdit ist hier NICHT das Melderecht. Übungsleiter haben bewusst KEIN
// Bearbeiten-Recht -- sonst gäbe ihnen resolveEditPermission im Worker das
// volle dav-save auf die ganze Datei, und jeder könnte fremde Nachweisdaten
// überschreiben. Das Melden läuft über eine eigene schmale Worker-Aktion, deren
// Gate die Team-Zugehörigkeit ist (darfMelden unten).
function canEdit()  { return currentIsAdmin || currentCanEdit; }
function canAdmin() { return currentIsAdmin || currentCanAdmin; }

// Darf der Angemeldete diesen Termin melden? Der Server prüft dasselbe noch
// einmal -- hier geht es nur darum, keine Knöpfe anzubieten, die 403 geben.
function darfMelden(massnahme) {
  if (!massnahme) return false;
  if (canEdit()) return true;
  const u = currentUser.username;
  if (!u) return false;
  if (massnahme.verantwortlichUsername === u) return true;
  return Array.isArray(massnahme.teamUsernames) && massnahme.teamUsernames.indexOf(u) !== -1;
}

// ---------------------------------------------------------------------------
// Helfer
// ---------------------------------------------------------------------------

function escapeHtml(s) {
  return String(s === null || s === undefined ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Fallback für ältere iOS-Geräte ohne crypto.randomUUID.
function uuid() {
  try {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      const b = new Uint8Array(16);
      window.crypto.getRandomValues(b);
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
      return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
    }
  } catch (_) {}
  let s = "";
  for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s.slice(0, 8) + "-" + s.slice(8, 12) + "-4" + s.slice(13, 16) + "-a" + s.slice(17, 20) + "-" + s.slice(20);
}

function heuteIso() { return isoAusDatum(heuteDatum()); }

function fmtDatum(iso) {
  const d = datumAusIso(iso);
  if (!d) return "";
  return String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0") + "." + d.getFullYear();
}
function fmtDatumKurz(iso) {
  const d = datumAusIso(iso);
  if (!d) return "";
  return String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0") + ".";
}
function fmtWochentag(iso) {
  const d = datumAusIso(iso);
  if (!d) return "";
  const w = WOCHENTAGE.find((x) => x.nr === d.getDay());
  return w ? w.name : "";
}
function fmtZeitstempel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0") + "." + d.getFullYear() +
         " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

// Lesbare Textfarbe auf farbigem Grund -- gerechnet auf der Rec.709-Luminanz,
// nicht auf dem schlichten Mittelwert der Kanäle.
function kontrastFarbe(hex) {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6) return "#ffffff";
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 150 ? "#1e2330" : "#ffffff";
}
function montagDerWoche(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const versatz = (x.getDay() + 6) % 7;   // Mo = 0
  x.setDate(x.getDate() - versatz);
  return x;
}
function kalenderwoche(d) {
  // ISO 8601: das Jahr einer Woche bestimmt ihr Donnerstag.
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + 3 - ((x.getDay() + 6) % 7));
  const jahresStart = new Date(x.getFullYear(), 0, 4);
  const tage = Math.round((x - jahresStart) / 86400000);
  return 1 + Math.floor((tage + ((jahresStart.getDay() + 6) % 7)) / 7);
}

function schuleVon(id) { return (appData.schulen || []).find((s) => s.id === id) || null; }
function ortVon(id) { return (appData.orte || []).find((o) => o.id === id) || null; }
function massnahmeVon(id) { return (appData.massnahmen || []).find((m) => m.id === id) || null; }
function terminVon(id) { return (appData.termine || []).find((t) => t.id === id) || null; }
function statusInfo(id) { return TERMIN_STATUS.find((s) => s.id === id) || TERMIN_STATUS[0]; }
function grundVon(id) { return (appData.ausfallgruende || []).find((g) => g.id === id) || null; }

function nameVon(username) {
  if (!username) return "";
  const k = teamKandidaten.find((p) => p.username === username);
  if (k && k.displayName) return k.displayName;
  if (username === currentUser.username) {
    const n = ((currentUser.vorname || "") + " " + (currentUser.nachname || "")).trim();
    if (n) return n;
  }
  return username;
}

function farbeDerMassnahme(m) {
  if (!m) return "#1a56a0";
  if (m.farbe) return m.farbe;
  const s = schuleVon(m.schuleId);
  return (s && s.farbe) || "#1a56a0";
}

// Termine, die im Zeitraum liegen, sortiert.
function termineImZeitraum(vonIso, bisIso, filter) {
  return (appData.termine || []).filter((t) => {
    if (vonIso && t.datum < vonIso) return false;
    if (bisIso && t.datum > bisIso) return false;
    if (typeof filter === "function" && !filter(t)) return false;
    return true;
  }).sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 :
    (a.startZeit < b.startZeit ? -1 : a.startZeit > b.startZeit ? 1 : 0)));
}

// Ein Termin gilt als überfällig, wenn er in der Vergangenheit liegt und noch
// keine Rückmeldung trägt.
function istUeberfaellig(t) {
  return !terminIstGemeldet(t) && t.datum < heuteIso();
}

// Termine, die in einem bestätigten Nachweis stecken, dürfen nicht mehr durch
// eine Serienänderung verschwinden.
function terminInBestaetigtemNachweis(massnahmeId, datumIso) {
  return (appData.nachweise || []).some((n) =>
    n && n.status === "bestaetigt" && n.massnahmeId === massnahmeId &&
    datumIso >= n.vonDatum && datumIso <= n.bisDatum);
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

function leeresSchema() {
  return {
    meta: { stand: new Date().toISOString(), schuljahrAktiv: schuljahrAusIso(heuteIso(), SCHULJAHR_BEGINN_MONAT) },
    einstellungen: {
      standardVorMin: STANDARD_VOR_MIN,
      standardNachMin: STANDARD_NACH_MIN,
      // freigabeTageGueltig stand hier bis 2026-09-04 und wurde nie gelesen —
      // die Ablauffrist des Freigabelinks setzt allein der Worker, siehe
      // config.js. Ein Altbestand darf das Feld behalten, Object.assign unten
      // wirft nichts weg.
      pushEmpfaenger: []
    },
    schulen: [], orte: [], massnahmen: [], termine: [],
    zusatzeintraege: [], sperrtage: [], ausfallgruende: [], nachweise: []
  };
}

function normalizeData(roh) {
  const d = Object.assign(leeresSchema(), roh && typeof roh === "object" ? roh : {});
  ["schulen", "orte", "massnahmen", "termine", "zusatzeintraege", "sperrtage", "ausfallgruende", "nachweise"]
    .forEach((k) => { if (!Array.isArray(d[k])) d[k] = []; });
  if (!d.meta || typeof d.meta !== "object") d.meta = {};
  d.einstellungen = Object.assign(leeresSchema().einstellungen, d.einstellungen || {});

  d.termine.forEach((t) => {
    if (t.teilnehmerzahl === undefined) t.teilnehmerzahl = null;
    if (!t.status) t.status = "offen";
  });
  d.massnahmen.forEach((m) => {
    if (!Array.isArray(m.teamUsernames)) m.teamUsernames = [];
    if (!Array.isArray(m.mitbringen)) m.mitbringen = [];
    if (!m.regel) m.regel = {};
    if (!Array.isArray(m.regel.wochentage)) m.regel.wochentage = [];
    if (!Array.isArray(m.regel.ausnahmen)) m.regel.ausnahmen = [];
  });
  d.orte.forEach((o) => { if (!Array.isArray(o.ausstattung)) o.ausstattung = []; });
  return d;
}

// ---------------------------------------------------------------------------
// Speichern -- Debounce mit In-Flight-Guard
// ---------------------------------------------------------------------------
// Ohne den Guard läuft ein zweites dav-save mit veraltetem ETag los und die App
// meldet „von einem anderen Gerät geändert", obwohl nur eine Person arbeitet.

let saveTimer = null;
let saveLauf = null;      // der gerade laufende Durchgang (Promise) oder null
let savePending = false;  // waehrend des Schreibens kam eine weitere Änderung

function setSaveStatus(text, fehler) {
  const el = document.getElementById("save-status");
  if (!el) return;
  el.textContent = text || "";
  el.className = "save-status" + (fehler ? " fehler" : "");
}

function markDirty() {
  if (!canEdit()) return;
  setSaveStatus("Änderung wird gespeichert …");
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, SPEICHER_DEBOUNCE_MS);
}

// Speichert JETZT und liefert ein Versprechen, das erst hält, wenn wirklich
// alles draußen ist.
//
// ⚠️ Das „wirklich alles" ist der Kern: Läuft schon ein Save, darf dieser Aufruf
// nicht einfach zurückkehren. Er merkt die Änderung vor UND wartet auf den
// laufenden Durchgang mit — der seinerseits so lange weiterschreibt, wie noch
// etwas ansteht. Bis zum 05.09.2026 setzte der zweite Aufruf nur `savePending`
// und kehrte sofort zurück; `await persistNow()` versprach damit etwas, das es
// nicht hielt.
function persistNow() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  if (!appData || !canEdit()) return Promise.resolve();
  if (saveLauf) { savePending = true; return saveLauf; }
  saveLauf = (async () => {
    try {
      do {
        // ⚠️ VOR dem Schreiben zuruecksetzen, nicht danach: was waehrend des
        // laufenden Schreibvorgangs dazukommt, muss eine weitere Runde ausloesen.
        savePending = false;
        await schreibeJetzt();
      } while (savePending);
    } finally {
      saveLauf = null;
      savePending = false;
    }
  })();
  return saveLauf;
}

// Ein einzelner Schreibvorgang. Fängt jeden Fehler selbst ab und meldet ihn im
// Statusfeld — der Aufrufer soll nicht daran scheitern, dass Nextcloud klemmt.
async function schreibeJetzt() {
  try {
    appData.meta.stand = new Date().toISOString();
    await gatewaySave(appData);
    setSaveStatus("Gespeichert um " + new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
  } catch (e) {
    if (e instanceof ConflictError) {
      setSaveStatus("Die Daten wurden zwischenzeitlich von einem anderen Gerät geändert. Bitte Seite neu laden.", true);
    } else if (e instanceof NotLoggedInError) {
      setSaveStatus("Die Sitzung ist abgelaufen. Bitte in der Tools-Übersicht neu anmelden.", true);
    } else {
      setSaveStatus("Speichern fehlgeschlagen: " + e.message, true);
    }
  }
}

// ⚠️ MUSS `async` sein und `persistNow()` awaiten. Die beiden Aufrufer —
// `erstelleFreigabe()` in nachweise.js und das Archivieren in massnahmen.js —
// schreiben `await flushPending()`, weil sie genau eine Zusage brauchen: erst
// alles gespeichert, dann darf der Worker mit derselben Datei arbeiten.
//
// Ohne das `await` war `await undefined` im nächsten Microtask fertig, während
// der dav-save noch unterwegs war: der unterschriebene Nachweis fror dann den
// ALTEN Stand ein (und `snapshot` ist unveränderlich), das Archivieren konnte
// vom nachlaufenden Save wieder überschrieben werden. Beides lautlos.
// Flottenstandard, siehe f-autosave-flush.
async function flushPending() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  await persistNow();
}

// ---------------------------------------------------------------------------
// Tabs und Sichtbarkeit
// ---------------------------------------------------------------------------

function applyRechteVisibility() {
  const bearbeiten = canEdit(), administrieren = canAdmin();
  document.querySelectorAll(".editor-only").forEach((el) => { el.style.display = bearbeiten ? "" : "none"; });
  document.querySelectorAll(".admin-only").forEach((el) => { el.style.display = administrieren ? "" : "none"; });
  const nn = document.getElementById("nav-nachweise");
  if (nn) nn.style.display = bearbeiten ? "" : "none";
  const na = document.getElementById("nav-administrieren");
  if (na) na.style.display = administrieren ? "" : "none";
  // Der Inhalt eines gesperrten Tabs wird geleert, nicht nur der Knopf versteckt.
  if (!administrieren) { const el = document.getElementById("admin-inhalt"); if (el) el.innerHTML = ""; }
}

function activateTab(name) {
  aktuellerTab = name;
  document.querySelectorAll("nav button[data-tab]").forEach((b) => {
    b.classList.toggle("active", b.getAttribute("data-tab") === name);
  });
  document.querySelectorAll(".tab-section").forEach((s) => {
    s.classList.toggle("active", s.id === "tab-" + name);
  });
  flushPending();
  if (name === "woche") renderWoche();
  else if (name === "melden") renderMelden();
  else if (name === "massnahmen") renderMassnahmen();
  else if (name === "nachweise") renderNachweise();
  else if (name === "uebersicht") renderUebersicht();
  else if (name === "administrieren") renderAdmin();
}

function setupTabs() {
  document.querySelectorAll("nav button[data-tab]").forEach((b) => {
    b.addEventListener("click", () => activateTab(b.getAttribute("data-tab")));
  });
}

// ---------------------------------------------------------------------------
// Wochenansicht
// ---------------------------------------------------------------------------

function wochenTermine() {
  const mo = new Date(wochenAnker);
  const so = new Date(mo); so.setDate(so.getDate() + 6);
  const fSchule = document.getElementById("filter-schule").value;
  const fPerson = document.getElementById("filter-person").value;

  return termineImZeitraum(isoAusDatum(mo), isoAusDatum(so), (t) => {
    const m = massnahmeVon(t.massnahmeId);
    if (!m) return false;
    if (fSchule && m.schuleId !== fSchule) return false;
    if (fPerson) {
      const drin = m.verantwortlichUsername === fPerson ||
        (Array.isArray(m.teamUsernames) && m.teamUsernames.indexOf(fPerson) !== -1);
      if (!drin) return false;
    }
    return true;
  });
}

// Welche Tage zeigt die Woche? Mo–Fr immer, Sa/So nur wenn dort etwas liegt.
function sichtbareTage(termine) {
  const tage = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(wochenAnker); d.setDate(d.getDate() + i);
    const iso = isoAusDatum(d);
    const wt = d.getDay();
    const drin = termine.some((t) => t.datum === iso);
    if (wt === 0 || wt === 6) { if (!drin) continue; }
    tage.push({ iso, datum: d, wochentag: wt });
  }
  return tage;
}

// Zeitfenster aus den Terminen der Woche, mit etwas Luft. Ohne Termine greift
// der Fallback aus config.js.
function rasterFenster(termine) {
  if (!termine.length) {
    return { von: minutenAusZeit(RASTER_START_FALLBACK), bis: minutenAusZeit(RASTER_ENDE_FALLBACK) };
  }
  let min = 24 * 60, max = 0;
  termine.forEach((t) => {
    const a = minutenAusZeit(t.startZeit) - (Number(t.vorbereitungMin) || 0);
    const b = minutenAusZeit(t.endZeit) + (Number(t.nachbereitungMin) || 0);
    if (a < min) min = a;
    if (b > max) max = b;
  });
  min = Math.max(0, Math.floor((min - RASTER_RAND_MIN) / 30) * 30);
  max = Math.min(24 * 60, Math.ceil((max + RASTER_RAND_MIN) / 30) * 30);
  if (max - min < 120) max = Math.min(24 * 60, min + 120);
  return { von: min, bis: max };
}

// Überlappende Termine desselben Tages teilen sich die Spaltenbreite.
function verteileSpalten(tagesTermine) {
  const sortiert = tagesTermine.slice().sort((a, b) => minutenAusZeit(a.startZeit) - minutenAusZeit(b.startZeit));
  const spalten = [];   // je Spalte das Endminuten-Maximum
  const zuordnung = new Map();
  sortiert.forEach((t) => {
    const a = minutenAusZeit(t.startZeit), b = minutenAusZeit(t.endZeit);
    let sp = spalten.findIndex((ende) => ende <= a);
    if (sp === -1) { spalten.push(b); sp = spalten.length - 1; }
    else spalten[sp] = b;
    zuordnung.set(t.id, sp);
  });
  return { zuordnung, anzahl: Math.max(1, spalten.length) };
}

function renderWoche() {
  if (!appData) return;
  const leer = !(appData.schulen || []).length && !(appData.massnahmen || []).length;
  const lc = document.getElementById("leerstand-card");
  if (lc) lc.style.display = leer ? "" : "none";

  const mo = new Date(wochenAnker);
  const so = new Date(mo); so.setDate(so.getDate() + 6);
  document.getElementById("wochen-label").textContent = "KW " + kalenderwoche(mo);
  document.getElementById("wochen-zeitraum").textContent = fmtDatum(isoAusDatum(mo)) + " bis " + fmtDatum(isoAusDatum(so));

  const termine = wochenTermine();
  const tage = sichtbareTage(termine);
  const fenster = rasterFenster(termine);
  const spanne = Math.max(30, fenster.bis - fenster.von);

  // --- Raster (ab 768px) ---
  // ⚠️ Die Hoehe MUSS hier gesetzt werden. Bloecke und Zeitmarken sind absolut
  // positioniert und tragen nichts zum Fluss bei; ohne diesen Wert faellt die
  // Spalte auf 0 zusammen und alle Zeitmarken landen uebereinander.
  // 1px je Minute — deckungsgleich mit dem 30px-Takt des Hintergrundverlaufs
  // in .raster-spalte. Wer den einen Wert aendert, muss den anderen mitziehen.
  const rasterHoehe = Math.round(spanne);

  let marken = "";
  for (let min = fenster.von; min <= fenster.bis; min += 30) {
    const pos = ((min - fenster.von) / spanne) * 100;
    marken += `<div class="marke" style="top:${pos}%">${zeitAusMinuten(min)}</div>`;
  }

  const heute = heuteIso();
  let tageHtml = "";
  tage.forEach((tag) => {
    const idx = baueSperrtagIndex(appData.sperrtage, null);
    const sperr = idx[tag.iso];
    const tagesTermine = termine.filter((t) => t.datum === tag.iso);
    const { zuordnung, anzahl } = verteileSpalten(tagesTermine);

    let bloecke = "";
    tagesTermine.forEach((t) => {
      const m = massnahmeVon(t.massnahmeId);
      const farbe = farbeDerMassnahme(m);
      const a = minutenAusZeit(t.startZeit), b = minutenAusZeit(t.endZeit);
      const top = ((a - fenster.von) / spanne) * 100;
      const hoehe = Math.max(2.5, ((b - a) / spanne) * 100);
      const sp = zuordnung.get(t.id) || 0;
      const breite = 100 / anzahl;
      const ort = ortVon(t.ortIdAbweichend || (m && m.ortId));
      const st = statusInfo(t.status);

      // Vor-/Nachbereitung als schraffierter Rand ober- und unterhalb
      const vor = Number(t.vorbereitungMin) || 0, nach = Number(t.nachbereitungMin) || 0;
      if (vor > 0) {
        const vTop = ((a - vor - fenster.von) / spanne) * 100;
        const vH = (vor / spanne) * 100;
        bloecke += `<div class="block-rand" style="top:${vTop}%;height:${vH}%;left:${sp * breite}%;width:${breite - 1}%;background-color:${farbe}" title="Vorbereitung ${vor} Min"></div>`;
      }
      if (nach > 0) {
        const nTop = ((b - fenster.von) / spanne) * 100;
        const nH = (nach / spanne) * 100;
        bloecke += `<div class="block-rand" style="top:${nTop}%;height:${nH}%;left:${sp * breite}%;width:${breite - 1}%;background-color:${farbe}" title="Nachbereitung ${nach} Min"></div>`;
      }

      bloecke += `<div class="block status-${escapeHtml(t.status)}" data-termin="${escapeHtml(t.id)}"
        style="top:${top}%;height:${hoehe}%;left:${sp * breite}%;width:${breite - 1}%;background:${farbe};color:${kontrastFarbe(farbe)}"
        title="${escapeHtml((m && m.titel) || "")} — ${escapeHtml(st.name)}">
        <span class="b-zeit">${escapeHtml(t.startZeit)}</span>
        <span class="b-titel">${escapeHtml((m && m.titel) || "")}</span>
        ${ort ? `<span class="b-ort">${escapeHtml(ort.name)}</span>` : ""}
      </div>`;
    });

    const wt = WOCHENTAGE.find((x) => x.nr === tag.wochentag);
    tageHtml += `<div class="raster-tag${sperr ? " gesperrt" : ""}${tag.iso === heute ? " heute" : ""}">
      <div class="raster-tag-kopf">
        ${escapeHtml(wt ? wt.kurz : "")}
        <span class="datum">${fmtDatumKurz(tag.iso)}</span>
        ${sperr && sperr.namen.length ? `<span class="ferien-name">${escapeHtml(sperr.namen[0])}</span>` : ""}
      </div>
      <div class="raster-spalte" style="height:${rasterHoehe}px">${bloecke}</div>
    </div>`;
  });

  const rasterHtml = `<div class="raster-wrap">
    <div class="raster">
      <div class="raster-zeit">
        <div class="raster-zeit-kopf"></div>
        <div class="raster-zeit-achse" style="height:${rasterHoehe}px">${marken}</div>
      </div>
      <div class="raster-tage">${tageHtml}</div>
    </div>
  </div>`;

  // --- Tagesliste (unter 768px) ---
  let listeHtml = `<div class="tagesliste">`;
  if (!termine.length) {
    listeHtml += `<div class="card"><div class="empty-state">In dieser Woche steht nichts an.</div></div>`;
  }
  tage.forEach((tag) => {
    const tagesTermine = termine.filter((t) => t.datum === tag.iso);
    const idx = baueSperrtagIndex(appData.sperrtage, null);
    const sperr = idx[tag.iso];
    if (!tagesTermine.length && !sperr) return;
    let zeilen = "";
    tagesTermine.forEach((t) => {
      const m = massnahmeVon(t.massnahmeId);
      const farbe = farbeDerMassnahme(m);
      const ort = ortVon(t.ortIdAbweichend || (m && m.ortId));
      const st = statusInfo(t.status);
      zeilen += `<div class="termin-zeile" data-termin="${escapeHtml(t.id)}">
        <div class="termin-farbe" style="background:${farbe}"></div>
        <div class="termin-text">
          <div class="t-titel">${escapeHtml((m && m.titel) || "")}</div>
          <div class="t-zeile">${escapeHtml(t.startZeit)}–${escapeHtml(t.endZeit)}${ort ? " · " + escapeHtml(ort.name) : ""}</div>
        </div>
        <span class="badge ${escapeHtml(t.status)}">${escapeHtml(st.name)}</span>
      </div>`;
    });
    listeHtml += `<div class="tag-block${sperr ? " gesperrt" : ""}">
      <h3>${escapeHtml(fmtWochentag(tag.iso))} <span class="muted">${fmtDatum(tag.iso)}</span></h3>
      ${sperr && sperr.namen.length ? `<p class="muted">${escapeHtml(sperr.namen.join(", "))}</p>` : ""}
      ${zeilen || `<p class="muted">Nichts geplant.</p>`}
    </div>`;
  });
  listeHtml += "</div>";

  document.getElementById("wochen-ansicht").innerHTML = rasterHtml + listeHtml;
  document.getElementById("wochen-hinweis").textContent =
    termine.length ? termine.length + (termine.length === 1 ? " Termin in dieser Woche" : " Termine in dieser Woche") : "";

  document.querySelectorAll("[data-termin]").forEach((el) => {
    el.addEventListener("click", () => oeffneTermin(el.getAttribute("data-termin")));
  });

  renderOffeneKarten();
}

// ---------------------------------------------------------------------------
// Offene Meldungen
// ---------------------------------------------------------------------------

function meineOffenen() {
  return (appData.termine || []).filter((t) => {
    if (terminIstGemeldet(t)) return false;
    if (t.datum > heuteIso()) return false;
    const m = massnahmeVon(t.massnahmeId);
    if (!m) return false;
    const u = currentUser.username;
    return m.verantwortlichUsername === u ||
      (Array.isArray(m.teamUsernames) && m.teamUsernames.indexOf(u) !== -1);
  }).sort((a, b) => (a.datum < b.datum ? -1 : 1));
}

function alleOffenen() {
  return (appData.termine || []).filter((t) => !terminIstGemeldet(t) && t.datum <= heuteIso())
    .sort((a, b) => (a.datum < b.datum ? -1 : 1));
}

function renderOffeneKarten() {
  const meine = meineOffenen();
  const karte = document.getElementById("meine-offenen-card");
  const zaehler = document.getElementById("nav-melden-zaehler");
  if (meine.length) {
    karte.style.display = "";
    document.getElementById("meine-offenen-titel").textContent =
      meine.length === 1 ? "1 Termin wartet auf deine Meldung" : meine.length + " Termine warten auf deine Meldung";
    document.getElementById("meine-offenen-inhalt").innerHTML = meine.slice(0, 5).map((t) => {
      const m = massnahmeVon(t.massnahmeId);
      return `<div class="liste-zeile"><div class="lz-haupt">
        <div class="lz-titel">${escapeHtml((m && m.titel) || "")}</div>
        <div class="lz-unter">${escapeHtml(fmtWochentag(t.datum))}, ${fmtDatum(t.datum)} · ${escapeHtml(t.startZeit)}–${escapeHtml(t.endZeit)}</div>
      </div><div class="lz-knoepfe">
        <button type="button" class="btn small" data-melden="${escapeHtml(t.id)}">Melden</button>
      </div></div>`;
    }).join("") + (meine.length > 5 ? `<p class="muted" style="margin-top:8px;">… und ${meine.length - 5} weitere im Reiter „Melden“.</p>` : "");
    zaehler.style.display = "";
    zaehler.textContent = meine.length;
  } else {
    karte.style.display = "none";
    zaehler.style.display = "none";
  }
  document.querySelectorAll("[data-melden]").forEach((b) => {
    b.addEventListener("click", (e) => { e.stopPropagation(); oeffneTermin(b.getAttribute("data-melden")); });
  });

  // Leitungssicht
  const gesamt = document.getElementById("offene-gesamt-card");
  if (!canEdit()) { gesamt.style.display = "none"; return; }
  const alle = alleOffenen();
  if (!alle.length) { gesamt.style.display = "none"; return; }
  gesamt.style.display = "";
  const proMassnahme = new Map();
  alle.forEach((t) => {
    const key = t.massnahmeId;
    if (!proMassnahme.has(key)) proMassnahme.set(key, []);
    proMassnahme.get(key).push(t);
  });
  let html = "";
  proMassnahme.forEach((liste, mid) => {
    const m = massnahmeVon(mid);
    const aeltest = liste[0];
    html += `<div class="liste-zeile"><div class="lz-haupt">
      <div class="lz-titel">${escapeHtml((m && m.titel) || "Unbekannte Maßnahme")}</div>
      <div class="lz-unter">${liste.length} offen, ältester ${fmtDatum(aeltest.datum)} · ${escapeHtml(nameVon(m && m.verantwortlichUsername))}</div>
    </div><div class="lz-knoepfe">
      <button type="button" class="btn secondary small" data-erinnern="${escapeHtml(mid)}">Erinnern</button>
    </div></div>`;
  });
  document.getElementById("offene-gesamt-inhalt").innerHTML = html;
  document.querySelectorAll("[data-erinnern]").forEach((b) => {
    b.addEventListener("click", () => sendeErinnerung(b.getAttribute("data-erinnern"), b));
  });
}

async function sendeErinnerung(massnahmeId, knopf) {
  if (knopf) { knopf.disabled = true; knopf.textContent = "…"; }
  try {
    const r = await erinnerungPush(massnahmeId);
    setSaveStatus("Erinnerung an " + (r.infrage || 0) + " Person(en) geschickt.");
  } catch (e) {
    setSaveStatus("Erinnerung fehlgeschlagen: " + e.message, true);
  } finally {
    if (knopf) { knopf.disabled = false; knopf.textContent = "Erinnern"; }
  }
}

// ---------------------------------------------------------------------------
// Melden
// ---------------------------------------------------------------------------

function renderMelden() {
  const u = currentUser.username;
  const meine = (appData.termine || []).filter((t) => {
    const m = massnahmeVon(t.massnahmeId);
    if (!m) return false;
    if (canEdit()) return true;
    return m.verantwortlichUsername === u ||
      (Array.isArray(m.teamUsernames) && m.teamUsernames.indexOf(u) !== -1);
  });

  let liste;
  if (meldeFilter === "offen") liste = meine.filter((t) => !terminIstGemeldet(t) && t.datum <= heuteIso());
  else if (meldeFilter === "kommend") liste = meine.filter((t) => t.datum > heuteIso());
  else liste = meine.slice();
  liste.sort((a, b) => (meldeFilter === "kommend"
    ? (a.datum < b.datum ? -1 : 1)
    : (a.datum > b.datum ? -1 : 1)));

  const el = document.getElementById("melden-liste");
  if (!liste.length) {
    el.innerHTML = `<div class="card"><div class="empty-state">${
      meldeFilter === "offen" ? "Nichts offen — alle vergangenen Termine sind gemeldet."
      : meldeFilter === "kommend" ? "Es stehen keine Termine an."
      : "Für dich ist keine Maßnahme hinterlegt."}</div></div>`;
    return;
  }

  el.innerHTML = liste.slice(0, 60).map((t) => meldeKarteHtml(t)).join("");
  bindeMeldeKarten();
}

function meldeKarteHtml(t) {
  const m = massnahmeVon(t.massnahmeId);
  const ort = ortVon(t.ortIdAbweichend || (m && m.ortId));
  const schule = schuleVon(m && m.schuleId);
  const st = statusInfo(t.status);
  const ro = !darfMelden(m);

  const gruende = (appData.ausfallgruende || []).map((g) =>
    `<option value="${escapeHtml(g.id)}"${t.ausfallgrundId === g.id ? " selected" : ""}>${escapeHtml(g.bezeichnung)}</option>`).join("");

  const team = [];
  if (m) {
    if (m.verantwortlichUsername) team.push(m.verantwortlichUsername);
    (m.teamUsernames || []).forEach((x) => { if (team.indexOf(x) === -1) team.push(x); });
  }
  const durchOpt = team.map((x) =>
    `<option value="${escapeHtml(x)}"${(t.durchgefuehrtVon || currentUser.username) === x ? " selected" : ""}>${escapeHtml(nameVon(x))}</option>`).join("");

  return `<div class="melde-karte${istUeberfaellig(t) ? " faellig" : ""}" data-karte="${escapeHtml(t.id)}">
    <div class="melde-kopf">
      <span class="m-titel">${escapeHtml((m && m.titel) || "")}</span>
      <span class="m-datum">${escapeHtml(fmtWochentag(t.datum))}, ${fmtDatum(t.datum)} · ${escapeHtml(t.startZeit)}–${escapeHtml(t.endZeit)}</span>
    </div>
    <div class="melde-ort">
      ${schule ? `<div>${escapeHtml(schule.name)}${ort ? " · " + escapeHtml(ort.name) : ""}</div>` : ""}
      ${ort && ort.zugang ? `<div><dt>Zugang:</dt><dd>${escapeHtml(ort.zugang)}</dd></div>` : ""}
      ${ort && ort.ausstattung && ort.ausstattung.length ? `<div><dt>Vor Ort:</dt><dd>${escapeHtml(ort.ausstattung.join(", "))}</dd></div>` : ""}
      ${m && m.mitbringen && m.mitbringen.length ? `<div><dt>Mitbringen:</dt><dd>${escapeHtml(m.mitbringen.join(", "))}</dd></div>` : ""}
    </div>
    ${ro ? `<p class="muted">Status: ${escapeHtml(st.name)}${t.teilnehmerzahl !== null ? " · " + t.teilnehmerzahl + " Kinder" : ""}</p>` : `
    <div class="status-chips">
      <button type="button" data-status="durchgefuehrt" class="${t.status === "durchgefuehrt" ? "aktiv" : ""}">Durchgeführt</button>
      <button type="button" data-status="ausgefallen" class="${t.status === "ausgefallen" ? "aktiv" : ""}">Ausgefallen</button>
      <button type="button" data-status="verschoben" class="${t.status === "verschoben" ? "aktiv" : ""}">Verschoben</button>
    </div>
    <div class="form-grid">
      <div class="form-field mk-zahl" style="${t.status === "durchgefuehrt" ? "" : "display:none"}">
        <label>Wie viele Kinder waren da?</label>
        <input type="number" min="0" max="999" inputmode="numeric" class="f-zahl" value="${t.teilnehmerzahl === null || t.teilnehmerzahl === undefined ? "" : escapeHtml(t.teilnehmerzahl)}" />
      </div>
      <div class="form-field mk-grund" style="${t.status === "ausgefallen" ? "" : "display:none"}">
        <label>Grund des Ausfalls</label>
        <select class="f-grund"><option value="">Bitte wählen</option>${gruende}</select>
      </div>
      <div class="form-field">
        <label>Durchgeführt von</label>
        <select class="f-durch">${durchOpt || `<option value="${escapeHtml(currentUser.username)}">${escapeHtml(nameVon(currentUser.username))}</option>`}</select>
      </div>
    </div>
    <div class="form-field">
      <label>Bemerkung (ohne Namen von Kindern)</label>
      <input type="text" class="f-notiz" maxlength="300" value="${escapeHtml(t.notiz || "")}" placeholder="optional" />
    </div>
    <div class="btn-row" style="justify-content:flex-start;">
      <button type="button" class="btn success small f-senden">Meldung speichern</button>
      <span class="muted f-echo"></span>
    </div>`}
  </div>`;
}

function bindeMeldeKarten() {
  document.querySelectorAll("[data-karte]").forEach((karte) => {
    const id = karte.getAttribute("data-karte");
    karte.querySelectorAll(".status-chips button").forEach((b) => {
      b.addEventListener("click", () => {
        karte.querySelectorAll(".status-chips button").forEach((x) => x.classList.remove("aktiv"));
        b.classList.add("aktiv");
        const st = b.getAttribute("data-status");
        const zahl = karte.querySelector(".mk-zahl"), grund = karte.querySelector(".mk-grund");
        if (zahl) zahl.style.display = st === "durchgefuehrt" ? "" : "none";
        if (grund) grund.style.display = st === "ausgefallen" ? "" : "none";
      });
    });
    const senden = karte.querySelector(".f-senden");
    if (senden) senden.addEventListener("click", () => sendeMeldung(id, karte, senden));
  });
}

async function sendeMeldung(terminId, karte, knopf) {
  const aktiv = karte.querySelector(".status-chips button.aktiv");
  if (!aktiv) { zeigeEcho(karte, "Bitte zuerst angeben, ob die Einheit stattgefunden hat.", true); return; }
  const status = aktiv.getAttribute("data-status");
  const zahlFeld = karte.querySelector(".f-zahl");
  const grundFeld = karte.querySelector(".f-grund");

  let zahl = null;
  if (status === "durchgefuehrt") {
    const roh = zahlFeld ? zahlFeld.value.trim() : "";
    if (roh === "") { zeigeEcho(karte, "Bitte die Anzahl der Kinder eintragen.", true); return; }
    zahl = Number(roh);
    if (!Number.isFinite(zahl) || zahl < 0 || zahl > 999) { zeigeEcho(karte, "Die Anzahl muss zwischen 0 und 999 liegen.", true); return; }
  }
  const grund = status === "ausgefallen" && grundFeld ? grundFeld.value : "";
  if (status === "ausgefallen" && !grund) { zeigeEcho(karte, "Bitte einen Grund für den Ausfall wählen.", true); return; }

  const felder = {
    terminId,
    status,
    teilnehmerzahl: zahl,
    durchgefuehrtVon: karte.querySelector(".f-durch") ? karte.querySelector(".f-durch").value : currentUser.username,
    ausfallgrundId: grund,
    notiz: karte.querySelector(".f-notiz") ? karte.querySelector(".f-notiz").value.trim() : ""
  };

  knopf.disabled = true;
  const alt = knopf.textContent;
  knopf.textContent = "Wird gespeichert …";
  try {
    const neu = await meldeTermin(felder);
    // Lokalen Stand nachziehen, damit Woche und Zähler sofort stimmen.
    const t = terminVon(terminId);
    if (t && neu) Object.assign(t, neu);
    else if (t) Object.assign(t, felder, { gemeldetVon: currentUser.username, gemeldetAm: new Date().toISOString() });
    zeigeEcho(karte, "Gespeichert.", false);
    renderMelden();
    renderOffeneKarten();
  } catch (e) {
    zeigeEcho(karte, "Fehlgeschlagen: " + e.message, true);
    knopf.disabled = false;
    knopf.textContent = alt;
  }
}

function zeigeEcho(karte, text, fehler) {
  const el = karte.querySelector(".f-echo");
  if (!el) return;
  el.textContent = text;
  el.style.color = fehler ? "#c0392b" : "#2d8c4e";
}

// ---------------------------------------------------------------------------
// Einzeltermin-Dialog
// ---------------------------------------------------------------------------

function oeffneTermin(id) {
  const t = terminVon(id);
  if (!t) return;
  offenerTerminId = id;
  const m = massnahmeVon(t.massnahmeId);
  const schule = schuleVon(m && m.schuleId);
  const ort = ortVon(t.ortIdAbweichend || (m && m.ortId));
  const st = statusInfo(t.status);
  const ro = !darfMelden(m);

  document.getElementById("termin-dialog-titel").textContent = (m && m.titel) || "Termin";
  document.getElementById("termin-formular").innerHTML = `
    <p class="muted">${escapeHtml(fmtWochentag(t.datum))}, ${fmtDatum(t.datum)} · ${escapeHtml(t.startZeit)}–${escapeHtml(t.endZeit)}</p>
    ${schule ? `<p class="muted">${escapeHtml(schule.name)}${ort ? " · " + escapeHtml(ort.name) : ""}</p>` : ""}
    <p style="margin:10px 0;"><span class="badge ${escapeHtml(t.status)}">${escapeHtml(st.name)}</span>
      ${t.teilnehmerzahl !== null && t.teilnehmerzahl !== undefined ? ` <strong>${escapeHtml(t.teilnehmerzahl)}</strong> Kinder` : ""}</p>
    ${t.gemeldetAm ? `<p class="muted">Gemeldet von ${escapeHtml(nameVon(t.gemeldetVon))} am ${escapeHtml(fmtZeitstempel(t.gemeldetAm))}</p>` : ""}
    ${t.ausfallgrundId ? `<p class="muted">Grund: ${escapeHtml((grundVon(t.ausfallgrundId) || {}).bezeichnung || t.ausfallgrundId)}</p>` : ""}
    ${t.notiz ? `<p class="muted">Bemerkung: ${escapeHtml(t.notiz)}</p>` : ""}
    ${ro ? `<p class="hinweis info" style="margin-top:12px;">Melden darf, wer für diese Maßnahme eingeteilt ist.</p>` : `
      <div style="margin-top:14px;">${meldeKarteHtml(t)}</div>`}
    ${terminInBestaetigtemNachweis(t.massnahmeId, t.datum)
      ? `<p class="hinweis warnung" style="margin-top:12px;">Dieser Termin steht in einem bereits bestätigten Nachweis. Eine Korrektur ändert das ausgestellte Dokument nicht mehr.</p>` : ""}
  `;
  if (!ro) bindeMeldeKarten();
  document.getElementById("btn-termin-speichern").style.display = "none";
  oeffneOverlay("termin-overlay");
}

// ---------------------------------------------------------------------------
// Overlays
// ---------------------------------------------------------------------------

function oeffneOverlay(id) { document.getElementById(id).classList.add("offen"); }
function schliesseOverlay(id) { document.getElementById(id).classList.remove("offen"); }

function setupOverlays() {
  const paare = [
    ["massnahme-overlay", ["btn-massnahme-abbrechen", "btn-massnahme-abbrechen-2"]],
    ["abgleich-overlay", ["btn-abgleich-abbrechen", "btn-abgleich-abbrechen-2"]],
    ["termin-overlay", ["btn-termin-abbrechen", "btn-termin-abbrechen-2"]],
    ["freigabe-overlay", ["btn-freigabe-schliessen", "btn-freigabe-schliessen-2"]]
  ];
  paare.forEach(([ov, knoepfe]) => {
    knoepfe.forEach((k) => {
      const el = document.getElementById(k);
      if (el) el.addEventListener("click", () => schliesseOverlay(ov));
    });
    const el = document.getElementById(ov);
    if (el) el.addEventListener("click", (e) => { if (e.target === el) schliesseOverlay(ov); });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const offen = document.querySelector(".overlay.offen");
    if (offen) offen.classList.remove("offen");
  });
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

function renderChangelog() {
  const el = document.getElementById("changelog-list");
  if (!el) return;
  el.innerHTML = APP_CHANGELOG.map((entry) => `
    <div class="changelog-entry">
      <span class="cv">Version ${escapeHtml(entry.version)}</span>
      ${entry.groups.map((g) => `
        <div class="changelog-group">
          <div class="cg-title">${escapeHtml(g.title)}</div>
          <ul class="cg-items">${g.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>
        </div>`).join("")}
    </div>`).join("");
}

// ---------- Sitzungsverlust: räumen, nicht nur verstecken ----------

// ⚠️ Verstecken ist nicht Räumen. Fällt die Sitzung weg, WÄHREND die App
// offen ist, steht bereits alles auf dem Bildschirm. display:none macht das
// unsichtbar, nicht weg -- Namen, Nummern und ausgefüllte Formularfelder sind
// im Seitenquelltext weiter lesbar.
//
// ⚠️ Über die CONTAINER räumen, nie über eine Id-Liste. Eine Liste veraltet
// lautlos: wer später ein Feld ergänzt, müsste daran denken, und genau das eine
// bliebe stehen.
//
// ⚠️ Dialoge, Druckbereich und Bild-Lightbox stehen NEBEN der Hülle, nicht
// darin -- ihr innerHTML erwischt sie nicht. Ein offener Dialog ist dabei der
// schlimmste Fall: er steht nicht nur gespeichert, sondern SICHTBAR da.
//
// Wegwerfen ist gefahrlos: zurück in die App geht es ausschließlich über ein
// Neuladen der Seite. Wer sich neu anmeldet, bekommt sie ohnehin frisch.
let bildschirmGeraeumt = false;

// Vor dem ersten Aufbau gibt es nichts zu räumen -- und wer gar nicht angemeldet
// ist, soll nicht "Sitzung abgelaufen" lesen. Gesetzt wird das erst, wenn die
// Hülle wirklich sichtbar wird.
let appLaeuft = false;

function raeumeBildschirm() {
  bildschirmGeraeumt = true;
  const huelle = document.getElementById("app-shell");
  if (huelle) huelle.innerHTML = "";
  // ⚠️ #header-user steht in vier Apps im Seitenkopf und damit NEBEN der
  // Hülle -- der Name des Angemeldeten blieb dort nach dem Sitzungsverlust
  // stehen. Der Rest des Kopfes (Titel, Logo, Zurück-Link) bleibt absichtlich:
  // ohne ihn stünde man vor einer weißen Seite ohne Weg zurück.
  document.querySelectorAll(".modal-overlay, .overlay, #print-area, .foto-lightbox, #header-user").forEach((el) => {
    el.innerHTML = "";
    el.classList.add("hidden");
    el.style.display = "none";
  });
}

// ⚠️ Gerufen aus db.js -- an der EINEN Stelle, an der die 401 ankommt. Sonst
// müsste jeder einzelne Fehlerweg daran denken, und einer vergisst es.
function raeumeBeiSitzungsverlust() {
  if (!appLaeuft) return;
  showConnectScreen("Die Sitzung ist abgelaufen. Bitte über die Tools-Übersicht neu anmelden.");
}

function showConnectScreen(fehler) {
  raeumeBildschirm();
  document.getElementById("connect-screen").style.display = "";
  document.getElementById("app-shell").style.display = "none";
  if (fehler) {
    const el = document.getElementById("cloud-error");
    el.style.display = "";
    el.textContent = fehler;
  }
}

function startApp() {
  appLaeuft = true;
  document.getElementById("connect-screen").style.display = "none";
  document.getElementById("app-shell").style.display = "";
}

function fuelleFilter() {
  const schulen = (appData.schulen || []).filter((s) => s.aktiv !== false);
  const opt = (liste, leer) => `<option value="">${leer}</option>` +
    liste.map((x) => `<option value="${escapeHtml(x.id || x.username)}">${escapeHtml(x.name || x.displayName)}</option>`).join("");

  ["filter-schule", "mf-schule"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const alt = el.value;
    el.innerHTML = opt(schulen, "Alle Schulen");
    el.value = alt;
  });

  const personen = teamKandidaten.slice();
  const fp = document.getElementById("filter-person");
  if (fp) { const alt = fp.value; fp.innerHTML = opt(personen, "Alle"); fp.value = alt; }

  // Schuljahre aus dem Bestand
  const jahre = new Set();
  (appData.massnahmen || []).forEach((m) => { if (m.schuljahr) jahre.add(m.schuljahr); });
  jahre.add(schuljahrAusIso(heuteIso(), SCHULJAHR_BEGINN_MONAT));
  const sortiert = Array.from(jahre).sort().reverse();
  ["mf-schuljahr", "ue-schuljahr"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const alt = el.value;
    el.innerHTML = (id === "ue-schuljahr" ? `<option value="">Zeitraum frei wählen</option>` : `<option value="">Alle Schuljahre</option>`) +
      sortiert.map((j) => `<option value="${escapeHtml(j)}">${escapeHtml(j)}</option>`).join("");
    el.value = alt || (id === "mf-schuljahr" ? sortiert[0] || "" : "");
  });
}

function renderAlles() {
  if (bildschirmGeraeumt) return;
  fuelleFilter();
  applyRechteVisibility();
  activateTab(aktuellerTab);
}

async function init() {
  document.getElementById("version-badge-2").textContent = "v" + APP_VERSION;
  renderChangelog();
  setupTabs();
  setupOverlays();
  wochenAnker = montagDerWoche(heuteDatum());

  // Klickhandler EINMALIG registrieren -- die Container überleben jedes Rendern.
  document.getElementById("btn-woche-zurueck").addEventListener("click", () => {
    wochenAnker.setDate(wochenAnker.getDate() - 7); renderWoche();
  });
  document.getElementById("btn-woche-vor").addEventListener("click", () => {
    wochenAnker.setDate(wochenAnker.getDate() + 7); renderWoche();
  });
  document.getElementById("btn-woche-heute").addEventListener("click", () => {
    wochenAnker = montagDerWoche(heuteDatum()); renderWoche();
  });
  ["filter-schule", "filter-person"].forEach((id) => {
    document.getElementById(id).addEventListener("change", renderWoche);
  });
  document.getElementById("btn-zu-melden").addEventListener("click", () => activateTab("melden"));
  document.querySelectorAll("#melden-filter button").forEach((b) => {
    b.addEventListener("click", () => {
      meldeFilter = b.getAttribute("data-mf");
      document.querySelectorAll("#melden-filter button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      renderMelden();
    });
  });
  document.querySelectorAll("#admin-subnav button").forEach((b) => {
    b.addEventListener("click", () => {
      adminBereich = b.getAttribute("data-adm");
      document.querySelectorAll("#admin-subnav button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      renderAdmin();
    });
  });
  ["mf-schule", "mf-schuljahr", "mf-status"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", renderMassnahmen);
  });
  setupMassnahmenKnoepfe();
  setupNachweisKnoepfe();

  window.addEventListener("pagehide", flushPending);
  document.addEventListener("visibilitychange", () => { if (document.hidden) flushPending(); });

  // Beim Drehen des Handys muss die Ansicht mitwechseln -- sonst bleibt beim
  // Wechsel auf Querformat die Tagesliste stehen.
  if (window.matchMedia) {
    const mq = window.matchMedia("(max-width: " + (MOBIL_BREITE - 1) + "px)");
    if (mq.addEventListener) mq.addEventListener("change", () => { if (aktuellerTab === "woche") renderWoche(); });
  }

  if (!getSessionToken()) { showConnectScreen(); return; }

  try {
    // Die Team-Kandidaten haengen nicht an dav-load und laufen deshalb ab hier
    // parallel mit. Vorher starteten sie erst NACH dav-load und me -- ein
    // voller Roundtrip (~180 ms), den jeder Nutzer vor dem ersten Bild
    // abwartete. Der catch macht daraus wie bisher eine leere Liste.
    const kandidatenP = ladeTeamKandidaten().catch(() => []);
    // dav-load und me weiter nacheinander: dav-load liefert das me gratis mit.
    const data = await gatewayLoad();
    const me = await fetchMe();
    currentUser = me || currentUser;
    currentIsAdmin = !!me.isAdmin;
    currentCanEdit = !!me.canEdit;
    currentCanAdmin = !!me.canAdmin;
    appData = normalizeData(data);

    const name = ((me.vorname || "") + " " + (me.nachname || "")).trim() || me.username || "";
    document.getElementById("header-user").textContent = name;

    teamKandidaten = await kandidatenP;

    startApp();
    renderAlles();

    // Hat die Schule zwischenzeitlich gezeichnet? Dann entsteht daraus jetzt das
    // unveränderliche Dokument. Bewusst NACH dem Rendern und ohne await -- die
    // App soll nicht auf einen PDF-Bau warten.
    legeBestaetigtePdfsAb();
  } catch (e) {
    if (e instanceof NotLoggedInError) showConnectScreen();
    else showConnectScreen("Fehler beim Laden: " + e.message);
  }
}

window.addEventListener("DOMContentLoaded", () => { init(); });
