// Schulsport-Planer -- Konstanten und Änderungsliste.
// APP_VERSION bleibt auf 1.0 und wird nicht gebumpt. Neue Funktionen kommen als
// zusätzlicher Block ÜBER dem bestehenden in APP_CHANGELOG.
const APP_VERSION = "1.0";

// ---------------------------------------------------------------------------
// Fachliche Konstanten
// ---------------------------------------------------------------------------

// Eine Maßnahme ist entweder eine AG (läuft in der Schulzeit, lässt Ferien aus)
// oder ein Camp (liegt bewusst IN den Ferien). Gleicher Datentyp, anderes Muster.
const MASSNAHME_TYPEN = [
  { id: "ag",   name: "AG",   ferienAuslassen: true,  muster: "woechentlich" },
  { id: "camp", name: "Camp", ferienAuslassen: false, muster: "taeglich" }
];

const RAHMEN_ARTEN = [
  { id: "schulzeit", name: "Schulzeit" },
  { id: "hortzeit",  name: "Hortzeit" },
  { id: "ganztag",   name: "Ganztagsangebot" }
];

// Status eines einzelnen Termins. "offen" heißt: noch nicht gemeldet.
const TERMIN_STATUS = [
  { id: "offen",         name: "Offen",         farbe: "#9aa5b1", gemeldet: false },
  { id: "durchgefuehrt", name: "Durchgeführt",  farbe: "#2e9e5b", gemeldet: true },
  { id: "ausgefallen",   name: "Ausgefallen",   farbe: "#c0392b", gemeldet: true },
  { id: "verschoben",    name: "Verschoben",    farbe: "#d68910", gemeldet: true }
];

// Ferien, Feiertage und schulspezifische Schließtage. Die Art entscheidet, ob
// eine AG oder ein Camp an diesem Tag stattfindet.
const SPERRTAG_ARTEN = [
  { id: "ferien",      name: "Ferien" },
  { id: "feiertag",    name: "Feiertag" },
  { id: "schliesstag", name: "Schließtag" }
];

const ORT_ARTEN = [
  { id: "halle",         name: "Turnhalle" },
  { id: "aussenflaeche", name: "Sportplatz / Außenfläche" },
  { id: "raum",          name: "Raum" },
  { id: "sonstiges",     name: "Sonstiges" }
];

// Ausfallgründe sind eine Auswahlliste, damit der Nachweis sie aufschlüsseln kann
// statt sie nur zu zählen. "vereinsverschulden" trennt, was dem Verein zur Last
// fällt -- genau die Unterscheidung, nach der eine Behörde fragt.
// Die Liste ist im Administrieren-Tab erweiterbar; das hier ist der Startbestand.
const AUSFALLGRUENDE_STANDARD = [
  { id: "schule-zu",       bezeichnung: "Schule geschlossen",           vereinsverschulden: false },
  { id: "ferientag",       bezeichnung: "Beweglicher Ferientag",        vereinsverschulden: false },
  { id: "ort-belegt",      bezeichnung: "Ort nicht verfügbar",          vereinsverschulden: false },
  { id: "wetter",          bezeichnung: "Witterung",                    vereinsverschulden: false },
  { id: "zu-wenig-kinder", bezeichnung: "Zu wenige Kinder",             vereinsverschulden: false },
  { id: "ul-verhindert",   bezeichnung: "Übungsleiter verhindert",      vereinsverschulden: true },
  { id: "sonstiges",       bezeichnung: "Sonstiges",                    vereinsverschulden: false }
];

const WOCHENTAGE = [
  { nr: 1, kurz: "Mo", name: "Montag" },
  { nr: 2, kurz: "Di", name: "Dienstag" },
  { nr: 3, kurz: "Mi", name: "Mittwoch" },
  { nr: 4, kurz: "Do", name: "Donnerstag" },
  { nr: 5, kurz: "Fr", name: "Freitag" },
  { nr: 6, kurz: "Sa", name: "Samstag" },
  { nr: 0, kurz: "So", name: "Sonntag" }
];

// Farbvorrat für neue Schulen. Die Farbe trägt den Block im Wochenraster.
const SCHUL_FARBEN = [
  "#1a56a0", "#2e9e5b", "#c0392b", "#7d3c98",
  "#d68910", "#117a8b", "#a04000", "#4a5568"
];

