import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const name = "crew-restore-" + randomBytes(5).toString("hex");
const source = name + "-source";
const target = name + "-target";
const broken = name + "-invalid";
const fallback = name + "-fallback";
const origin = "http://localhost:8080";
const password = "synthetic-restore-password";
const session = "7".repeat(64);
const evidence = "%PDF-1.4\n% Crew synthetischer Nachweis\n%%EOF\n";
const repository = fileURLToPath(new URL("../", import.meta.url));
const composeArgs = (project, args) => ["compose", "-f", fileURLToPath(new URL("../compose.yaml", import.meta.url)), "-p", project, ...args];
const composeOptions = {
  env: { ...process.env, CREW_PORT: "0", CREW_ORIGIN: origin, CREW_REGISTRATION: "open", CREW_TRUSTED_PROXY: "" },
  cwd: repository,
  encoding: "utf8",
  windowsHide: true,
};
const compose = (project, args, input) => execFileSync("docker", composeArgs(project, args), {
  ...composeOptions, input, stdio: ["pipe", "pipe", "pipe"],
}).trim();
const maintenance = (project, ...args) => compose(project, ["run", "--rm", "-T", "crew", "node", "admin.js", ...args]);
const copySnapshot = project => compose(project, ["run", "--rm", "-T", "-v", `${source}_crew-data:/snapshot:ro`, "crew",
  "sh", "-c", "cp -a /snapshot/. /app/data/"]);
const sourceHash = () => compose(source, ["run", "--rm", "-T", "crew", "sha256sum", "/app/data/crew.sqlite"]);

async function start(project) {
  compose(project, ["up", "-d"]);
  const base = "http://" + compose(project, ["port", "crew", "8080"]).replace("\r", "");
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const ready = await fetch(base + "/ready", { signal: AbortSignal.timeout(1000) });
      if (ready.ok) {
        await ready.text();
        return base;
      }
    } catch {
      // Der Container kann bereits gebunden sein, bevor Crew bereit ist.
    }
    await delay(500);
  }
  throw new Error("Crew wurde im Compose-Prüfprojekt nicht bereit.");
}

async function login(base, email) {
  const result = await fetch(base + "/anmelden", { method: "POST", redirect: "manual", headers: { origin },
    body: new URLSearchParams({ email, password }) });
  assert.equal(result.status, 303);
  return result.headers.get("set-cookie").split(";")[0];
}

async function verify(base) {
  const admin = await login(base, "dispo@example.test");
  const staff = await login(base, "mira@example.test");
  const other = await login(base, "leni@example.test");
  const planning = await (await fetch(base + "/dispo", { headers: { Cookie: admin } })).text();
  assert.match(planning, /Stadtfest West/);
  assert.match(planning, /1 von 2 Plätzen besetzt/);
  assert.match(planning, /0 von 1 Plätzen besetzt/);
  assert.match(planning, /Eingeladen: Mira Nord/);
  assert.match(planning, /Welcher Treffpunkt\?[\s\S]+Tor 4/);
  const personal = await (await fetch(base, { headers: { Cookie: staff } })).text();
  assert.match(personal, /Erwartete Vergütung<\/span><strong>80,00\s€/);
  const pdf = await fetch(base + "/nachweis/1", { headers: { Cookie: staff } });
  assert.equal(pdf.status, 200);
  assert.deepEqual(Buffer.from(await pdf.arrayBuffer()), Buffer.from(evidence));
  assert.equal((await fetch(base + "/nachweis/1", { headers: { Cookie: other } })).status, 404);
}

