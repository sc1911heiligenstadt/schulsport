// Maßnahmen-Verwaltung (AGs und Camps) und der Administrieren-Tab.
// Setzt auf app.js auf und nutzt dessen Zustand (appData, canEdit, markDirty).

// ---------------------------------------------------------------------------
// Maßnahmen-Liste
// ---------------------------------------------------------------------------

function gefilterteMassnahmen() {
  const fSchule = (document.getElementById("mf-schule") || {}).value || "";
  const fJahr = (document.getElementById("mf-schuljahr") || {}).value || "";
  const fStatus = (document.getElementById("mf-status") || {}).value || "";
  return (appData.massnahmen || []).filter((m) => {
    if (fSchule && m.schuleId !== fSchule) return false;
    if (fJahr && m.schuljahr !== fJahr) return false;
    if (fStatus && m.status !== fStatus) return false;
    return true;
  }).sort((a, b) => {
    const sa = (a.regel && a.regel.startDatum) || "", sb = (b.regel && b.regel.startDatum) || "";
    return sa > sb ? -1 : sa < sb ? 1 : 0;
  });
}

function renderMassnahmen() {
  const el = document.getElementById("massnahmen-liste");
  if (!el) return;
  const liste = gefilterteMassnahmen();
  if (!liste.length) {
    el.innerHTML = `<div class="card"><div class="empty-state">Keine Maßnahme gefunden.${
      canEdit() ? " Über die Knöpfe oben lässt sich eine anlegen." : ""}</div></div>`;
    return;
  }

  el.innerHTML = liste.map((m) => {
    const schule = schuleVon(m.schuleId);
    const ort = ortVon(m.ortId);
    const meine = (appData.termine || []).filter((t) => t.massnahmeId === m.id);
    const s = summiereTermine(meine);
    const rahmen = RAHMEN_ARTEN.find((r) => r.id === m.rahmen);
    const wt = (m.regel.wochentage || []).map((n) => (WOCHENTAGE.find((w) => w.nr === n) || {}).kurz).filter(Boolean).join(", ");
    const farbe = farbeDerMassnahme(m);
    const offen = meine.filter((t) => !terminIstGemeldet(t) && t.datum <= heuteIso()).length;

    return `<div class="card">
      <div class="card-header-row">
        <h2><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${farbe};margin-right:6px;"></span>${escapeHtml(m.titel)}</h2>
        <div class="lz-knoepfe editor-only">
          <button type="button" class="btn secondary small" data-mbearb="${escapeHtml(m.id)}">Bearbeiten</button>
          <button type="button" class="btn secondary small" data-mabgleich="${escapeHtml(m.id)}">Termine neu erzeugen</button>
        </div>
      </div>
      <p class="muted">
        ${escapeHtml(m.typ === "camp" ? "Camp" : "AG")}${rahmen ? " · " + escapeHtml(rahmen.name) : ""}
        ${schule ? " · " + escapeHtml(schule.name) : ""}${ort ? " · " + escapeHtml(ort.name) : ""}
        ${m.zielgruppe ? " · " + escapeHtml(m.zielgruppe) : ""}
      </p>
      <p class="muted">
        ${m.typ === "camp" ? "täglich" : (wt ? wt : "kein Wochentag gewählt")}
        ${escapeHtml(m.regel.startZeit || "")}–${escapeHtml(m.regel.endZeit || "")} ·
        ${fmtDatum(m.regel.startDatum)} bis ${fmtDatum(m.regel.endDatum)}
      </p>
      <p class="muted">
        ${escapeHtml(nameVon(m.verantwortlichUsername))}${(m.teamUsernames || []).length ? " (+ " + (m.teamUsernames || []).length + ")" : ""}
        · Vorbereitung ${escapeHtml(m.vorbereitungMin || 0)} Min, Nachbereitung ${escapeHtml(m.nachbereitungMin || 0)} Min
      </p>
      <div class="kennzahlen" style="margin-top:12px;">
        <div class="kennzahl"><div class="kz-wert">${s.durchgefuehrt}<span style="font-size:15px;color:var(--muted);"> / ${s.geplant}</span></div><div class="kz-label">durchgeführt</div></div>
        <div class="kennzahl"><div class="kz-wert">${s.teilnahmen}</div><div class="kz-label">Teilnahmen gesamt</div></div>
        <div class="kennzahl"><div class="kz-wert">${s.schnitt}</div><div class="kz-label">Kinder im Schnitt</div></div>
        <div class="kennzahl"><div class="kz-wert" style="${offen ? "color:var(--red)" : ""}">${offen}</div><div class="kz-label">offene Meldungen</div></div>
      </div>
    </div>`;
  }).join("");

  el.querySelectorAll("[data-mbearb]").forEach((b) => {
    b.addEventListener("click", () => oeffneMassnahme(b.getAttribute("data-mbearb")));
  });
  el.querySelectorAll("[data-mabgleich]").forEach((b) => {
    b.addEventListener("click", () => oeffneAbgleich(b.getAttribute("data-mabgleich")));
  });
  applyRechteVisibility();
}

// ---------------------------------------------------------------------------
// Maßnahmen-Dialog
// ---------------------------------------------------------------------------

function leereMassnahme(typ) {
  const t = MASSNAHME_TYPEN.find((x) => x.id === typ) || MASSNAHME_TYPEN[0];
  const heute = heuteIso();
  return {
    id: uuid(),
    schuljahr: schuljahrAusIso(heute, SCHULJAHR_BEGINN_MONAT),
    typ: t.id,
    titel: "",
    schuleId: "", ortId: "",
    rahmen: "schulzeit",
    ansprechpartnerAbweichend: null,
    zielgruppe: "",
    maxTeilnehmer: null,
    verantwortlichUsername: currentUser.username || "",
    teamUsernames: [],
    regel: {
      muster: t.muster,
      wochentage: t.muster === "woechentlich" ? [2] : [],
      startDatum: heute, endDatum: heute,
      startZeit: "14:00", endZeit: "15:30",
      ferienAuslassen: t.ferienAuslassen,
      feiertageAuslassen: true,
      schliesstageAuslassen: true,
      ausnahmen: []
    },
    vorbereitungMin: appData.einstellungen.standardVorMin,
    nachbereitungMin: appData.einstellungen.standardNachMin,
    mitbringen: [],
    farbe: "",
    notiz: "",
    status: "geplant",
    angelegtVon: currentUser.username || "",
    angelegtAm: new Date().toISOString(),
    geaendertAm: ""
  };
}

