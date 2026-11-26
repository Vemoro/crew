import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { missingQualifications, openDatabase, passwordHash } from "../model.js";
import { createApp } from "../server.js";

function future(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

test("Bewerbung, Einladungen, Voraussetzungen, Schichtbesetzung und Vergütung", async t => {
  const db = openDatabase(":memory:");
  const password = "synthetic-test-password";
  db.prepare("INSERT INTO people (email,name,secret,role,status) VALUES (?,?,?,'admin','active')")
    .run("dispo@example.test", "Dispo", passwordHash(password));
  const origin = "http://localhost:8080";
  const server = createApp({ db, origin });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.close();
    await once(server, "close");
    db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  function client() {
    let session;
    return async (path, fields, status = 200, source = origin) => {
      const body = fields instanceof FormData || !fields ? fields : new URLSearchParams(fields);
      const headers = { Origin: source };
      if (session) headers.Cookie = session;
      const response = await fetch(base + path, { method: body ? "POST" : "GET", body, headers, redirect: "manual" });
      const cookie = response.headers.get("set-cookie");
      if (cookie) session = cookie.split(";")[0];
      const html = await response.text();
      assert.equal(response.status, status, `${path}: ${html}`);
      return html;
    };
  }
  const admin = client();
  const mira = client();
  const leni = client();
  const pending = client();
  await admin("/anmelden", { email: "dispo@example.test", password }, 303);
  await mira("/registrieren", { email: "mira@example.test", name: "Mira <Nord>", availability: "Abends", password }, 303);
  await leni("/registrieren", { email: "leni@example.test", name: "Leni Süd", password }, 303);
  await pending("/registrieren", { email: "offen@example.test", name: "Offen", password }, 303);
  assert.match(await mira("/"), /In Prüfung/);
  assert.match(await mira("/"), /Mira &lt;Nord&gt;/);
  assert.doesNotMatch(await mira("/"), /Leni Süd/);
  await mira("/dispo", undefined, 303);
  await mira("/dispo/freigabe", { person: 2, status: "active" }, 404);
  await admin("/dispo/freigabe", { person: 2, status: "active" }, 303);
  await admin("/dispo/freigabe", { person: 3, status: "active" }, 303);
  assert.match(await admin("/dispo/einsatz", { title: "Stadtfest West", location: "Musterhalle", reference: "Desk DEMO-1",
    instructions: "Treffpunkt Tor 4" }, 422, "https://not-crew.example.test"), /Ursprung/);
  await admin("/dispo/einsatz", { title: "Stadtfest West", location: "Musterhalle", reference: "Desk DEMO-1",
    instructions: "Treffpunkt Tor 4" }, 303);

  async function addShift(title, pay, day, start, end, fields = {}) {
    await admin("/dispo/schicht", { title, pay, event: 1, slots: 1,
      starts: `${future(day)}T${start}`, ends: `${future(day)}T${end}`, ...fields }, 303);
  }
  await addShift("Aufbau", "80", 7, "14:00", "18:00", {
    apply: "Staplerschein", assign: "Sicherheitsfreigabe", questions: "An welchem Eingang wartest du?\nWann bist du vor Ort?",
  });
  await addShift("Abbau", "45", 7, "18:00", "20:00");
  await addShift("Einlass", "25", 7, "15:00", "17:00");
  assert.doesNotMatch(await mira("/"), /Aufbau/);
  await admin("/dispo/sichtbarkeit", { shift: 1, visibility: "pool" }, 303);
  await admin("/dispo/sichtbarkeit", { shift: 2, visibility: "invite" }, 303);
  await admin("/dispo/sichtbarkeit", { shift: 3, visibility: "pool" }, 303);
  assert.doesNotMatch(await pending("/"), /Stadtfest West/);
  await pending("/schichten/1", undefined, 404);
  await leni("/schichten/2", undefined, 404);
  await leni("/interesse", { shift: 2 }, 422);
  assert.doesNotMatch(await mira("/"), /Treffpunkt Tor 4/);
  await admin("/dispo/einladen", { shift: 2, person: 2 }, 303);
  assert.match(await mira("/schichten/2"), /Abbau/);
  assert.match(await mira("/interesse", { shift: 1, answer: "Tor 4" }, 422), /fehlen geprüfte Qualifikationen/);
  const proof = new FormData();
  proof.set("name", "Staplerschein");
  proof.set("evidence", new Blob(["%PDF-1.7 Testnachweis"], { type: "application/pdf" }), "muster.pdf");
  await mira("/qualifikation", proof, 303);
  assert.match(await mira("/nachweis/1"), /PDF/);
  assert.match(await admin("/nachweis/1"), /PDF/);
  await leni("/nachweis/1", undefined, 404);
  await admin("/dispo/nachweis", { qualification: 1, revision: 1 }, 303);
  assert.match(await mira("/interesse", { shift: 1 }, 422), /beantworte alle Fragen/);
  const unanswered = new URLSearchParams([["shift", "1"], ["answer", "Beispiel Tor 4"], ["answer", " "]]);
  const invalidAnswers = await mira("/interesse", unanswered, 422);
  assert.match(invalidAnswers, /beantworte alle Fragen/);
  assert.match(invalidAnswers, /<textarea[^>]*>Beispiel Tor 4<\/textarea>/);
  await mira("/interesse", new URLSearchParams([["shift", "1"], ["answer", "Tor 4"], ["answer", "13:30"]]), 303);
  assert.match(await admin("/dispo"), /An welchem Eingang wartest du\?[\s\S]+Tor 4/);
  assert.match(await mira("/"), /sicherheitsfreigabe prüfen lassen/);
  assert.match(await admin("/dispo/einteilen", { shift: 1, person: 2, revision: 1 }, 422), /Fehlende geprüfte Qualifikationen/);
  await mira("/qualifikation", { name: "Sicherheitsfreigabe", validUntil: future(1) }, 303);
  await admin("/dispo/nachweis", { qualification: 2, revision: 1 }, 303);
  await admin("/dispo/einteilen", { shift: 1, person: 2, revision: 1 }, 422);
  await mira("/qualifikation", { name: "Sicherheitsfreigabe", validUntil: future(8) }, 303);
  await admin("/dispo/einteilen", { shift: 1, person: 2, revision: 1 }, 422);
  await admin("/dispo/nachweis", { qualification: 2, revision: 1 }, 422);
  await admin("/dispo/nachweis", { qualification: 2, revision: 3 }, 303);
  await mira("/absagen", { shift: 1, status: "interested", revision: 1 }, 303);
  await mira("/interesse", new URLSearchParams([["shift", "1"], ["answer", "Tor 6"], ["answer", "13:30"]]), 303);
  assert.match(await admin("/dispo/einteilen", { shift: 1, person: 2, revision: 1 }, 422), /Bewerbung hat sich geändert/);
  assert.match(await mira("/"), /Erwartete Vergütung<\/span><strong>0,00\s€/);
  assert.match(await admin("/dispo"), /An welchem Eingang wartest du\?[\s\S]+Tor 6/);
  await admin("/dispo/einteilen", { shift: 1, person: 2, revision: 2 }, 303);
  await admin("/dispo/einteilen", { shift: 1, person: 2, revision: 2 }, 303);
  assert.match(await mira("/"), /Erwartete Vergütung<\/span><strong>80,00\s€/);
  assert.match(await mira("/"), /Treffpunkt Tor 4/);
  await mira("/interesse", { shift: 2 }, 303);
  assert.match(await mira("/"), /Erwartete Vergütung<\/span><strong>80,00\s€/);
  await admin("/dispo/einteilen", { shift: 2, person: 2, revision: 1 }, 303);
  assert.match(await mira("/"), /Erwartete Vergütung<\/span><strong>125,00\s€/);

  await mira("/interesse", { shift: 3 }, 303);
  assert.match(await admin("/dispo/einteilen", { shift: 3, person: 2, revision: 1 }, 422), /zeitgleich/);
  assert.match(await mira("/absagen", { shift: 1, status: "interested", revision: 2 }, 422), /Rückmeldung hat sich geändert/);
  assert.match(await mira("/absagen", { shift: 1, status: "assigned", revision: 1 }, 422), /Rückmeldung hat sich geändert/);
  assert.match(await mira("/"), /Erwartete Vergütung<\/span><strong>125,00\s€/);
  await mira("/absagen", { shift: 1, status: "assigned", revision: 2 }, 303);
  await mira("/absagen", { shift: 1, status: "assigned", revision: 2 }, 303);
  assert.match(await mira("/"), /Erwartete Vergütung<\/span><strong>45,00\s€/);
  assert.match(await admin("/dispo"), /0 von 1 Plätzen besetzt/);
  await leni("/interesse", { shift: 3 }, 303);
  const outcomes = await Promise.allSettled([
    admin("/dispo/einteilen", { shift: 3, person: 2, revision: 1 }, 303),
    admin("/dispo/einteilen", { shift: 3, person: 3, revision: 1 }, 303),
  ]);
  assert.equal(outcomes.filter(outcome => outcome.status === "fulfilled").length, 1);
  const rejected = outcomes.find(outcome => outcome.status === "rejected");
  assert.match(rejected.reason.message, /Alle Plätze sind bereits besetzt/);
  await mira("/abmelden", {}, 303);
  await mira("/nachweis/1", undefined, 404);
  for (let count = 0; count < 9; count += 1) {
    await mira("/anmelden", { email: "mira@example.test", password }, 303);
    await mira("/abmelden", {}, 303);
  }
});

test("Ein bis zum Schichttag gültiger Nachweis reicht bis zum exklusiven Ende um Mitternacht", t => {
  const db = openDatabase(":memory:");
  t.after(() => db.close());
  db.prepare("INSERT INTO people (email,name,secret,role,status) VALUES (?,?,?,'staff','active')")
    .run("mira@example.test", "Mira Nord", "synthetic");
  db.prepare("INSERT INTO qualifications (person,name,valid_until,verified) VALUES (1,'aufbau','2030-01-02',1)").run();
  const requirements = JSON.stringify([{ name: "aufbau", timing: "assign" }]);
  const atMidnight = { requirements, ends: "2030-01-02T23:00:00.000Z" };
  const afterMidnight = { requirements, ends: "2030-01-02T23:01:00.000Z" };
  assert.deepEqual(missingQualifications(db, atMidnight, 1, "assign", "Europe/Berlin"), []);
  assert.deepEqual(missingQualifications(db, afterMidnight, 1, "assign", "Europe/Berlin"), ["aufbau"]);
});

test("Ein bestehender Datenbestand erhält Bewerbungsrevisionen ohne Datenverlust", t => {
  const directory = mkdtempSync(join(tmpdir(), "crew-schema-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "crew.sqlite");
  const original = openDatabase(path);
  original.exec(`
    ALTER TABLE responses DROP COLUMN revision;
    ALTER TABLE people DROP COLUMN access_revision;
    ALTER TABLE people DROP COLUMN access_suspended;
    ALTER TABLE events DROP COLUMN revision;
    ALTER TABLE shifts DROP COLUMN cancelled_at;
    ALTER TABLE shifts DROP COLUMN locked_location;
    ALTER TABLE shifts DROP COLUMN locked_instructions;
    ALTER TABLE shifts DROP COLUMN placement_revision;
    ALTER TABLE responses DROP COLUMN released_by_dispo;
    DROP TABLE qualification_requests;
    PRAGMA user_version = 1;
    INSERT INTO people (id,email,name,secret,role,status) VALUES (1,'mira@example.test','Mira','synthetic','staff','active');
    INSERT INTO events (id,title,location) VALUES (1,'Stadtfest West','Musterhalle');
    INSERT INTO shifts VALUES (1,1,'Aufbau','2030-01-02T13:00:00.000Z','2030-01-02T17:00:00.000Z',1,8000,'[]','[]','pool');
    INSERT INTO responses (shift,person,status,answers) VALUES (1,1,'assigned','[]');
  `);
  original.close();
  for (let run = 0; run < 2; run += 1) {
    const migrated = openDatabase(path);
    try {
      const row = migrated.prepare("SELECT status, revision FROM responses WHERE shift=1 AND person=1").get();
      assert.equal(row.status, "assigned");
      assert.equal(row.revision, 1);
      assert.equal(migrated.prepare("PRAGMA user_version").get().user_version, 5);
      assert.equal(migrated.prepare("SELECT access_suspended FROM people WHERE id=1").get().access_suspended, 0);
    } finally {
      migrated.close();
    }
  }
});
