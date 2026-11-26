import { isIP } from "node:net";

export function canonicalAddress(value) {
  if (typeof value !== "string") return "";
  const address = value.trim().toLowerCase();
  if (address.startsWith("::ffff:") && isIP(address.slice(7)) === 4) return address.slice(7);
  const family = isIP(address);
  if (family === 4) return address;
  if (family === 6 && !address.includes("%")) return new URL(`http://[${address}]/`).hostname.slice(1, -1);
  return "";
}

export function clientAddress(req, trustedProxy) {
  const peer = canonicalAddress(req.socket.remoteAddress);
  if (!trustedProxy || peer !== trustedProxy) return peer;
  return canonicalAddress(req.headers["x-forwarded-for"]) || peer;
}

export function webConfig(env) {
  const port = Number(env.PORT || 8080);
  const host = env.HOST || "127.0.0.1";
  const address = new URL(env.CREW_ORIGIN || `http://localhost:${port}`);
  if (!["http:", "https:"].includes(address.protocol) || address.href !== address.origin + "/") {
    throw new Error("CREW_ORIGIN muss eine HTTP(S)-Origin ohne Pfad sein.");
  }
  if (address.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(address.hostname)) {
    throw new Error("Eine externe Crew-Adresse benötigt HTTPS.");
  }
  const trustedProxy = canonicalAddress(env.CREW_TRUSTED_PROXY);
  if (env.CREW_TRUSTED_PROXY && !trustedProxy) throw new Error("CREW_TRUSTED_PROXY muss eine einzelne IP-Adresse sein.");
  const registration = env.CREW_REGISTRATION || "open";
  if (!["open", "paused"].includes(registration)) throw new Error("CREW_REGISTRATION muss open oder paused sein.");
  return { port, host, origin: address.origin, trustedProxy, registrationOpen: registration === "open" };
}
