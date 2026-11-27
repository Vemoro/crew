import { password } from 'bun';
import { createPerson, resetPassword, revokeSessions } from '../server/auth';
import { createPool, writeTransaction } from '../server/db';
import { normalizeEmail, requireInput, verifyPasswordLength } from '../server/inputs';

const [command = '', argument] = Bun.argv.slice(2);
const pool = createPool();
try {
  await writeTransaction(pool, async db => {
    if (command === 'invalidate-sessions') {
      await revokeSessions(db);
      console.log('Alle Crew-Sitzungen sind ungültig.');
      return;
    }
    const value = process.env.CREW_ADMIN_PASSWORD ?? '';
    verifyPasswordLength(value);
    if (command === 'reset-password') {
      await resetPassword(db, normalizeEmail(argument ?? ''), value);
      console.log('Passwort geändert. Frühere Sitzungen sind ungültig.');
    } else {
      const name = (argument ?? 'Crew Dispo').trim();
      requireInput(name.length > 0 && name.length <= 100, 'Name prüfen.');
      await createPerson(db, normalizeEmail(command), name, await password.hash(value), 'admin');
      console.log('Dispo-Konto angelegt.');
    }
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Kontoverwaltung fehlgeschlagen.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
