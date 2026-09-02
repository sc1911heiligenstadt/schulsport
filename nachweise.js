// Durchführungsnachweise und Kennzahlen-Übersicht.

// ---------------------------------------------------------------------------
// Nachweise
// ---------------------------------------------------------------------------

function nachweisZeitraum() {
  return {
    massnahmeId: (document.getElementById("nw-massnahme") || {}).value || "",
    von: (document.getElementById("nw-von") || {}).value || "",
    bis: (document.getElementById("nw-bis") || {}).value || ""
  };
}

// Baut den Datensatz, aus dem PDF und Vorschau entstehen. Beim Ausstellen eines
// Freigabelinks baut der WORKER dasselbe noch einmal aus der Datei -- der Client
// darf einen Snapshot nicht liefern, sonst stünde im Nachweis, was der Browser
// behauptet, statt was gespeichert ist.
function baueNachweisDaten(massnahmeId, vonIso, bisIso) {
  const m = massnahmeVon(massnahmeId);
  if (!m) return null;
  const schule = schuleVon(m.schuleId);
  const ort = ortVon(m.ortId);
  const termine = termineImZeitraum(vonIso, bisIso, (t) => t.massnahmeId === massnahmeId);
  const summen = summiereTermine(termine);
  const ausfaelle = ausfaelleNachGrund(termine, appData.ausfallgruende);
  const rahmen = RAHMEN_ARTEN.find((r) => r.id === m.rahmen);

  return {
    massnahmeId, vonDatum: vonIso, bisDatum: bisIso,
    schuleName: schule ? schule.name : "",
    schuleAnschrift: schule ? [schule.strasse, [schule.plz, schule.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ") : "",
    ansprechpartner: schule && schule.ansprechpartner ? schule.ansprechpartner : null,
    massnahmeTitel: m.titel,
    typ: m.typ,
    rahmen: rahmen ? rahmen.name : "",
    zielgruppe: m.zielgruppe || "",
    ortName: ort ? ort.name : "",
    verantwortlichName: nameVon(m.verantwortlichUsername),
    teamNamen: (m.teamUsernames || []).map(nameVon),
    zeilen: termine.map((t) => ({
      datum: t.datum,
      wochentag: fmtWochentag(t.datum),
      startZeit: t.startZeit, endZeit: t.endZeit,
      status: t.status,
      statusName: statusInfo(t.status).name,
      teilnehmerzahl: t.teilnehmerzahl,
      durchgefuehrtVonName: nameVon(t.durchgefuehrtVon),
      ausfallgrund: t.ausfallgrundId ? ((grundVon(t.ausfallgrundId) || {}).bezeichnung || "") : "",
      notiz: t.notiz || "",
      vorbereitungMin: t.vorbereitungMin || 0,
      nachbereitungMin: t.nachbereitungMin || 0
    })),
    summen, ausfaelle,
    offeneTermine: summen.offen
  };
}

function renderNachweisVorschau() {
  const el = document.getElementById("nw-vorschau");
  if (!el) return;
  const z = nachweisZeitraum();
  if (!z.massnahmeId || !z.von || !z.bis) {
    el.innerHTML = `<p class="muted">Maßnahme und Zeitraum wählen.</p>`;
    return;
  }
  if (z.bis < z.von) { el.innerHTML = `<p class="hinweis fehler">Das Ende liegt vor dem Beginn.</p>`; return; }

  const d = baueNachweisDaten(z.massnahmeId, z.von, z.bis);
  if (!d) { el.innerHTML = `<p class="hinweis fehler">Maßnahme nicht gefunden.</p>`; return; }
  if (!d.zeilen.length) { el.innerHTML = `<p class="hinweis warnung">In diesem Zeitraum liegt kein Termin dieser Maßnahme.</p>`; return; }

  const s = d.summen;
  el.innerHTML = `
    ${s.offen ? `<p class="hinweis warnung">${s.offen === 1 ? "Ein Termin ist" : s.offen + " Termine sind"} noch nicht gemeldet. Der Nachweis lässt sich trotzdem ausstellen — die Lücke steht dann aber so im Dokument.</p>` : ""}
    <div class="kennzahlen">
      <div class="kennzahl"><div class="kz-wert">${s.durchgefuehrt}<span style="font-size:15px;color:var(--muted);"> / ${s.geplant}</span></div><div class="kz-label">durchgeführt</div></div>
      <div class="kennzahl"><div class="kz-wert">${s.teilnahmen}</div><div class="kz-label">Teilnahmen gesamt</div></div>
      <div class="kennzahl"><div class="kz-wert">${s.schnitt}</div><div class="kz-label">Kinder im Schnitt</div></div>
      <div class="kennzahl"><div class="kz-wert">${stundenText(s.minutenGesamt)}</div><div class="kz-label">Zeit gesamt</div></div>
    </div>
    ${d.ausfaelle.length ? `<p class="muted">Ausfälle: ${d.ausfaelle.map((a) =>
      escapeHtml(a.bezeichnung) + " (" + a.anzahl + ")").join(", ")}</p>` : ""}
    <div class="tabelle-scroll">
      <table class="daten">
        <thead><tr>
          <th style="width:22%;">Datum</th><th style="width:18%;">Zeit</th><th style="width:22%;">Status</th>
          <th class="num" style="width:14%;">Kinder</th><th style="width:24%;">Durchgeführt von</th>
        </tr></thead>
        <tbody>${d.zeilen.map((r) => `<tr>
          <td>${escapeHtml(r.wochentag.slice(0, 2))}, ${fmtDatum(r.datum)}</td>
          <td>${escapeHtml(r.startZeit)}–${escapeHtml(r.endZeit)}</td>
          <td>${escapeHtml(r.statusName)}${r.ausfallgrund ? " (" + escapeHtml(r.ausfallgrund) + ")" : ""}</td>
          <td class="num">${r.teilnehmerzahl === null || r.teilnehmerzahl === undefined ? "–" : escapeHtml(r.teilnehmerzahl)}</td>
          <td>${escapeHtml(r.durchgefuehrtVonName)}</td>
        </tr>`).join("")}
        <tr class="summe">
          <td>Summe</td><td>${escapeHtml(stundenText(s.minutenAg))}</td>
          <td>${s.durchgefuehrt} durchgeführt, ${s.ausgefallen} ausgefallen</td>
          <td class="num">${s.teilnahmen}</td><td></td>
        </tr></tbody>
      </table>
    </div>`;
}

function renderNachweise() {
  if (!canEdit()) return;
  // Auswahllisten füllen
  const sel = document.getElementById("nw-massnahme");
  if (sel) {
    const alt = sel.value;
    sel.innerHTML = `<option value="">Bitte wählen</option>` + (appData.massnahmen || []).map((m) => {
      const s = schuleVon(m.schuleId);
      return `<option value="${escapeHtml(m.id)}">${escapeHtml(m.titel)}${s ? " — " + escapeHtml(s.name) : ""}</option>`;
    }).join("");
    sel.value = alt;
  }
  // Zeitraum vorbelegen: laufendes Schulhalbjahr
  const von = document.getElementById("nw-von"), bis = document.getElementById("nw-bis");
  if (von && !von.value) {
    const h = heuteDatum();
    const start = h.getMonth() + 1 >= SCHULJAHR_BEGINN_MONAT
      ? new Date(h.getFullYear(), SCHULJAHR_BEGINN_MONAT - 1, 1)
      : new Date(h.getFullYear() - 1, SCHULJAHR_BEGINN_MONAT - 1, 1);
    von.value = isoAusDatum(start);
  }
  if (bis && !bis.value) bis.value = heuteIso();

  renderNachweisVorschau();
  renderNachweisListe();
}

function renderNachweisListe() {
  const el = document.getElementById("nw-liste");
  const leer = document.getElementById("nw-liste-leer");
  if (!el) return;
  const liste = (appData.nachweise || []).slice().sort((a, b) => (a.erstelltAm > b.erstelltAm ? -1 : 1));
  if (!liste.length) { el.innerHTML = ""; if (leer) leer.style.display = ""; return; }
  if (leer) leer.style.display = "none";

  el.innerHTML = liste.map((n) => {
    const m = massnahmeVon(n.massnahmeId);
    const abgelaufen = n.gueltigBis && new Date(n.gueltigBis) < new Date();
    const status = n.widerrufen ? "widerrufen" : (n.status === "offen" && abgelaufen ? "abgelaufen" : n.status);
    const stName = { offen: "Wartet auf Bestätigung", bestaetigt: "Bestätigt", rueckfrage: "Rückfrage", abgelaufen: "Abgelaufen", widerrufen: "Widerrufen" }[status] || status;
    const s = (n.snapshot && n.snapshot.summen) || {};

    return `<div class="liste-zeile"><div class="lz-haupt">
      <div class="lz-titel">${escapeHtml((n.snapshot && n.snapshot.massnahmeTitel) || (m && m.titel) || "Nachweis")}
        <span class="badge ${escapeHtml(status)}">${escapeHtml(stName)}</span></div>
      <div class="lz-unter">${fmtDatum(n.vonDatum)} bis ${fmtDatum(n.bisDatum)} · ${escapeHtml((n.snapshot && n.snapshot.schuleName) || "")}</div>
      <div class="lz-unter">${s.durchgefuehrt || 0} Termine, ${s.teilnahmen || 0} Teilnahmen · ausgestellt ${escapeHtml(fmtZeitstempel(n.erstelltAm))}</div>
      ${n.bestaetigung ? `<div class="lz-unter">Bestätigt von ${escapeHtml(n.bestaetigung.name)}${
        n.bestaetigung.funktion ? " (" + escapeHtml(n.bestaetigung.funktion) + ")" : ""} am ${escapeHtml(fmtZeitstempel(n.bestaetigung.bestaetigtAm))}${
        n.pdfFileId ? " · als PDF in der Nextcloud abgelegt" : ""}</div>` : ""}
      ${n.rueckfrage ? `<div class="hinweis warnung" style="margin-top:6px;">Rückfrage von ${escapeHtml(n.rueckfrage.name)}: ${escapeHtml(n.rueckfrage.text)}</div>` : ""}
    </div><div class="lz-knoepfe">
      <button type="button" class="btn secondary small" data-nw-pdf="${escapeHtml(n.id)}">PDF</button>
      ${status === "offen" ? `<button type="button" class="btn secondary small" data-nw-link="${escapeHtml(n.id)}">Link</button>
        <button type="button" class="btn secondary small" data-nw-mail="${escapeHtml(n.id)}">Mail</button>` : ""}
      ${status === "abgelaufen" || status === "rueckfrage" ? `<button type="button" class="btn secondary small" data-nw-neu="${escapeHtml(n.id)}">Neu ausstellen</button>` : ""}
      ${status === "offen" ? `<button type="button" class="btn secondary small" data-nw-widerruf="${escapeHtml(n.id)}">Widerrufen</button>` : ""}
    </div></div>`;
  }).join("");

  el.querySelectorAll("[data-nw-link]").forEach((b) => b.addEventListener("click", () => zeigeFreigabeLink(b.getAttribute("data-nw-link"))));
  el.querySelectorAll("[data-nw-mail]").forEach((b) => b.addEventListener("click", () => sendeNachweisMail(b.getAttribute("data-nw-mail"), b)));
  el.querySelectorAll("[data-nw-pdf]").forEach((b) => b.addEventListener("click", () => pdfAusVorgang(b.getAttribute("data-nw-pdf"), b)));
  el.querySelectorAll("[data-nw-widerruf]").forEach((b) => b.addEventListener("click", () => nachweisAktion(b.getAttribute("data-nw-widerruf"), "widerrufen", b)));
  el.querySelectorAll("[data-nw-neu]").forEach((b) => b.addEventListener("click", () => nachweisAktion(b.getAttribute("data-nw-neu"), "neu-ausstellen", b)));
}

async function erstelleFreigabe() {
  const z = nachweisZeitraum();
  if (!z.massnahmeId || !z.von || !z.bis) { alert("Bitte Maßnahme und Zeitraum wählen."); return; }
  const d = baueNachweisDaten(z.massnahmeId, z.von, z.bis);
  if (!d || !d.zeilen.length) { alert("In diesem Zeitraum liegt kein Termin."); return; }
  if (d.summen.offen && !confirm(d.summen.offen + " Termine sind noch nicht gemeldet.\n\nDer Nachweis friert diesen Stand ein — die Lücke steht dann so im Dokument, das die Schule unterschreibt.\n\nTrotzdem ausstellen?")) return;

  const knopf = document.getElementById("btn-nw-freigabe");
  knopf.disabled = true;
  const alt = knopf.textContent;
  knopf.textContent = "Wird ausgestellt …";
  try {
    await flushPending();
    const r = await erstelleNachweis({ art: "massnahme", massnahmeId: z.massnahmeId, vonDatum: z.von, bisDatum: z.bis });
    const daten = await gatewayLoad();
    appData = normalizeData(daten);
    renderNachweise();
    zeigeFreigabeLink(r.id, r.url);
  } catch (e) {
    alert("Ausstellen fehlgeschlagen: " + e.message);
  } finally {
    knopf.disabled = false;
    knopf.textContent = alt;
  }
}

function zeigeFreigabeLink(nachweisId, urlDirekt) {
  const n = (appData.nachweise || []).find((x) => x.id === nachweisId);
  const url = urlDirekt || (n && n.token ? FREIGABE_BASIS_URL + "?t=" + n.token : "");
  const schule = n ? schuleVon((massnahmeVon(n.massnahmeId) || {}).schuleId) : null;

  document.getElementById("freigabe-inhalt").innerHTML = `
    <p class="muted">Mit diesem Link sieht die Schule den Nachweis und kann ihn unterschreiben. Ein Zugang zu den Vereins-Tools ist dafür nicht nötig.</p>
    ${url ? `<div class="link-box"><input type="text" id="freigabe-url" readonly value="${escapeHtml(url)}" />
      <button type="button" class="btn small" id="btn-link-kopieren">Kopieren</button></div>` :
      `<p class="hinweis fehler">Für diesen Vorgang liegt kein Link vor. Möglicherweise fehlt das Bearbeiten-Recht.</p>`}
    <p class="muted">Gültig bis ${n && n.gueltigBis ? escapeHtml(fmtZeitstempel(n.gueltigBis)) : "—"}.</p>
    ${schule && schule.bestaetigungEmail
      ? `<p class="muted">Per Mail geht der Link an <strong>${escapeHtml(schule.bestaetigungEmail)}</strong>.</p>`
      : `<p class="hinweis warnung">Für diese Schule ist keine E-Mail für Bestätigungen hinterlegt — der Link lässt sich nur von Hand weitergeben.</p>`}
    <p class="muted">Kommt die Mail nicht an, hilft der kopierte Link: er funktioniert unabhängig vom Versandweg.</p>`;

  const kop = document.getElementById("btn-link-kopieren");
  if (kop) kop.addEventListener("click", () => {
    const feld = document.getElementById("freigabe-url");
    feld.select();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(feld.value);
      else document.execCommand("copy");
      kop.textContent = "Kopiert";
      setTimeout(() => { kop.textContent = "Kopieren"; }, 1500);
    } catch (_) {}
  });
  oeffneOverlay("freigabe-overlay");
}

async function sendeNachweisMail(nachweisId, knopf) {
  const n = (appData.nachweise || []).find((x) => x.id === nachweisId);
  const schule = n ? schuleVon((massnahmeVon(n.massnahmeId) || {}).schuleId) : null;
  if (schule && !schule.bestaetigungEmail) {
    alert("Für „" + schule.name + "“ ist keine E-Mail für Bestätigungen hinterlegt.\n\nSie lässt sich unter Verwaltung → Schulen eintragen. Bis dahin hilft der Knopf „Link“.");
    return;
  }
  if (!confirm("Bestätigungslink an " + (schule ? schule.bestaetigungEmail : "die Schule") + " schicken?")) return;
  knopf.disabled = true;
  try {
    const r = await sendeNachweis(nachweisId);
    if (r.sent) setSaveStatus("Der Link wurde verschickt.");
    else setSaveStatus("Es wurde keine Mail verschickt" + (r.grund ? " (" + r.grund + ")" : "") + ". Bitte den Link von Hand weitergeben.", true);
    const daten = await gatewayLoad();
    appData = normalizeData(daten);
    renderNachweisListe();
  } catch (e) {
    setSaveStatus("Versand fehlgeschlagen: " + e.message, true);
  } finally {
    knopf.disabled = false;
  }
}

async function nachweisAktion(nachweisId, was, knopf) {
  const texte = {
    widerrufen: "Diesen Bestätigungslink widerrufen? Er funktioniert danach nicht mehr.",
    verlaengern: "Die Laufzeit dieses Links verlängern?",
    "neu-ausstellen": "Einen neuen Link mit dem AKTUELLEN Stand der Zahlen ausstellen?"
  };
  if (!confirm(texte[was] || "Fortfahren?")) return;
  knopf.disabled = true;
  try {
    await nachweisStatus(nachweisId, was);
    const daten = await gatewayLoad();
    appData = normalizeData(daten);
    renderNachweise();
  } catch (e) {
    alert("Fehlgeschlagen: " + e.message);
    knopf.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Übersicht / Kennzahlen
// ---------------------------------------------------------------------------

function uebersichtZeitraum() {
  const jahr = (document.getElementById("ue-schuljahr") || {}).value || "";
  if (jahr) {
    const start = Number(jahr.slice(0, 4));
    return {
      von: start + "-" + String(SCHULJAHR_BEGINN_MONAT).padStart(2, "0") + "-01",
      bis: (start + 1) + "-" + String(SCHULJAHR_BEGINN_MONAT - 1 || 12).padStart(2, "0") + "-31"
    };
  }
  return {
    von: (document.getElementById("ue-von") || {}).value || "",
    bis: (document.getElementById("ue-bis") || {}).value || ""
  };
}

function renderUebersicht() {
  const el = document.getElementById("uebersicht-inhalt");
  if (!el) return;
  const von = document.getElementById("ue-von"), bis = document.getElementById("ue-bis");
  if (von && !von.value) {
    const h = heuteDatum();
    const start = h.getMonth() + 1 >= SCHULJAHR_BEGINN_MONAT
      ? new Date(h.getFullYear(), SCHULJAHR_BEGINN_MONAT - 1, 1)
      : new Date(h.getFullYear() - 1, SCHULJAHR_BEGINN_MONAT - 1, 1);
    von.value = isoAusDatum(start);
  }
  if (bis && !bis.value) bis.value = heuteIso();

  const z = uebersichtZeitraum();
  const termine = termineImZeitraum(z.von, z.bis, null);
  const s = summiereTermine(termine);

  // Erreichte Kinder je Woche: Summe der Teilnahmen geteilt durch die Zahl der
  // Wochen, in denen überhaupt etwas stattgefunden hat. Wochen ohne Angebot
  // (Ferien) würden den Wert sonst künstlich drücken.
  const wochen = new Set();
  termine.forEach((t) => {
    if (t.status !== "durchgefuehrt") return;
    const d = datumAusIso(t.datum);
    if (d) wochen.add(d.getFullYear() + "-" + kalenderwoche(d));
  });
  const proWoche = wochen.size ? Math.round((s.teilnahmen / wochen.size) * 10) / 10 : 0;
  const quote = s.geplant ? Math.round((s.durchgefuehrt / (s.durchgefuehrt + s.ausgefallen || 1)) * 100) : 0;

  // Je Schule
  const proSchule = new Map();
  termine.forEach((t) => {
    const m = massnahmeVon(t.massnahmeId);
    if (!m) return;
    const key = m.schuleId || "";
    if (!proSchule.has(key)) proSchule.set(key, []);
    proSchule.get(key).push(t);
  });
  const zeilen = Array.from(proSchule.entries()).map(([sid, liste]) => {
    const schule = schuleVon(sid);
    const ss = summiereTermine(liste);
    const massnahmen = new Set(liste.map((t) => t.massnahmeId)).size;
    return { name: schule ? schule.name : "ohne Schule", massnahmen, s: ss };
  }).sort((a, b) => b.s.teilnahmen - a.s.teilnahmen);

  const ausfaelle = ausfaelleNachGrund(termine, appData.ausfallgruende);

  el.innerHTML = `
    <div class="kennzahlen">
      <div class="kennzahl"><div class="kz-wert">${s.teilnahmen}</div><div class="kz-label">Teilnahmen im Zeitraum</div></div>
      <div class="kennzahl"><div class="kz-wert">${proWoche}</div><div class="kz-label">Kinder je Woche im Schnitt</div></div>
      <div class="kennzahl"><div class="kz-wert">${s.durchgefuehrt}</div><div class="kz-label">durchgeführte Einheiten</div></div>
      <div class="kennzahl"><div class="kz-wert">${quote}%</div><div class="kz-label">Durchführungsquote</div></div>
      <div class="kennzahl"><div class="kz-wert">${proSchule.size}</div><div class="kz-label">Schulen</div></div>
      <div class="kennzahl"><div class="kz-wert">${stundenText(s.minutenGesamt)}</div><div class="kz-label">geleistete Zeit</div></div>
    </div>

    <div class="card">
      <h2>Nach Schule</h2>
      ${zeilen.length ? `<div class="tabelle-scroll"><table class="daten">
        <thead><tr>
          <th style="width:30%;">Schule</th><th class="num" style="width:14%;">Maßnahmen</th>
          <th class="num" style="width:14%;">Einheiten</th><th class="num" style="width:14%;">Ausfälle</th>
          <th class="num" style="width:14%;">Teilnahmen</th><th class="num" style="width:14%;">Schnitt</th>
        </tr></thead>
        <tbody>${zeilen.map((r) => `<tr>
          <td>${escapeHtml(r.name)}</td>
          <td class="num">${r.massnahmen}</td>
          <td class="num">${r.s.durchgefuehrt}</td>
          <td class="num">${r.s.ausgefallen}</td>
          <td class="num">${r.s.teilnahmen}</td>
          <td class="num">${r.s.schnitt}</td>
        </tr>`).join("")}
        <tr class="summe"><td>Gesamt</td>
          <td class="num">${new Set(termine.map((t) => t.massnahmeId)).size}</td>
          <td class="num">${s.durchgefuehrt}</td><td class="num">${s.ausgefallen}</td>
          <td class="num">${s.teilnahmen}</td><td class="num">${s.schnitt}</td></tr>
        </tbody></table></div>` : `<div class="empty-state">Im gewählten Zeitraum liegt kein Termin.</div>`}
    </div>

    ${ausfaelle.length ? `<div class="card">
      <h2>Ausfälle nach Grund</h2>
      <p class="muted">Getrennt danach, was dem Verein zur Last fällt — genau die Unterscheidung, nach der eine Behörde fragt.</p>
      <div class="tabelle-scroll"><table class="daten">
        <thead><tr><th style="width:55%;">Grund</th><th style="width:30%;">Zurechnung</th><th class="num" style="width:15%;">Anzahl</th></tr></thead>
        <tbody>${ausfaelle.map((a) => `<tr>
          <td>${escapeHtml(a.bezeichnung)}</td>
          <td>${a.vereinsverschulden ? "beim Verein" : "nicht beim Verein"}</td>
          <td class="num">${a.anzahl}</td></tr>`).join("")}</tbody>
      </table></div>
    </div>` : ""}

    <div class="card">
      <h2>Zeitaufwand</h2>
      <div class="tabelle-scroll"><table class="daten">
        <thead><tr><th style="width:60%;">Anteil</th><th class="num" style="width:40%;">Zeit</th></tr></thead>
        <tbody>
          <tr><td>Einheiten selbst</td><td class="num">${escapeHtml(stundenText(s.minutenAg))}</td></tr>
          <tr><td>Vorbereitung</td><td class="num">${escapeHtml(stundenText(s.minutenVor))}</td></tr>
          <tr><td>Nachbereitung</td><td class="num">${escapeHtml(stundenText(s.minutenNach))}</td></tr>
          <tr class="summe"><td>Gesamt</td><td class="num">${escapeHtml(stundenText(s.minutenGesamt))}</td></tr>
        </tbody>
      </table></div>
      <p class="muted">Gezählt wird nur, was als durchgeführt gemeldet ist. Stundensätze und Abrechnung bleiben bei den Personalkosten.</p>
    </div>`;
}

// ---------------------------------------------------------------------------
// Verdrahtung (einmalig)
// ---------------------------------------------------------------------------

function setupNachweisKnoepfe() {
  ["nw-massnahme", "nw-von", "nw-bis"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", renderNachweisVorschau);
  });
  ["ue-von", "ue-bis", "ue-schuljahr"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", renderUebersicht);
  });
  const f = document.getElementById("btn-nw-freigabe");
  if (f) f.addEventListener("click", erstelleFreigabe);
  const p = document.getElementById("btn-nw-pdf");
  if (p) p.addEventListener("click", () => {
    const z = nachweisZeitraum();
    if (!z.massnahmeId || !z.von || !z.bis) { alert("Bitte Maßnahme und Zeitraum wählen."); return; }
    const d = baueNachweisDaten(z.massnahmeId, z.von, z.bis);
    if (!d || !d.zeilen.length) { alert("In diesem Zeitraum liegt kein Termin."); return; }
    erzeugeNachweisPdf(d, null, p);
  });
  const sam = document.getElementById("btn-nw-sammel");
  if (sam) sam.addEventListener("click", () => {
    const z = nachweisZeitraum();
    if (!z.von || !z.bis) { alert("Bitte einen Zeitraum wählen."); return; }
    erzeugeSammelPdf(z.von, z.bis, sam);
  });
  const erin = document.getElementById("btn-erinnerung-alle");
  if (erin) erin.addEventListener("click", () => sendeErinnerung(null, erin));
}

// PDF aus einem bereits ausgestellten Vorgang -- nutzt den EINGEFRORENEN
// Snapshot, nicht den aktuellen Stand. Genau das ist der Zweck des Vorgangs.
function pdfAusVorgang(nachweisId, knopf) {
  const n = (appData.nachweise || []).find((x) => x.id === nachweisId);
  if (!n || !n.snapshot) { alert("Zu diesem Vorgang liegen keine eingefrorenen Daten vor."); return; }
  erzeugeNachweisPdf(n.snapshot, n, knopf);
}

// ---------------------------------------------------------------------------
// Ablage bestätigter Nachweise
// ---------------------------------------------------------------------------
// Sobald die Schule gezeichnet hat, entsteht daraus ein unveränderliches
// Dokument in der Vereins-Nextcloud.
//
// ⚠️ Das PDF baut BEWUSST dieser Client, nicht die Seite der Schule: sonst
// nähme eine login-lose Worker-Aktion eine mehrere hundert Kilobyte große Datei
// entgegen. Die Bestätigungsseite schickt nur Name und Unterschriftsbild.
// Ein Cloudflare-Worker kann selbst kein PDF setzen.
//
// Läuft nach dem Laden und nach jedem Neuladen der Nachweise. Ohne
// Bearbeiten-Recht gar nicht: dav-file-put verlangt es serverseitig.
async function legeBestaetigtePdfsAb() {
  if (!canEdit() || !appData) return;
  const offen = (appData.nachweise || []).filter((n) =>
    n && n.status === "bestaetigt" && n.bestaetigung && !n.pdfFileId);
  if (!offen.length) return;

  let erledigt = 0;
  for (const n of offen) {
    try {
      const blob = await erzeugeNachweisPdf(n.snapshot, n, null, true);
      if (!blob) continue;
      const base64 = await blobZuBase64(blob);
      if (!base64) continue;
      const id = uuid();
      const name = "Durchfuehrungsnachweis_" +
        String((n.snapshot && n.snapshot.massnahmeTitel) || "").replace(/[^A-Za-z0-9]+/g, "_").slice(0, 60) +
        "_" + n.vonDatum + "_" + n.bisDatum + ".pdf";
      await dateiPut(id, name, "application/pdf", base64);
      n.pdfFileId = id;
      n.pdfDateiname = name;
      n.pdfErzeugtAm = new Date().toISOString();
      erledigt++;
    } catch (e) {
      // Ein Fehlschlag darf die Bestätigung nicht entwerten -- sie steht bereits
      // in der Datei. Der nächste Aufruf versucht es erneut.
      console.warn("Nachweis-PDF konnte nicht abgelegt werden:", e && e.message);
    }
  }
  if (erledigt) {
    markDirty();
    setSaveStatus(erledigt === 1
      ? "Ein bestätigter Nachweis wurde als PDF in der Nextcloud abgelegt."
      : erledigt + " bestätigte Nachweise wurden als PDF in der Nextcloud abgelegt.");
    if (aktuellerTab === "nachweise") renderNachweisListe();
  }
}
