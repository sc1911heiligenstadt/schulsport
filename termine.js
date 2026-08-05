// Serienregel -> Einzeltermine. Reine Rechenlogik, KEINE DOM-Zugriffe und kein
// Zugriff auf appData -- alles kommt als Parameter herein. Damit lässt sich die
// Datei einzeln in Node prüfen, ohne einen Browser zu starten.
//
// ⚠️ Gerechnet wird durchgehend mit getFullYear/getMonth/getDate, NIE mit
// toISOString().slice(0,10): in deutscher Sommerzeit liefert toISOString() vor
// 02:00 Uhr den VORTAG. Ein nächtlicher Test verschöbe damit die halbe Serie um
// einen Tag, während tagsüber alles richtig aussieht.

function isoAusDatum(d) {
  const j = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const t = String(d.getDate()).padStart(2, "0");
  return `${j}-${m}-${t}`;
}

function datumAusIso(iso) {
  const teile = String(iso || "").split("-");
  if (teile.length !== 3) return null;
  const d = new Date(Number(teile[0]), Number(teile[1]) - 1, Number(teile[2]));
  return isNaN(d.getTime()) ? null : d;
}

// Mitternacht des heutigen Tages -- der Standard-Stichtag beim Ändern einer Serie.
function heuteDatum() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function minutenAusZeit(hhmm) {
  const t = String(hhmm || "").split(":");
  if (t.length !== 2) return 0;
  return Number(t[0]) * 60 + Number(t[1]);
}

function zeitAusMinuten(min) {
  const m = Math.max(0, Math.round(min));
  return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
}

// Schuljahr eines Datums, z. B. "2026/27". Beginn im August (SCHULJAHR_BEGINN_MONAT).
function schuljahrAusIso(iso, beginnMonat) {
  const d = datumAusIso(iso);
  if (!d) return "";
  const bm = beginnMonat || 8;
  const start = d.getMonth() + 1 >= bm ? d.getFullYear() : d.getFullYear() - 1;
  return start + "/" + String((start + 1) % 100).padStart(2, "0");
}

// ---------------------------------------------------------------------------
// Sperrtage
// ---------------------------------------------------------------------------

// Baut ein Nachschlagewerk Datum -> {ferien, feiertag, schliesstag} für genau
// eine Schule. Ein Eintrag mit schuleId === null gilt für alle Schulen.
function baueSperrtagIndex(sperrtage, schuleId) {
  const idx = Object.create(null);
  (sperrtage || []).forEach((s) => {
    if (!s || !s.von || !s.bis) return;
    if (s.schuleId && s.schuleId !== schuleId) return;
    const von = datumAusIso(s.von);
    const bis = datumAusIso(s.bis);
    if (!von || !bis || bis < von) return;
    const art = s.art || "ferien";
    // bis EINSCHLIESSLICH -- die letzte Ferienwoche endet am Sonntag, und dieser
    // Sonntag gehört noch dazu.
    for (const d = new Date(von); d <= bis; d.setDate(d.getDate() + 1)) {
      const iso = isoAusDatum(d);
      if (!idx[iso]) idx[iso] = { ferien: false, feiertag: false, schliesstag: false, namen: [] };
      idx[iso][art] = true;
      if (s.name && idx[iso].namen.indexOf(s.name) === -1) idx[iso].namen.push(s.name);
    }
  });
  return idx;
}

