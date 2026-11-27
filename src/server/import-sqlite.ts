import { Database } from 'bun:sqlite';
import { existsSync, statSync } from 'node:fs';
import type { Pool } from 'pg';
import { insertCredential, type Person } from './auth';
import { first, writeTransaction, type Query } from './db';
import { requireInput } from './inputs';
import { ensureSchema } from './schema';

// These columns are the stable Schema 6 interchange format. Session tables and credential metadata are never copied wholesale.
const tables = {
  events: ['id','title','location','reference','instructions','revision'],
  shifts: ['id','event','title','starts','ends','slots','cents','requirements','questions','visibility','cancelled_at',
    'locked_location','locked_instructions','placement_revision','anonymous_assigned'],
  qualifications: ['id','person','name','valid_until','verified','evidence','revision'],
  qualification_requests: ['person','name','note','state'],
  invitations: ['shift','person'],
  responses: ['shift','person','status','answers','revision','released_by_dispo'],
} as const;

type LegacyPerson = Pick<Person, 'id' | 'email' | 'name' | 'role' | 'status' | 'availability' | 'review_note' | 'access_suspended' | 'access_revision'>
  & { secret: string };

async function copyTable(read: Database, db: Query, table: keyof typeof tables) {
  const columns: readonly string[] = tables[table];
  const select = `SELECT ${columns.join(',')} FROM ${table}`;
  const insert = `INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(',')})`;
  for (const record of read.query<Record<string, unknown>, []>(select).iterate()) {
    await db.query(insert, columns.map(column => {
      const value = record[column];
      return value instanceof Uint8Array ? Buffer.from(value) : value;
    }));
  }
}

async function copyPeople(read: Database, db: Query) {
  for (const person of read.query<LegacyPerson, []>('SELECT * FROM people ORDER BY id').iterate()) {
    requireInput(/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(person.secret), 'Ungültiger Passwortbestand in der SQLite-Quelle.');
    const target = await first<{ auth_id: string }>(db, `INSERT INTO people
      (id,email,name,role,status,availability,review_note,access_suspended,access_revision)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING auth_id`,
    [person.id, person.email, person.name, person.role, person.status, person.availability, person.review_note,
      person.access_suspended, person.access_revision]);
    if (!target) throw new Error('Crew-Profil konnte nicht übernommen werden.');
    await insertCredential(db, target.auth_id, `crew-sqlite:${person.secret}`);
  }
}

export async function importSqlite(pool: Pool, path: string) {
  requireInput(existsSync(path) && statSync(path).isFile() && !existsSync(path + '-wal') && !existsSync(path + '-journal'),
    'Verwende eine vorhandene abgeschlossene SQLite-Sicherung ohne WAL- oder Journaldatei.');
  const source = new Database(path, { readonly: true });
  try {
    source.exec('BEGIN');
    const check = source.query<{ quick_check: string }, []>('PRAGMA quick_check').all();
    const version = source.query<{ user_version: number }, []>('PRAGMA user_version').get()?.user_version;
    requireInput(check.length === 1 && check[0].quick_check === 'ok' && version === 6,
      'Die SQLite-Quelle muss intakt sein und Crew-Schema 6 verwenden.');
    requireInput(!source.query('PRAGMA foreign_key_check').get(), 'Die SQLite-Quelle enthält ungültige Verknüpfungen.');
    await writeTransaction(pool, async db => {
      await ensureSchema(db);
      requireInput(!await first(db, `SELECT 1 WHERE EXISTS (SELECT 1 FROM sqlite_import)
        OR EXISTS (SELECT 1 FROM people) OR EXISTS (SELECT 1 FROM events)
        OR EXISTS (SELECT 1 FROM auth_verifications)
        OR EXISTS (SELECT 1 FROM erased_ids WHERE greatest<>0)`), 'Der PostgreSQL-Zielbestand muss leer sein.');
      await copyPeople(source, db);
      for (const table of Object.keys(tables) as (keyof typeof tables)[]) await copyTable(source, db, table);
      const erased = source.query<{ kind: 'people' | 'qualifications'; greatest: number }, []>('SELECT * FROM erased_ids').all();
      requireInput(erased.length === 2 && erased.some(row => row.kind === 'people') && erased.some(row => row.kind === 'qualifications'),
        'Die Profil- und Nachweiszähler der SQLite-Quelle fehlen.');
      for (const row of erased) await db.query('UPDATE erased_ids SET greatest=$1 WHERE kind=$2', [row.greatest, row.kind]);
      for (const table of ['events','shifts']) {
        const max = await first<{ id: number }>(db, `SELECT coalesce(max(id),0) AS id FROM ${table}`);
        await db.query(`ALTER TABLE ${table} ALTER COLUMN id RESTART WITH ${(max?.id ?? 0) + 1}`);
      }
      await db.query('INSERT INTO sqlite_import DEFAULT VALUES');
    });
  } finally {
    source.close();
  }
}
