import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  assign, canSee, checkPassword, InputError, normalizeEmail, openDatabase, passwordHash,
  qualificationName, requireInput, respond, sessionHash, transaction, verifyPasswordLength,
} from "./model.js";
import { render, renderEvidence, renderShift } from "./views.js";

const lifetime = 12 * 60 * 60;
const maxBody = 2_200_000;
const css = readFileSync(new URL("./crew.css", import.meta.url));
const dummyPassword = passwordHash("crew-nonexistent-account");

function field(form, key, max, required = true) {
  const value = form.get(key) ?? "";
  requireInput(typeof value === "string", "Ungültige Eingabe.");
  const trimmed = value.trim();
  requireInput(trimmed.length <= max && (!required || trimmed.length > 0),
    `Bitte prüfe die Eingabe. Erlaubt sind bis zu ${max} Zeichen.`);
  return trimmed;
}

function id(form, key) {
  const value = Number(form.get(key));
  requireInput(Number.isSafeInteger(value) && value > 0, "Ungültiger Eintrag.");
  return value;
}

function lines(form, key) {
  const values = field(form, key, 2000, false).split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  requireInput(values.length <= 10 && values.every(value => value.length <= 200), "Bis zu zehn Zeilen mit je 200 Zeichen sind möglich.");
  return values;
}

function expiration(value) {
  if (!value) return "";
  const date = new Date(value + "T00:00:00Z");
  requireInput(/^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(+date) && date.toISOString().slice(0, 10) === value,
    "Datum für den Nachweis prüfen.");
  return value;
}

function localTime(value) {
  const date = new Date(value);
  const format = new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeStyle: "short" });
  requireInput(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) && Number.isFinite(+date) &&
    format.format(date).replace(" ", "T") === value, "Datum und Uhrzeit prüfen.");
  return date.toISOString();
}

async function readForm(req) {
  const type = req.headers["content-type"] ?? "";
  requireInput(type.startsWith("application/x-www-form-urlencoded") || type.startsWith("multipart/form-data;"), "Ungültiges Formular.");
  requireInput(Number(req.headers["content-length"] || 0) <= maxBody, "Die Datei ist zu groß.");
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    requireInput(bytes <= maxBody, "Die Datei ist zu groß.");
    chunks.push(chunk);
  }
  try {
    return await new Response(Buffer.concat(chunks), { headers: { "Content-Type": type } }).formData();
  } catch {
    throw new InputError("Das Formular konnte nicht gelesen werden.");
  }
}

function authLimit() {
  const attempts = new Map();
  const duration = 15 * 60_000;
  return (ip, email) => {
    const now = Date.now();
    for (const [key, entry] of attempts) {
      if (entry.until <= now) attempts.delete(key);
    }
    const keys = [`ip:${ip}`, `account:${email}`];
    requireInput(attempts.size < 4096, "Bitte versuche es später erneut.");
    for (const [index, key] of keys.entries()) {
      requireInput((attempts.get(key)?.count ?? 0) < (index === 0 ? 50 : 8), "Zu viele Versuche. Bitte versuche es später erneut.");
    }
    for (const key of keys) {
      const entry = attempts.get(key) ?? { until: now + duration, count: 0 };
      entry.count += 1;
      attempts.set(key, entry);
    }
    return () => attempts.delete(keys[1]);
  };
}

const homeFor = user => user?.role === "admin" ? "/dispo" : "/";
const redirect = (res, url) => res.writeHead(303, { Location: url }).end();

function findUser(db, token) {
  if (!token) return undefined;
  return db.prepare(`SELECT p.* FROM sessions s JOIN people p ON p.id=s.person
    WHERE s.token=? AND s.expires>?`).get(sessionHash(token), Date.now());
}

function cookie(res, token, secure) {
  res.setHeader("Set-Cookie", `crew_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? lifetime : 0}${secure ? "; Secure" : ""}`);
}