function oeffneMassnahme(id, typ) {
  if (!canEdit()) return;
  let m;
  if (id) { m = massnahmeVon(id); if (!m) return; offeneMassnahmeId = id; }
  else { m = leereMassnahme(typ); offeneMassnahmeId = null; window.__neueMassnahme = m; }

  document.getElementById("massnahme-dialog-titel").textContent =
    id ? "Maßnahme bearbeiten" : (typ === "camp" ? "Neues Camp" : "Neue AG");
  document.getElementById("btn-massnahme-loeschen").style.display = id ? "" : "none";

  const schulOpt = (appData.schulen || []).map((s) =>
    `<option value="${escapeHtml(s.id)}"${m.schuleId === s.id ? " selected" : ""}>${escapeHtml(s.name)}</option>`).join("");
  const orte = (appData.orte || []).filter((o) => !m.schuleId || !o.schuleId || o.schuleId === m.schuleId);
  const ortOpt = orte.map((o) =>
    `<option value="${escapeHtml(o.id)}"${m.ortId === o.id ? " selected" : ""}>${escapeHtml(o.name)}${o.schuleId ? "" : " (vereinseigen)"}</option>`).join("");
  const rahmenOpt = RAHMEN_ARTEN.map((r) =>
    `<option value="${escapeHtml(r.id)}"${m.rahmen === r.id ? " selected" : ""}>${escapeHtml(r.name)}</option>`).join("");
  const personOpt = teamKandidaten.map((p) =>
    `<option value="${escapeHtml(p.username)}"${m.verantwortlichUsername === p.username ? " selected" : ""}>${escapeHtml(p.displayName || p.username)}</option>`).join("");
  const wtChecks = WOCHENTAGE.filter((w) => w.nr >= 1 && w.nr <= 6).map((w) =>
    `<label class="check-zeile" style="display:inline-flex;margin-right:10px;">
      <input type="checkbox" class="f-wt" value="${w.nr}"${(m.regel.wochentage || []).indexOf(w.nr) !== -1 ? " checked" : ""} /> ${escapeHtml(w.kurz)}
    </label>`).join("");
  const teamChecks = teamKandidaten.map((p) =>
    `<label class="check-zeile"><input type="checkbox" class="f-team" value="${escapeHtml(p.username)}"${(m.teamUsernames || []).indexOf(p.username) !== -1 ? " checked" : ""} /> ${escapeHtml(p.displayName || p.username)}</label>`).join("");

  document.getElementById("massnahme-formular").innerHTML = `
    <div class="form-grid wide">
      <div class="form-field">
        <label>Bezeichnung</label>
        <input type="text" id="f-titel" maxlength="120" value="${escapeHtml(m.titel)}" placeholder="z. B. Fußball-AG Klasse 1–2" />
      </div>
      <div class="form-field">
        <label>Art</label>
        <select id="f-typ">${MASSNAHME_TYPEN.map((t) =>
          `<option value="${escapeHtml(t.id)}"${m.typ === t.id ? " selected" : ""}>${escapeHtml(t.name)}</option>`).join("")}</select>
      </div>
      <div class="form-field">
        <label>Schule</label>
        <select id="f-schule"><option value="">Bitte wählen</option>${schulOpt}</select>
      </div>
      <div class="form-field">
        <label>Ort</label>
        <select id="f-ort"><option value="">Bitte wählen</option>${ortOpt}</select>
      </div>
      <div class="form-field">
        <label>Rahmen</label>
        <select id="f-rahmen">${rahmenOpt}</select>
      </div>
      <div class="form-field">
        <label>Zielgruppe</label>
        <input type="text" id="f-zielgruppe" maxlength="80" value="${escapeHtml(m.zielgruppe)}" placeholder="z. B. Klasse 1–2" />
      </div>
    </div>

    <h3 style="margin-top:16px;">Wann findet die Maßnahme statt?</h3>
    <div class="form-grid">
      <div class="form-field">
        <label>Beginn</label>
        <input type="date" id="f-von" value="${escapeHtml(m.regel.startDatum || "")}" />
      </div>
      <div class="form-field">
        <label>Ende</label>
        <input type="date" id="f-bis" value="${escapeHtml(m.regel.endDatum || "")}" />
      </div>
      <div class="form-field">
        <label>Von</label>
        <input type="time" id="f-startzeit" value="${escapeHtml(m.regel.startZeit || "")}" />
      </div>
      <div class="form-field">
        <label>Bis</label>
        <input type="time" id="f-endzeit" value="${escapeHtml(m.regel.endZeit || "")}" />
      </div>
    </div>
    <div id="f-wt-block" style="${m.regel.muster === "taeglich" ? "display:none" : ""}">
      <label style="display:block;font-size:12px;color:var(--muted);font-weight:600;margin-bottom:4px;">Wochentage</label>
      <div>${wtChecks}</div>
    </div>
    <p class="muted" id="f-muster-hinweis" style="margin-top:8px;"></p>
    <label class="check-zeile"><input type="checkbox" id="f-ferien"${m.regel.ferienAuslassen ? " checked" : ""} /> Ferien auslassen</label>
    <label class="check-zeile"><input type="checkbox" id="f-feiertage"${m.regel.feiertageAuslassen ? " checked" : ""} /> Feiertage auslassen</label>
    <label class="check-zeile"><input type="checkbox" id="f-schliesstage"${m.regel.schliesstageAuslassen ? " checked" : ""} /> Schließtage der Schule auslassen</label>

    <h3 style="margin-top:16px;">Wer führt durch?</h3>
    <div class="form-grid">
      <div class="form-field">
        <label>Verantwortlich</label>
        <select id="f-verantwortlich"><option value="">Bitte wählen</option>${personOpt}</select>
      </div>
      <div class="form-field">
        <label>Vorbereitung (Minuten)</label>
        <input type="number" id="f-vor" min="0" max="480" value="${escapeHtml(m.vorbereitungMin || 0)}" />
      </div>
      <div class="form-field">
        <label>Nachbereitung (Minuten)</label>
        <input type="number" id="f-nach" min="0" max="480" value="${escapeHtml(m.nachbereitungMin || 0)}" />
      </div>
    </div>
    <label style="display:block;font-size:12px;color:var(--muted);font-weight:600;margin:8px 0 4px;">Weitere aus dem Team (dürfen ebenfalls melden)</label>
    <div>${teamChecks || `<p class="muted">Es sind keine weiteren Personen hinterlegt.</p>`}</div>

    <h3 style="margin-top:16px;">Material und Sonstiges</h3>
    <div class="form-field">
      <label>Vom Verein mitzubringen (mit Komma trennen)</label>
      <input type="text" id="f-mitbringen" value="${escapeHtml((m.mitbringen || []).join(", "))}" placeholder="Leibchen, Hütchen, Bälle" />
    </div>
    <div class="form-field">
      <label>Notiz</label>
      <textarea id="f-notiz" maxlength="1000">${escapeHtml(m.notiz || "")}</textarea>
    </div>
    <div class="form-grid">
      <div class="form-field">
        <label>Status</label>
        <select id="f-status">
          <option value="geplant"${m.status === "geplant" ? " selected" : ""}>Geplant</option>
          <option value="laufend"${m.status === "laufend" ? " selected" : ""}>Laufend</option>
          <option value="beendet"${m.status === "beendet" ? " selected" : ""}>Beendet</option>
        </select>
      </div>
    </div>
    <p class="muted" id="f-vorschau" style="margin-top:10px;"></p>
  `;

  const typSel = document.getElementById("f-typ");
  const aktualisiereVorschau = () => {
    const entwurf = sammleMassnahme(m);
    const soll = erzeugeSollTermine(entwurf, appData.sperrtage);
    const el = document.getElementById("f-vorschau");
    if (!soll.length) {
      el.textContent = "Diese Regel erzeugt keinen einzigen Termin. Liegt der Zeitraum vollständig in den Ferien, oder fehlt ein Wochentag?";
      el.style.color = "#c0392b";
    } else {
      el.textContent = "Diese Regel ergibt " + soll.length + " Termine, vom " + fmtDatum(soll[0].datum) + " bis " + fmtDatum(soll[soll.length - 1].datum) + ".";
      el.style.color = "";
    }
    // Camp außerhalb der Ferien ist ein Hinweis, keine Sperre.
    if (entwurf.typ === "camp" && soll.length) {
      const idx = baueSperrtagIndex(appData.sperrtage, entwurf.schuleId);
      const ausserhalb = soll.filter((s) => !(idx[s.datum] && idx[s.datum].ferien)).length;
      if (ausserhalb) el.textContent += " Achtung: " + ausserhalb + " Tage liegen außerhalb der Ferien.";
    }
  };
  typSel.addEventListener("change", () => {
    const t = MASSNAHME_TYPEN.find((x) => x.id === typSel.value) || MASSNAHME_TYPEN[0];
    document.getElementById("f-wt-block").style.display = t.muster === "taeglich" ? "none" : "";
    document.getElementById("f-ferien").checked = t.ferienAuslassen;
    document.getElementById("f-muster-hinweis").textContent = t.muster === "taeglich"
      ? "Ein Camp läuft täglich von Montag bis Freitag im gewählten Zeitraum."
      : "Die AG wiederholt sich wöchentlich an den gewählten Wochentagen.";
    aktualisiereVorschau();
  });
  typSel.dispatchEvent(new Event("change"));

  ["f-von", "f-bis", "f-startzeit", "f-endzeit", "f-ferien", "f-feiertage", "f-schliesstage", "f-schule"]
    .forEach((id) => { const el = document.getElementById(id); if (el) el.addEventListener("change", aktualisiereVorschau); });
  document.querySelectorAll(".f-wt").forEach((c) => c.addEventListener("change", aktualisiereVorschau));

  document.getElementById("f-schule").addEventListener("change", () => {
    // Ortsliste an die Schule anpassen, damit keine fremde Halle wählbar bleibt.
    const sid = document.getElementById("f-schule").value;
    const passend = (appData.orte || []).filter((o) => !sid || !o.schuleId || o.schuleId === sid);
    const sel = document.getElementById("f-ort");
    const alt = sel.value;
    sel.innerHTML = `<option value="">Bitte wählen</option>` + passend.map((o) =>
      `<option value="${escapeHtml(o.id)}">${escapeHtml(o.name)}${o.schuleId ? "" : " (vereinseigen)"}</option>`).join("");
    sel.value = passend.some((o) => o.id === alt) ? alt : "";
  });

  oeffneOverlay("massnahme-overlay");
}

