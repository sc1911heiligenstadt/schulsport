// PDF-Erzeugung. jsPDF und autoTable werden erst bei Bedarf nachgeladen --
// zusammen sind es rund 400 KB, die niemand beim Seitenaufbau braucht.
// Aufbau übernommen aus E:\platzbelegung\app.js (ladePdfBibliotheken).

const _pdfBibliotheken = {};

function ladeBibliothek(url) {
  if (_pdfBibliotheken[url]) return _pdfBibliotheken[url];
  _pdfBibliotheken[url] = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = url;
    s.onload = () => resolve();
    s.onerror = () => { delete _pdfBibliotheken[url]; reject(new Error("Bibliothek nicht erreichbar: " + url)); };
    document.head.appendChild(s);
  });
  return _pdfBibliotheken[url];
}

// ⚠️ Die Reihenfolge ist Pflicht, kein Promise.all: autoTable hängt sich an
// jsPDF an und findet es sonst nicht.
async function ladePdfBibliotheken() {
  await ladeBibliothek(PDF_CDN_JSPDF);
  await ladeBibliothek(PDF_CDN_AUTOTABLE);
  if (!window.jspdf || typeof window.jspdf.jsPDF !== "function") {
    throw new Error("jsPDF wurde geladen, steht aber nicht bereit.");
  }
  const probe = new window.jspdf.jsPDF();
  if (typeof probe.autoTable !== "function") {
    throw new Error("Die Tabellen-Erweiterung wurde nicht angehängt.");
  }
}

function pdfDateiname(teile) {
  const roh = teile.filter(Boolean).join("_");
  return roh.replace(/[^A-Za-z0-9ÄÖÜäöüß_\-]+/g, "_").replace(/_+/g, "_").slice(0, 120) + ".pdf";
}

// Wandelt einen Blob in base64 (ohne den data:-Kopf).
// ⚠️ Über FileReader, nicht über btoa(String.fromCharCode(...bytes)) -- der
// Spread sprengt bei einigen hundert KB den Aufruf-Stack.
function blobZuBase64(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const s = String(fr.result || "");
      const komma = s.indexOf(",");
      resolve(komma >= 0 ? s.slice(komma + 1) : "");
    };
    fr.onerror = () => reject(new Error("Datei konnte nicht gelesen werden"));
    fr.readAsDataURL(blob);
  });
}

// ⚠️ Das Fenster SYNCHRON vor jedem await öffnen -- iOS-Safari blockt einen
// window.open-Aufruf, der nach einer asynchronen Pause kommt, stillschweigend.
function oeffneBlob(doc, name) {
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 20000);
}

function pdfKopf(doc, titel, untertitel) {
  doc.setFontSize(15);
  doc.setTextColor(26, 86, 160);
  doc.text(titel, 14, 18);
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text("1. SC 1911 Heiligenstadt e.V.", 14, 24);
  if (untertitel) doc.text(untertitel, 14, 29);
  doc.setTextColor(30, 35, 48);
  return untertitel ? 35 : 30;
}

function pdfFuss(doc) {
  const seiten = doc.internal.getNumberOfPages();
  for (let i = 1; i <= seiten; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text("Erstellt am " + new Date().toLocaleDateString("de-DE") + " mit dem Schulsport-Planer des 1. SC 1911 Heiligenstadt",
      14, doc.internal.pageSize.getHeight() - 8);
    doc.text("Seite " + i + " von " + seiten,
      doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 8, { align: "right" });
  }
  doc.setTextColor(30, 35, 48);
}

// ---------------------------------------------------------------------------
// Durchführungsnachweis je Maßnahme
// ---------------------------------------------------------------------------
// d = die Datenstruktur aus baueNachweisDaten() bzw. der eingefrorene Snapshot
// eines ausgestellten Vorgangs. vorgang = der Nachweis-Datensatz (optional).