function saveSession(db, res, person, token, secure) {
  const nextToken = randomBytes(32).toString("hex");
  transaction(db, () => {
    db.prepare("DELETE FROM sessions WHERE expires<=? OR token=?").run(Date.now(), sessionHash(token ?? ""));
    db.prepare("INSERT INTO sessions VALUES (?,?,?)").run(sessionHash(nextToken), person, Date.now() + lifetime * 1000);
  });
  cookie(res, nextToken, secure);
}

async function submit({ db, req, res, token, path, form, secure, timezone, limit }) {
  if (path === "/anmelden" || path === "/registrieren") {
    const email = normalizeEmail(field(form, "email", 254));
    const password = form.get("password");
    requireInput(typeof password === "string" && password.length <= 128, "Anmeldedaten prüfen.");
    const clearAccountLimit = limit(req.socket.remoteAddress, email);
    if (path === "/registrieren") {
      verifyPasswordLength(password);
      const name = field(form, "name", 100);
      const availability = field(form, "availability", 1000, false);
      const result = db.prepare(`INSERT INTO people (email,name,secret,role,status,availability)
        VALUES (?,?,?,'staff','pending',?) ON CONFLICT(email) DO NOTHING`).run(email, name, passwordHash(password), availability);
      requireInput(result.changes === 1, "Registrierung nicht möglich. Wenn du bereits ein Konto hast, melde dich an.");
      saveSession(db, res, result.lastInsertRowid, token, secure);
      clearAccountLimit();
      return "/";
    }
    const person = db.prepare("SELECT * FROM people WHERE email=?").get(email);
    const valid = checkPassword(password, person?.secret ?? dummyPassword);
    requireInput(person && valid, "E-Mail-Adresse oder Passwort stimmt nicht.");
    saveSession(db, res, person.id, token, secure);
    clearAccountLimit();
    return homeFor(person);
  }
  const user = findUser(db, token);
  requireInput(user, "Bitte melde dich an.");
  if (path === "/abmelden") {
    db.prepare("DELETE FROM sessions WHERE token=?").run(sessionHash(token));
    cookie(res, "", secure);
    return "/";
  }

  if (user.role === "staff") {
    if (path === "/verfuegbarkeit") {
      db.prepare("UPDATE people SET availability=? WHERE id=?").run(field(form, "availability", 1000, false), user.id);
      return "/#profil";
    }
    if (path === "/qualifikation") {
      requireInput(user.status !== "rejected", "Deine Bewerbung wurde abgelehnt.");
      const name = qualificationName(field(form, "name", 100));
      const validUntil = expiration(field(form, "validUntil", 10, false));
      const file = form.get("evidence");
      let evidence = null;
      if (file instanceof File && file.size) {
        requireInput(file.size <= 2_000_000 && file.type === "application/pdf", "Erlaubt sind PDF-Dateien bis 2 MB.");
        evidence = Buffer.from(await file.arrayBuffer());
        requireInput(evidence.subarray(0, 5).toString() === "%PDF-", "Die Datei ist keine PDF-Datei.");
      }
      transaction(db, () => {
        const current = findUser(db, token);
        requireInput(current && current.status !== "rejected", "Du kannst derzeit keine Nachweise einreichen.");
        const { count } = db.prepare("SELECT count(*) AS count FROM qualifications WHERE person=?").get(user.id);
        const existing = db.prepare("SELECT 1 FROM qualifications WHERE person=? AND name=?").get(user.id, name);
        requireInput(existing || count < 30, "Du hast bereits 30 Qualifikationen erfasst.");
        db.prepare(`INSERT INTO qualifications (person,name,valid_until,evidence) VALUES (?,?,?,?)
          ON CONFLICT(person,name) DO UPDATE SET valid_until=excluded.valid_until, evidence=excluded.evidence,
            verified=0, revision=qualifications.revision+1`)
          .run(user.id, name, validUntil, evidence);
      });
      return "/#profil";
    }
    if (!["/interesse", "/absagen"].includes(path)) return null;
    requireInput(user.status === "active", "Die Dispo muss deine Bewerbung zuerst freigeben.");
    if (path === "/interesse") {
      const shift = id(form, "shift");
      const answers = form.getAll("answer").map(value => typeof value === "string" ? value.trim() : "");
      respond(db, shift, user.id, answers, timezone);
      return "/#bewerbungen";
    }
    if (path === "/absagen") {
      db.prepare(`UPDATE responses SET status='withdrawn' WHERE shift=? AND person=?
        AND EXISTS (SELECT 1 FROM shifts WHERE id=responses.shift AND starts>?)`).run(id(form, "shift"), user.id, new Date().toISOString());
      return "/#bewerbungen";
    }
    return null;
  }

  if (path === "/dispo/freigabe") {
    const status = field(form, "status", 10);
    requireInput(["active", "rejected", "pending"].includes(status), "Ungültiger Bewerbungsstatus.");
    db.prepare(`UPDATE people SET status=?, review_note=? WHERE id=? AND role='staff' AND status<>'active'`)
      .run(status, field(form, "note", 1000, false), id(form, "person"));
    return "/dispo#personal";
  }
  if (path === "/dispo/nachweis") {
    const result = db.prepare("UPDATE qualifications SET verified=1 WHERE id=? AND revision=?")
      .run(id(form, "qualification"), id(form, "revision"));
    requireInput(result.changes === 1, "Der Nachweis hat sich geändert. Bitte öffne und prüfe den aktuellen Eintrag.");
    return "/dispo#personal";
  }
  if (path === "/dispo/einsatz") {
    const created = db.prepare("INSERT INTO events (title,location,reference,instructions) VALUES (?,?,?,?)").run(
      field(form, "title", 120), field(form, "location", 180), field(form, "reference", 250, false),
      field(form, "instructions", 2000, false),
    );
    return `/dispo#event-${created.lastInsertRowid}`;
  }
  if (path === "/dispo/schicht") {
    const event = id(form, "event");
    requireInput(db.prepare("SELECT 1 FROM events WHERE id=?").get(event), "Einsatz nicht gefunden.");
    const starts = localTime(field(form, "starts", 16));
    const ends = localTime(field(form, "ends", 16));
    requireInput(starts < ends && starts > new Date().toISOString(), "Die Schicht muss in der Zukunft starten und danach enden.");
    const slots = id(form, "slots");
    const pay = field(form, "pay", 10).replace(",", ".");
    requireInput(slots <= 999 && /^\d{1,7}(\.\d{1,2})?$/.test(pay), "Platzanzahl oder Vergütung prüfen.");
    const [euros, fraction = ""] = pay.split(".");
    const cents = Number(euros) * 100 + Number(fraction.padEnd(2, "0"));
    const requirements = new Map();
    for (const timing of ["apply", "assign"]) {
      for (const value of lines(form, timing)) {
        const name = qualificationName(value);
        requireInput(value.length <= 100, "Qualifikationen dürfen höchstens 100 Zeichen lang sein.");
        if (!requirements.has(name)) requirements.set(name, { name, timing });
      }
    }
    db.prepare(`INSERT INTO shifts (event,title,starts,ends,slots,cents,requirements,questions,visibility)
      VALUES (?,?,?,?,?,?,?,?,'draft')`).run(event, field(form, "title", 120), starts, ends, slots, cents,
        JSON.stringify([...requirements.values()]), JSON.stringify(lines(form, "questions")));
    return `/dispo#event-${event}`;
  }
  if (path === "/dispo/sichtbarkeit" || path === "/dispo/einladen" || path === "/dispo/einteilen") {
    const shift = db.prepare("SELECT * FROM shifts WHERE id=?").get(id(form, "shift"));
    requireInput(shift, "Schicht nicht gefunden.");
    if (path === "/dispo/sichtbarkeit") {
      const visibility = field(form, "visibility", 10);
      requireInput(["pool", "invite"].includes(visibility), "Sichtbarkeit prüfen.");
      const published = db.prepare("UPDATE shifts SET visibility=? WHERE id=? AND visibility='draft' AND starts>?")
        .run(visibility, shift.id, new Date().toISOString());
      requireInput(published.changes === 1, "Diese Schicht ist bereits veröffentlicht oder hat begonnen.");
    } else if (path === "/dispo/einladen") {
      const person = id(form, "person");
      requireInput(shift.visibility === "invite" && shift.starts > new Date().toISOString()
        && db.prepare("SELECT 1 FROM people WHERE id=? AND role='staff' AND status='active'").get(person),
      "Eine Einladung benötigt eine offene Einladungsschicht und ein aktives Poolmitglied.");
      db.prepare("INSERT OR IGNORE INTO invitations VALUES (?,?)").run(shift.id, person);
    } else {
      assign(db, shift.id, id(form, "person"), id(form, "revision"), timezone);
    }
    return `/dispo#shift-${shift.id}`;
  }
  return null;
}

