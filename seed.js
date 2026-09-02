// Startbestand: Ferien und Feiertage für Thüringen.
//
// Quellen (nachgeschlagen am 2026-08-05, nicht geschätzt):
//   Ferientermine  -- schulferien.org / feiertage-deutschland.de, KMK-bestätigt
//   Feiertage      -- gesetzliche Feiertage des Freistaats Thüringen
//   bewegliche Feiertage (Karfreitag, Ostermontag, Christi Himmelfahrt,
//   Pfingstmontag) -- aus dem Ostersonntag gerechnet, nicht aus dem Gedächtnis
//   übernommen. Ostersonntag 2027 = 28.03., 2028 = 16.04.
//
// ⚠️ ZU PRÜFEN: Das Ende der Sommerferien 2027 ist unten mit sechs Wochen
// angesetzt (dem Thüringer Regelfall), aber nicht belegt. Ebenso fehlt das
// Schuljahr 2027/28 vollständig. Beides ist im Reiter „Administrieren“ zu
// ergänzen, sobald die Termine amtlich vorliegen — die App braucht dafür
// keine Codeänderung.
//
// Beweglich Ferientage der einzelnen Schulen (Brückentage, Projektwochen,
// Schließtage) stehen hier bewusst NICHT: die legt jede Schule selbst fest und
// sie werden je Schule im Administrieren-Tab nachgetragen.

const SEED_SPERRTAGE = [
  // ---- Schuljahr 2026/27 ----
  { id: "th-2026-sommer",  schuljahr: "2025/26", name: "Sommerferien",     von: "2026-07-04", bis: "2026-08-14", art: "ferien",   schuleId: null, quelle: "seed" },
  { id: "th-2026-herbst",  schuljahr: "2026/27", name: "Herbstferien",     von: "2026-10-12", bis: "2026-10-24", art: "ferien",   schuleId: null, quelle: "seed" },
  { id: "th-2026-weihn",   schuljahr: "2026/27", name: "Weihnachtsferien", von: "2026-12-23", bis: "2027-01-02", art: "ferien",   schuleId: null, quelle: "seed" },
  { id: "th-2027-winter",  schuljahr: "2026/27", name: "Winterferien",     von: "2027-02-01", bis: "2027-02-06", art: "ferien",   schuleId: null, quelle: "seed" },
  { id: "th-2027-ostern",  schuljahr: "2026/27", name: "Osterferien",      von: "2027-03-30", bis: "2027-04-10", art: "ferien",   schuleId: null, quelle: "seed" },
  // ⚠️ Enddatum geschätzt (sechs Wochen ab dem belegten Beginn), bitte prüfen.
  { id: "th-2027-sommer",  schuljahr: "2026/27", name: "Sommerferien",     von: "2027-07-10", bis: "2027-08-20", art: "ferien",   schuleId: null, quelle: "seed" },

  // ---- Gesetzliche Feiertage Thüringen ----
  // Auch die, die auf ein Wochenende fallen: sie stören nicht, und wenn eine
  // Maßnahme je auf einen Samstag gelegt wird, greifen sie sofort.
  { id: "th-ft-2026-10-03", schuljahr: "2026/27", name: "Tag der Deutschen Einheit", von: "2026-10-03", bis: "2026-10-03", art: "feiertag", schuleId: null, quelle: "seed" },
  { id: "th-ft-2026-10-31", schuljahr: "2026/27", name: "Reformationstag",           von: "2026-10-31", bis: "2026-10-31", art: "feiertag", schuleId: null, quelle: "seed" },
  { id: "th-ft-2026-12-25", schuljahr: "2026/27", name: "1. Weihnachtstag",          von: "2026-12-25", bis: "2026-12-25", art: "feiertag", schuleId: null, quelle: "seed" },
  { id: "th-ft-2026-12-26", schuljahr: "2026/27", name: "2. Weihnachtstag",          von: "2026-12-26", bis: "2026-12-26", art: "feiertag", schuleId: null, quelle: "seed" },
  { id: "th-ft-2027-01-01", schuljahr: "2026/27", name: "Neujahr",                   von: "2027-01-01", bis: "2027-01-01", art: "feiertag", schuleId: null, quelle: "seed" },
  // Karfreitag und Ostermontag liegen 2027 VOR den Osterferien (Ostern ist am
  // 28.03., die Ferien beginnen erst am 30.03.) -- sie fallen also wirklich ins
  // Schuljahr und müssen einzeln stehen.
  { id: "th-ft-2027-03-26", schuljahr: "2026/27", name: "Karfreitag",                von: "2027-03-26", bis: "2027-03-26", art: "feiertag", schuleId: null, quelle: "seed" },
  { id: "th-ft-2027-03-29", schuljahr: "2026/27", name: "Ostermontag",               von: "2027-03-29", bis: "2027-03-29", art: "feiertag", schuleId: null, quelle: "seed" },
  { id: "th-ft-2027-05-01", schuljahr: "2026/27", name: "Tag der Arbeit",            von: "2027-05-01", bis: "2027-05-01", art: "feiertag", schuleId: null, quelle: "seed" },
  { id: "th-ft-2027-05-06", schuljahr: "2026/27", name: "Christi Himmelfahrt",       von: "2027-05-06", bis: "2027-05-06", art: "feiertag", schuleId: null, quelle: "seed" },
  { id: "th-ft-2027-05-17", schuljahr: "2026/27", name: "Pfingstmontag",             von: "2027-05-17", bis: "2027-05-17", art: "feiertag", schuleId: null, quelle: "seed" }
];

// Spielt den Startbestand ein. IDEMPOTENT per id: ergänzt nur, was fehlt, und
// überschreibt nie -- ein zweiter Lauf ist harmlos, eigene Korrekturen an den
// Terminen überleben ihn.
function spieleSeedEin(data) {
  let ergaenzt = 0;
  if (!Array.isArray(data.sperrtage)) data.sperrtage = [];
  const vorhanden = new Set(data.sperrtage.map((s) => s && s.id));
  SEED_SPERRTAGE.forEach((s) => {
    if (vorhanden.has(s.id)) return;
    data.sperrtage.push(Object.assign({}, s));
    ergaenzt++;
  });

  if (!Array.isArray(data.ausfallgruende)) data.ausfallgruende = [];
  const gVorhanden = new Set(data.ausfallgruende.map((g) => g && g.id));
  AUSFALLGRUENDE_STANDARD.forEach((g) => {
    if (gVorhanden.has(g.id)) return;
    data.ausfallgruende.push(Object.assign({}, g));
    ergaenzt++;
  });

  return ergaenzt;
}