function sammleMassnahme(basis) {
  const m = Object.assign({}, basis);
  const v = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };
  const c = (id) => { const el = document.getElementById(id); return el ? el.checked : false; };

  m.titel = v("f-titel").trim();
  m.typ = v("f-typ");
  m.schuleId = v("f-schule");
  m.ortId = v("f-ort");
  m.rahmen = v("f-rahmen");
  m.zielgruppe = v("f-zielgruppe").trim();
  m.verantwortlichUsername = v("f-verantwortlich");
  m.vorbereitungMin = Number(v("f-vor")) || 0;
  m.nachbereitungMin = Number(v("f-nach")) || 0;
  m.notiz = v("f-notiz").trim();
  m.status = v("f-status");
  m.mitbringen = v("f-mitbringen").split(",").map((s) => s.trim()).filter(Boolean);
  m.teamUsernames = Array.from(document.querySelectorAll(".f-team:checked")).map((x) => x.value);

  const t = MASSNAHME_TYPEN.find((x) => x.id === m.typ) || MASSNAHME_TYPEN[0];
  m.regel = Object.assign({}, basis.regel, {
    muster: t.muster,
    wochentage: t.muster === "taeglich" ? [] : Array.from(document.querySelectorAll(".f-wt:checked")).map((x) => Number(x.value)),
    startDatum: v("f-von"),
    endDatum: v("f-bis"),
    startZeit: v("f-startzeit"),
    endZeit: v("f-endzeit"),
    ferienAuslassen: c("f-ferien"),
    feiertageAuslassen: c("f-feiertage"),
    schliesstageAuslassen: c("f-schliesstage")
  });
  m.schuljahr = schuljahrAusIso(m.regel.startDatum, SCHULJAHR_BEGINN_MONAT);
  return m;
}

