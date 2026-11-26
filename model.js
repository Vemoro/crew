import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function openDatabase(path = process.env.CREW_DB || "data/crew.sqlite") {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
  `);
  transaction(db, () => {
    const { user_version: version } = db.prepare("PRAGMA user_version").get();
    if (version > 3) throw new Error("Unbekannte Version der Crew-Datenbank.");
    if (version === 0) db.exec(`
    CREATE TABLE people (
      id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      secret TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('staff','admin')),
      status TEXT NOT NULL CHECK(status IN ('pending','active','rejected')),
      availability TEXT NOT NULL DEFAULT '', review_note TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY, person INTEGER NOT NULL REFERENCES people(id),
      expires INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS qualifications (
      id INTEGER PRIMARY KEY, person INTEGER NOT NULL REFERENCES people(id),
      name TEXT NOT NULL, valid_until TEXT NOT NULL DEFAULT '', verified INTEGER NOT NULL DEFAULT 0,
      evidence BLOB, revision INTEGER NOT NULL DEFAULT 1, UNIQUE(person, name)
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY, title TEXT NOT NULL, location TEXT NOT NULL,
      reference TEXT NOT NULL DEFAULT '', instructions TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY, event INTEGER NOT NULL REFERENCES events(id),
      title TEXT NOT NULL, starts TEXT NOT NULL, ends TEXT NOT NULL,
      slots INTEGER NOT NULL CHECK(slots > 0), cents INTEGER NOT NULL CHECK(cents >= 0),
      requirements TEXT NOT NULL, questions TEXT NOT NULL,
      visibility TEXT NOT NULL CHECK(visibility IN ('draft','pool','invite')),
      CHECK(starts < ends)
    );
    CREATE TABLE IF NOT EXISTS invitations (
      shift INTEGER NOT NULL REFERENCES shifts(id), person INTEGER NOT NULL REFERENCES people(id),
      PRIMARY KEY(shift, person)
    );
    CREATE TABLE IF NOT EXISTS responses (
      shift INTEGER NOT NULL REFERENCES shifts(id), person INTEGER NOT NULL REFERENCES people(id),
      status TEXT NOT NULL CHECK(status IN ('interested','assigned','withdrawn')),
      answers TEXT NOT NULL, PRIMARY KEY(shift, person)
    );
    CREATE INDEX IF NOT EXISTS responses_person_status ON responses(person, status);
    CREATE INDEX IF NOT EXISTS invitations_person ON invitations(person);
    PRAGMA user_version = 1;
    `);
    if (version < 2) {
      const hasRevision = db.prepare("PRAGMA table_info(responses)").all().some(column => column.name === "revision");
      if (!hasRevision) db.exec("ALTER TABLE responses ADD COLUMN revision INTEGER NOT NULL DEFAULT 1");
      db.exec("PRAGMA user_version = 2");
    }
    if (version < 3) db.exec(`
      ALTER TABLE people ADD COLUMN access_suspended INTEGER NOT NULL DEFAULT 0 CHECK(access_suspended IN (0,1));
      ALTER TABLE people ADD COLUMN access_revision INTEGER NOT NULL DEFAULT 1;
      PRAGMA user_version = 3;
    `);
  });
  return db;
}

export class InputError extends Error {}

export function requireInput(condition, message) {
  if (!condition) throw new InputError(message);
}

export function passwordHash(password, salt = randomBytes(16).toString("hex")) {
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}

export function checkPassword(password, stored) {
  const [salt] = stored.split(":");
  return timingSafeEqual(Buffer.from(passwordHash(password, salt)), Buffer.from(stored));
}

export function normalizeEmail(value) {
  const email = value.trim().toLowerCase();
  requireInput(email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), "E-Mail-Adresse prüfen.");
  return email;
}

export function verifyPasswordLength(password) {
  requireInput(password.length >= 12 && password.length <= 128, "Das Passwort braucht 12 bis 128 Zeichen.");
}

export function qualificationName(value) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("de");
}

export function sessionHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function transaction(db, execute) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = execute();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function resetPassword(db, email, password) {
  verifyPasswordLength(password);
  const secret = passwordHash(password);
  transaction(db, () => {
    const updated = db.prepare("UPDATE people SET secret=? WHERE email=? RETURNING id").get(secret, email);
    requireInput(updated, "Für diese Adresse existiert kein Konto.");
    db.prepare("DELETE FROM sessions WHERE person=?").run(updated.id);
  });
}

export function updatePoolAccess(db, person, revision, suspended) {
  transaction(db, () => {
    const result = db.prepare(`UPDATE people SET access_suspended=?, access_revision=access_revision+1
      WHERE id=? AND role='staff' AND status='active' AND access_revision=? AND access_suspended<>?`)
      .run(suspended, person, revision, suspended);
    requireInput(result.changes === 1, "Der Kontozugang hat sich geändert oder das Konto ist kein aktives Poolmitglied.");
    db.prepare("DELETE FROM sessions WHERE person=?").run(person);
  });
}

export const shiftQuery = `
  SELECT s.*, e.title AS event_title, e.location, e.instructions,
         (SELECT count(*) FROM responses r WHERE r.shift=s.id AND r.status='assigned') AS filled
  FROM shifts s JOIN events e ON e.id=s.event
`;

export function missingQualifications(db, shift, person, timing, timezone) {
  const verified = db.prepare("SELECT name, valid_until FROM qualifications WHERE person=? AND verified=1").all(person);
  const lastInstant = new Date(Date.parse(shift.ends) - 1);
  const lastDay = new Intl.DateTimeFormat("sv-SE", { timeZone: timezone }).format(lastInstant);
  return JSON.parse(shift.requirements)
    .filter(requirement => timing === "assign" || requirement.timing === "apply")
    .filter(requirement => !verified.some(q => q.name === requirement.name && (!q.valid_until || q.valid_until >= lastDay)))
    .map(requirement => requirement.name);
}

export function canSee(db, shift, person) {
  return shift.visibility === "pool" || (shift.visibility === "invite" && Boolean(
    db.prepare("SELECT 1 FROM invitations WHERE shift=? AND person=?").get(shift.id, person)
  ));
}

export function respond(db, shiftId, person, answers, timezone) {
  transaction(db, () => {
    const shift = db.prepare(shiftQuery + " WHERE s.id=?").get(shiftId);
    requireInput(shift && canSee(db, shift, person), "Der Einsatz ist nicht verfügbar.");
    requireInput(shift.starts > new Date().toISOString(), "Die Schicht hat bereits begonnen.");
    requireInput(missingQualifications(db, shift, person, "apply", timezone).length === 0,
      "Für diese Bewerbung fehlen geprüfte Qualifikationen.");
    const questions = JSON.parse(shift.questions);
    requireInput(answers.length === questions.length && answers.every(answer => answer.length > 0 && answer.length <= 2000),
      "Bitte beantworte alle Fragen mit höchstens 2.000 Zeichen pro Antwort.");
    db.prepare(`INSERT INTO responses (shift,person,status,answers) VALUES (?,?,'interested',?)
      ON CONFLICT(shift,person) DO UPDATE SET status='interested', answers=excluded.answers, revision=responses.revision+1
      WHERE responses.status='withdrawn' OR (responses.status='interested' AND responses.answers<>excluded.answers)`)
      .run(shiftId, person, JSON.stringify(answers));
  });
}

export function assign(db, shiftId, person, revision, timezone) {
  transaction(db, () => {
    const shift = db.prepare(shiftQuery + " WHERE s.id=?").get(shiftId);
    const response = db.prepare(`SELECT r.status, r.revision, p.status AS person_status, p.access_suspended
      FROM responses r JOIN people p ON p.id=r.person WHERE r.shift=? AND r.person=?`).get(shiftId, person);
    requireInput(response?.revision === revision, "Die Bewerbung hat sich geändert. Bitte prüfe die aktuelle Rückmeldung.");
    if (response?.status === "assigned") return;
    requireInput(shift && response?.status === "interested" && response.person_status === "active" && !response.access_suspended
      && canSee(db, shift, person), "Es liegt keine gültige Einsatzbewerbung vor.");
    requireInput(shift.starts > new Date().toISOString(), "Die Schicht hat bereits begonnen.");
    requireInput(shift.filled < shift.slots, "Alle Plätze sind bereits besetzt.");
    const missing = missingQualifications(db, shift, person, "assign", timezone);
    requireInput(missing.length === 0, "Fehlende geprüfte Qualifikationen: " + missing.join(", "));
    const overlap = db.prepare(`SELECT 1 FROM responses r JOIN shifts s ON s.id=r.shift
      WHERE r.person=? AND r.status='assigned' AND s.starts < ? AND s.ends > ?`).get(person, shift.ends, shift.starts);
    requireInput(!overlap, "Die Person ist zeitgleich bereits eingeteilt.");
    db.prepare("UPDATE responses SET status='assigned' WHERE shift=? AND person=?").run(shiftId, person);
  });
}
