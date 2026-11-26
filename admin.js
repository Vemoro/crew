import { normalizeEmail, openDatabase, passwordHash, requireInput, resetPassword, transaction, verifyPasswordLength } from "./model.js";

try {
  const [, , command = "", argument] = process.argv;
  const password = process.env.CREW_ADMIN_PASSWORD ?? "";
  const clearSessions = command === "invalidate-sessions";
  if (!clearSessions) verifyPasswordLength(password);
  const db = openDatabase(undefined, { initialize: !clearSessions && command !== "reset-password" });
  try {
    if (clearSessions) {
      transaction(db, () => {
        const check = db.prepare("PRAGMA quick_check").all();
        requireInput(check.length === 1 && check[0].quick_check === "ok", "Die Crew-Datenbank ist nicht intakt.");
        db.exec("DELETE FROM sessions");
      });
      console.log("Alle Crew-Sitzungen sind ungültig.");
    } else if (command === "reset-password") {
      resetPassword(db, normalizeEmail(argument ?? ""), password);
      console.log("Passwort geändert. Frühere Sitzungen sind ungültig.");
    } else {
      const email = normalizeEmail(command);
      const name = (argument ?? "Crew Dispo").trim();
      requireInput(name.length > 0 && name.length <= 100, "Name prüfen.");
      const result = db.prepare(`INSERT INTO people (email,name,secret,role,status) VALUES (?,?,?,'admin','active')
        ON CONFLICT(email) DO NOTHING`).run(email, name, passwordHash(password));
      requireInput(result.changes === 1, "Für diese Adresse existiert bereits ein Konto.");
      console.log("Dispo-Konto angelegt.");
    }
  } finally {
    db.close();
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