function speichereMassnahme() {
  const basis = offeneMassnahmeId ? massnahmeVon(offeneMassnahmeId) : window.__neueMassnahme;
  if (!basis) return;
  const m = sammleMassnahme(basis);

  if (!m.titel) { alert("Bitte eine Bezeichnung eintragen."); return; }
  if (!m.schuleId) { alert("Bitte eine Schule wählen."); return; }
  if (!m.regel.startDatum || !m.regel.endDatum) { alert("Bitte Beginn und Ende eintragen."); return; }
  if (m.regel.endDatum < m.regel.startDatum) { alert("Das Ende liegt vor dem Beginn."); return; }
  if (!m.regel.startZeit || !m.regel.endZeit) { alert("Bitte die Uhrzeiten eintragen."); return; }
  if (minutenAusZeit(m.regel.endZeit) <= minutenAusZeit(m.regel.startZeit)) { alert("Die Endzeit muss nach der Startzeit liegen."); return; }
  if (m.regel.muster === "woechentlich" && !m.regel.wochentage.length) { alert("Bitte mindestens einen Wochentag wählen."); return; }

  m.geaendertAm = new Date().toISOString();

  if (offeneMassnahmeId) {
    const i = appData.massnahmen.findIndex((x) => x.id === offeneMassnahmeId);
    if (i >= 0) appData.massnahmen[i] = m;
  } else {
    appData.massnahmen.push(m);
  }
  schliesseOverlay("massnahme-overlay");

  // Nach dem Speichern gleich den Abgleich anbieten -- ohne Termine nützt die
  // Maßnahme nichts, und der Dialog zeigt vorher an, was passiert.
  markDirty();
  oeffneAbgleich(m.id);
  renderMassnahmen();
}

function loescheMassnahme() {
  if (!offeneMassnahmeId) return;
  const m = massnahmeVon(offeneMassnahmeId);
  if (!m) return;
  const eigene = (appData.termine || []).filter((t) => t.massnahmeId === m.id);
  const gemeldet = eigene.filter(terminIstGemeldet).length;
  let text = "„" + m.titel + "“ mit " + eigene.length + " Terminen wirklich löschen?";
  if (gemeldet) text += "\n\nDarunter sind " + gemeldet + " bereits gemeldete Termine. Diese Nachweisdaten gehen verloren.";
  if (!confirm(text)) return;

  appData.massnahmen = appData.massnahmen.filter((x) => x.id !== m.id);
  appData.termine = appData.termine.filter((t) => t.massnahmeId !== m.id);
  offeneMassnahmeId = null;
  schliesseOverlay("massnahme-overlay");
  markDirty();
  renderMassnahmen();
}

// ---------------------------------------------------------------------------
// Abgleich-Dialog
// ---------------------------------------------------------------------------

function oeffneAbgleich(massnahmeId) {
  if (!canEdit()) return;
  const m = massnahmeVon(massnahmeId);
  if (!m) return;
  const stichtagVorschlag = heuteIso();

  document.getElementById("abgleich-inhalt").innerHTML = `
    <p class="muted">Die Termine von „${escapeHtml(m.titel)}“ werden nach der hinterlegten Regel neu erzeugt.</p>
    <div class="form-field" style="margin-top:12px;">
      <label>Ab welchem Tag soll neu geplant werden?</label>
      <input type="date" id="f-stichtag" value="${escapeHtml(stichtagVorschlag)}" />
    </div>
    <p class="muted">Alles vor diesem Tag bleibt unverändert — ebenso jeder bereits gemeldete Termin, auch ein künftiger.</p>
    <div id="abgleich-vorschau" style="margin-top:14px;"></div>
  `;

  const rechne = () => {
    const stichtag = document.getElementById("f-stichtag").value || stichtagVorschlag;
    const plan = planeAbgleich(m, appData.termine, appData.sperrtage, stichtag, terminInBestaetigtemNachweis);
    offenerAbgleich = plan;
    const z = plan.zahlen;
    document.getElementById("abgleich-vorschau").innerHTML = `
      <div class="hinweis ${z.entfernt ? "warnung" : "info"}">${escapeHtml(abgleichText(plan))}</div>
      <div class="kennzahlen">
        <div class="kennzahl"><div class="kz-wert">${z.neu}</div><div class="kz-label">neu</div></div>
        <div class="kennzahl"><div class="kz-wert">${z.aktualisiert}</div><div class="kz-label">neue Zeiten</div></div>
        <div class="kennzahl"><div class="kz-wert">${z.unangetastet}</div><div class="kz-label">unverändert</div></div>
        <div class="kennzahl"><div class="kz-wert" style="${z.entfernt ? "color:var(--red)" : ""}">${z.entfernt}</div><div class="kz-label">werden gelöscht</div></div>
      </div>`;
  };
  document.getElementById("f-stichtag").addEventListener("change", rechne);
  rechne();
  oeffneOverlay("abgleich-overlay");
}

function wendeAbgleichVomDialogAn() {
  if (!offenerAbgleich) return;
  appData.termine = wendeAbgleichAn(offenerAbgleich, appData.termine, uuid);
  offenerAbgleich = null;
  schliesseOverlay("abgleich-overlay");
  markDirty();
  renderMassnahmen();
  if (aktuellerTab === "woche") renderWoche();
}

// ---------------------------------------------------------------------------
// Administrieren
// ---------------------------------------------------------------------------