// ---------------------------------------------------------------------------
// Anzeige und Verhalten
// ---------------------------------------------------------------------------

const RASTER_START_FALLBACK = "07:00";   // nur für Wochen ohne jeden Termin
const RASTER_ENDE_FALLBACK  = "17:00";
const RASTER_RAND_MIN       = 30;        // Luft ober- und unterhalb der Blöcke
const MOBIL_BREITE          = 768;       // darunter Tagesliste statt Raster

const STANDARD_VOR_MIN  = 15;
const STANDARD_NACH_MIN = 15;

const SPEICHER_DEBOUNCE_MS = 700;

// Ein Nachweis-Freigabelink läuft nach dieser Zeit ab. 30 Tage, weil eine
// Schulsekretärin über die Ferien nicht im Haus ist.
const FREIGABE_TAGE_GUELTIG = 30;

// Basis für den Bestätigungslink. Lokal wird gegen einen Stub getestet, live
// zeigt er auf die GitHub-Pages-Adresse dieser App.
const FREIGABE_BASIS_URL = "https://sc1911heiligenstadt.github.io/schulsport/bestaetigung.html";

// PDF-Bibliotheken werden erst bei Bedarf nachgeladen (zusammen rund 400 KB).
// ⚠️ Reihenfolge ist Pflicht: autoTable hängt sich an jsPDF an.
const PDF_CDN_JSPDF     = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
const PDF_CDN_AUTOTABLE = "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js";

// Das Schuljahr beginnt im August. Bestimmt die Vorbelegung und die Archivierung.
const SCHULJAHR_BEGINN_MONAT = 8;

// ---------------------------------------------------------------------------
// Änderungsliste
// ---------------------------------------------------------------------------

