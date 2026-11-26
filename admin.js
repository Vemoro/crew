import { normalizeEmail, openDatabase, passwordHash, requireInput, verifyPasswordLength } from "./model.js";

try {
  const [, , address = "", rawName = "Crew Dispo"] = process.argv;
  const email = normalizeEmail(address);
  const name = rawName.trim();
  const password = process.env.CREW_ADMIN_PASSWORD ?? "";
  requireInput(name.length > 0 && name.length <= 100, "Name prüfen.");
  verifyPasswordLength(password);
  const db = openDatabase();
  const result = db.prepare(`INSERT INTO people (email,name,secret,role,status) VALUES (?,?,?,'admin','active')
    ON CONFLICT(email) DO NOTHING`).run(email, name, passwordHash(password));
  requireInput(result.changes === 1, "Für diese Adresse existiert bereits ein Konto.");
  console.log("Dispo-Konto angelegt.");
  db.close();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