function renderAdmin() {
  const el = document.getElementById("admin-inhalt");
  if (!el) return;
  if (!canAdmin()) { el.innerHTML = ""; return; }
  if (adminBereich === "schulen") renderAdminSchulen(el);
  else if (adminBereich === "orte") renderAdminOrte(el);
  else if (adminBereich === "sperrtage") renderAdminSperrtage(el);
  else if (adminBereich === "gruende") renderAdminGruende(el);
  else if (adminBereich === "schuljahr") renderAdminSchuljahr(el);
}

function renderAdminSchulen(el) {
  const liste = appData.schulen || [];
  el.innerHTML = `<div class="card">
    <div class="card-header-row"><h2>Schulen</h2>
      <button type="button" class="btn success small" id="btn-neue-schule">+ Neue Schule</button></div>
    ${liste.length ? liste.map((s) => `
      <div class="liste-zeile">
        <div class="termin-farbe" style="background:${escapeHtml(s.farbe || "#1a56a0")};width:5px;align-self:stretch;border-radius:3px;"></div>
        <div class="lz-haupt">
          <div class="lz-titel">${escapeHtml(s.name)}${s.aktiv === false ? " (inaktiv)" : ""}</div>
          <div class="lz-unter">${escapeHtml([s.strasse, [s.plz, s.ort].filter(Boolean).join(" ")].filter(Boolean).join(", "))}</div>
          <div class="lz-unter">${escapeHtml((s.ansprechpartner && s.ansprechpartner.name) || "")}${
            s.ansprechpartner && s.ansprechpartner.telefon ? " · " + escapeHtml(s.ansprechpartner.telefon) : ""}</div>
        </div>
        <div class="lz-knoepfe"><button type="button" class="btn secondary small" data-schule="${escapeHtml(s.id)}">Bearbeiten</button></div>
      </div>`).join("") : `<div class="empty-state">Noch keine Schule angelegt.</div>`}
  </div>
  <div class="card" id="schule-form-card" style="display:none;"><div id="schule-form"></div></div>`;

  document.getElementById("btn-neue-schule").addEventListener("click", () => oeffneSchulForm(null));
  el.querySelectorAll("[data-schule]").forEach((b) => b.addEventListener("click", () => oeffneSchulForm(b.getAttribute("data-schule"))));
}

function oeffneSchulForm(id) {
  const s = id ? schuleVon(id) : {
    id: uuid(), name: "", kurz: "",
    farbe: SCHUL_FARBEN[(appData.schulen || []).length % SCHUL_FARBEN.length],
    strasse: "", plz: "", ort: "",
    ansprechpartner: { name: "", funktion: "", email: "", telefon: "" },
    bestaetigungEmail: "", notiz: "", aktiv: true
  };
  if (!s) return;
  const ap = s.ansprechpartner || {};
  document.getElementById("schule-form-card").style.display = "";
  document.getElementById("schule-form").innerHTML = `
    <h2>${id ? "Schule bearbeiten" : "Neue Schule"}</h2>
    <div class="form-grid wide">
      <div class="form-field"><label>Name</label><input type="text" id="s-name" value="${escapeHtml(s.name)}" /></div>
      <div class="form-field"><label>Kürzel (fürs Wochenraster)</label><input type="text" id="s-kurz" maxlength="12" value="${escapeHtml(s.kurz)}" /></div>
      <div class="form-field"><label>Farbe</label><select id="s-farbe">${SCHUL_FARBEN.map((f) =>
        `<option value="${f}"${s.farbe === f ? " selected" : ""}>${f}</option>`).join("")}</select></div>
      <div class="form-field"><label>Straße</label><input type="text" id="s-strasse" value="${escapeHtml(s.strasse)}" /></div>
      <div class="form-field"><label>PLZ</label><input type="text" id="s-plz" maxlength="5" value="${escapeHtml(s.plz)}" /></div>
      <div class="form-field"><label>Ort</label><input type="text" id="s-ort" value="${escapeHtml(s.ort)}" /></div>
    </div>
    <h3>Ansprechpartner</h3>
    <div class="form-grid wide">
      <div class="form-field"><label>Name</label><input type="text" id="s-ap-name" value="${escapeHtml(ap.name || "")}" /></div>
      <div class="form-field"><label>Funktion</label><input type="text" id="s-ap-funktion" value="${escapeHtml(ap.funktion || "")}" /></div>
      <div class="form-field"><label>Telefon</label><input type="tel" id="s-ap-telefon" value="${escapeHtml(ap.telefon || "")}" /></div>
      <div class="form-field"><label>E-Mail</label><input type="email" id="s-ap-email" value="${escapeHtml(ap.email || "")}" /></div>
    </div>
    <div class="form-field">
      <label>E-Mail für Bestätigungslinks</label>
      <input type="email" id="s-best-email" value="${escapeHtml(s.bestaetigungEmail || "")}" placeholder="sekretariat@…" />
    </div>
    <p class="muted">An diese Adresse geht der Link, mit dem die Schule einen Durchführungsnachweis bestätigt. Bleibt sie leer, lässt sich der Link nur von Hand weitergeben.</p>
    <label class="check-zeile"><input type="checkbox" id="s-aktiv"${s.aktiv !== false ? " checked" : ""} /> Aktiv</label>
    <div class="btn-row" style="justify-content:flex-start;">
      <button type="button" class="btn success" id="btn-schule-speichern">Speichern</button>
      <button type="button" class="btn secondary" id="btn-schule-abbrechen">Abbrechen</button>
      ${id ? `<button type="button" class="btn secondary" id="btn-schule-loeschen">Löschen</button>` : ""}
    </div>`;

  document.getElementById("btn-schule-abbrechen").addEventListener("click", () => {
    document.getElementById("schule-form-card").style.display = "none";
  });
  document.getElementById("btn-schule-speichern").addEventListener("click", () => {
    const v = (x) => document.getElementById(x).value.trim();
    if (!v("s-name")) { alert("Bitte einen Namen eintragen."); return; }
    const neu = Object.assign({}, s, {
      name: v("s-name"), kurz: v("s-kurz") || v("s-name").slice(0, 8),
      farbe: document.getElementById("s-farbe").value,
      strasse: v("s-strasse"), plz: v("s-plz"), ort: v("s-ort"),
      ansprechpartner: { name: v("s-ap-name"), funktion: v("s-ap-funktion"), telefon: v("s-ap-telefon"), email: v("s-ap-email") },
      bestaetigungEmail: v("s-best-email"),
      aktiv: document.getElementById("s-aktiv").checked
    });
    const i = (appData.schulen || []).findIndex((x) => x.id === s.id);
    if (i >= 0) appData.schulen[i] = neu; else appData.schulen.push(neu);
    markDirty();
    fuelleFilter();
    renderAdmin();
  });
  const del = document.getElementById("btn-schule-loeschen");
  if (del) del.addEventListener("click", () => {
    const betroffen = (appData.massnahmen || []).filter((m) => m.schuleId === s.id).length;
    if (betroffen) { alert("Diese Schule hat noch " + betroffen + " Maßnahmen. Bitte diese zuerst löschen oder umhängen."); return; }
    if (!confirm("„" + s.name + "“ wirklich löschen?")) return;
    appData.schulen = appData.schulen.filter((x) => x.id !== s.id);
    appData.orte = appData.orte.filter((o) => o.schuleId !== s.id);
    markDirty();
    fuelleFilter();
    renderAdmin();
  });
}

