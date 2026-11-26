import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import { openDatabase, passwordHash } from "../model.js";
import { createApp } from "../server.js";

test("Widerruf und Nachforderung schützen neue Einteilungen und zeigen bestehende Zusagen zur Prüfung", async t => {
  const db = openDatabase(":memory:");
  const origin = "http://localhost:8080";
  const password = "synthetic-qualification-password";
  const secret = passwordHash(password);
  db.prepare(`INSERT INTO people (id,email,name,secret,role,status) VALUES
    (1,'dispo@example.test','Dispo',?,'admin','active'),(2,'mira@example.test','Mira',?,'staff','active'),
    (3,'leni@example.test','Leni',?,'staff','active')`).run(secret, secret, secret);
  db.exec(`INSERT INTO qualifications (person,name,verified,evidence) VALUES (2,'funk',1,X'255044462D');
    INSERT INTO events VALUES (1,'Stadtfest','Halle','', '',1);`);
  const create = db.prepare(`INSERT INTO shifts (id,event,title,starts,ends,slots,cents,requirements,questions,visibility)
    VALUES (?,1,?,'2099-01-01T10:00:00.000Z','2099-01-01T12:00:00.000Z',3,8000,?,'[]','pool')`);
  create.run(1, "Bestätigte Schicht", JSON.stringify([{ name: "funk", timing: "assign" }]));
  create.run(2, "Nur mit geprüfter Bewerbung", JSON.stringify([{ name: "funk", timing: "apply" }]));
  create.run(3, "Zweite Auswahl", JSON.stringify([{ name: "funk", timing: "assign" }]));
  db.exec("INSERT INTO responses (shift,person,status,answers) VALUES (1,2,'assigned','[]'),(3,2,'interested','[]')");
  const app = createApp({ db, origin });
  app.listen(0, "127.0.0.1");
  await once(app, "listening");
  t.after(async () => {
    await new Promise(resolve => app.close(resolve));
    db.close();
  });
  const base = `http://127.0.0.1:${app.address().port}`;
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
  db.prepare("UPDATE shifts SET starts=? WHERE id=1").run(new Date(Date.now() - 3600000).toISOString());
  assert.match((await visit("/dispo", admin)).html, /Besetzung prüfen\. Fehlende geprüfte Nachweise: funk/);
  db.prepare("UPDATE shifts SET ends=? WHERE id=1").run(new Date(Date.now() - 10000).toISOString());
  assert.doesNotMatch((await visit("/dispo", admin)).html, /Besetzung prüfen\. Fehlende geprüfte Nachweise/);
  db.exec("UPDATE shifts SET starts='2099-01-01T10:00:00.000Z',ends='2099-01-01T12:00:00.000Z' WHERE id=1");
  await visit("/qualifikation", mira, { name: "Funk" }, 303);
  assert.match((await visit("/", mira)).html, /In Prüfung[\s\S]+Bitte den neuen Nachweis/);
  await visit("/dispo/nachweis", admin, { qualification: 1, revision: 3 }, 303);
  await visit("/dispo/nachweis-zuruecknehmen", admin, { qualification: 1, revision: 1 }, 422);
  assert.match((await visit("/", mira)).html, /Erledigt[\s\S]+Bitte den neuen Nachweis/);
  assert.doesNotMatch((await visit("/dispo", admin)).html, /Besetzung prüfen\. Fehlende geprüfte Nachweise/);
});
