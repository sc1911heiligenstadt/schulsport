# 🏫 Schulsport

Wochenplan und Nachweis der Sport- und Fußball-AGs an Schulen und im Hort: Eine AG wird einmal als Serie angelegt, die Termine des Schuljahres entstehen daraus von selbst und lassen Ferien automatisch aus. Nach jeder Einheit meldet der Übungsleiter am Handy, ob sie stattgefunden hat und wie viele Kinder da waren — daraus entsteht auf Knopfdruck der Durchführungsnachweis als PDF, den die Schule über einen Link auch digital gegenzeichnen kann.

**➡️ [Schulsport öffnen](https://sc1911heiligenstadt.github.io/schulsport/)**

## Seiten

| Seite | Wofür |
|---|---|
| [Schulsport](https://sc1911heiligenstadt.github.io/schulsport/) (`index.html`) | Wochenplan, Melden, Maßnahmen, Nachweise — für alle mit Vereinskonto |
| [Nachweis bestätigen](https://sc1911heiligenstadt.github.io/schulsport/bestaetigung.html) (`bestaetigung.html`) | Die Schule bestätigt die Durchführung — über einen Link, **ohne Anmeldung** |

## Was drin ist

| Reiter | Wofür |
|---|---|
| **Woche** | Der Wochenplan aller AGs — am Rechner als Zeitraster, am Handy als Tagesliste |
| **Melden** | Nach einer Einheit melden, ob sie stattgefunden hat und wie viele Kinder da waren |
| **Maßnahmen** | Die AGs selbst — einmal als Serie angelegt, die Termine des Schuljahres entstehen daraus |
| **Nachweise** | Durchführungsnachweise erstellen, als PDF ausgeben und den Bestätigungslink vergeben |
| **Übersicht** | Kennzahlen und offene Meldungen |
| **Verwaltung** | Schulen, Orte, Ferien und Feiertage, Ausfallgründe, Schuljahr abschließen |
| **Info** | Was die App tut, die Änderungen und der Datenschutz-Hinweis |

## Wenn eine Einheit ausfällt

Der Grund kommt aus einer Auswahlliste, nicht aus einem Freitext. Die Liste
trennt, was dem Verein zur Last fällt (Übungsleiter verhindert), von allem
anderen (Schule zu, Ort belegt, Witterung, zu wenige Kinder) — genau die
Unterscheidung, nach der eine Behörde beim Nachweis fragt. Erweitern lässt sie
sich in der Verwaltung.

## Der Nachweis

Aus den Meldungen entsteht der Durchführungsnachweis als PDF: Schule, Ort,
Ansprechpartner, jeder einzelne Termin mit Datum und Teilnehmerzahl, dazu Summen
und geleistete Stunden. Eine Sammelübersicht fasst alle Maßnahmen eines Zeitraums
auf einem Blatt zusammen.

Die Schule bekommt einen Link und unterschreibt direkt am Bildschirm — ohne
Zugang zu den Vereins-Tools. Der Link läuft nach **30 Tagen** ab und lässt sich
jederzeit zurückziehen oder neu ausstellen. Ein bestätigter Nachweis ist
eingefroren: eine spätere Korrektur an einer Teilnehmerzahl ändert das
unterschriebene Dokument nicht mehr. Statt zu unterschreiben kann die Schule auch
eine Rückfrage stellen; sie landet in der Übersicht der Leitung.

## Datenschutz

Von den teilnehmenden Kindern wird **ausschließlich die Anzahl** erfasst — Namen
von Schülerinnen und Schülern speichert dieses Werkzeug bewusst nicht. Von der
bestätigenden Person an der Schule werden Name, Funktion, Unterschrift und
Zeitpunkt festgehalten, als Nachweis der erbrachten Leistung.

## Zugang

Die Anmeldung läuft über die [Tools-Übersicht](https://sc1911heiligenstadt.github.io/ToolsUebersicht/) — dort einmal anmelden, danach ist dieses Werkzeug offen. Die Bestätigungsseite der Schule braucht **keine Anmeldung**, sondern den Link.

Die Rechte gelten in vier Stufen:

- **Sehen** — Wochenplan, Maßnahmen und Kennzahlen.
- **Melden** — wer als Übungsleiter für eine AG eingeteilt ist, meldet deren Termine. Fremde Maßnahmen sind nicht nur ausgeblendet, sondern serverseitig gesperrt.
- **Bearbeiten** — Maßnahmen anlegen und ändern, Termine neu erzeugen, Nachweise erstellen, den Bestätigungslink vergeben.
- **Administrieren** — Reiter *Verwaltung*: Schulen, Orte, Ferienzeiten, Ausfallgründe, Schuljahr abschließen.

Wer welche Stufe hat, legt die Tools-Übersicht fest.

## Lokal starten

Über den Eintrag `schulsport` in `E:\.claude\launch.json` — der Server läuft dann auf `http://localhost:8812/`.

## Technik

| Datei | Zweck |
|---|---|
| `index.html` | sieben Reiter, vier Dialoge |
| `bestaetigung.html` | die Seite **ohne Anmeldung** für die Schule |
| `config.js` | Version, Status- und Grundlisten, Fristen, Changelog |
| `termine.js` | Termine aus einer Serie erzeugen, Ferien aussparen — ohne Oberfläche |
| `massnahmen.js` / `nachweise.js` | Maßnahmen- und Nachweis-Logik |
| `pdf.js` | Durchführungsnachweis und Sammelübersicht |
| `db.js` / `db-bestaetigung.js` | Gateway mit bzw. ohne Sitzungstoken |
| `bestaetigung.js` / `signature-pad.js` | die Bestätigungsseite und die Unterschrift |
| `seed.js` | Startbestand für eine leere Datei |
| `app.js` | Reiter, Wochenraster, Rechte, Speichern |
| `style.css` | Gestaltung beider Seiten |

Vanilla JavaScript ohne Build-Schritt — die Dateien werden so ausgeliefert, wie sie im Repo liegen. Veröffentlicht über GitHub Pages. Die PDF-Bibliotheken werden erst beim ersten Nachweis nachgeladen. Die Daten liegen in der Vereins-Nextcloud; der Zugriff läuft ausschließlich über den Login-Worker der Tools-Übersicht, nie mit Zugangsdaten im Browser. Abgeschlossene Schuljahre wandern in ein Archiv, damit die laufende Datei klein bleibt.

---

Ein Werkzeug des 1. SC 1911 Heiligenstadt. Alle Werkzeuge auf einen Blick: [Tools-Übersicht](https://sc1911heiligenstadt.github.io/ToolsUebersicht/) · Erklärungen im [Toolbox Wiki](https://sc1911heiligenstadt.github.io/Vereinswiki/).