function renderAdminOrte(el) {
  const liste = appData.orte || [];
  el.innerHTML = `<div class="card">
    <div class="card-header-row"><h2>Orte</h2>
      <button type="button" class="btn success small" id="btn-neuer-ort">+ Neuer Ort</button></div>
    <p class="muted">Turnhallen, Sportplätze und Räume — je Schule oder vereinseigen. Zugang und Ausstattung stehen dem Übungsleiter beim Termin zur Verfügung.</p>
    ${liste.length ? liste.map((o) => {
      const s = schuleVon(o.schuleId);
      return `<div class="liste-zeile"><div class="lz-haupt">
        <div class="lz-titel">${escapeHtml(o.name)}</div>
        <div class="lz-unter">${escapeHtml(s ? s.name : "vereinseigen")}${o.zugang ? " · Zugang: " + escapeHtml(o.zugang) : ""}</div>
        <div class="lz-unter">${(o.ausstattung || []).length ? "Vor Ort: " + escapeHtml((o.ausstattung || []).join(", ")) : "keine Ausstattung hinterlegt"}</div>
      </div><div class="lz-knoepfe"><button type="button" class="btn secondary small" data-ort="${escapeHtml(o.id)}">Bearbeiten</button></div></div>`;
    }).join("") : `<div class="empty-state">Noch kein Ort angelegt.</div>`}
  </div>
  <div class="card" id="ort-form-card" style="display:none;"><div id="ort-form"></div></div>`;

  document.getElementById("btn-neuer-ort").addEventListener("click", () => oeffneOrtForm(null));
  el.querySelectorAll("[data-ort]").forEach((b) => b.addEventListener("click", () => oeffneOrtForm(b.getAttribute("data-ort"))));
}

function oeffneOrtForm(id) {
  const o = id ? ortVon(id) : {
    id: uuid(), schuleId: "", name: "", art: "halle",
    strasse: "", plz: "", ort: "", zugang: "", schluessel: "",
    ausstattung: [], notiz: "", aktiv: true
  };
  if (!o) return;
  document.getElementById("ort-form-card").style.display = "";
  document.getElementById("ort-form").innerHTML = `
    <h2>${id ? "Ort bearbeiten" : "Neuer Ort"}</h2>
    <div class="form-grid wide">
      <div class="form-field"><label>Name</label><input type="text" id="o-name" value="${escapeHtml(o.name)}" placeholder="z. B. Turnhalle Nord" /></div>
      <div class="form-field"><label>Gehört zu</label><select id="o-schule"><option value="">vereinseigen</option>${
        (appData.schulen || []).map((s) => `<option value="${escapeHtml(s.id)}"${o.schuleId === s.id ? " selected" : ""}>${escapeHtml(s.name)}</option>`).join("")}</select></div>
      <div class="form-field"><label>Art</label><select id="o-art">${ORT_ARTEN.map((a) =>
        `<option value="${escapeHtml(a.id)}"${o.art === a.id ? " selected" : ""}>${escapeHtml(a.name)}</option>`).join("")}</select></div>
    </div>
    <p class="muted">Anschrift nur ausfüllen, wenn sie von der Schule abweicht.</p>
    <div class="form-grid">
      <div class="form-field"><label>Straße</label><input type="text" id="o-strasse" value="${escapeHtml(o.strasse)}" /></div>
      <div class="form-field"><label>PLZ</label><input type="text" id="o-plz" maxlength="5" value="${escapeHtml(o.plz)}" /></div>
      <div class="form-field"><label>Ort</label><input type="text" id="o-ort" value="${escapeHtml(o.ort)}" /></div>
    </div>
    <div class="form-field"><label>Zugang</label><input type="text" id="o-zugang" value="${escapeHtml(o.zugang)}" placeholder="Wie kommt man hinein?" /></div>
    <div class="form-field"><label>Schlüssel</label><input type="text" id="o-schluessel" value="${escapeHtml(o.schluessel)}" placeholder="Wer hat den Schlüssel?" /></div>
    <div class="form-field"><label>Vor Ort vorhanden (mit Komma trennen)</label>
      <input type="text" id="o-ausstattung" value="${escapeHtml((o.ausstattung || []).join(", "))}" placeholder="Tore klein, Matten, Bälle" /></div>
    <div class="btn-row" style="justify-content:flex-start;">
      <button type="button" class="btn success" id="btn-ort-speichern">Speichern</button>
      <button type="button" class="btn secondary" id="btn-ort-abbrechen">Abbrechen</button>
      ${id ? `<button type="button" class="btn secondary" id="btn-ort-loeschen">Löschen</button>` : ""}
    </div>`;

  document.getElementById("btn-ort-abbrechen").addEventListener("click", () => {
    document.getElementById("ort-form-card").style.display = "none";
  });
  document.getElementById("btn-ort-speichern").addEventListener("click", () => {
    const v = (x) => document.getElementById(x).value.trim();
    if (!v("o-name")) { alert("Bitte einen Namen eintragen."); return; }
    const neu = Object.assign({}, o, {
      name: v("o-name"), schuleId: document.getElementById("o-schule").value,
      art: document.getElementById("o-art").value,
      strasse: v("o-strasse"), plz: v("o-plz"), ort: v("o-ort"),
      zugang: v("o-zugang"), schluessel: v("o-schluessel"),
      ausstattung: v("o-ausstattung").split(",").map((x) => x.trim()).filter(Boolean)
    });
    const i = (appData.orte || []).findIndex((x) => x.id === o.id);
    if (i >= 0) appData.orte[i] = neu; else appData.orte.push(neu);
    markDirty();
    renderAdmin();
  });
  const del = document.getElementById("btn-ort-loeschen");
  if (del) del.addEventListener("click", () => {
    const betroffen = (appData.massnahmen || []).filter((m) => m.ortId === o.id).length;
    if (betroffen) { alert("Dieser Ort wird von " + betroffen + " Maßnahmen genutzt."); return; }
    if (!confirm("„" + o.name + "“ wirklich löschen?")) return;
    appData.orte = appData.orte.filter((x) => x.id !== o.id);
    markDirty();
    renderAdmin();
  });
}

