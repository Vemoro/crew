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
const evidence = "%PDF-1.4\n% Crew synthetischer Nachweis\n%%EOF\n";
const repository = fileURLToPath(new URL("../", import.meta.url));
const composeArgs = (project: string, args: string[]) => ["compose", "-f", fileURLToPath(new URL("../compose.yaml", import.meta.url)), "-p", project, ...args];
const composeOptions = {
  env: { ...process.env, CREW_PORT: "0", CREW_ORIGIN: origin, CREW_REGISTRATION: "open", CREW_TRUSTED_PROXY: "",
    CREW_DB_PASSWORD: "synthetic-restore-db-password", CREW_AUTH_SECRET: "synthetic-restore-auth-secret-for-tests" },
  cwd: repository,
  encoding: "utf8" as const,
  windowsHide: true,
};
const compose = (project: string, args: string[], input?: string) => execFileSync("docker", composeArgs(project, args), {
  ...composeOptions, input, stdio: ["pipe", "pipe", "pipe"],
}).trim();
const maintenance = (project: string, ...args: string[]) => compose(project, ["run", "--rm", "-T", "crew", "bun", "run", "admin", ...args]);
const sql = (project: string, input: string) => compose(project, ["exec", "-T", "postgres", "psql",
  "-X", "-U", "crew", "-d", "crew", "--single-transaction", "-v", "ON_ERROR_STOP=1"], input);
const dump = (project: string) => compose(project, ["exec", "-T", "postgres", "pg_dump", "-U", "crew", "--no-owner", "--no-acl", "crew"]);
const database = (project: string) => compose(project, ["up", "-d", "--wait", "postgres"]);

async function start(project: string) {
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

async function login(base: string, email: string) {
  const result = await fetch(base + "/anmelden", { method: "POST", redirect: "manual", headers: { origin },
    body: new URLSearchParams({ email, password }) });
  assert.equal(result.status, 303);
  const cookie = result.headers.get("set-cookie");
  assert.ok(cookie);
  return cookie.split(";")[0];
}

async function verify(base: string) {
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
  const sourceBase = await start(source);
  const hash = await Bun.password.hash(password);
  sql(source, `
    INSERT INTO people (id,email,name,role,status) VALUES
      (1,'dispo@example.test','Dispo','admin','active'),(2,'mira@example.test','Mira Nord','staff','active'),
      (3,'leni@example.test','Leni','staff','active');
    INSERT INTO auth_accounts ("userId","providerId","accountId",password)
      SELECT auth_id,'credential',auth_id::text,'${hash}' FROM people;
    INSERT INTO qualifications (id,person,name,verified,evidence)
      VALUES (1,2,'Staplerschein',1,decode('${Buffer.from(evidence).toString("hex")}','hex'));
    INSERT INTO events (title,location) VALUES ('Stadtfest West','Musterhalle');
    INSERT INTO shifts (event,title,starts,ends,slots,cents,requirements,questions,visibility) VALUES
      (1,'Aufbau','2099-01-01T10:00:00.000Z','2099-01-01T14:00:00.000Z',2,8000,'[]','["Welcher Treffpunkt?"]','invite'),
      (1,'Abbau','2099-01-01T15:00:00.000Z','2099-01-01T17:00:00.000Z',1,4500,'[]','[]','pool');
    INSERT INTO invitations VALUES (1,2);
    INSERT INTO responses (shift,person,status,answers) VALUES (1,2,'assigned','["Tor 4"]');
  `);
  const oldCookie = { Cookie: await login(sourceBase, "mira@example.test") };
  const untouchedCookie = { Cookie: await login(sourceBase, "mira@example.test") };
  await verify(sourceBase);
  compose(source, ["stop", "crew"]);
  const backup = dump(source);
  assert.match(backup, /PostgreSQL database dump/);
  for (const project of [target, broken, fallback]) database(project);
  sql(target, backup);
  sql(fallback, backup);

  const liveSource = await start(source);
  const logout = await fetch(liveSource + "/abmelden", { method: "POST", redirect: "manual",
    headers: { ...oldCookie, Origin: origin }, body: new URLSearchParams() });
  assert.equal(logout.status, 303);
  maintenance(target, "invalidate-sessions");
  const targetBase = await start(target);
  assert.equal((await fetch(targetBase + "/nachweis/1", { headers: oldCookie })).status, 404);
  assert.equal((await fetch(targetBase + "/nachweis/1", { headers: untouchedCookie })).status, 404);
  await verify(targetBase);

  assert.throws(() => sql(broken, backup + "\nINVALID BACKUP;\n"), /syntax error/);
  assert.match(sql(broken, "SELECT to_regclass('public.people') IS NULL AS empty;"), /empty[\s|+-]+t\b/);
  assert.equal((await fetch(liveSource + "/nachweis/1", { headers: oldCookie })).status, 404);
  assert.equal((await fetch(liveSource + "/nachweis/1", { headers: untouchedCookie })).status, 200);
  await verify(liveSource);
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
