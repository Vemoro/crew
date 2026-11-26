import { requireInput, transaction } from "./model.js";

function requireQualificationPlace(db, person, name, message) {
  const { count, existing } = db.prepare(`SELECT count(*) AS count,count(*) FILTER (WHERE name=?) AS existing FROM (
    SELECT name FROM qualifications WHERE person=?
    UNION SELECT name FROM qualification_requests WHERE person=? AND state='open'
  )`).get(name, person, person);
  requireInput(existing || count < 30, message);
}

export function submitQualification(db, person, name, validUntil, evidence) {
  requireQualificationPlace(db, person, name, "Alle 30 Plätze für Qualifikationen sind belegt oder durch Nachforderungen reserviert.");
  db.prepare(`INSERT INTO qualifications (person,name,valid_until,evidence) VALUES (?,?,?,?)
    ON CONFLICT(person,name) DO UPDATE SET valid_until=excluded.valid_until, evidence=excluded.evidence,
      verified=0, revision=qualifications.revision+1`).run(person, name, validUntil, evidence);
  db.prepare(`UPDATE qualification_requests SET state='submitted'
    WHERE person=? AND name=? AND state='open'`).run(person, name);
}

export function reviewQualification(db, qualification, revision, verified) {
  transaction(db, () => {
    const entry = db.prepare(`UPDATE qualifications SET verified=?,revision=revision+1
      WHERE id=? AND revision=? AND verified<>? RETURNING person,name`).get(verified, qualification, revision, verified);
    requireInput(entry, "Der Nachweis hat sich geändert. Bitte öffne und prüfe den aktuellen Eintrag.");
    if (verified) db.prepare(`UPDATE qualification_requests SET state='done'
      WHERE person=? AND name=? AND state='submitted'`).run(entry.person, entry.name);
  });
}

export function requestQualification(db, person, name, note) {
  transaction(db, () => {
    requireInput(db.prepare("SELECT 1 FROM people WHERE id=? AND role='staff' AND status='active' AND access_suspended=0").get(person),
      "Eine Nachforderung benötigt ein aktives Poolmitglied.");
    requireQualificationPlace(db, person, name, "Alle 30 Plätze dieses Poolprofils sind belegt oder durch Nachforderungen reserviert.");
    const change = db.prepare(`INSERT INTO qualification_requests (person,name,note,state) VALUES (?,?,?,'open')
      ON CONFLICT(person,name) DO UPDATE SET note=excluded.note,state='open' WHERE qualification_requests.state='done'`)
      .run(person, name, note);
    requireInput(change.changes === 1, "Für diesen Nachweis läuft bereits eine Nachforderung.");
  });
}