function renderAdminSperrtage(el) {
  const liste = (appData.sperrtage || []).slice().sort((a, b) => (a.von < b.von ? -1 : 1));
  const heute = heuteIso();
  const kommend = liste.filter((s) => s.bis >= heute);
  const vergangen = liste.filter((s) => s.bis < heute);

  const zeile = (s) => {
    const art = SPERRTAG_ARTEN.find((a) => a.id === s.art);
    const schule = schuleVon(s.schuleId);
    return `<div class="liste-zeile"><div class="lz-haupt">
      <div class="lz-titel">${escapeHtml(s.name)}</div>
      <div class="lz-unter">${fmtDatum(s.von)}${s.von !== s.bis ? " bis " + fmtDatum(s.bis) : ""} · ${escapeHtml(art ? art.name : s.art)}${
        schule ? " · nur " + escapeHtml(schule.name) : ""}</div>
    </div><div class="lz-knoepfe">
      <button type="button" class="btn secondary small" data-sperr-del="${escapeHtml(s.id)}">Entfernen</button>
    </div></div>`;
  };

  el.innerHTML = `<div class="card">
    <h2>Ferien, Feiertage und Schließtage</h2>
    <p class="muted">AG-Termine fallen an diesen Tagen weg, Camps liegen bewusst in den Ferien. Ein Eintrag ohne Schule gilt für alle.</p>
    <div class="form-grid wide">
      <div class="form-field"><label>Bezeichnung</label><input type="text" id="sp-name" placeholder="z. B. Projektwoche" /></div>
      <div class="form-field"><label>Art</label><select id="sp-art">${SPERRTAG_ARTEN.map((a) =>
        `<option value="${escapeHtml(a.id)}">${escapeHtml(a.name)}</option>`).join("")}</select></div>
      <div class="form-field"><label>Von</label><input type="date" id="sp-von" /></div>
      <div class="form-field"><label>Bis</label><input type="date" id="sp-bis" /></div>
      <div class="form-field"><label>Nur für</label><select id="sp-schule"><option value="">alle Schulen</option>${
        (appData.schulen || []).map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join("")}</select></div>
    </div>
    <div class="btn-row" style="justify-content:flex-start;">
      <button type="button" class="btn success small" id="btn-sperr-add">Hinzufügen</button>
      <button type="button" class="btn secondary small" id="btn-seed">Thüringer Ferien einspielen</button>
    </div>
    <p class="muted" id="seed-echo"></p>
  </div>
  <div class="card"><h2>Kommend (${kommend.length})</h2>
    ${kommend.length ? kommend.map(zeile).join("") : `<div class="empty-state">Nichts hinterlegt.</div>`}</div>
  ${vergangen.length ? `<div class="card"><h2>Vergangen (${vergangen.length})</h2>${vergangen.map(zeile).join("")}</div>` : ""}`;

  document.getElementById("btn-sperr-add").addEventListener("click", () => {
    const name = document.getElementById("sp-name").value.trim();
    const von = document.getElementById("sp-von").value;
    const bis = document.getElementById("sp-bis").value || von;
    if (!name || !von) { alert("Bitte Bezeichnung und Datum eintragen."); return; }
    if (bis < von) { alert("Das Ende liegt vor dem Beginn."); return; }
    appData.sperrtage.push({
      id: uuid(), schuljahr: schuljahrAusIso(von, SCHULJAHR_BEGINN_MONAT),
      name, von, bis,
      art: document.getElementById("sp-art").value,
      schuleId: document.getElementById("sp-schule").value || null,
      quelle: "manuell"
    });
    markDirty();
    renderAdmin();
  });
  document.getElementById("btn-seed").addEventListener("click", () => {
    const n = spieleSeedEin(appData);
    document.getElementById("seed-echo").textContent = n
      ? n + " Einträge ergänzt."
      : "Es war schon alles vorhanden — es wurde nichts überschrieben.";
    if (n) { markDirty(); renderAdmin(); }
  });
  el.querySelectorAll("[data-sperr-del]").forEach((b) => b.addEventListener("click", () => {
    const id = b.getAttribute("data-sperr-del");
    const s = (appData.sperrtage || []).find((x) => x.id === id);
    if (!s || !confirm("„" + s.name + "“ entfernen? Bereits erzeugte Termine ändern sich dadurch nicht von selbst.")) return;
    appData.sperrtage = appData.sperrtage.filter((x) => x.id !== id);
    markDirty();
    renderAdmin();
  }));
}

