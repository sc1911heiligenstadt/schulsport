# 🏫 Schulsport

Wochenplan und Nachweis der Sport- und Fußball-AGs an Schulen und im Hort: Eine AG wird einmal als Serie angelegt, die Termine des Schuljahres entstehen daraus von selbst und lassen Ferien automatisch aus. Nach jeder Einheit meldet der Übungsleiter am Handy, ob sie stattgefunden hat und wie viele Kinder da waren — daraus entsteht auf Knopfdruck der Durchführungsnachweis als PDF, den die Schule über einen Link auch digital gegenzeichnen kann.

**➡️ [Schulsport öffnen](https://sc1911heiligenstadt.github.io/schulsport/)**

## Seiten

| Seite | Wofür |
|---|---|
| [Schulsport](https://sc1911heiligenstadt.github.io/schulsport/) | Wochenplan und Nachweis der Sport- und Fußball-AGs an Schulen und im Hort. Eine AG wird einmal als Serie angelegt, die Termine des Schuljahres entstehen daraus von selbst und lassen Ferien automatisch aus. |
| [Nachweis bestätigen](https://sc1911heiligenstadt.github.io/schulsport/bestaetigung.html) | Die Schule bestätigt die Durchführung — über einen Link, ohne Anmeldung |

## Was drin ist

| Reiter | Wofür |
|---|---|
| **Woche** | Der Wochenplan aller AGs |
| **Melden** | Nach einer Einheit melden, ob sie stattgefunden hat und wie viele Kinder da waren |
| **Maßnahmen** | Die AGs selbst — einmal als Serie angelegt, die Termine des Schuljahres entstehen daraus |
| **Nachweise** | Die ausgestellten Durchführungsnachweise |
| **Übersicht** | Kennzahlen und offene Meldungen |
| **Administrieren** | AGs anlegen, Termine neu erzeugen, Nachweise erstellen, Bestätigungslink vergeben |

## Ferien-Camps laufen nicht mehr hier

Der Planer ist allein für die **AGs an Schulen und im Hort** da. Ferien-Camps
haben seit dem 25.08.2026 ihr eigenes Werkzeug:
[Fußballcamp](https://sc1911heiligenstadt.github.io/fussballcamp/). Die Auswahl
„Art“, der Knopf „+ Neues Camp“, der Filter „AGs und Camps“ und das Camp-Band
über dem Zeitraster sind hier entfallen.

## Zugang

Die Anmeldung läuft über die [Tools-Übersicht](https://sc1911heiligenstadt.github.io/ToolsUebersicht/) — dort einmal anmelden, danach ist dieses Werkzeug offen.

Die Rechte gelten in drei Stufen: **Sehen** (Wochenplan, AGs und ausgestellte Nachweise ansehen), **Bearbeiten** (nach einer Einheit melden, ob sie stattgefunden hat und wie viele Kinder da waren) und **Administrieren** (Reiter *Administrieren*: AGs als Serie anlegen, Termine neu erzeugen, Durchführungsnachweise erstellen und den Bestätigungslink an die Schule geben). Wer welche Stufe hat, legt die Tools-Übersicht fest.

## Lokal starten

Über den Eintrag `schulsport` in `E:\.claude\launch.json` — der Server läuft dann auf `http://localhost:8812/`.

## Technik

Vanilla JavaScript ohne Build-Schritt — die Dateien werden so ausgeliefert, wie sie im Repo liegen. Veröffentlicht über GitHub Pages. Die Daten liegen in der Vereins-Nextcloud; der Zugriff läuft ausschließlich über den Login-Worker der Tools-Übersicht, nie mit Zugangsdaten im Browser.

---

Ein Werkzeug des 1. SC 1911 Heiligenstadt. Alle Werkzeuge auf einen Blick: [Tools-Übersicht](https://sc1911heiligenstadt.github.io/ToolsUebersicht/) · Erklärungen im [Toolbox Wiki](https://sc1911heiligenstadt.github.io/Vereinswiki/).
