import assert from "node:assert/strict";
import { test } from "node:test";
import { shiftQuery } from "../src/server/planning";
import { createTestDatabase, startTestServer, stopTestServer, seedPerson, encodeForm, type FormRequest } from "./runtime";

test("Dispo korrigiert künftige Schichten, besetzt einen freigegebenen Platz und nimmt die Schicht zurück", async t => {
  const database = await createTestDatabase();
  const db = database.pool;
  t.after(database.close);
  const password = "synthetic-planning-password";
  await seedPerson(db, "dispo@example.test", "Dispo", password, "admin");
  await seedPerson(db, "mira@example.test", "Mira", password);
  await seedPerson(db, "leni@example.test", "Leni", password);
  await seedPerson(db, "andi@example.test", "Andi", password);
  await db.query("INSERT INTO events (id,title,location,instructions) VALUES (1,'Stadtfest','Alte Halle','Tor 1')");
  const slot = (id: number, title: string, starts: string, ends: string, cents: number) => db.query(`INSERT INTO shifts (id,event,title,starts,ends,slots,cents,requirements,questions,visibility)
    VALUES ($1,1,$2,$3,$4,1,$5,'[]','[]','invite')`, [id,title,starts,ends,cents]);
  const at = (hours: number) => new Date(Date.now() + hours * 3600000).toISOString();
  await slot(1, "Aufbau", at(24), at(25), 8000);
  await slot(2, "Abbau", at(25), at(26), 4500);
  await slot(3, "Vorbereitung", at(-3), at(-2), 0);
  await slot(4, "Einlass", at(-1), at(1), 0);
  await db.query(`INSERT INTO invitations VALUES (1,2),(2,2),(1,3);
    INSERT INTO responses (shift,person,status,answers) VALUES (1,2,'assigned','[]'),(2,2,'assigned','[]'),(3,2,'assigned','[]');`);
  const origin = "http://127.0.0.1:42692";
  const base = origin;
  const server = await startTestServer(database.url, origin);
  t.after(() => stopTestServer(server));
  async function visit(path: string, { cookie, data, expected = 200 }: FormRequest = {}) {
    const response = await fetch(base + path, { method: data ? "POST" : "GET", redirect: "manual",
      headers: { origin, ...(cookie ? { Cookie: cookie } : {}) }, body: data && encodeForm(data) });
    const body = await response.text();
    assert.equal(response.status, expected, `${path}: ${body}`);
    return { body, cookie: response.headers.get("set-cookie")?.split(";")[0] };
  }
  async function login(email: string) {
    return (await visit("/anmelden", { data: { email, password }, expected: 303 })).cookie;
  }
  const admin = await login("dispo@example.test");
  const mira = await login("mira@example.test");
  const leni = await login("leni@example.test");
  const andi = await login("andi@example.test");
  const correction = { event: 1, revision: 1, location: "Neue Halle", instructions: "Nur für Eingeteilte: Tor 4" };
  await visit("/dispo/einsatz-korrigieren", { cookie: mira, data: correction, expected: 404 });
  await visit("/dispo/einsatz-korrigieren", { cookie: admin, data: correction, expected: 303 });
  const staleCorrection = await visit("/dispo/einsatz-korrigieren", { cookie: admin, data: correction, expected: 422 });
  assert.match(staleCorrection.body, /Zur Korrektur mit der Fehlermeldung/);
  assert.match(staleCorrection.body, /<li>Aufbau ·[^<]+<\/li><li>Abbau ·[^<]+<\/li>/);
  assert.doesNotMatch(staleCorrection.body, /<li>(Vorbereitung|Einlass) ·/);
  const byId = async (id: number) => (await db.query(shiftQuery + " WHERE s.id=$1", [id])).rows[0];
  assert.deepEqual(await Promise.all([1, 2, 3, 4].map(async (id: number) => (await byId(id)).location)), ["Neue Halle", "Neue Halle", "Alte Halle", "Alte Halle"]);
  assert.match((await visit("/", { cookie: mira })).body, /Tor 4/);
  const invitation = await visit("/schichten/1", { cookie: leni });
  assert.match(invitation.body, /Neue Halle/);
  assert.doesNotMatch(invitation.body, /Tor 4/);
  await visit("/schichten/1", { cookie: andi, expected: 404 });

  const release = { shift: 1, person: 2, revision: 1 };
  await visit("/dispo/platz-freigeben", { cookie: admin, data: { ...release, shift: 3 }, expected: 422 });
  await visit("/dispo/platz-freigeben", { cookie: admin, data: release, expected: 303 });
  await visit("/dispo/platz-freigeben", { cookie: admin, data: release, expected: 303 });
  const after = (await visit("/", { cookie: mira })).body;
  assert.match(after, /Durch die Dispo freigegeben/);
  assert.match(after, /Erwartete Vergütung<\/span><strong>45,00\s€/);
  await visit("/interesse", { cookie: leni, data: { shift: 1 }, expected: 303 });
  await visit("/dispo/einteilen", { cookie: admin, data: { shift: 1, person: 3, revision: 1 }, expected: 303 });
  await visit("/dispo/schicht-zuruecknehmen", { cookie: admin, data: { shift: 1, revision: 2 }, expected: 422 });
  await visit("/dispo/schicht-zuruecknehmen", { cookie: admin, data: { shift: 1, revision: 3 }, expected: 303 });
  await visit("/dispo/einsatz-korrigieren", { cookie: admin, data: { ...correction, revision: 2 }, expected: 422 });
  await visit("/dispo/einladen", { cookie: admin, data: { shift: 1, person: 4 }, expected: 422 });
  await visit("/dispo/einladen", { cookie: admin, data: { shift: 2, person: 4 }, expected: 303 });
  await visit("/dispo/einladen", { cookie: admin, data: { shift: 2, person: 4 }, expected: 303 });
  assert.equal((await byId(2)).placement_revision, 2);
  await visit("/dispo/schicht-zuruecknehmen", { cookie: admin, data: { shift: 2, revision: 1 }, expected: 422 });
  await visit("/interesse", { cookie: mira, data: { shift: 1 }, expected: 422 });
  const cancelled = (await visit("/", { cookie: leni })).body;
  assert.match(cancelled, /Schicht zurückgenommen/);
  assert.match(cancelled, /Erwartete Vergütung<\/span><strong>0,00\s€/);
});
