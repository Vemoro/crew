import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { nextPersonId, nextQualificationId, openDatabase, shiftQuery } from "../model.js";

test("Der Betreiber exportiert und bereinigt genau ein Profil und erhält historische Besetzungszahlen", t => {
  const directory = mkdtempSync(join(tmpdir(), "crew-personendaten-"));
  const database = join(directory, "crew.sqlite");
  const db = openDatabase(database);
  t.after(() => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const cli = fileURLToPath(new URL("../people-admin.js", import.meta.url));
  const call = (...args) => spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8", env: { ...process.env, CREW_DB: database },
  });
  const mira = "mira@example.test";
  const output = join(directory, "export");
  const person = db.prepare("INSERT INTO people (id,email,name,secret,role,status,review_note) VALUES (?,?,?,?,?,?,?)");
  person.run(1, "dispo@example.test", "Dispo", "dispo-hash", "admin", "active", "");
  person.run(2, "leni@example.test", "Leni Anders", "leni-hash", "staff", "active", "Lenis Notiz");
  person.run(3, mira, "Mira Nord", "mira-hash", "staff", "active", "Miras Notiz");
  person.run(4, "noa@example.test", "Noa", "noa-hash", "staff", "rejected", "");
  db.exec("INSERT INTO events (id,title,location) VALUES (1,'Stadtfest','Halle')");
  const slot = db.prepare(`INSERT INTO shifts (id,event,title,starts,ends,slots,cents,requirements,questions,visibility)
    VALUES (?,1,?,?,?,2,8000,'[]','["Rückfrage"]','invite')`);
  const at = hours => new Date(Date.now() + hours * 3600000).toISOString();
  slot.run(1, "Vergangen", at(-3), at(-2));
  slot.run(2, "Laufend", at(-1), at(1));
  slot.run(3, "Bevorstehend", at(2), at(3));
  db.exec(`INSERT INTO responses (shift,person,status,answers) VALUES
      (1,3,'assigned','["Miras Antwort"]'),(1,2,'assigned','["Lenis Antwort"]'),(2,3,'assigned','[]'),(3,3,'assigned','[]');
    INSERT INTO invitations VALUES (1,3),(2,3),(3,3),(1,2);
    INSERT INTO sessions VALUES ('mira-session',3,9999999999),('leni-session',2,9999999999);
    INSERT INTO qualification_requests VALUES (3,'stufe 2','Miras Nachforderung','submitted'),(2,'stufe 3','Lenis Nachforderung','open');`);
  const pdf = Buffer.from("%PDF-1.4\nMiras synthetischer Inhalt\n%%EOF\n");
  const qualification = db.prepare("INSERT INTO qualifications (id,person,name,evidence) VALUES (?,?,?,?)");
  qualification.run(19, 3, "stufe 2", pdf);
  qualification.run(18, 2, "stufe 3", Buffer.from("%PDF-1.4\nLenis synthetischer Inhalt\n%%EOF\n"));

  const exported = call("export", mira, output);
  assert.equal(exported.status, 0, exported.stderr);
  assert.deepEqual(readdirSync(output).sort(), ["nachweis-19.pdf", "profil.json"]);
  assert.deepEqual(readFileSync(join(output, "nachweis-19.pdf")), pdf);
  const json = readFileSync(join(output, "profil.json"), "utf8");
  const manifest = JSON.parse(json);
  assert.equal(manifest.person.name, "Mira Nord");
  assert.equal(manifest.invitations.length, 3);
  assert.equal(manifest.responses[0].status, "assigned");
  assert.deepEqual(manifest.responses[0].answers, ["Miras Antwort"]);
  assert.equal(manifest.qualification_requests[0].state, "submitted");
  assert.doesNotMatch(json, /leni|mira-hash|mira-session|secret/i);
  assert.equal(call("export", mira, output).status, 1);
  const unknown = join(directory, "unbekannt");
  assert.equal(call("export", "unknown@example.test", unknown).status, 1);
  assert.equal(existsSync(unknown), false);

  const erase = () => call("erase", mira, mira);
  const counts = tables => tables.map(table => db.prepare(`SELECT count(*) AS n FROM ${table} WHERE person=3`).get().n);
  const tables = ["responses", "sessions", "qualifications", "invitations", "qualification_requests"];
  assert.equal(call("erase", mira, "leni@example.test").status, 1);
  assert.equal(call("erase", "dispo@example.test", "dispo@example.test").status, 1);
  const preflight = erase();
  assert.equal(preflight.status, 1);
  assert.match(preflight.stderr, /Schicht #2.*Schicht #3/);
  assert.deepEqual(counts(tables), [3, 1, 1, 3, 1]);
  db.exec(`UPDATE responses SET status='withdrawn',released_by_dispo=1 WHERE shift=3 AND person=3;
    UPDATE shifts SET starts='2000-01-01T00:00:00.000Z',ends='2000-01-01T01:00:00.000Z' WHERE id=2;
    CREATE TRIGGER simulate_failure BEFORE DELETE ON people WHEN old.id=3 BEGIN SELECT RAISE(ABORT, 'synthetischer Fehler'); END;`);
  assert.equal(erase().status, 1);
  assert.deepEqual(counts(tables), [3, 1, 1, 3, 1]);
  assert.equal(db.prepare("SELECT sum(anonymous_assigned) AS n FROM shifts").get().n, 0);

  db.exec("DROP TRIGGER simulate_failure; UPDATE people SET access_suspended=1 WHERE id=3");
  const removed = erase();
  assert.equal(removed.status, 0, removed.stderr);
  assert.deepEqual(counts(tables), [0, 0, 0, 0, 0]);
  assert.equal(db.prepare("SELECT 1 FROM people WHERE id=3").get(), undefined);
  const before = db.prepare(shiftQuery + " WHERE s.id=1").get();
  assert.equal(before.filled, 2);
  assert.equal(before.anonymous_assigned, 1);
  assert.equal(erase().status, 0);
  assert.equal(db.prepare(shiftQuery + " WHERE s.id=1").get().filled, 2);
  assert.equal(db.prepare("SELECT count(*) AS n FROM sessions WHERE person=2").get().n, 1);
  assert.equal(call("erase", "noa@example.test", "noa@example.test").status, 0);
  assert.equal(db.prepare(`SELECT ${nextPersonId} AS person,${nextQualificationId} AS qualification`).get().person, 5);
  assert.equal(db.prepare(`SELECT ${nextQualificationId} AS qualification`).get().qualification, 20);
  assert.equal(db.prepare("SELECT count(*) AS n FROM people WHERE role='staff'").get().n, 1);
});