function renderAdminGruende(el) {
  const liste = appData.ausfallgruende || [];
  el.innerHTML = `<div class="card">
    <h2>Ausfallgründe</h2>
    <p class="muted">Diese Gründe stehen beim Melden zur Auswahl. Der Nachweis schlüsselt die Ausfälle danach auf — und trennt, was dem Verein zur Last fällt.</p>
    <div class="form-grid">
      <div class="form-field"><label>Bezeichnung</label><input type="text" id="ag-name" placeholder="z. B. Halle gesperrt" /></div>
    </div>
    <label class="check-zeile"><input type="checkbox" id="ag-vv" /> Fällt dem Verein zur Last</label>
    <div class="btn-row" style="justify-content:flex-start;">
      <button type="button" class="btn success small" id="btn-ag-add">Hinzufügen</button>
    </div>
    ${liste.length ? liste.map((g) => `<div class="liste-zeile"><div class="lz-haupt">
      <div class="lz-titel">${escapeHtml(g.bezeichnung)}</div>
      <div class="lz-unter">${g.vereinsverschulden ? "fällt dem Verein zur Last" : "liegt nicht beim Verein"}</div>
    </div><div class="lz-knoepfe">
      <button type="button" class="btn secondary small" data-ag-del="${escapeHtml(g.id)}">Entfernen</button>
    </div></div>`).join("") : `<div class="empty-state">Keine Gründe hinterlegt.</div>`}
  </div>`;

  document.getElementById("btn-ag-add").addEventListener("click", () => {
    const name = document.getElementById("ag-name").value.trim();
    if (!name) return;
    appData.ausfallgruende.push({ id: uuid(), bezeichnung: name, vereinsverschulden: document.getElementById("ag-vv").checked });
    markDirty();
    renderAdmin();
  });
  el.querySelectorAll("[data-ag-del]").forEach((b) => b.addEventListener("click", () => {
    const id = b.getAttribute("data-ag-del");
    const benutzt = (appData.termine || []).filter((t) => t.ausfallgrundId === id).length;
    if (benutzt && !confirm("Dieser Grund steht an " + benutzt + " Terminen. Diese behalten ihn, er ist nur nicht mehr wählbar. Fortfahren?")) return;
    appData.ausfallgruende = appData.ausfallgruende.filter((x) => x.id !== id);
    markDirty();
    renderAdmin();
  }));
}

function renderAdminSchuljahr(el) {
  const jahre = new Map();
  (appData.massnahmen || []).forEach((m) => {
    const j = m.schuljahr || "";
    if (!jahre.has(j)) jahre.set(j, { massnahmen: 0, termine: 0, nachweise: 0 });
    jahre.get(j).massnahmen++;
  });
  (appData.termine || []).forEach((t) => {
    const m = massnahmeVon(t.massnahmeId);
    const j = (m && m.schuljahr) || "";
    if (jahre.has(j)) jahre.get(j).termine++;
  });
  (appData.nachweise || []).forEach((n) => {
    const j = n.schuljahr || "";
    if (jahre.has(j)) jahre.get(j).nachweise++;
  });

  const aktuell = schuljahrAusIso(heuteIso(), SCHULJAHR_BEGINN_MONAT);
  let zeilen = "";
  Array.from(jahre.keys()).sort().forEach((j) => {
    const z = jahre.get(j);
    const laufend = j === aktuell;
    zeilen += `<div class="liste-zeile"><div class="lz-haupt">
      <div class="lz-titel">${escapeHtml(j || "ohne Zuordnung")}${laufend ? " (laufend)" : ""}</div>
      <div class="lz-unter">${z.massnahmen} Maßnahmen · ${z.termine} Termine · ${z.nachweise} Nachweise</div>
    </div><div class="lz-knoepfe">
      ${laufend || !j ? `<span class="muted">nicht abschließbar</span>`
        : `<button type="button" class="btn secondary small" data-arch="${escapeHtml(j)}">Ins Archiv verschieben</button>`}
    </div></div>`;
  });

  el.innerHTML = `<div class="card">
    <h2>Schuljahr abschließen</h2>
    <p class="muted">
      Ein abgeschlossenes Schuljahr wandert samt Terminen und Nachweisen in eine
      eigene Archivdatei. Die laufende Datei bleibt dadurch klein und schnell —
      bei jedem Speichern wird sie vollständig übertragen. Schulen und Orte
      bleiben unverändert bestehen, ausgestellte Nachweise bleiben erhalten.
    </p>
    <p class="hinweis warnung">Das laufende Schuljahr lässt sich nicht abschließen.</p>
    ${zeilen || `<div class="empty-state">Es ist noch nichts zu archivieren.</div>`}
    <p class="muted" id="arch-echo"></p>
  </div>`;

  el.querySelectorAll("[data-arch]").forEach((b) => b.addEventListener("click", async () => {
    const j = b.getAttribute("data-arch");
    const z = jahre.get(j);
    if (!confirm("Schuljahr " + j + " ins Archiv verschieben?\n\n" +
      z.massnahmen + " Maßnahmen, " + z.termine + " Termine und " + z.nachweise + " Nachweise werden verschoben.")) return;
    b.disabled = true;
    try {
      await flushPending();
      const r = await archiviereSchuljahr(j);
      const daten = await gatewayLoad();
      appData = normalizeData(daten);
      document.getElementById("arch-echo").textContent = "Verschoben: " +
        (r.verschoben ? Object.entries(r.verschoben).map(([k, v]) => v + " " + k).join(", ") : "");
      renderAdmin();
    } catch (e) {
      document.getElementById("arch-echo").textContent = "Fehlgeschlagen: " + e.message;
      b.disabled = false;
    }
  }));
}

// ---------------------------------------------------------------------------
// Verdrahtung der Dialogknöpfe (einmalig)
// ---------------------------------------------------------------------------

function setupMassnahmenKnoepfe() {
  const n1 = document.getElementById("btn-neue-ag");
  if (n1) n1.addEventListener("click", () => oeffneMassnahme(null, "ag"));
  const n2 = document.getElementById("btn-neues-camp");
  if (n2) n2.addEventListener("click", () => oeffneMassnahme(null, "camp"));
  const sp = document.getElementById("btn-massnahme-speichern");
  if (sp) sp.addEventListener("click", speichereMassnahme);
  const lo = document.getElementById("btn-massnahme-loeschen");
  if (lo) lo.addEventListener("click", loescheMassnahme);
  const ab = document.getElementById("btn-abgleich-anwenden");
  if (ab) ab.addEventListener("click", wendeAbgleichVomDialogAn);
}