export function createApp({ db, origin, timezone = Intl.DateTimeFormat().resolvedOptions().timeZone }) {
  const secure = origin.startsWith("https:");
  const limit = authLimit();
  return createServer({ requestTimeout: 30_000 }, async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
    res.setHeader("Cache-Control", "no-store");
    const token = /(?:^|;\s*)crew_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie ?? "")?.[1];
    let user;
    let path;
    let form;
    try {
      path = new URL(req.url, origin).pathname;
      if (req.method === "GET" && path === "/crew.css") {
        return res.writeHead(200, { "Content-Type": "text/css; charset=utf-8" }).end(css);
      }
      if (req.method === "GET" && path === "/ready") {
        db.prepare("SELECT 1 FROM people LIMIT 1").get();
        return res.writeHead(200, { "Content-Type": "text/plain" }).end("OK");
      }
      user = findUser(db, token);
      let body;
      let status = 200;
      if (req.method === "POST") {
        requireInput(req.headers.origin === origin, "Der Ursprung des Formulars stimmt nicht. Öffne Crew über seine konfigurierte Adresse.");
        requireInput(user || path === "/anmelden" || path === "/registrieren", "Bitte melde dich an.");
        form = await readForm(req);
        const destination = await submit({ db, req, res, token, path, form, secure, timezone, limit });
        if (destination) return redirect(res, destination);
        status = 404;
      } else if (req.method === "GET") {
        const evidence = /^\/nachweis\/(\d+)$/.exec(path);
        const shiftLink = /^\/schichten\/(\d+)$/.exec(path);
        if (evidence && renderEvidence(db, res, user, Number(evidence[1]))) return;
        if (shiftLink && user?.role === "staff" && user.status === "active") {
          body = renderShift(db, user, Number(shiftLink[1]), timezone);
        }
        if (["/", "/registrieren", "/anmelden", "/dispo"].includes(path)) {
          if (user?.role === "admin" && path !== "/dispo") return redirect(res, "/dispo");
          if (path === "/dispo" && user?.role !== "admin") return redirect(res, "/");
          if (user?.role === "staff" && path !== "/") return redirect(res, "/");
          body = render(db, user, timezone, path);
        }
        if (!body) status = 404;
      } else {
        status = 405;
      }
      res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" })
        .end(body ?? render(db, user, timezone, "/fehler", "Die Seite ist nicht verfügbar."));
    } catch (error) {
      const input = error instanceof InputError;
      if (!input) console.error("Crew-Anfrage fehlgeschlagen.", error.code ?? error.name);
      res.writeHead(input ? 422 : 500, { "Content-Type": "text/html; charset=utf-8" })
        .end(render(db, user, timezone, "/fehler",
          input ? error.message : "Die Anfrage konnte nicht abgeschlossen werden.", input ? { path, form } : undefined));
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.env.TZ ||= "Europe/Berlin";
  const port = Number(process.env.PORT || 8080);
  const host = process.env.HOST || "127.0.0.1";
  const address = new URL(process.env.CREW_ORIGIN || `http://localhost:${port}`);
  if (!["http:", "https:"].includes(address.protocol) || address.href !== address.origin + "/") {
    throw new Error("CREW_ORIGIN muss eine HTTP(S)-Origin ohne Pfad sein.");
  }
  const db = openDatabase();
  const server = createApp({ db, origin: address.origin });
  server.listen(port, host, () => console.log("Crew ist bereit."));
  for (const signal of ["SIGTERM", "SIGINT"]) {
    process.once(signal, () => server.close(() => db.close()));
  }
}