try {
  for (const project of [source, target, broken, fallback]) compose(project, ["build"]);
  compose(source, ["run", "--rm", "-T", "crew", "node", "--input-type=module", "-"], `
    import { openDatabase, passwordHash, sessionHash } from './model.js';
    const db = openDatabase();
    const secret = passwordHash(${JSON.stringify(password)});
    db.prepare("INSERT INTO people (id,email,name,secret,role,status) VALUES (1,'dispo@example.test','Dispo',?,'admin','active'),(2,'mira@example.test','Mira Nord',?,'staff','active'),(3,'leni@example.test','Leni',?,'staff','active')").run(secret, secret, secret);
    db.prepare("INSERT INTO qualifications (person,name,verified,evidence) VALUES (2,'Staplerschein',1,?)").run(Buffer.from(${JSON.stringify(evidence)}));
    db.prepare("INSERT INTO sessions (token,person,expires) VALUES (?,2,?)").run(sessionHash(${JSON.stringify(session)}),Date.now()+3600000);
    db.exec("INSERT INTO events (id,title,location) VALUES (1,'Stadtfest West','Musterhalle')");
    db.prepare("INSERT INTO shifts (id,event,title,starts,ends,slots,cents,requirements,questions,visibility) VALUES (1,1,'Aufbau',?,?,2,8000,'[]',?,'invite')")
      .run(new Date(Date.now()+86400000).toISOString(),new Date(Date.now()+100800000).toISOString(),JSON.stringify(['Welcher Treffpunkt?']));
    db.prepare("INSERT INTO shifts (id,event,title,starts,ends,slots,cents,requirements,questions,visibility) VALUES (2,1,'Abbau',?,?,1,4500,'[]','[]','pool')")
      .run(new Date(Date.now()+104400000).toISOString(),new Date(Date.now()+108000000).toISOString());
    db.prepare("INSERT INTO invitations VALUES (1,2)").run();
    db.prepare("INSERT INTO responses (shift,person,status,answers) VALUES (1,2,'assigned',?)").run(JSON.stringify(['Tor 4']));
    db.close();
  `);
  const sourceBase = await start(source);
  const oldCookie = { Cookie: "crew_session=" + session };
  assert.equal((await fetch(sourceBase + "/nachweis/1", { headers: oldCookie })).status, 200);
  const untouchedCookie = { Cookie: await login(sourceBase, "mira@example.test") };
  await verify(sourceBase);
  compose(source, ["stop", "crew"]);

  for (const project of [target, broken, fallback]) copySnapshot(project);
  const liveSource = await start(source);
  const logout = await fetch(liveSource + "/abmelden", { method: "POST", redirect: "manual",
    headers: { ...oldCookie, Origin: origin }, body: new URLSearchParams() });
  assert.equal(logout.status, 303);
  maintenance(target, "invalidate-sessions");
  const targetBase = await start(target);
  assert.equal((await fetch(targetBase + "/nachweis/1", { headers: oldCookie })).status, 404);
  await verify(targetBase);

  compose(source, ["stop", "crew"]);
  const beforeFailure = sourceHash();
  compose(broken, ["run", "--rm", "-T", "crew", "node", "--input-type=module", "-"], `
    import { closeSync, openSync, writeSync } from 'node:fs';
    import { DatabaseSync } from 'node:sqlite';
    const path = '/app/data/crew.sqlite';
    const db = new DatabaseSync(path, { readOnly: true });
    const rootPage = db.prepare("SELECT rootpage FROM sqlite_schema WHERE name='qualifications'").get().rootpage;
    const pageSize = db.prepare("PRAGMA page_size").get().page_size;
    db.close();
    const file = openSync(path,'r+');
    writeSync(file, Buffer.from([0]), 0, 1, (rootPage-1)*pageSize);
    closeSync(file);
  `);
  const failed = spawnSync("docker", composeArgs(broken, ["run", "--rm", "-T", "crew", "node", "admin.js", "invalidate-sessions"]), composeOptions);
  assert.equal(failed.error, undefined);
  assert.notEqual(failed.status, 0, "Eine beschädigte Datenbank darf nicht als bereit gemeldet werden.");
  assert.match(failed.stderr, /Datenbank ist nicht intakt|database disk image is malformed/);
  assert.equal(sourceHash(), beforeFailure);
  const recoveredSource = await start(source);
  assert.equal((await fetch(recoveredSource + "/nachweis/1", { headers: oldCookie })).status, 404);
  assert.equal((await fetch(recoveredSource + "/nachweis/1", { headers: untouchedCookie })).status, 200);
  await verify(recoveredSource);
  maintenance(fallback, "invalidate-sessions");
  await verify(await start(fallback));
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repository, encoding: "utf8" }).trim();
  console.log("Compose-Restore: Sitzungen, Konten, PDF, Einladungen, Rückmeldungen und Besetzung geprüft.");
  console.log(`Quellstand ${commit}, Laufzeitimage ${compose(source, ["images", "-q", "crew"])}.`);
} finally {
  for (const project of [target, broken, fallback, source]) {
    const cleanup = spawnSync("docker", composeArgs(project, ["down", "-v", "--remove-orphans", "--rmi", "local"]), composeOptions);
    if (cleanup.status !== 0) {
      process.exitCode = 1;
      console.error(`Aufräumen des Prüfprojekts ${project} fehlgeschlagen.`);
    }
  }
}
