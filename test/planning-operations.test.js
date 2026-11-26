import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import { openDatabase, passwordHash, shiftQuery } from "../model.js";
import { createApp } from "../server.js";

test("Dispo korrigiert künftige Schichten, besetzt einen freigegebenen Platz und nimmt die Schicht zurück", async t => {
  const db = openDatabase(":memory:");
  const origin = "http://localhost:8080";
  const password = "synthetic-planning-password";
  const secret = passwordHash(password);
  db.prepare(`INSERT INTO people (id,email,name,secret,role,status) VALUES
    (1,'dispo@example.test','Dispo',?,'admin','active'),(2,'mira@example.test','Mira',?,'staff','active'),
    (3,'leni@example.test','Leni',?,'staff','active'),(4,'andi@example.test','Andi',?,'staff','active')`)
    .run(secret, secret, secret, secret);
  db.exec("INSERT INTO events (id,title,location,instructions) VALUES (1,'Stadtfest','Alte Halle','Tor 1')");
  const slot = db.prepare(`INSERT INTO shifts (id,event,title,starts,ends,slots,cents,requirements,questions,visibility)
    VALUES (?,1,?,?,?,1,?,'[]','[]','invite')`);
  const at = hours => new Date(Date.now() + hours * 3600000).toISOString();
  slot.run(1, "Aufbau", at(24), at(25), 8000);
  slot.run(2, "Abbau", at(25), at(26), 4500);
  slot.run(3, "Vorbereitung", at(-3), at(-2), 0);
  slot.run(4, "Einlass", at(-1), at(1), 0);
  db.exec(`INSERT INTO invitations VALUES (1,2),(2,2),(1,3);
    INSERT INTO responses (shift,person,status,answers) VALUES (1,2,'assigned','[]'),(2,2,'assigned','[]'),(3,2,'assigned','[]');`);
  const server = createApp({ db, origin });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function visit(path, { cookie, data, expected = 200 } = {}) {
    const response = await fetch(base + path, { method: data ? "POST" : "GET", redirect: "manual",
      headers: { origin, ...(cookie ? { Cookie: cookie } : {}) }, body: data && new URLSearchParams(data) });
    const body = await response.text();
    assert.equal(response.status, expected, `${path}: ${body}`);
    return { body, cookie: response.headers.get("set-cookie")?.split(";")[0] };
  }
  async function login(email) {
    return (await visit("/anmelden", { data: { email, password }, expected: 303 })).cookie;
  }
  const admin = await login("dispo@example.test");
  const mira = await login("mira@example.test");
  const leni = await login("leni@example.test");
  const andi = await login("andi@example.test");
  const correction = { event: 1, revision: 1, location: "Neue Halle", instructions: "Nur für Eingeteilte: Tor 4" };
  await visit("/dispo/einsatz-korrigieren", { cookie: mira, data: correction, expected: 404 });
  await visit("/dispo/einsatz-korrigieren", { cookie: admin, data: correction, expected: 303 });
  await visit("/dispo/einsatz-korrigieren", { cookie: admin, data: correction, expected: 422 });
  const byId = db.prepare(shiftQuery + " WHERE s.id=?");
  assert.deepEqual([1, 2, 3, 4].map(id => byId.get(id).location), ["Neue Halle", "Neue Halle", "Alte Halle", "Alte Halle"]);
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
  await visit("/dispo/einladen", { cookie: admin, data: { shift: 1, person: 4 }, expected: 422 });
  await visit("/interesse", { cookie: mira, data: { shift: 1 }, expected: 422 });
  const cancelled = (await visit("/", { cookie: leni })).body;
  assert.match(cancelled, /Schicht zurückgenommen/);
  assert.match(cancelled, /Erwartete Vergütung<\/span><strong>0,00\s€/);
});
