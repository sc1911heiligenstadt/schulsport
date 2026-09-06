// Schulsport-Planer -- Konstanten und Änderungsliste.
// APP_VERSION bleibt auf 1.0 und wird nicht gebumpt. Neue Funktionen kommen als
// zusätzlicher Block ÜBER dem bestehenden in APP_CHANGELOG.
const APP_VERSION = "1.0";

// ---------------------------------------------------------------------------
// Fachliche Konstanten
// ---------------------------------------------------------------------------

// Eine Maßnahme ist eine AG: sie läuft in der Schulzeit und lässt Ferien aus.
// Am 2026-08-25 auf Michels Entscheidung hin auf diesen einen Fall verengt --
// bis dahin gab es daneben den Typ "camp" mit täglichem Muster in den Ferien.
// Ferien-Camps laufen jetzt ausschließlich über die eigene App "fussballcamp".
const MASSNAHME_MUSTER = "woechentlich";
const MASSNAHME_FERIEN_AUSLASSEN = true;

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
// eine AG an diesem Tag stattfindet.
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

// ⚠️ 0, nicht 700 (geändert 05.09.2026). Hier gibt es nichts zu entprellen:
// alle dreizehn `markDirty()`-Stellen hängen an diskreten Klicks („Maßnahme
// speichern", „Schule löschen", „Abgleich anwenden", „Sperrtag hinzufügen") —
// keine einzige an einem Tastendruck. Der Timer verlängerte damit nur das
// Fenster, in dem eine Änderung schon gespeichert AUSSAH (Dialog zu, Liste neu
// gezeichnet) und nirgends lag.
//
// Gegen überlappende Saves schützt der In-Flight-Guard in `persistNow()`, nicht
// dieser Timer; mit 0 fasst `setTimeout` außerdem weiterhin alles zusammen, was
// in einem Rutsch anfällt.
const SPEICHER_DEBOUNCE_MS = 0;

