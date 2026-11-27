import { closeSync, mkdirSync, openSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Person } from '../server/auth';
import { createPool, first, rows, writeTransaction, type Query } from '../server/db';
import { normalizeEmail, requireInput } from '../server/inputs';

const context = 's.id AS shift_id,s.title AS shift_title,s.starts,s.ends,s.cancelled_at,e.title AS event_title';
async function profile(db: Query, email: string) {
  const person = await first<Pick<Person, 'id' | 'role'>>(db, `SELECT id,email,name,availability,status,review_note,access_suspended,role
    FROM people WHERE email=$1`, [email]);
  requireInput(person?.role !== 'admin', 'Dieser Befehl gilt nur für Poolprofile.');
  return person;
}

async function exportPerson(db: Query, email: string, destination: string) {
  const person = await profile(db, email);
  requireInput(person, 'Kein Poolprofil für diese Adresse vorhanden.');
  const qualifications = await rows<{ id: number; name: string; valid_until: string; verified: number; evidence: Buffer | null }>(db,
    'SELECT id,name,valid_until,verified,evidence FROM qualifications WHERE person=$1 ORDER BY id', [person.id]);
  const invitations = await rows(db, `SELECT ${context} FROM invitations i
    JOIN shifts s ON s.id=i.shift JOIN events e ON e.id=s.event WHERE i.person=$1 ORDER BY s.starts,s.id`, [person.id]);
  const responses = await rows<{ questions: string; answers: string }>(db, `SELECT ${context},s.questions,r.status,r.answers,r.released_by_dispo,s.cents AS shift_cents
    FROM responses r JOIN shifts s ON s.id=r.shift JOIN events e ON e.id=s.event WHERE r.person=$1 ORDER BY s.starts,s.id`, [person.id]);
  const requests = await rows(db, 'SELECT name,note,state FROM qualification_requests WHERE person=$1 ORDER BY name', [person.id]);
  mkdirSync(destination, { mode: 0o700 });
  const files: string[] = [];
  const write = (name: string, content: string | Buffer) => {
    const path = join(destination, name);
    const file = openSync(path, 'wx', 0o600);
    files.push(path);
    try { writeFileSync(file, content); } finally { closeSync(file); }
  };
  try {
    const exported = qualifications.map(({ evidence, ...entry }) => {
      const file = evidence ? `nachweis-${entry.id}.pdf` : null;
      if (file && evidence) write(file, evidence);
      return { ...entry, file };
    });
    const payload = { format: 1, person, invitations,
      responses: responses.map(row => ({ ...row, questions: JSON.parse(row.questions), answers: JSON.parse(row.answers) })),
      qualifications: exported, qualification_requests: requests };
    write('profil.json', JSON.stringify(payload, null, 2) + '\n');
  } catch (error) {
    for (const path of files) unlinkSync(path);
    rmdirSync(destination);
    throw error;
  }
}

async function erasePerson(db: Query, email: string, confirmedId: number) {
  const person = await profile(db, email);
  if (!person) return false;
  requireInput(person.id === confirmedId, 'Die Profil-ID stimmt nicht mit dem derzeitigen Konto überein.');
  const blocked = await rows<{ id: number; starts: string; ends: string }>(db, `SELECT s.id,s.starts,s.ends FROM shifts s
    JOIN responses r ON r.shift=s.id WHERE r.person=$1 AND r.status='assigned'
      AND s.cancelled_at IS NULL AND s.ends>$2 ORDER BY s.starts,s.id`, [person.id, new Date().toISOString()]);
  requireInput(blocked.length === 0, 'Offene Einteilungen zuerst klären. ' + blocked
    .map(shift => `Schicht #${shift.id} (${shift.starts} bis ${shift.ends})`).join(', '));
  await db.query(`UPDATE shifts SET anonymous_assigned=anonymous_assigned+1 WHERE id IN
    (SELECT shift FROM responses WHERE person=$1 AND status='assigned')`, [person.id]);
  await db.query("UPDATE erased_ids SET greatest=greatest(greatest,$1) WHERE kind='people'", [person.id]);
  await db.query(`UPDATE erased_ids SET greatest=greatest(greatest,coalesce(
    (SELECT max(id) FROM qualifications WHERE person=$1),0)) WHERE kind='qualifications'`, [person.id]);
  await db.query('DELETE FROM qualifications WHERE person=$1', [person.id]);
  await db.query('DELETE FROM invitations WHERE person=$1', [person.id]);
  await db.query('DELETE FROM responses WHERE person=$1', [person.id]);
  await db.query('DELETE FROM people WHERE id=$1', [person.id]);
  return true;
}

try {
  const [command, address, argument, ...rest] = Bun.argv.slice(2);
  const inspect = command === 'inspect';
  requireInput(address && rest.length === 0 && (inspect ? argument === undefined :
    (command === 'export' || command === 'erase') && argument),
  'Aufruf: bun run people inspect EMAIL, export EMAIL ZIELORDNER oder erase EMAIL PROFIL-ID');
  const email = normalizeEmail(address);
  const confirmedId = Number(argument);
  if (command === 'erase') requireInput(/^[1-9]\d*$/.test(argument) && Number.isSafeInteger(confirmedId), 'Profil-ID prüfen.');
  const pool = createPool();
  try {
    if (inspect) {
      const person = await profile(pool, email);
      requireInput(person, 'Kein Poolprofil für diese Adresse vorhanden.');
      console.log(`Profil-ID: ${person.id}`);
    } else if (command === 'export') {
      await writeTransaction(pool, db => exportPerson(db, email, argument));
      console.log('Poolprofil und vorhandene Nachweise exportiert.');
    } else {
      const erased = await writeTransaction(pool, db => erasePerson(db, email, confirmedId));
      console.log(erased ? 'Poolprofil und zugehörige Daten bereinigt.' : 'Kein Poolprofil vorhanden.');
    }
  } finally {
    await pool.end();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Profilverwaltung fehlgeschlagen.');
  process.exitCode = 1;
}
