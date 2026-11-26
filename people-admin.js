import { closeSync, mkdirSync, openSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeEmail, openDatabase, requireInput, transaction } from "./model.js";

const shiftContext = `s.id AS shift_id,s.title AS shift_title,s.starts,s.ends,s.cancelled_at,e.title AS event_title`;

function profile(db, email) {
  const person = db.prepare(`SELECT id,email,name,availability,status,review_note,access_suspended,role
    FROM people WHERE email=?`).get(email);
  requireInput(person?.role !== "admin", "Dieser Befehl gilt nur für Poolprofile.");
  return person;
}

function exportPerson(db, email, destination) {
  mkdirSync(destination, { mode: 0o700 });
  const files = [];
  const write = (name, content) => {
    const path = join(destination, name);
    const file = openSync(path, "wx", 0o600);
    files.push(path);
    try { writeFileSync(file, content); } finally { closeSync(file); }
  };
  try {
    transaction(db, () => {
      const person = profile(db, email);
      requireInput(person, "Kein Poolprofil für diese Adresse vorhanden.");
      const qualifications = db.prepare(`SELECT id,name,valid_until,verified,evidence IS NOT NULL AS has_pdf
        FROM qualifications WHERE person=? ORDER BY id`).all(person.id);
      const pdf = db.prepare("SELECT evidence FROM qualifications WHERE id=? AND person=?");
      for (const qualification of qualifications) {
        qualification.file = qualification.has_pdf ? `nachweis-${qualification.id}.pdf` : null;
        delete qualification.has_pdf;
        if (qualification.file) write(qualification.file, pdf.get(qualification.id, person.id).evidence);
      }
      const invitations = db.prepare(`SELECT ${shiftContext} FROM invitations i
        JOIN shifts s ON s.id=i.shift JOIN events e ON e.id=s.event WHERE i.person=? ORDER BY s.starts,s.id`).all(person.id);
      const responses = db.prepare(`SELECT ${shiftContext},s.questions,r.status,r.answers,r.released_by_dispo,s.cents AS shift_cents
        FROM responses r JOIN shifts s ON s.id=r.shift JOIN events e ON e.id=s.event
        WHERE r.person=? ORDER BY s.starts,s.id`).all(person.id).map(row => ({
        ...row, questions: JSON.parse(row.questions), answers: JSON.parse(row.answers),
      }));
      const requests = db.prepare("SELECT name,note,state FROM qualification_requests WHERE person=? ORDER BY name").all(person.id);
      const payload = { format: 1, person, invitations, responses, qualifications, qualification_requests: requests };
      write("profil.json", JSON.stringify(payload, null, 2) + "\n");
    });
  } catch (error) {
    for (const path of files) {
      try { unlinkSync(path); } catch (cleanupError) {
        if (cleanupError.code !== "ENOENT") throw cleanupError;
      }
    }
    rmdirSync(destination);
    throw error;
  }
}

function erasePerson(db, email, confirmedId) {
  return transaction(db, () => {
    const person = profile(db, email);
    if (!person) return false;
    requireInput(person.id === confirmedId, "Die Profil-ID stimmt nicht mit dem derzeitigen Konto überein.");
    const blocked = db.prepare(`SELECT s.id,s.starts,s.ends FROM shifts s
      JOIN responses r ON r.shift=s.id WHERE r.person=? AND r.status='assigned'
        AND s.cancelled_at IS NULL AND s.ends>? ORDER BY s.starts,s.id`).all(person.id, new Date().toISOString());
    requireInput(blocked.length === 0, "Offene Einteilungen zuerst klären. " + blocked
      .map(shift => `Schicht #${shift.id} (${shift.starts} bis ${shift.ends})`).join(", "));

    db.prepare(`UPDATE shifts SET anonymous_assigned=anonymous_assigned+1 WHERE id IN
      (SELECT shift FROM responses WHERE person=? AND status='assigned')`).run(person.id);
    db.prepare("UPDATE erased_ids SET greatest=max(greatest,?) WHERE kind='people'").run(person.id);
    db.prepare(`UPDATE erased_ids SET greatest=max(greatest,coalesce(
      (SELECT max(id) FROM qualifications WHERE person=?),0)) WHERE kind='qualifications'`).run(person.id);
    db.prepare("DELETE FROM sessions WHERE person=?").run(person.id);
    db.prepare("DELETE FROM qualifications WHERE person=?").run(person.id);
    db.prepare("DELETE FROM invitations WHERE person=?").run(person.id);
    db.prepare("DELETE FROM responses WHERE person=?").run(person.id);
    db.prepare("DELETE FROM people WHERE id=?").run(person.id);
    return true;
  });
}

try {
  const [command, address, argument, ...rest] = process.argv.slice(2);
  const inspect = command === "inspect";
  requireInput(address && rest.length === 0 && (inspect ? argument === undefined :
    (command === "export" || command === "erase") && argument),
  "Aufruf: node people-admin.js inspect EMAIL, export EMAIL ZIELORDNER oder erase EMAIL PROFIL-ID");
  const email = normalizeEmail(address);
  const confirmedId = Number(argument);
  if (command === "erase") requireInput(/^[1-9]\d*$/.test(argument) && Number.isSafeInteger(confirmedId), "Profil-ID prüfen.");
  const db = openDatabase(undefined, { initialize: false });
  try {
    if (inspect) {
      const person = profile(db, email);
      requireInput(person, "Kein Poolprofil für diese Adresse vorhanden.");
      console.log(`Profil-ID: ${person.id}`);
    } else if (command === "export") {
      exportPerson(db, email, argument);
      console.log("Poolprofil und vorhandene Nachweise exportiert.");
    } else {
      db.exec("PRAGMA secure_delete = ON");
      console.log(erasePerson(db, email, confirmedId) ? "Poolprofil und zugehörige Daten bereinigt." : "Kein Poolprofil vorhanden.");
    }
  } finally {
    db.close();
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