// Fällt an diesem Tag aus? Getrennt nach Art, damit die drei Flags der Regel
// einzeln greifen können.
function tagFaelltAus(eintrag, regel) {
  if (!eintrag) return false;
  if (regel.ferienAuslassen      && eintrag.ferien)      return true;
  if (regel.feiertageAuslassen   && eintrag.feiertag)    return true;
  if (regel.schliesstageAuslassen && eintrag.schliesstag) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Soll-Termine aus der Regel
// ---------------------------------------------------------------------------

// Liefert die Termine, die die Regel für den Zeitraum vorsieht -- ohne jeden
// Blick auf bereits gespeicherte Termine. Das Zusammenführen macht planeAbgleich.
function erzeugeSollTermine(massnahme, sperrtage) {
  const out = [];
  const r = massnahme && massnahme.regel;
  if (!r) return out;
  const von = datumAusIso(r.startDatum);
  const bis = datumAusIso(r.endDatum);
  if (!von || !bis || bis < von) return out;

  const idx = baueSperrtagIndex(sperrtage, massnahme.schuleId);
  const ausnahmen = new Set(Array.isArray(r.ausnahmen) ? r.ausnahmen : []);
  const wochentage = Array.isArray(r.wochentage) ? r.wochentage : [];

  for (const d = new Date(von); d <= bis; d.setDate(d.getDate() + 1)) {
    const wt = d.getDay(); // 0 = So, 1 = Mo, ...

    if (r.muster === "taeglich") {
      // Ein Camp läuft Montag bis Freitag. Am Wochenende ist an einer Schule
      // niemand da -- und ein Camp, das am Samstag endet, wird als Einzeltermin
      // nachgetragen statt die Regel dafür aufzuweichen.
      if (wt === 0 || wt === 6) continue;
    } else {
      if (wochentage.indexOf(wt) === -1) continue;
    }

    const iso = isoAusDatum(d);
    if (ausnahmen.has(iso)) continue;
    if (tagFaelltAus(idx[iso], r)) continue;

    out.push({
      datum: iso,
      startZeit: r.startZeit,
      endZeit: r.endZeit,
      vorbereitungMin: Number(massnahme.vorbereitungMin) || 0,
      nachbereitungMin: Number(massnahme.nachbereitungMin) || 0
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Abgleich mit dem Bestand
// ---------------------------------------------------------------------------

// Ein Termin gilt als gemeldet, sobald jemand ihn angefasst hat. Beide Prüfungen
// sind nötig: der Status kann auf "ausgefallen" stehen (dann gibt es keine Zahl),
// und eine Zahl kann vorliegen, während der Status noch nachgezogen wird.
function terminIstGemeldet(t) {
  if (!t) return false;
  if (t.status && t.status !== "offen") return true;
  if (t.teilnehmerzahl !== null && t.teilnehmerzahl !== undefined) return true;
  if (t.gemeldetAm) return true;
  return false;
}

// Plant den Abgleich, OHNE etwas zu ändern. Das Ergebnis ist zugleich die
// Vorschau für den Dialog und die Arbeitsanweisung für wendeAbgleichAn.
//
// stichtagIso: ab diesem Tag (einschließlich) wird neu geplant. Alles davor
// bleibt unangetastet -- ein Nachweis darf sich nie rückwirkend ändern.
// istGeschuetzt: optionale Funktion (massnahmeId, datumIso) -> bool. Damit
// schützt der Aufrufer Termine, die in einem bestätigten Nachweis stehen.
function planeAbgleich(massnahme, bestand, sperrtage, stichtagIso, istGeschuetzt) {
  const stichtag = datumAusIso(stichtagIso) || heuteDatum();
  const meine = (bestand || []).filter((t) => t && t.massnahmeId === massnahme.id);
  const soll = erzeugeSollTermine(massnahme, sperrtage);

  const sollNachDatum = new Map();
  soll.forEach((s) => sollNachDatum.set(s.datum, s));
  const istNachDatum = new Map();
  meine.forEach((t) => istNachDatum.set(t.datum, t));

  const geschuetzt = (datum) => (typeof istGeschuetzt === "function")
    ? !!istGeschuetzt(massnahme.id, datum) : false;

  const neu = [];
  const aktualisiert = [];
  const entfernt = [];
  const unangetastet = [];

  // 1) Was die Regel vorsieht
  sollNachDatum.forEach((s, datum) => {
    const d = datumAusIso(datum);
    if (d < stichtag) return;                       // Vergangenheit bleibt, wie sie ist
    const vorhanden = istNachDatum.get(datum);
    if (!vorhanden) { neu.push(s); return; }
    if (terminIstGemeldet(vorhanden)) { unangetastet.push(vorhanden); return; }
    if (vorhanden.abweichend) { unangetastet.push(vorhanden); return; }
    const gleich = vorhanden.startZeit === s.startZeit && vorhanden.endZeit === s.endZeit &&
                   Number(vorhanden.vorbereitungMin) === s.vorbereitungMin &&
                   Number(vorhanden.nachbereitungMin) === s.nachbereitungMin;
    if (gleich) unangetastet.push(vorhanden);
    else aktualisiert.push({ termin: vorhanden, soll: s });
  });

  // 2) Was im Bestand steht, aber nicht mehr in der Regel
  istNachDatum.forEach((t, datum) => {
    if (sollNachDatum.has(datum)) return;
    const d = datumAusIso(datum);
    if (d && d < stichtag) { unangetastet.push(t); return; }
    // ⚠️ Ein gemeldeter Termin wird NIE gelöscht. Er ist ein Nachweis und kann
    // in eine unterschriebene Bestätigung eingeflossen sein. Er bleibt stehen
    // und wird nur gekennzeichnet.
    if (terminIstGemeldet(t) || geschuetzt(datum)) { unangetastet.push(t); return; }
    entfernt.push(t);
  });

  return {
    massnahmeId: massnahme.id,
    stichtag: isoAusDatum(stichtag),
    neu, aktualisiert, entfernt, unangetastet,
    zahlen: {
      neu: neu.length,
      aktualisiert: aktualisiert.length,
      entfernt: entfernt.length,
      unangetastet: unangetastet.length,
      gemeldetBleibt: unangetastet.filter(terminIstGemeldet).length
    }
  };
}

// Setzt den geplanten Abgleich um und gibt die neue Terminliste zurück.
// neueId: Funktion, die eine frische Id liefert (uuid aus app.js).
function wendeAbgleichAn(plan, bestand, neueId) {
  const raus = new Set(plan.entfernt.map((t) => t.id));
  const aktuMap = new Map();
  plan.aktualisiert.forEach((a) => aktuMap.set(a.termin.id, a.soll));

  const out = (bestand || []).filter((t) => !raus.has(t.id)).map((t) => {
    const s = aktuMap.get(t.id);
    if (!s) return t;
    return Object.assign({}, t, {
      startZeit: s.startZeit,
      endZeit: s.endZeit,
      vorbereitungMin: s.vorbereitungMin,
      nachbereitungMin: s.nachbereitungMin
    });
  });

  plan.neu.forEach((s) => {
    out.push({
      id: neueId(),
      massnahmeId: plan.massnahmeId,
      datum: s.datum,
      startZeit: s.startZeit,
      endZeit: s.endZeit,
      vorbereitungMin: s.vorbereitungMin,
      nachbereitungMin: s.nachbereitungMin,
      ortIdAbweichend: "",
      status: "offen",
      teilnehmerzahl: null,
      durchgefuehrtVon: "",
      durchgefuehrtVonName: "",
      ausfallgrundId: "",
      ausfallBemerkung: "",
      notiz: "",
      gemeldetVon: "",
      gemeldetAm: "",
      quelle: "serie",
      abweichend: false,
      serienabweichung: false
    });
  });

  // Termine, die aus der Regel gefallen sind, aber stehenbleiben mussten, werden
  // gekennzeichnet -- sonst sähe die Leitung nicht, dass sie nicht mehr zur
  // Serie gehören.
  const sollDaten = new Set(plan.neu.map((s) => s.datum));
  plan.unangetastet.forEach((u) => { sollDaten.add(u.datum); });

  out.sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0));
  return out;
}

// Formuliert die Vorschau in einem Satz, den man einem Menschen zeigen kann.
function abgleichText(plan) {
  const z = plan.zahlen;
  const teile = [];
  if (z.neu) teile.push(z.neu === 1 ? "1 Termin kommt neu dazu" : z.neu + " Termine kommen neu dazu");
  if (z.aktualisiert) teile.push(z.aktualisiert === 1 ? "1 Termin bekommt neue Zeiten" : z.aktualisiert + " Termine bekommen neue Zeiten");
  if (z.unangetastet) teile.push(z.unangetastet === 1 ? "1 Termin bleibt unverändert" : z.unangetastet + " Termine bleiben unverändert");
  if (z.entfernt) teile.push(z.entfernt === 1 ? "1 noch nicht gemeldeter Termin wird gelöscht" : z.entfernt + " noch nicht gemeldete Termine werden gelöscht");
  if (!teile.length) return "Es ändert sich nichts.";
  let satz = teile.join(". ") + ".";
  if (z.gemeldetBleibt) {
    satz += z.gemeldetBleibt === 1
      ? " Der eine bereits gemeldete Termin bleibt erhalten."
      : " Die " + z.gemeldetBleibt + " bereits gemeldeten Termine bleiben erhalten.";
  }
  return satz;
}

// ---------------------------------------------------------------------------
// Auswertung
// ---------------------------------------------------------------------------

// Rechnet die Summen für einen Satz Termine. Grundlage für Nachweis und Kennzahlen.
function summiereTermine(termine) {
  let geplant = 0, durchgefuehrt = 0, ausgefallen = 0, verschoben = 0;
  let teilnahmen = 0, mitZahl = 0;
  let minutenAg = 0, minutenVor = 0, minutenNach = 0;

  (termine || []).forEach((t) => {
    geplant++;
    if (t.status === "durchgefuehrt") {
      durchgefuehrt++;
      const dauer = minutenAusZeit(t.endZeit) - minutenAusZeit(t.startZeit);
      if (dauer > 0) minutenAg += dauer;
      minutenVor  += Number(t.vorbereitungMin) || 0;
      minutenNach += Number(t.nachbereitungMin) || 0;
    } else if (t.status === "ausgefallen") {
      ausgefallen++;
    } else if (t.status === "verschoben") {
      verschoben++;
    }
    if (t.teilnehmerzahl !== null && t.teilnehmerzahl !== undefined && t.status === "durchgefuehrt") {
      teilnahmen += Number(t.teilnehmerzahl) || 0;
      mitZahl++;
    }
  });

  return {
    geplant, durchgefuehrt, ausgefallen, verschoben,
    offen: geplant - durchgefuehrt - ausgefallen - verschoben,
    teilnahmen,
    // ⚠️ Nenner ist die Zahl der Termine MIT Angabe, nicht die der durchgeführten.
    // Sonst zöge ein durchgeführter, aber noch nicht gezählter Termin den Schnitt
    // nach unten und die Zahl wäre eine Scheingenauigkeit.
    schnitt: mitZahl ? Math.round((teilnahmen / mitZahl) * 10) / 10 : 0,
    mitZahl,
    minutenAg, minutenVor, minutenNach,
    minutenGesamt: minutenAg + minutenVor + minutenNach
  };
}

// Ausfälle nach Grund, damit der Nachweis sie aufschlüsseln kann statt sie nur
// zu zählen -- die Behörde fragt, WARUM vier von zwanzig ausgefallen sind.
function ausfaelleNachGrund(termine, gruende) {
  const namen = new Map((gruende || []).map((g) => [g.id, g]));
  const zaehler = new Map();
  (termine || []).forEach((t) => {
    if (t.status !== "ausgefallen") return;
    const key = t.ausfallgrundId || "";
    zaehler.set(key, (zaehler.get(key) || 0) + 1);
  });
  const out = [];
  zaehler.forEach((anzahl, key) => {
    const g = namen.get(key);
    out.push({
      id: key,
      bezeichnung: g ? g.bezeichnung : "Ohne Angabe",
      vereinsverschulden: g ? !!g.vereinsverschulden : false,
      anzahl
    });
  });
  out.sort((a, b) => b.anzahl - a.anzahl);
  return out;
}

function stundenText(minuten) {
  const m = Math.max(0, Math.round(minuten || 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return r + " Min";
  if (!r) return h + " Std";
  return h + " Std " + r + " Min";
}
