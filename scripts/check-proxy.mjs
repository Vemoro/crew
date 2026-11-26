import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { createServer as createProxy, request as httpsRequest } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { openDatabase, passwordHash } from "../model.js";
import { createApp } from "../server.js";

test("HTTPS-Proxy begrenzt Clients getrennt und pausiert Registrierungen", { timeout: 30_000 }, async t => {
  const folder = mkdtempSync(join(tmpdir(), "crew-proxy-test-"));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const keyPath = join(folder, "proxy.key");
  const certPath = join(folder, "proxy.crt");
  execFileSync(process.env.CREW_OPENSSL || "openssl", ["req", "-x509", "-nodes", "-newkey", "rsa:2048",
    "-days", "1", "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1",
    "-keyout", keyPath, "-out", certPath], { stdio: "ignore", windowsHide: true });
  const cert = readFileSync(certPath);
  const db = openDatabase(":memory:");
  t.after(() => db.close());
  const password = "synthetic-proxy-password";
  const secret = passwordHash(password);
  const insert = db.prepare("INSERT INTO people (email,name,secret,role,status) VALUES (?,?,?,?,'active')");
  insert.run("dispo@example.test", "Crew Dispo", secret, "admin");
  insert.run("mira@example.test", "Mira", secret, "staff");

  let upstreamPort;
  const proxy = createProxy({ key: readFileSync(keyPath), cert }, (req, res) => {
    const forward = httpRequest({ hostname: "127.0.0.1", port: upstreamPort, path: req.url, method: req.method,
      headers: { ...req.headers, "x-forwarded-for": req.socket.remoteAddress } }, response => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
    });
    forward.once("error", error => res.destroy(error));
    req.pipe(forward);
  });
  proxy.listen(0, "127.0.0.1");
  await once(proxy, "listening");
  t.after(() => new Promise(resolve => proxy.close(resolve)));
  const origin = `https://127.0.0.1:${proxy.address().port}`;
  const crew = createApp({ db, origin, trustedProxy: "127.0.0.1", registrationOpen: false });
  crew.listen(0, "127.0.0.1");
  await once(crew, "listening");
  upstreamPort = crew.address().port;
  t.after(() => new Promise(resolve => crew.close(resolve)));

  const browser = (path, options = {}) => send(httpsRequest, origin + path, { ca: cert, origin, ...options });
  const paused = await browser("/registrieren");
  assert.equal(paused.status, 200);
  assert.match(paused.html, /Selbstregistrierung ist derzeit pausiert/);
  assert.doesNotMatch(paused.html, /action="\/registrieren"/);
  const registration = await browser("/registrieren", { data: { email: "neu@example.test", password, name: "Neu" } });
  assert.equal(registration.status, 422);
  assert.equal(db.prepare("SELECT count(*) AS count FROM people").get().count, 2);

  const badOrigin = await browser("/anmelden", { origin: "https://fremd.example.test", data: { email: "dispo@example.test", password } });
  assert.equal(badOrigin.status, 422);
  const admin = await browser("/anmelden", { localAddress: "127.0.0.2", data: { email: "dispo@example.test", password } });
  assert.equal(admin.status, 303);
  assert.match(admin.headers["set-cookie"][0], /; Secure/);
  assert.equal(admin.headers["strict-transport-security"], "max-age=31536000");
  for (let attempt = 0; attempt < 50; attempt += 1) {
    assert.equal((await browser("/anmelden", { localAddress: "127.0.0.2", data: {
      email: `offen-${attempt}@example.test`, password,
    } })).status, 422);
  }
  const rateLimited = await browser("/anmelden", { localAddress: "127.0.0.2", data: { email: "mira@example.test", password } });
  assert.match(rateLimited.html, /Zu viele Versuche/);
  const staff = await browser("/anmelden", { localAddress: "127.0.0.3", data: { email: "mira@example.test", password } });
  assert.equal(staff.status, 303);

  const direct = await send(httpRequest, `http://127.0.0.1:${upstreamPort}/anmelden`, {
    origin, localAddress: "127.0.0.4", data: { email: "mira@example.test", password },
    forwardedFor: "127.0.0.2",
  });
  assert.equal(direct.status, 303, "Die fremde Forwarding-Angabe darf den bereits begrenzten Client nicht auswählen.");
});

function send(request, url, { ca, origin, localAddress, data, forwardedFor }) {
  const body = data ? new URLSearchParams(data).toString() : "";
  const headers = body ? { Origin: origin, "Content-Type": "application/x-www-form-urlencoded",
    "Content-Length": Buffer.byteLength(body) } : {};
  if (forwardedFor) headers["X-Forwarded-For"] = forwardedFor;
  return new Promise((resolve, reject) => {
    const req = request(url, { ca, localAddress, method: body ? "POST" : "GET", headers }, res => {
      res.setEncoding("utf8");
      let html = "";
      res.on("data", chunk => { html += chunk; });
      res.once("end", () => resolve({ html, headers: res.headers, status: res.statusCode }));
      res.once("error", reject);
    });
    req.once("error", reject);
    req.end(body);
  });
}