// nurBlob: true → das Dokument wird nicht heruntergeladen, sondern als Blob
// zurückgegeben (für die Ablage eines bestätigten Nachweises in der Nextcloud).
async function erzeugeNachweisPdf(d, vorgang, knopf, nurBlob) {
  const alt = knopf ? knopf.textContent : "";
  if (knopf) { knopf.disabled = true; knopf.textContent = "PDF wird gebaut …"; }
  try {
    await ladePdfBibliotheken();
    const doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
    const s = d.summen || {};

    let y = pdfKopf(doc, "Durchführungsnachweis",
      d.massnahmeTitel + "  ·  " + fmtDatum(d.vonDatum) + " bis " + fmtDatum(d.bisDatum));

    // --- Kopfdaten ---
    const kopf = [
      ["Maßnahme", d.massnahmeTitel + (d.typ === "camp" ? "  (Ferien-Camp)" : "")],
      ["Rahmen", [d.rahmen, d.zielgruppe].filter(Boolean).join("  ·  ") || "—"],
      ["Schule", [d.schuleName, d.schuleAnschrift].filter(Boolean).join(", ") || "—"],
      ["Ansprechpartner", d.ansprechpartner
        ? [d.ansprechpartner.name, d.ansprechpartner.funktion, d.ansprechpartner.telefon, d.ansprechpartner.email].filter(Boolean).join("  ·  ")
        : "—"],
      ["Ort", d.ortName || "—"],
      ["Durchführung", [d.verantwortlichName].concat(d.teamNamen || []).filter(Boolean).join(", ") || "—"],
      ["Zeitraum", fmtDatum(d.vonDatum) + " bis " + fmtDatum(d.bisDatum)]
    ];
    doc.autoTable({
      startY: y,
      body: kopf,
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 1.6 },
      columnStyles: { 0: { cellWidth: 38, fontStyle: "bold" }, 1: { cellWidth: "auto" } }
    });
    y = doc.lastAutoTable.finalY + 6;

    // --- Termine ---
    doc.setFontSize(11);
    doc.setTextColor(26, 86, 160);
    doc.text("Einzelne Termine", 14, y);
    doc.setTextColor(30, 35, 48);
    y += 3;

    const zeilen = (d.zeilen || []).map((r) => [
      (r.wochentag || "").slice(0, 2) + ", " + fmtDatum(r.datum),
      r.startZeit + "–" + r.endZeit,
      r.statusName + (r.ausfallgrund ? "\n(" + r.ausfallgrund + ")" : ""),
      r.teilnehmerzahl === null || r.teilnehmerzahl === undefined ? "–" : String(r.teilnehmerzahl),
      r.durchgefuehrtVonName || ""
    ]);

    doc.autoTable({
      startY: y,
      head: [["Datum", "Uhrzeit", "Status", "Kinder", "Durchgeführt von"]],
      body: zeilen,
      theme: "striped",
      styles: { fontSize: 8.5, cellPadding: 1.8 },
      headStyles: { fillColor: [26, 86, 160], textColor: 255, fontSize: 8.5 },
      // Spaltenbreiten fest, damit die Statusspalte den längsten Ausfallgrund
      // einzeilig trägt und die Tabelle nicht je Seite anders aussieht.
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 24 },
        2: { cellWidth: 48 },
        3: { cellWidth: 18, halign: "right" },
        4: { cellWidth: "auto" }
      },
      didParseCell: (data) => {
        if (data.section !== "body") return;
        const r = (d.zeilen || [])[data.row.index];
        if (!r) return;
        if (r.status === "ausgefallen") data.cell.styles.textColor = [192, 57, 43];
        else if (r.status === "offen") data.cell.styles.textColor = [140, 140, 140];
      }
    });
    y = doc.lastAutoTable.finalY + 6;

    // --- Summen ---
    if (y > doc.internal.pageSize.getHeight() - 80) { doc.addPage(); y = 20; }
    doc.setFontSize(11);
    doc.setTextColor(26, 86, 160);
    doc.text("Zusammenfassung", 14, y);
    doc.setTextColor(30, 35, 48);
    y += 3;

    const summenZeilen = [
      ["Termine geplant", String(s.geplant || 0)],
      ["davon durchgeführt", String(s.durchgefuehrt || 0)],
      ["davon ausgefallen", String(s.ausgefallen || 0)],
      ["davon noch nicht gemeldet", String(s.offen || 0)],
      ["Teilnahmen gesamt", String(s.teilnahmen || 0)],
      ["Kinder im Schnitt je Einheit", String(s.schnitt || 0)],
      ["Zeit der Einheiten", stundenText(s.minutenAg || 0)],
      ["Vor- und Nachbereitung", stundenText((s.minutenVor || 0) + (s.minutenNach || 0))],
      ["Zeitaufwand gesamt", stundenText(s.minutenGesamt || 0)]
    ];
    doc.autoTable({
      startY: y,
      body: summenZeilen,
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 1.6 },
      columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 30, halign: "right", fontStyle: "bold" } }
    });
    y = doc.lastAutoTable.finalY + 5;

    if ((d.ausfaelle || []).length) {
      doc.autoTable({
        startY: y,
        head: [["Ausfälle nach Grund", "Zurechnung", "Anzahl"]],
        body: d.ausfaelle.map((a) => [a.bezeichnung, a.vereinsverschulden ? "beim Verein" : "nicht beim Verein", String(a.anzahl)]),
        theme: "grid",
        styles: { fontSize: 8.5, cellPadding: 1.6 },
        headStyles: { fillColor: [120, 120, 120], textColor: 255, fontSize: 8.5 },
        columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 45 }, 2: { cellWidth: 20, halign: "right" } }
      });
      y = doc.lastAutoTable.finalY + 5;
    }

    if (s.offen) {
      doc.setFontSize(8.5);
      doc.setTextColor(192, 57, 43);
      doc.text("Hinweis: " + s.offen + " Termine sind noch nicht zurückgemeldet und daher ohne Teilnehmerzahl ausgewiesen.", 14, y);
      doc.setTextColor(30, 35, 48);
      y += 6;
    }

    // --- Bestätigung ---
    if (y > doc.internal.pageSize.getHeight() - 60) { doc.addPage(); y = 20; }
    y += 6;
    doc.setFontSize(9);

    if (vorgang && vorgang.bestaetigung) {
      const b = vorgang.bestaetigung;
      doc.setTextColor(45, 140, 78);
      doc.text("Von der Schule bestätigt am " + fmtZeitstempel(b.bestaetigtAm), 14, y);
      doc.setTextColor(30, 35, 48);
      y += 6;
      if (b.unterschriftDataUrl && /^data:image\//.test(b.unterschriftDataUrl)) {
        try {
          const art = b.unterschriftDataUrl.indexOf("image/jpeg") !== -1 ? "JPEG" : "PNG";
          doc.addImage(b.unterschriftDataUrl, art, 14, y, 60, 20);
        } catch (_) {}
        y += 22;
      }
      doc.line(14, y, 84, y);
      y += 4;
      doc.text(b.name + (b.funktion ? ", " + b.funktion : ""), 14, y);
    } else {
      // Leere Zeilen zum Ausdrucken und Gegenzeichnen -- funktioniert auch dann,
      // wenn die digitale Bestätigung nicht genutzt wurde.
      doc.text("Ort, Datum: ______________________________", 14, y);
      y += 18;
      doc.line(14, y, 84, y);
      doc.line(110, y, 180, y);
      y += 4;
      doc.setFontSize(8);
      doc.setTextColor(90, 90, 90);
      doc.text("Übungsleiter / Verein", 14, y);
      doc.text("Schule / Einrichtung", 110, y);
      doc.setTextColor(30, 35, 48);
    }

    pdfFuss(doc);
    if (nurBlob) return doc.output("blob");
    oeffneBlob(doc, pdfDateiname(["Durchfuehrungsnachweis", d.massnahmeTitel, d.vonDatum, d.bisDatum]));
    return null;
  } catch (e) {
    if (nurBlob) throw e;
    alert("Das PDF konnte nicht erzeugt werden: " + e.message +
      "\n\nDie PDF-Bibliothek wird bei Bedarf aus dem Netz geladen — ohne Verbindung geht es nicht.");
    return null;
  } finally {
    if (knopf) { knopf.disabled = false; knopf.textContent = alt; }
  }
}

