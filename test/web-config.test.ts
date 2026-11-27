import assert from "node:assert/strict";
import { test } from "node:test";
import { clientAddress, webConfig } from "../src/server/web-config";

test("Lokaler Standard bleibt nutzbar und externe Instanzen brauchen HTTPS", () => {
  assert.deepEqual(webConfig({}), {
    port: 8080, host: "127.0.0.1", origin: "http://localhost:8080", trustedProxy: "", registrationOpen: true,
  });
  assert.equal(webConfig({ CREW_ORIGIN: "https://crew.example.test", CREW_REGISTRATION: "paused" }).registrationOpen, false);
  assert.throws(() => webConfig({ CREW_ORIGIN: "http://crew.example.test" }), /benötigt HTTPS/);
  assert.throws(() => webConfig({ CREW_REGISTRATION: "off" }), /open oder paused/);
  assert.throws(() => webConfig({ CREW_TRUSTED_PROXY: "127.0.0.1, 127.0.0.2" }), /einzelne IP-Adresse/);
});

test("Nur der konfigurierte Proxy kann eine einzelne gültige Client-IP bereitstellen", () => {
  const req = { socket: { remoteAddress: "::ffff:127.0.0.1" },
    headers: { "x-forwarded-for": "2001:0DB8::0001" } };
  assert.equal(clientAddress(new Headers(req.headers), req.socket.remoteAddress, "127.0.0.1"), "2001:db8::1");
  const mappedProxy = webConfig({ CREW_TRUSTED_PROXY: "::ffff:7f00:1" });
  assert.equal(clientAddress(new Headers(req.headers), req.socket.remoteAddress, mappedProxy.trustedProxy), "2001:db8::1");
  assert.equal(clientAddress(new Headers(req.headers), req.socket.remoteAddress, "127.0.0.2"), "127.0.0.1");
  req.headers["x-forwarded-for"] = "203.0.113.1, 127.0.0.1";
  assert.equal(clientAddress(new Headers(req.headers), req.socket.remoteAddress, "127.0.0.1"), "127.0.0.1");
});