// ⚠️ Die Ablaufzeit des Nachweis-Freigabelinks steht NICHT hier, sondern im
// Gateway: SCHULSPORT_FREIGABE_TAGE in ToolsUebersicht/admin-worker.js. Nur der
// Worker setzt gueltigBis und prüft es auch — der Client hat auf die Frist
// keinen Einfluss.
//
// Bis 2026-09-04 stand an dieser Stelle ein zweites `FREIGABE_TAGE_GUELTIG = 30`
// samt der Begründung „30 Tage, weil eine Schulsekretärin über die Ferien nicht
// im Haus ist". Es wurde in einstellungen.freigabeTageGueltig mitgespeichert und
// sah damit aus wie eine wirksame Einstellung — gelesen hat es nie jemand, weder
// hier noch im Worker. Wer die Frist ändern will, ändert sie im Worker; die
// Begründung steht dort jetzt daneben. Gefunden in der Bugjagd vom 04.09.2026.

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
    version: "1.6",
    groups: [
      {
        title: "Die Wochenansicht wechselt auch auf älteren iPhones beim Drehen mit",
        items: [
          "Unter 768 Pixel Breite zeigt die Wochenansicht eine Tagesliste, darüber das Raster. Der Wechsel dazwischen hing an einem Ereignis, das erst iOS 14 kennt — auf älteren Geräten passierte beim Drehen des Handys ersatzlos nichts, die Tagesliste blieb im Querformat stehen.",
          "Der Wechsel hängt jetzt am Größenwechsel des Fensters, den jedes Gerät meldet. Neu gezeichnet wird nur, wenn die 768-Pixel-Grenze wirklich überschritten wird — das Ein- und Ausblenden der Adressleiste löst kein Neuzeichnen aus."
        ]
      }
    ]
  },
  {
    version: "1.5",
    groups: [
      {
        title: "Die Durchführungsquote rechnet jetzt alle geplanten Einheiten mit",
        items: [
          "In den Zahlen zur Übersicht zählten nur durchgeführte und ausgefallene Einheiten. Termine, zu denen noch gar keine Meldung vorliegt, und solche, die ein Übungsleiter ausdrücklich als verschoben gemeldet hat, fielen ganz heraus. 20 geplante Einheiten, davon 10 durchgeführt und 10 nie gemeldet, ergaben so 100 %.",
          "Der Nenner ist jetzt die Zahl der geplanten Einheiten, und die Kachel sagt das auch. Daneben stehen zwei neue Kacheln: „noch nicht gemeldet“ und „verschoben“ — damit die Prozentzahl nicht allein dasteht.",
          "Am Nachweis und am PDF ändert sich nichts; dort war die Aufteilung schon immer vollständig."
        ]
      }
    ]
  },
  {
    version: "1.4",
    groups: [
      {
        title: "Eine gerade angelegte Maßnahme geht beim Schließen nicht mehr verloren",
        items: [
          "Nach einer Änderung wartete der Planer erst 0,7 Sekunden, bevor er überhaupt zu speichern anfing — der Dialog war da längst zu und die Maßnahme stand in der Liste. Wer in dieser Zeit den Reiter schloss oder zurück in die Tools-Übersicht klickte, verlor sie, ohne dass irgendetwas darauf hingewiesen hätte.",
          "Gespeichert wird jetzt sofort. Und beim Verlassen der Seite geht der letzte Stand auf einem Weg raus, den das Schließen des Browserfensters nicht mehr abbricht — so, wie es die übrigen Vereins-Tools schon halten.",
          "Trägt dieser Weg einmal nicht, fragt der Browser vor dem Schließen nach, statt die Änderung stillschweigend fallen zu lassen."
        ]
      }
    ]
  },
  {
    version: "1.3",
    groups: [
      {
        title: "Nachweis und Archivieren warten jetzt wirklich, bis gespeichert ist",
        items: [
          "Vor dem Ausstellen eines Nachweises und vor dem Archivieren eines Schuljahres schreibt der Planer den letzten Stand weg — der Server baut den Nachweis aus der Datei, nicht aus dem Bildschirm. Gewartet hat er auf dieses Speichern aber nicht: es lief nebenher weiter.",
          "Wer eine Teilnehmerzahl korrigiert und gleich danach den Nachweis ausstellt, konnte deshalb die alte Zahl einfrieren — und ein ausgestellter Nachweis lässt sich nicht nachrechnen. Beim Archivieren konnte der nachlaufende Speichervorgang die Verschiebung wieder rückgängig machen.",
          "Beides passiert jetzt in der richtigen Reihenfolge, auch wenn gerade noch ein anderer Speichervorgang läuft."
        ]
      }
    ]
  },
  {
    version: "1.2",
    groups: [
      {
        title: "Abgelaufener Bestätigungslink: „Verlängern“ ist jetzt anklickbar",
        items: [
          "Meldet sich eine Schule nicht rechtzeitig, lässt sich die Laufzeit ihres Bestätigungslinks um 30 Tage verlängern. Der Server konnte das schon immer, es gab dafür aber keinen Knopf — der einzige Ausweg war „Neu ausstellen“, und das friert die Zahlen neu ein: Sind seither Termine gemeldet oder geändert worden, bestätigt die Schule andere Zahlen als die, die ihr vorgelegt wurden.",
          "Beide Rückfragen sagen jetzt ausdrücklich, was der Unterschied ist."
        ]
      }
    ]
  },
  {
    version: "1.1",
    groups: [
      {
        title: "Der Planer ist beim Öffnen schneller da",
        items: [
          "Die Liste der Übungsleiter für das Team-Feld wurde bisher erst geholt, nachdem der Wochenplan geladen war — ein Roundtrip, auf den jeder vor dem ersten Bild wartete. Jetzt laufen beide Abfragen gemeinsam los."
        ]
      }
    ]
  },
  {
    version: "1.0",
    groups: [
      {
        title: "Wochenplan für Schul-AGs",
        items: [
          "Der Planer ist allein für die AGs an Schulen und im Hort da.",
          "Jede AG wird einmal als Serie angelegt — Schule, Ort, Wochentag, Uhrzeit und Zeitraum. Daraus entstehen alle einzelnen Termine des Schuljahres von selbst.",
          "Ferien, Feiertage und Schließtage sind hinterlegt: AG-Termine fallen dort automatisch weg.",
          "Der Wochenplan zeigt Montag bis Freitag nebeneinander, jede Schule in ihrer eigenen Farbe. Samstag und Sonntag erscheinen nur, wenn dort wirklich etwas stattfindet.",
          "Am Computer steht der Tagesverlauf als Zeitraster: die Uhrzeiten untereinander an der linken Seite, jeder Termin an der Stelle, an der er wirklich stattfindet. Alle Wochentage beginnen auf gleicher Höhe, auch wenn bei einzelnen Tagen zusätzlich Ferien vermerkt sind.",
          "Vor- und Nachbereitungszeiten sind am Termin sichtbar, damit klar ist, ab wann jemand vor Ort sein muss. Zusätzliche Arbeitszeiten lassen sich an jedem beliebigen Tag eintragen.",
          "Verschiebt sich eine AG mitten im Schuljahr, wird nur ab einem gewählten Stichtag neu geplant. Was bereits stattgefunden hat und was schon gemeldet wurde, bleibt unangetastet."
        ]
      },
      {
        title: "Melden nach der Einheit",
        items: [
          "Nach jeder AG wird gemeldet, ob sie stattgefunden hat und wie viele Kinder da waren.",
          "Fällt sie aus, wird der Grund aus einer Liste gewählt. Die Liste trennt, was dem Verein zur Last fällt, von allem anderen — genau die Unterscheidung, nach der eine Behörde fragt.",
          "Der Reiter „Melden“ zeigt oben, wie viele eigene Termine noch auf eine Meldung warten."
        ]
      },
      {
        title: "Nachweis über durchgeführte Stunden",
        items: [
          "Aus den Meldungen entsteht auf Knopfdruck ein Durchführungsnachweis als PDF: Schule, Ort, Ansprechpartner, jeder einzelne Termin mit Datum und Teilnehmerzahl, dazu die Summen und die geleisteten Stunden.",
          "Eine Sammelübersicht fasst alle Maßnahmen eines Zeitraums auf einem Blatt zusammen.",
          "Die Schule kann den Nachweis digital bestätigen: Sie bekommt einen Link, sieht dort die Aufstellung und unterschreibt direkt am Bildschirm. Ein Zugang zu den Vereins-Tools ist dafür nicht nötig.",
          "Bestätigte Nachweise sind eingefroren. Wird später eine Teilnehmerzahl korrigiert, ändert sich das bereits unterschriebene Dokument nicht mehr.",
          "Stimmt etwas nicht, kann die Schule statt zu unterschreiben eine Rückfrage stellen — sie landet direkt in der Übersicht der Leitung."
        ]
      },
      {
        title: "Verwaltung",
        items: [
          "Schulen und Orte pflegen; jede Schule bekommt ihre eigene Farbe im Wochenplan.",
          "Ferien, Feiertage und Schließtage hinterlegen — daraus ergibt sich, welche Termine ausfallen.",
          "Die Liste der Ausfallgründe lässt sich erweitern.",
          "Ein abgeschlossenes Schuljahr wandert ins Archiv, damit die laufende Datei klein und schnell bleibt."
        ]
      },
      {
        title: "Wer darf was",
        items: [
          "Sehen: Wochenplan, Maßnahmen und Kennzahlen — für alle, die mit den Schul-AGs zu tun haben.",
          "Melden: Wer als Übungsleiter für eine AG eingeteilt ist, meldet deren Termine. Fremde Maßnahmen sind nicht nur ausgeblendet, sondern serverseitig gesperrt — ein Nachweis soll sich nicht von anderer Seite ändern lassen.",
          "Bearbeiten: Maßnahmen anlegen und ändern, Termine neu erzeugen, Nachweise erstellen und den Bestätigungslink vergeben. Das ist Sache der Leitung und der Geschäftsstelle.",
          "Administrieren: Schulen, Orte, Ferienzeiten, Ausfallgründe und der Abschluss eines Schuljahres im Reiter „Verwaltung“.",
          "Der Reiter „Info“ steht jedem angemeldeten Nutzer offen.",
          "Fällt die Anmeldung weg, während die App offen ist, räumt sie den Bildschirm samt der vier Dialoge daneben und dem eigenen Namen oben rechts, statt AGs, Termine und Nachweise im Hintergrund lesbar zu lassen."
        ]
      },
      {
        title: "Bedienung am Handy",
        items: [
          "Am Handy wird aus dem Wochenraster eine Tagesliste — ein Raster mit fünf Spalten ist auf einem kleinen Bildschirm nicht lesbar.",
          "Melden geht in drei Griffen: Zahl eintippen, Status wählen, fertig.",
          "Zu jedem Termin stehen Ort, Zugang und die Ausstattung vor Ort — dazu, was aus dem Vereinsheim mitzunehmen ist. Damit kommt auch eine Vertretung zurecht."
        ]
      },
      {
        title: "Daten und Speicherung",
        items: [
          "Gespeichert wird in der Vereins-Nextcloud über die zentrale Anmeldung der Tools-Übersicht — ein eigenes Passwort braucht es nicht.",
          "Von den teilnehmenden Kindern wird ausschließlich die Anzahl erfasst. Namen von Schülerinnen und Schülern werden in diesem Werkzeug bewusst nicht gespeichert.",
          "Von der bestätigenden Person an der Schule werden Name, Funktion, Unterschrift und Zeitpunkt festgehalten — als Nachweis der erbrachten Leistung.",
          "Ein Bestätigungslink läuft nach 30 Tagen ab und kann jederzeit zurückgezogen oder neu ausgestellt werden.",
          "Abgeschlossene Schuljahre wandern in ein Archiv. Ausgestellte Nachweise bleiben dabei erhalten."
        ]
      }
    ]
  }
];
