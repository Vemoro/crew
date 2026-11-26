import { canSee, missingQualifications, shiftQuery } from "./model.js";

const esc = value => String(value ?? "").replace(/[&<>"']/g, char =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const money = cents => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
const date = (value, timezone) => new Intl.DateTimeFormat("de-DE",
  { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(value));
const hidden = (name, value) => `<input type="hidden" name="${name}" value="${esc(value)}">`;
const post = (action, content, attrs = "") => `<form method="post" action="${action}" ${attrs}>${content}</form>`;
const button = text => `<button type="submit">${text}</button>`;
const label = (text, content) => `<label><span>${esc(text)}</span>${content}</label>`;
const textarea = (name, limit, value = "", required = false) =>
  `<textarea name="${name}" maxlength="${limit}" rows="2" ${required ? "required" : ""}>${esc(value)}</textarea>`;
const box = (title, body, id = "") => `<section ${id ? `id="${id}"` : ""}><h2>${esc(title)}</h2>${body}</section>`;
const empty = text => `<p class="muted">${text}</p>`;
const statusLabel = { pending: "In Prüfung", active: "Im Pool", rejected: "Abgelehnt",
  interested: "Interesse gemeldet", assigned: "Eingeteilt", withdrawn: "Zurückgezogen",
  draft: "Entwurf", pool: "Im Pool sichtbar", invite: "Nur auf Einladung" };
const alert = message => message ? `<p class="form-error" role="alert">${esc(message)}</p>` : "";

function page(user, title, content) {
  const admin = user?.role === "admin";
  const nav = admin ? `<a href="/dispo#personal">Personal</a><a href="/dispo#einsaetze">Einsätze</a>`
    : user?.status === "active" ? `<a href="/#schichten">Schichten</a><a href="/#bewerbungen">Bewerbungen</a><a href="/#profil">Profil</a>`
      : user ? `<a href="/#bewerbungen">Bewerbung</a><a href="/#profil">Profil</a>`
      : `<a href="/anmelden">Anmelden</a><a href="/registrieren">Registrieren</a>`;
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${esc(title)} · Crew</title><link rel="stylesheet" href="/crew.css"></head><body>
    <a href="#inhalt" class="skip">Zum Inhalt</a>
    <header><div class="header-inner"><a class="brand" href="${admin ? "/dispo" : "/"}">Crew<span aria-hidden="true">.</span></a>
    <nav class="desktop-nav" aria-label="Hauptnavigation">${nav}</nav>
    ${user ? post("/abmelden", button("Abmelden"), 'class="sign-out"') : ""}
    <details class="mobile-nav"><summary>Menü</summary><nav aria-label="Hauptnavigation">${nav}</nav></details></div></header>
    <main id="inhalt" tabindex="-1">${content}</main></body></html>`;
}

function auth(path, message, values) {
  const registering = path === "/registrieren";
  const title = registering ? "Für den Personalpool bewerben" : "Bei Crew anmelden";
  return page(null, title, `<div class="narrow"><h1>${title}</h1>
    ${registering ? "<p>Die Dispo prüft deine Bewerbung. Den Status und deine Nachweise siehst du anschließend im Portal.</p>" : ""}
    ${alert(message)}
    ${post(registering ? "/registrieren" : "/anmelden", `
      ${registering ? label("Name", `<input name="name" maxlength="100" autocomplete="name" value="${esc(values?.get("name"))}" required>`) : ""}
      ${label("E-Mail-Adresse", `<input type="email" name="email" maxlength="254" autocomplete="email" value="${esc(values?.get("email"))}" required>`)}
      ${label(registering ? "Passwort (mindestens 12 Zeichen)" : "Passwort",
        `<input type="password" name="password" ${registering ? 'minlength="12"' : ""} maxlength="128" autocomplete="${registering ? "new-password" : "current-password"}" required>`)}
      ${registering ? label("Verfügbarkeit (optional)", textarea("availability", 1000, values?.get("availability"))) : ""}
      ${button(registering ? "Bewerbung starten" : "Anmelden")}`)}
    <p>${registering ? '<a href="/anmelden">Ich habe bereits ein Konto</a>' : '<a href="/registrieren">Für den Pool bewerben</a>'}</p></div>`);
}

function qualifications(db, person) {
  return db.prepare(`SELECT id,name,verified,valid_until,revision,evidence IS NOT NULL AS has_evidence
    FROM qualifications WHERE person=? ORDER BY name`).all(person);
}

function qualificationList(db, person, admin = false) {
  const rows = qualifications(db, person);
  return rows.length ? `<ul class="items">${rows.map(q => `<li><strong>${esc(q.name)}</strong>
    <span class="muted">${q.verified ? "Geprüft" : "Prüfung offen"}${q.valid_until ? " · Gültig bis " + esc(q.valid_until) : ""}</span>
    ${q.has_evidence ? `<a href="/nachweis/${q.id}">PDF herunterladen</a>` : ""}
    ${admin && !q.verified ? post("/dispo/nachweis", hidden("qualification", q.id) + hidden("revision", q.revision)
      + button("Als geprüft markieren")) : ""}
    </li>`).join("")}</ul>` : empty("Noch keine Qualifikationen eingetragen.");
}

export function renderEvidence(db, res, user, id) {
  if (!user) return false;
  const entry = db.prepare("SELECT person, evidence FROM qualifications WHERE id=?").get(id);
  if (!entry?.evidence || (user.role !== "admin" && user.id !== entry.person)) return false;
  res.writeHead(200, {
    "Content-Type": "application/pdf",
    "Content-Disposition": 'attachment; filename="qualifikationsnachweis.pdf"',
  }).end(entry.evidence);
  return true;
}

function shiftFacts(shift, timezone) {
  return `<p class="muted">${esc(shift.location)} · ${esc(date(shift.starts, timezone))} bis ${esc(date(shift.ends, timezone))}</p>
    <p class="facts"><strong>${money(shift.cents)}</strong> pro Schicht · ${shift.filled} von ${shift.slots} Plätzen besetzt</p>`;
}

function shiftList(shifts, timezone, detail) {
  return shifts.length ? `<ul class="items">${shifts.map(shift => `<li><h3>${esc(shift.event_title)} · ${esc(shift.title)}</h3>
    ${shiftFacts(shift, timezone)}${detail(shift)}</li>`).join("")}</ul>` : "";
}

function staffHome(db, user, timezone) {
  const profileForm = post("/verfuegbarkeit", label("Typische Verfügbarkeit oder Hinweis", textarea("availability", 1000, user.availability))
    + button("Verfügbarkeit speichern"));
  const qualificationForm = post("/qualifikation", `<h3>Qualifikation einreichen oder erneuern</h3>
    <p class="muted">Wenn du dieselbe Bezeichnung verwendest, ersetzt du den bisherigen Eintrag. Die Dispo prüft den neuen Stand.</p>
    ${label("Bezeichnung", '<input name="name" required maxlength="100">')}
    ${label("Gültig bis (optional)", '<input name="validUntil" type="date">')}
    ${label("Nachweis als PDF (optional, bis 2 MB)", '<input name="evidence" type="file" accept="application/pdf">')}
    ${button("Qualifikation einreichen")}`, 'enctype="multipart/form-data"');
  const profile = box("Profil und Qualifikationen", profileForm + qualificationList(db, user.id)
    + (user.status !== "rejected" ? qualificationForm : ""), "profil");
  const heading = `<p class="eyebrow">Personalportal</p><h1>Hallo, ${esc(user.name)}</h1>`;
  if (user.status !== "active") {
    return page(user, "Meine Bewerbung", heading + box("Meine Bewerbung", `<p class="badge">${statusLabel[user.status]}</p>
      ${user.review_note ? `<p>${esc(user.review_note)}</p>` : ""}`, "bewerbungen") + profile);
  }
  const now = new Date().toISOString();
  const responses = db.prepare(shiftQuery + ` JOIN responses r ON r.shift=s.id
    WHERE r.person=? ORDER BY s.starts`).all(user.id);
  const responseState = new Map(db.prepare("SELECT shift, status FROM responses WHERE person=?").all(user.id)
    .map(row => [row.shift, row.status]));
  const upcoming = responses.filter(shift => shift.ends > now && responseState.get(shift.id) === "assigned");
  const open = db.prepare(shiftQuery + " WHERE s.starts>? AND s.visibility<>'draft' ORDER BY s.starts").all(now)
    .filter(shift => canSee(db, shift, user.id) && !["assigned", "interested"].includes(responseState.get(shift.id)));
  const interested = responses.filter(shift => responseState.get(shift.id) === "interested" && shift.starts > now);
  const tasks = interested.flatMap(shift => missingQualifications(db, shift, user.id, "assign", timezone)
    .map(name => `<li>${esc(shift.title)} · ${esc(name)} prüfen lassen</li>`));
  const abort = (shift, text) => shift.starts > now
    ? post("/absagen", hidden("shift", shift.id) + button(text), 'class="secondary"') : "";
  return page(user, "Meine Einsätze", heading
    + `<div class="overview"><div><span class="muted">Bevorstehende Schichten</span><strong>${upcoming.length}</strong></div>
    <div><span class="muted">Erwartete Vergütung</span><strong>${money(upcoming.reduce((sum, shift) => sum + shift.cents, 0))}</strong></div></div>`
    + box("Als Nächstes", shiftList(upcoming, timezone, shift =>
      `<p class="preserve">${esc(shift.instructions)}</p>${abort(shift, "Einsatz absagen")}`) || empty("Du bist für keine bevorstehende Schicht eingeteilt."))
    + box("Offene Schichten", shiftList(open, timezone, shift =>
      `<a href="/schichten/${shift.id}">${shift.filled >= shift.slots ? "Für die Nachbesetzung vormerken" : "Schicht ansehen"}</a>`)
      || empty("Zurzeit gibt es keine neuen Schichtangebote für dich."), "schichten")
    + box("Meine Rückmeldungen", shiftList(responses, timezone, shift =>
      `<p class="badge">${statusLabel[responseState.get(shift.id)]}</p>
      ${responseState.get(shift.id) === "interested" ? abort(shift, "Interesse zurückziehen") : ""}`)
      || empty("Deine Bewerbungen und Zusagen erscheinen hier."), "bewerbungen")
    + box("Aufgaben", (user.review_note ? `<p>${esc(user.review_note)}</p>` : "")
      + (tasks.length ? `<ul>${tasks.join("")}</ul>` : empty("Für deine offenen Einsatzbewerbungen fehlen keine Qualifikationen.")))
    + profile);
}

export function renderShift(db, user, id, timezone, failure) {
  const shift = db.prepare(shiftQuery + " WHERE s.id=? AND s.starts>?").get(id, new Date().toISOString());
  if (!shift || !canSee(db, shift, user.id)) return null;
  const missing = missingQualifications(db, shift, user.id, "apply", timezone);
  const allMissing = missingQualifications(db, shift, user.id, "assign", timezone);
  const response = db.prepare("SELECT status FROM responses WHERE shift=? AND person=?").get(id, user.id);
  const questions = JSON.parse(shift.questions);
  const answers = failure?.form.getAll("answer") ?? [];
  const form = post("/interesse", hidden("shift", id)
    + questions.map((question, index) => {
      const previous = answers[index];
      return label(question, textarea("answer", 2000, typeof previous === "string" ? previous.slice(0, 2000) : "", true));
    }).join("")
    + button("Interesse melden"));
  return page(user, shift.title, `<a href="/#schichten">Alle offenen Schichten</a><p class="eyebrow">${esc(shift.event_title)}</p>
    <h1>${esc(shift.title)}</h1>${shiftFacts(shift, timezone)}
    ${alert(failure?.message)}
    ${allMissing.length ? `<p>Noch zu prüfen: ${esc(allMissing.join(", "))}</p>` : ""}
    ${response && response.status !== "withdrawn" ? `<p class="badge">${statusLabel[response.status]}</p>`
      : missing.length ? box("Vor der Bewerbung erforderlich", `<p>${esc(missing.join(", "))}</p><a href="/#profil">Qualifikationen ansehen</a>`)
        : box("Für die Schicht bewerben", form)}`);
}

function staffReview(db, person) {
  return `<li><details><summary>${esc(person.name)} <span class="badge">${statusLabel[person.status]}</span></summary>
    <p>${esc(person.email)}</p><p class="preserve">${esc(person.availability || "Keine typische Verfügbarkeit hinterlegt.")}</p>
    ${qualificationList(db, person.id, true)}
    ${person.status !== "active" ? post("/dispo/freigabe", hidden("person", person.id)
      + label("Rückmeldung an die Person (optional)", textarea("note", 1000, person.review_note))
      + label("Entscheidung", `<select name="status"><option value="pending">In Prüfung belassen</option>
        <option value="active">In den Pool aufnehmen</option><option value="rejected">Ablehnen</option></select>`)
      + button("Entscheidung speichern")) : ""}</details></li>`;
}

function planningShift(db, shift, staff, timezone) {
  const responses = db.prepare(`SELECT r.*, p.name FROM responses r JOIN people p ON p.id=r.person
    WHERE r.shift=? ORDER BY CASE r.status WHEN 'assigned' THEN 0 WHEN 'interested' THEN 1 ELSE 2 END, p.name`).all(shift.id);
  const questions = JSON.parse(shift.questions);
  const requirements = JSON.parse(shift.requirements);
  const isUpcoming = shift.starts > new Date().toISOString();
  const invitations = staff.filter(person => person.status === "active");
  const invitationNames = db.prepare(`SELECT p.name FROM invitations i JOIN people p ON p.id=i.person
    WHERE i.shift=? ORDER BY p.name`).all(shift.id);
  return `<div class="shift" id="shift-${shift.id}"><h3>${esc(shift.title)}</h3>
    <p class="badge">${statusLabel[shift.visibility]}</p>${shiftFacts(shift, timezone)}
    ${requirements.length ? `<p>${requirements.map(r => esc(r.name) + (r.timing === "apply" ? " (vor Bewerbung)" : " (vor Einteilung)")).join(" · ")}</p>` : ""}
    ${isUpcoming && shift.visibility === "draft" ? post("/dispo/sichtbarkeit", hidden("shift", shift.id)
      + label("Veröffentlichen für", '<select name="visibility"><option value="pool">Aktiver Pool</option><option value="invite">Nur eingeladene Personen</option></select>')
      + button("Schicht veröffentlichen")) : ""}
    ${shift.visibility === "invite" && invitationNames.length ? `<p>Eingeladen: ${esc(invitationNames.map(row => row.name).join(", "))}</p>` : ""}
    ${isUpcoming && shift.visibility === "invite" && invitations.length ? `<details><summary>Poolmitglied einladen</summary>${post("/dispo/einladen", hidden("shift", shift.id)
      + label("Poolmitglied", `<select name="person">${invitations.map(person => `<option value="${person.id}">${esc(person.name)} · ${esc(person.email)}</option>`).join("")}</select>`)
      + button("Einladung im Portal bereitstellen"))}</details>` : ""}
    ${responses.length ? `<ul class="items">${responses.map(response => {
      const missing = missingQualifications(db, shift, response.person, "assign", timezone);
      const answers = JSON.parse(response.answers);
      return `<li><strong>${esc(response.name)}</strong> <span class="badge">${statusLabel[response.status]}</span>
      ${answers.length ? `<dl>${answers.map((answer, index) => `<dt>${esc(questions[index])}</dt><dd>${esc(answer)}</dd>`).join("")}</dl>` : ""}
      ${response.status === "interested" && missing.length ? `<p>Fehlende Nachweise: ${esc(missing.join(", "))}</p>` : ""}
      ${response.status === "interested" && isUpcoming && !missing.length && shift.filled < shift.slots
        ? post("/dispo/einteilen", hidden("shift", shift.id) + hidden("person", response.person)
          + hidden("revision", response.revision) + button("Besetzung bestätigen")) : ""}</li>`;
    }).join("")}</ul>` : empty("Noch keine Rückmeldungen.")}</div>`;
}

function shiftForm(event, timezone, failure) {
  const values = failure?.form;
  return `<details ${failure ? "open" : ""}><summary>Schicht hinzufügen</summary>${alert(failure?.message)}
    ${post("/dispo/schicht", hidden("event", event.id)
    + label("Schichtname", `<input name="title" required maxlength="120" value="${esc(values?.get("title"))}">`)
    + `<div class="form-grid">${label("Beginn", `<input name="starts" type="datetime-local" required value="${esc(values?.get("starts"))}">`)}
      ${label("Ende", `<input name="ends" type="datetime-local" required value="${esc(values?.get("ends"))}">`)}</div>
      <p class="muted">Zeitzone: ${esc(timezone)}</p><div class="form-grid">
      ${label("Plätze", `<input name="slots" type="number" min="1" max="999" value="${esc(values?.get("slots") ?? "1")}" required>`)}
      ${label("Vergütung pro Person in Euro", `<input name="pay" inputmode="decimal" maxlength="10" value="${esc(values?.get("pay"))}" required>`)}</div>`
    + label("Vor Bewerbung nötig (eine Qualifikation pro Zeile)", textarea("apply", 2000, values?.get("apply")))
    + label("Vor Einteilung nötig (eine Qualifikation pro Zeile)", textarea("assign", 2000, values?.get("assign")))
    + label("Pflichtfragen (eine Frage pro Zeile)", textarea("questions", 2000, values?.get("questions")))
    + button("Schichtentwurf speichern"))}</details>`;
}

function adminHome(db, user, timezone, failure) {
  const staff = db.prepare("SELECT id,name,email,status,availability,review_note FROM people WHERE role='staff' ORDER BY status='pending' DESC,name").all();
  const events = db.prepare("SELECT * FROM events ORDER BY id DESC").all();
  const shifts = db.prepare(shiftQuery + " ORDER BY s.starts").all();
  const eventForm = post("/dispo/einsatz",
    `<div class="form-grid">${label("Einsatzname", '<input name="title" required maxlength="120">')}
    ${label("Ort", '<input name="location" required maxlength="180">')}</div>
    ${label("Externe Referenz (optional)", '<input name="reference" maxlength="250">')}
    ${label("Treffpunkt und Hinweise für eingeteiltes Personal", textarea("instructions", 2000))}
    ${button("Einsatz anlegen")}`);
  return page(user, "Disposition", `<p class="eyebrow">Disposition</p><h1>Personal und Einsätze</h1>
    ${failure ? `<p><a href="#event-${failure.event}">Zum Schichtformular mit der Fehlermeldung</a></p>` : ""}
    <div class="overview"><div><span class="muted">Bewerbungen in Prüfung</span><strong>${staff.filter(p => p.status === "pending").length}</strong></div>
    <div><span class="muted">Aktive Poolmitglieder</span><strong>${staff.filter(p => p.status === "active").length}</strong></div></div>`
    + box("Personal", staff.length ? `<ul class="items">${staff.map(person => staffReview(db, person)).join("")}</ul>`
      : empty("Sobald sich jemand registriert, erscheint die Bewerbung hier."), "personal")
    + box("Einsätze", `<details ${events.length ? "" : "open"}><summary>Einsatz anlegen</summary>${eventForm}</details>
      ${events.map(event => `<article id="event-${event.id}"><h3>${esc(event.title)}</h3><p class="muted">
      ${esc(event.location)}${event.reference ? " · " + esc(event.reference) : ""}</p>
      ${shiftForm(event, timezone, failure?.event === event.id ? failure : undefined)}
      ${shifts.filter(shift => shift.event === event.id).map(shift => planningShift(db, shift, staff, timezone)).join("")}</article>`).join("")}`, "einsaetze"));
}

export function render(db, user, timezone, path, message, failure) {
  if (message && failure?.form) {
    if (user?.role === "admin" && failure.path === "/dispo/schicht") {
      const event = Number(failure.form.get("event"));
      if (Number.isSafeInteger(event) && db.prepare("SELECT 1 FROM events WHERE id=?").get(event)) {
        return adminHome(db, user, timezone, { event, form: failure.form, message });
      }
    }
    if (!user && ["/anmelden", "/registrieren"].includes(failure.path)) return auth(failure.path, message, failure.form);
    if (user?.role === "staff" && user.status === "active" && failure.path === "/interesse") {
      const shift = Number(failure.form.get("shift"));
      if (Number.isSafeInteger(shift)) {
        const content = renderShift(db, user, shift, timezone, { form: failure.form, message });
        if (content) return content;
      }
    }
  }
  if (message) return page(user, "Hinweis", `<div class="narrow"><h1>Hinweis</h1><p role="alert">${esc(message)}</p>
    <a href="${user?.role === "admin" ? "/dispo" : "/"}">Zur Übersicht</a></div>`);
  if (!user) return auth(path);
  return user.role === "admin" ? adminHome(db, user, timezone) : staffHome(db, user, timezone);
}