const APP_CHANGELOG = [
  {
    version: "1.2",
    groups: [
      {
        title: "Der richtige Vereinsname",
        items: [
          "Im Kopf der PDFs stand „1. SC 1911 e.V. Heilbad Heiligenstadt“. Richtig ist „1. SC 1911 Heiligenstadt e.V.“ — neue PDFs tragen den richtigen Namen. Schon verschickte PDFs ändern sich nicht."
        ]
      }
    ]
  },
  {
    version: "1.1",
    groups: [
      {
        title: "Am Handy",
        items: [
          "Bisher brach die Reiterleiste selbst um, die rechte Reiter-Gruppe darin aber nicht: Sie rutschte als ein Stück in die zweite Zeile und lief dort weiter über den rechten Rand hinaus. Jetzt bricht auch sie um, sobald sie zu breit wird. Zu sehen ist das nur, wenn genug Reiter nebeneinanderstehen — bis dahin sieht alles aus wie bisher."
        ]
      }
    ]
  },
  {
    version: "1.0",
    groups: [
      {
        title: "Der Reiter „Administrieren“ heißt jetzt „Verwaltung“",
        items: [
          "Nur der Name hat sich geändert — Inhalt, Zugang und Rechte sind dieselben. In den anderen Vereins-Tools heißt der rechte Reiter „Verwaltung“ oder „Einstellungen“; dieser hier war der einzige mit einem dritten Namen."
        ]
      },
      {
        title: "Wochenplan für Schul-AGs und Ferien-Camps",
        items: [
          "Jede AG wird einmal als Serie angelegt — Schule, Ort, Wochentag, Uhrzeit und Zeitraum. Daraus entstehen alle einzelnen Termine des Schuljahres von selbst.",
          "Ferien, Feiertage und Schließtage sind hinterlegt: AG-Termine fallen dort automatisch weg, Ferien-Camps liegen genau darin.",
          "Der Wochenplan zeigt Montag bis Freitag nebeneinander, jede Schule in ihrer eigenen Farbe. Samstag und Sonntag erscheinen nur, wenn dort wirklich etwas stattfindet.",
          "Am Computer steht der Tagesverlauf als Zeitraster: die Uhrzeiten untereinander an der linken Seite, jeder Termin an der Stelle, an der er wirklich stattfindet. Alle Wochentage beginnen auf gleicher Höhe, auch wenn bei einzelnen Tagen zusätzlich Ferien vermerkt sind.",
          "Vor- und Nachbereitungszeiten sind am Termin sichtbar, damit klar ist, ab wann jemand vor Ort sein muss. Zusätzliche Arbeitszeiten lassen sich an jedem beliebigen Tag eintragen.",
          "Verschiebt sich eine AG mitten im Schuljahr, wird nur ab einem gewählten Stichtag neu geplant. Was bereits stattgefunden hat und was schon gemeldet wurde, bleibt unangetastet."
        ]
      },
      {
        title: "Nachweis über durchgeführte Stunden",
        items: [
          "Nach jeder AG wird gemeldet, ob sie stattgefunden hat und wie viele Kinder da waren. Fällt sie aus, wird der Grund aus einer Liste gewählt — so steht später im Nachweis, warum ein Termin ausgefallen ist.",
          "Aus diesen Meldungen entsteht auf Knopfdruck ein Durchführungsnachweis als PDF: Schule, Ort, Ansprechpartner, jeder einzelne Termin mit Datum und Teilnehmerzahl, dazu die Summen und die geleisteten Stunden.",
          "Eine Sammelübersicht fasst alle Maßnahmen eines Zeitraums auf einem Blatt zusammen.",
          "Die Schule kann den Nachweis digital bestätigen: Sie bekommt einen Link, sieht dort die Aufstellung und unterschreibt direkt am Bildschirm. Ein Zugang zu den Vereins-Tools ist dafür nicht nötig.",
          "Bestätigte Nachweise sind eingefroren. Wird später eine Teilnehmerzahl korrigiert, ändert sich das bereits unterschriebene Dokument nicht mehr.",
          "Stimmt etwas nicht, kann die Schule statt zu unterschreiben eine Rückfrage stellen — sie landet direkt in der Übersicht der Leitung."
        ]
      },
      {
        title: "Wer darf was",
        items: [
          "Sehen: Wochenplan, Maßnahmen und Kennzahlen — für alle, die mit den Schul-AGs zu tun haben.",
          "Melden: Wer als Übungsleiter für eine AG eingeteilt ist, meldet deren Termine. Fremde Maßnahmen sind nicht nur ausgeblendet, sondern serverseitig gesperrt — ein Nachweis soll sich nicht von anderer Seite ändern lassen.",
          "Bearbeiten: Schulen, Orte, Maßnahmen und Nachweise pflegen. Das ist Sache der Leitung und der Geschäftsstelle.",
          "Administrieren: Ferienzeiten, Ausfallgründe und der Abschluss eines Schuljahres."
        ]
      },
      {
        title: "Bedienung am Handy",
        items: [
          "Am Handy wird aus dem Wochenraster eine Tagesliste — ein Raster mit fünf Spalten ist auf einem kleinen Bildschirm nicht lesbar.",
          "Der Reiter „Melden“ zeigt oben, wie viele eigene Termine noch auf eine Meldung warten. Zahl eintippen, Status wählen, fertig.",
          "Zu jedem Termin stehen Ort, Zugang und die Ausstattung vor Ort — dazu, was aus dem Vereinsheim mitzunehmen ist. Damit kommt auch eine Vertretung zurecht."
        ]
      },
      {
        title: "Daten & Speicherung",
        items: [
          "Gespeichert wird in der Vereins-Nextcloud über die zentrale Anmeldung der Tools-Übersicht — ein eigenes Passwort braucht es nicht.",
          "Von den teilnehmenden Kindern wird ausschließlich die Anzahl erfasst. Namen von Schülerinnen und Schülern werden in diesem Werkzeug bewusst nicht gespeichert.",
          "Von der bestätigenden Person an der Schule werden Name, Funktion, Unterschrift und Zeitpunkt festgehalten — als Nachweis der erbrachten Leistung.",
          "Ein Bestätigungslink läuft nach 30 Tagen ab und kann jederzeit zurückgezogen oder neu ausgestellt werden.",
          "Abgeschlossene Schuljahre wandern in ein Archiv, damit die laufende Datei klein und schnell bleibt. Ausgestellte Nachweise bleiben dabei erhalten."
        ]
      }
    ]
  }
];
