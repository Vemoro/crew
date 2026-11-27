import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { nextPersonId } from "../src/server/auth";
import { shiftQuery } from "../src/server/planning";
import { submitQualification } from "../src/server/qualifications";
import { createTestDatabase, seedPerson } from "./runtime";

test("Der Betreiber exportiert und bereinigt genau ein Profil und erhält historische Besetzungszahlen", async t => {
  const directory = mkdtempSync(join(tmpdir(), "crew-personendaten-"));
  const database = await createTestDatabase();
  const db = database.pool;
  const get = async (query: string) => (await db.query(query)).rows[0];
  t.after(async () => {
    await database.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const cli = fileURLToPath(new URL("../src/cli/people.ts", import.meta.url));
  const call = (...args: string[]) => spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8", env: { ...process.env, DATABASE_URL: database.url },
  });
  const mira = "mira@example.test";
  const output = join(directory, "export");
  await seedPerson(db, "dispo@example.test", "Dispo", "synthetic-dispo-password", "admin");
  await seedPerson(db, "leni@example.test", "Leni Anders", "synthetic-leni-password");
  await seedPerson(db, mira, "Mira Nord", "synthetic-mira-password");
  await seedPerson(db, "noa@example.test", "Noa", "synthetic-noa-password");
  await db.query(`UPDATE people SET status='rejected' WHERE id=4;
    UPDATE people SET review_note='Lenis Notiz' WHERE id=2;
    UPDATE people SET review_note='Miras Notiz' WHERE id=3;
    INSERT INTO events (id,title,location) VALUES (1,'Stadtfest','Halle');`);
  const slot = (id: number, title: string, starts: string, ends: string) => db.query(`INSERT INTO shifts (id,event,title,starts,ends,slots,cents,requirements,questions,visibility)
    VALUES ($1,1,$2,$3,$4,2,8000,'[]','["Rückfrage"]','invite')`, [id,title,starts,ends]);
  const at = (hours: number) => new Date(Date.now() + hours * 3600000).toISOString();
  await slot(1, "Vergangen", at(-3), at(-2));
  await slot(2, "Laufend", at(-1), at(1));
  await slot(3, "Bevorstehend", at(2), at(3));
  await db.query(`INSERT INTO responses (shift,person,status,answers) VALUES
      (1,3,'assigned','["Miras Antwort"]'),(1,2,'assigned','["Lenis Antwort"]'),(2,3,'assigned','[]'),(3,3,'assigned','[]');
    INSERT INTO invitations VALUES (1,3),(2,3),(3,3),(1,2);
    INSERT INTO auth_sessions ("userId",token,"expiresAt")
      SELECT auth_id,CASE WHEN id=3 THEN 'mira-session' ELSE 'leni-session' END,now()+interval '1 day' FROM people WHERE id IN (2,3);
    INSERT INTO qualification_requests VALUES (3,'stufe 2','Miras Nachforderung','submitted'),(2,'stufe 3','Lenis Nachforderung','open');`);
  const pdf = Buffer.from("%PDF-1.4\nMiras synthetischer Inhalt\n%%EOF\n");
  const qualification = (...values: [id: number, person: number, name: string, evidence: Buffer]) => db.query("INSERT INTO qualifications (id,person,name,evidence) VALUES ($1,$2,$3,$4)", values);
  await qualification(19, 3, "stufe 2", pdf);
  await qualification(18, 2, "stufe 3", Buffer.from("%PDF-1.4\nLenis synthetischer Inhalt\n%%EOF\n"));

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

  const erase = () => call("erase", mira, "3");
  const counts = () => Promise.all([
    ...["responses", "qualifications", "invitations", "qualification_requests"]
      .map(table => get(`SELECT count(*)::int AS n FROM ${table} WHERE person=3`)),
    get(`SELECT count(*)::int AS n FROM auth_sessions WHERE token='mira-session'`),
  ]).then(results => results.map(row => row.n));
  assert.match(call("inspect", mira).stdout, /Profil-ID: 3/);
  assert.equal(call("erase", mira, "2").status, 1);
  assert.equal(call("erase", "dispo@example.test", "1").status, 1);
  const preflight = erase();
  assert.equal(preflight.status, 1);
  assert.match(preflight.stderr, /Schicht #2.*Schicht #3/);
  assert.deepEqual(await counts(), [3, 1, 3, 1, 1]);
  await db.query(`UPDATE responses SET status='withdrawn',released_by_dispo=1 WHERE shift=3 AND person=3;
    UPDATE shifts SET starts='2000-01-01T00:00:00.000Z',ends='2000-01-01T01:00:00.000Z' WHERE id=2;
    CREATE FUNCTION simulate_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetischer Fehler'; END; $$;
    CREATE TRIGGER simulate_failure BEFORE DELETE ON people FOR EACH ROW WHEN (old.id=3) EXECUTE FUNCTION simulate_failure();`);
  assert.equal(erase().status, 1);
  assert.deepEqual(await counts(), [3, 1, 3, 1, 1]);
  assert.equal((await get("SELECT sum(anonymous_assigned)::int AS n FROM shifts")).n, 0);

  await db.query("DROP TRIGGER simulate_failure ON people; UPDATE people SET access_suspended=1 WHERE id=3");
  const removed = erase();
  assert.equal(removed.status, 0, removed.stderr);
  assert.deepEqual(await counts(), [0, 0, 0, 0, 0]);
  assert.equal(await get("SELECT 1 FROM people WHERE id=3"), undefined);
  const before = (await get(shiftQuery + " WHERE s.id=1"));
  assert.equal(before.filled, 2);
  assert.equal(before.anonymous_assigned, 1);
  assert.equal(erase().status, 0);
  assert.equal((await get(shiftQuery + " WHERE s.id=1")).filled, 2);
  assert.equal((await get("SELECT count(*)::int AS n FROM auth_sessions WHERE token='leni-session'")).n, 1);
  assert.equal(call("erase", "noa@example.test", "4").status, 0);
  assert.equal((await get(`SELECT ${nextPersonId} AS person`)).person, 5);
  await submitQualification(db, 2, "neuer Nachweis", "", null);
  assert.equal((await get("SELECT max(id) AS qualification FROM qualifications")).qualification, 20);
  assert.equal((await get("SELECT count(*)::int AS n FROM people WHERE role='staff'")).n, 1);
  await seedPerson(db, mira, "Neues Profil", "synthetic-new-mira-password");
  const staleErase = erase();
  assert.equal(staleErase.status, 1);
  assert.match(staleErase.stderr, /Profil-ID stimmt nicht/);
  assert.equal((await get("SELECT name FROM people WHERE id=5")).name, "Neues Profil");
});