// ---------------------------------------------------------------------------
// Sammelübersicht über alle Maßnahmen eines Zeitraums
// ---------------------------------------------------------------------------

async function erzeugeSammelPdf(vonIso, bisIso, knopf) {
  const alt = knopf ? knopf.textContent : "";
  if (knopf) { knopf.disabled = true; knopf.textContent = "PDF wird gebaut …"; }
  try {
    await ladePdfBibliotheken();
    const doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });

    let y = pdfKopf(doc, "Schulsport — Sammelübersicht",
      "Zeitraum " + fmtDatum(vonIso) + " bis " + fmtDatum(bisIso));

    const termine = termineImZeitraum(vonIso, bisIso, null);
    const proMassnahme = new Map();
    termine.forEach((t) => {
      if (!proMassnahme.has(t.massnahmeId)) proMassnahme.set(t.massnahmeId, []);
      proMassnahme.get(t.massnahmeId).push(t);
    });

    const zeilen = [];
    let gGeplant = 0, gDurch = 0, gAus = 0, gTeil = 0, gMin = 0;
    Array.from(proMassnahme.keys()).forEach((mid) => {
      const m = massnahmeVon(mid);
      if (!m) return;
      const schule = schuleVon(m.schuleId);
      const s = summiereTermine(proMassnahme.get(mid));
      gGeplant += s.geplant; gDurch += s.durchgefuehrt; gAus += s.ausgefallen;
      gTeil += s.teilnahmen; gMin += s.minutenGesamt;
      zeilen.push([
        m.titel,
        schule ? schule.name : "",
        m.typ === "camp" ? "Camp" : "AG",
        nameVon(m.verantwortlichUsername),
        String(s.durchgefuehrt) + " / " + String(s.geplant),
        String(s.ausgefallen),
        String(s.teilnahmen),
        String(s.schnitt),
        stundenText(s.minutenGesamt)
      ]);
    });

    zeilen.sort((a, b) => (a[1] + a[0]).localeCompare(b[1] + b[0], "de"));

    if (!zeilen.length) {
      doc.setFontSize(10);
      doc.text("Im gewählten Zeitraum liegt kein Termin.", 14, y + 6);
    } else {
      doc.autoTable({
        startY: y,
        head: [["Maßnahme", "Schule", "Art", "Durchführung", "Einheiten", "Ausfälle", "Teilnahmen", "Schnitt", "Zeit"]],
        body: zeilen,
        foot: [["Gesamt", "", "", "", gDurch + " / " + gGeplant, String(gAus), String(gTeil),
          gDurch ? String(Math.round((gTeil / gDurch) * 10) / 10) : "0", stundenText(gMin)]],
        theme: "striped",
        styles: { fontSize: 8.5, cellPadding: 1.8 },
        headStyles: { fillColor: [26, 86, 160], textColor: 255 },
        footStyles: { fillColor: [240, 242, 246], textColor: 30, fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 52 }, 1: { cellWidth: 46 }, 2: { cellWidth: 16 }, 3: { cellWidth: 40 },
          4: { cellWidth: 24, halign: "right" }, 5: { cellWidth: 20, halign: "right" },
          6: { cellWidth: 24, halign: "right" }, 7: { cellWidth: 20, halign: "right" },
          8: { cellWidth: "auto", halign: "right" }
        }
      });
    }

    pdfFuss(doc);
    oeffneBlob(doc, pdfDateiname(["Schulsport_Uebersicht", vonIso, bisIso]));
  } catch (e) {
    alert("Das PDF konnte nicht erzeugt werden: " + e.message);
  } finally {
    if (knopf) { knopf.disabled = false; knopf.textContent = alt; }
  }
}
