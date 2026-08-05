# Schulsport

Planung und Durchführungsnachweis der Sport- und Fußball-AGs, die der
1. SC 1911 Heiligenstadt an Schulen und im Hort anbietet, sowie der
Fußballcamps in den Ferien.

**Live:** https://sc1911heiligenstadt.github.io/schulsport/

## Was das Werkzeug leistet

- **Wochenplan** über alle Schulen: Montag bis Freitag nebeneinander, jede
  Schule in ihrer Farbe, Ferientage grau hinterlegt, Camps als durchgehendes
  Band. Am Handy wird daraus eine Tagesliste.
- **Serien statt Einzeltermine**: Eine AG wird einmal angelegt (Schule, Ort,
  Wochentag, Zeitraum), die Termine des Schuljahres entstehen daraus von selbst.
  Ferien und Feiertage fallen automatisch weg.
- **Rückmeldung durch die Übungsleiter**: Nach jeder Einheit werden Status und
  Teilnehmerzahl gemeldet — zwei Taps am Handy. Fällt etwas aus, wird der Grund
  aus einer Liste gewählt.
- **Durchführungsnachweis als PDF**: Kopfdaten, jeder einzelne Termin mit Datum
  und Teilnehmerzahl, Summen, Ausfälle nach Grund und die geleisteten Stunden.
  Dazu eine Sammelübersicht über alle Maßnahmen eines Zeitraums.
- **Digitale Bestätigung durch die Schule**: Sie erhält einen Link, sieht dort
  die Aufstellung und unterschreibt am Bildschirm. Ein Zugang zu den
  Vereins-Tools ist dafür nicht nötig.

## Datenschutz

Von den teilnehmenden Kindern wird ausschließlich die **Anzahl** je Termin
erfasst. Namen von Schülerinnen und Schülern werden in diesem Werkzeug nicht
gespeichert.

## Technik

Vanilla JavaScript ohne Build-Schritt. Anmeldung und Speicherung laufen über die
zentrale Tools-Übersicht des Vereins; die Daten liegen in der Vereins-Nextcloud.

Lokaler Entwicklungsserver: Port 8812 (Eintrag `schulsport` in
`E:\.claude\launch.json`).
