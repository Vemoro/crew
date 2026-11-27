import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { request as startRequest } from "node:http";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { createTestDatabase, startTestServer, stopTestServer, seedPerson } from "./runtime.ts";

test("Pool-Sperre und CLI-Passwortwiederherstellung widerrufen alte Sitzungen", async t => {
  const database = await createTestDatabase();
  const db = database.pool;
  const password = "synthetic-access-password";
  const replacement = "synthetic-recovery-password";
  await seedPerson(db, "dispo@example.test", "Dispo", password, "admin");
  await seedPerson(db, "mira@example.test", "Mira", password);
  await seedPerson(db, "leni@example.test", "Leni", password);
  await db.query(`
    INSERT INTO qualifications (id,person,name,evidence) VALUES (1,2,'Funk',decode('255044462D','hex'));
    INSERT INTO events (id,title,location) VALUES (1,'Stadtfest','Musterhalle');
    INSERT INTO shifts (id,event,title,starts,ends,slots,cents,requirements,questions,visibility)
      VALUES (1,1,'Einlass','2099-01-01T10:00:00.000Z','2099-01-01T14:00:00.000Z',1,8000,'[]','[]','invite');
    INSERT INTO invitations (shift,person) VALUES (1,2);
    INSERT INTO responses (shift,person,status,answers) VALUES (1,2,'assigned','[]');
  `);
  const origin = "http://127.0.0.1:42695";
  const base = origin;
  const server = await startTestServer(database.url, origin);
  t.after(async () => {
    await stopTestServer(server);
    await database.close();
  });
  async function request(path, { cookie, data, expected = 200 } = {}) {
    const headers = { Origin: origin };
    if (cookie) headers.Cookie = cookie;
    const response = await fetch(base + path, { headers, method: data ? "POST" : "GET",
      body: data && new URLSearchParams(data), redirect: "manual" });
    const html = await response.text();
    assert.equal(response.status, expected, `${path}: ${html}`);
    return { cookie: response.headers.get("set-cookie")?.split(";")[0], html };
  }
  async function login(email, password, expected = 303) {
    return (await request("/anmelden", { data: { email, password }, expected })).cookie;
  }
  const admin = await login("dispo@example.test", password);
  const first = await login("mira@example.test", password);
  const second = await login("mira@example.test", password);
  const other = await login("leni@example.test", password);
  await request("/nachweis/1", { cookie: first });
  const suspend = { person: 2, revision: 1, action: "suspend" };
  await request("/dispo/kontozugang", { data: suspend, cookie: other, expected: 404 });
  await request("/dispo/kontozugang", { data: suspend, cookie: admin, expected: 303 });
  await login("mira@example.test", password, 422);
  for (const cookie of [first, second]) await request("/nachweis/1", { cookie, expected: 404 });
  const planning = await request("/dispo", { cookie: admin });
  assert.match(planning.html, /Zugang gesperrt\. Besetzung prüfen\./);
  assert.match(planning.html, /1 von 1 Plätzen besetzt/);
  await request("/dispo/kontozugang", { data: { person: 2, revision: 2, action: "resume" }, cookie: admin, expected: 303 });
  const staleForm = await request("/dispo/kontozugang", { data: suspend, cookie: admin, expected: 422 });
  assert.match(staleForm.html, /id="person-2"><details open="">[\s\S]+role="alert">Der Kontozugang hat sich geändert/);
  for (const cookie of [first, second]) await request("/nachweis/1", { cookie, expected: 404 });
  const renewed = await login("mira@example.test", password);
  await request("/nachweis/1", { cookie: renewed });

  const entrypoint = fileURLToPath(new URL("../src/cli/admin.ts", import.meta.url));
  const invalid = spawnSync(process.execPath, [entrypoint, "reset-password", "mira@example.test"], {
    env: { ...process.env, DATABASE_URL: database.url, CREW_ADMIN_PASSWORD: replacement + "\n" }, encoding: "utf8",
  });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /keine Zeilenumbrüche/);
  const reused = spawnSync(process.execPath, [entrypoint, "reset-password", "mira@example.test"], {
    env: { ...process.env, DATABASE_URL: database.url, CREW_ADMIN_PASSWORD: password }, encoding: "utf8",
  });
  assert.equal(reused.status, 1);
  assert.match(reused.stderr, /muss sich vom bisherigen unterscheiden/);
  await request("/nachweis/1", { cookie: renewed });

  for (const email of ["mira@example.test", "dispo@example.test"]) {
    const formBody = "title=&location=Interner+Testort";
    let pending;
    let responseAfterReset;
    if (email === "dispo@example.test") {
      responseAfterReset = new Promise((resolve, reject) => {
        pending = startRequest(base + "/dispo/einsatz", { method: "POST",
          headers: { Origin: origin, Cookie: admin, "Content-Type": "application/x-www-form-urlencoded",
            "Content-Length": Buffer.byteLength(formBody) },
        }, response => {
          response.setEncoding("utf8");
          let html = "";
          response.on("data", chunk => { html += chunk; });
          response.once("end", () => resolve({ status: response.statusCode, html }));
          response.once("error", reject);
        });
        pending.once("error", reject);
        pending.flushHeaders();
      });
      await Bun.sleep(100);
    }
    const operation = spawnSync(process.execPath, [entrypoint, "reset-password", email], {
      env: { ...process.env, DATABASE_URL: database.url, CREW_ADMIN_PASSWORD: replacement }, encoding: "utf8",
    });
    assert.equal(operation.status, 0, operation.stderr);
    assert.equal((operation.stdout + operation.stderr).includes(replacement), false);
    if (pending) {
      pending.end(formBody);
      const blocked = await responseAfterReset;
      assert.equal(blocked.status, 422);
      assert.doesNotMatch(blocked.html, /Personal und Einsätze|Mira|Interner Testort/);
    }
    await login(email, password, 422);
    await login(email, replacement);
  }
  await request("/nachweis/1", { cookie: renewed, expected: 404 });
  await request("/dispo", { cookie: admin, expected: 303 });
  assert.equal((await db.query("SELECT status FROM responses WHERE shift=1 AND person=2")).rows[0].status, "assigned");
});
