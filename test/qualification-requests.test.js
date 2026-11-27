import assert from "node:assert/strict";
import { test } from "node:test";
import { submitQualification } from "../src/server/qualifications.ts";
import { createTestDatabase, startTestServer, stopTestServer, seedPerson } from "./runtime.ts";

test("Widerruf und Nachforderung schützen neue Einteilungen und zeigen bestehende Zusagen zur Prüfung", async t => {
  const database = await createTestDatabase();
  const db = database.pool;
  t.after(database.close);
  const password = "synthetic-qualification-password";
  await seedPerson(db, "dispo@example.test", "Dispo", password, "admin");
  await seedPerson(db, "mira@example.test", "Mira", password);
  await seedPerson(db, "leni@example.test", "Leni", password);
  await db.query(`INSERT INTO qualifications (id,person,name,verified,evidence) VALUES (1,2,'funk',1,decode('255044462D','hex'));
    INSERT INTO events (id,title,location) VALUES (1,'Stadtfest','Halle');`);
  const create = (id,title,requirements) => db.query(`INSERT INTO shifts (id,event,title,starts,ends,slots,cents,requirements,questions,visibility)
    VALUES ($1,1,$2,'2099-01-01T10:00:00.000Z','2099-01-01T12:00:00.000Z',3,8000,$3,'[]','pool')`, [id,title,requirements]);
  await create(1, "Bestätigte Schicht", JSON.stringify([{ name: "funk", timing: "assign" }]));
  await create(2, "Nur mit geprüfter Bewerbung", JSON.stringify([{ name: "funk", timing: "apply" }]));
  await create(3, "Zweite Auswahl", JSON.stringify([{ name: "funk", timing: "assign" }]));
  await db.query("INSERT INTO responses (shift,person,status,answers) VALUES (1,2,'assigned','[]'),(3,2,'interested','[]')");
  const origin = "http://127.0.0.1:42693";
  const base = origin;
  const server = await startTestServer(database.url, origin);
  t.after(() => stopTestServer(server));
  async function visit(path, cookie, data, expected = 200) {
    const response = await fetch(base + path, { method: data ? "POST" : "GET", redirect: "manual",
      headers: { origin, ...(cookie ? { Cookie: cookie } : {}) }, body: data && new URLSearchParams(data) });
    const html = await response.text();
    assert.equal(response.status, expected, html);
    return { html, cookie: response.headers.get("set-cookie")?.split(";")[0] };
  }
  const login = async email => (await visit("/anmelden", "", { email, password }, 303)).cookie;
  const admin = await login("dispo@example.test");
  const mira = await login("mira@example.test");
  const other = await login("leni@example.test");
  const requested = { person: 2, name: "Funk", note: "Bitte den neuen Nachweis einreichen." };
  await visit("/dispo/nachforderung", other, requested, 404);
  await visit("/dispo/nachforderung", admin, requested, 303);
  assert.match((await visit("/", mira)).html, /Nachweis angefordert[\s\S]+Bitte den neuen Nachweis/);
  assert.doesNotMatch((await visit("/", other)).html, /Bitte den neuen Nachweis/);
  await visit("/dispo/nachweis-zuruecknehmen", admin, { qualification: 1, revision: 1 }, 303);
  await visit("/dispo/nachweis", admin, { qualification: 1, revision: 1 }, 422);
  await visit("/interesse", mira, { shift: 2 }, 422);
  await visit("/dispo/einteilen", admin, { shift: 3, person: 2, revision: 1 }, 422);
  assert.match((await visit("/dispo", admin)).html, /Besetzung prüfen\. Fehlende geprüfte Nachweise: funk/);
  assert.match((await visit("/", mira)).html, /Erwartete Vergütung<\/span><strong>80,00\s€/);
  await db.query("UPDATE shifts SET starts=$1 WHERE id=1", [new Date(Date.now() - 3600000).toISOString()]);
  assert.match((await visit("/dispo", admin)).html, /Besetzung prüfen\. Fehlende geprüfte Nachweise: funk/);
  await db.query("UPDATE shifts SET ends=$1 WHERE id=1", [new Date(Date.now() - 10000).toISOString()]);
  assert.doesNotMatch((await visit("/dispo", admin)).html, /Besetzung prüfen\. Fehlende geprüfte Nachweise/);
  await db.query("UPDATE shifts SET starts='2099-01-01T10:00:00.000Z',ends='2099-01-01T12:00:00.000Z' WHERE id=1");
  await visit("/qualifikation", mira, { name: "Funk" }, 303);
  assert.match((await visit("/", mira)).html, /In Prüfung[\s\S]+Bitte den neuen Nachweis/);
  await visit("/dispo/nachweis", admin, { qualification: 1, revision: 3 }, 303);
  await visit("/dispo/nachweis-zuruecknehmen", admin, { qualification: 1, revision: 1 }, 422);
  assert.match((await visit("/", mira)).html, /Erledigt[\s\S]+Bitte den neuen Nachweis/);
  assert.doesNotMatch((await visit("/dispo", admin)).html, /Besetzung prüfen\. Fehlende geprüfte Nachweise/);

  for (let index = 1; index <= 28; index++) await submitQualification(db, 2, `synthetisch ${index}`, "", null);
  await visit("/dispo/nachforderung", admin, { ...requested, name: "Reserviert" }, 303);
  await visit("/qualifikation", mira, { name: "Anderes Thema" }, 422);
  await visit("/dispo/nachforderung", admin, { ...requested, name: "Kein Platz" }, 422);
  await visit("/qualifikation", mira, { name: "Reserviert" }, 303);
  await visit("/dispo/nachforderung", admin, { ...requested, name: "Voll" }, 422);
});
