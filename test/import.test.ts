import { createHash, scryptSync } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { Database } from 'bun:sqlite';
import { importSqlite } from '../src/server/import-sqlite';
import { first } from '../src/server/db';
import { createTestDatabase, seedPerson, startTestServer, stopTestServer } from './runtime';

test('SQLite-Import erhält Konten, Freigaben, Revisionen, Links, Zähler und PDFs', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'crew-sqlite-import-'));
  const path = join(directory, 'schema-6.sqlite');
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const sqlite = new Database(path);
  sqlite.exec(readFileSync(new URL('./fixtures/sqlite-schema-6.sql', import.meta.url), 'utf8'));
  const password = 'synthetic-legacy-password';
  const salt = '4'.repeat(32);
  const hash = salt + ':' + scryptSync(password, salt, 64).toString('hex');
  const proof = Buffer.from('%PDF-1.4\nSynthetischer Inhalt\n%%EOF');
  const token = '7'.repeat(64);
  sqlite.query(`INSERT INTO people (id,email,name,secret,role,status,availability,access_suspended,access_revision)
    VALUES (5,'mira=abend@example.test','Mira Nord',?,'staff','active','Samstag',0,4),
      (8,'dispo@example.test','Dispo',?,'admin','active','',0,1),
      (9,'gesperrt@example.test','Gesperrt',?,'staff','active','',1,3)`).run(hash, hash, hash);
  sqlite.exec(`INSERT INTO events (id,title,location,revision) VALUES (10,'Stadtfest','Halle',3);
    INSERT INTO shifts (id,event,title,starts,ends,slots,cents,requirements,questions,visibility,placement_revision,anonymous_assigned)
    VALUES (11,10,'Aufbau','2099-05-01T10:00:00.000Z','2099-05-01T12:00:00.000Z',2,8000,'[]','["Welches Tor?"]','invite',4,1);
    INSERT INTO invitations VALUES (11,5);
    INSERT INTO responses (shift,person,status,answers,revision) VALUES (11,5,'assigned','["Tor 4"]',3);
    INSERT INTO qualification_requests VALUES (5,'funk','Nachweis bitte','done');
    UPDATE erased_ids SET greatest=40;`);
  sqlite.query('INSERT INTO qualifications (id,person,name,verified,evidence,revision) VALUES (12,5,\'funk\',1,?,7)').run(proof);
  sqlite.query('INSERT INTO sessions VALUES (?,5,?)').run(createHash('sha256').update(token).digest('hex'), Date.now() + 3600_000);
  sqlite.close();

  const target = await createTestDatabase({ initialize: false });
  t.after(target.close);
  const importCommand = () => spawnSync(process.execPath, ['src/cli/migrate.ts', 'import-sqlite', path], {
    env: { ...process.env, DATABASE_URL: target.url }, encoding: 'utf8',
  });
  const wrongVersion = new Database(path);
  wrongVersion.exec('PRAGMA user_version=5');
  wrongVersion.close();
  const incompatible = importCommand();
  assert.equal(incompatible.status, 1);
  assert.match(incompatible.stderr, /Schema 6/);
  const schemaPresent = () => first(target.pool, "SELECT to_regclass('crew_schema') IS NOT NULL AS present");
  assert.deepEqual(await schemaPresent(), { present: false });
  const invalid = new Database(path);
  invalid.exec("PRAGMA user_version=6; UPDATE people SET secret='invalid' WHERE id=9");
  invalid.close();
  await assert.rejects(importSqlite(target.pool, path), /Passwortbestand/);
  assert.deepEqual(await schemaPresent(), { present: false });
  const repair = new Database(path);
  repair.query('UPDATE people SET secret=? WHERE id=9').run(hash);
  repair.close();
  const original = readFileSync(path);
  const imported = importCommand();
  assert.equal(imported.status, 0, imported.stderr);
  assert.deepEqual(readFileSync(path), original);
  await assert.rejects(importSqlite(target.pool, path), /Zielbestand muss leer sein/);
  const occupied = await createTestDatabase();
  t.after(occupied.close);
  await occupied.pool.query(`INSERT INTO auth_verifications (identifier,value,"expiresAt") VALUES ('synthetic','synthetic',now())`);
  await assert.rejects(importSqlite(occupied.pool, path), /Zielbestand muss leer sein/);
  assert.deepEqual(await first(occupied.pool, 'SELECT count(*)::int AS count FROM people'), { count: 0 });
  assert.equal((await first<{ n: number }>(target.pool, 'SELECT count(*)::int AS n FROM auth_sessions'))?.n, 0);
  assert.deepEqual(await first(target.pool, 'SELECT status,revision,answers FROM responses WHERE shift=11 AND person=5'),
    { status: 'assigned', revision: 3, answers: '["Tor 4"]' });
  assert.deepEqual(await first(target.pool, 'SELECT evidence,revision FROM qualifications WHERE id=12'), { evidence: proof, revision: 7 });
  assert.equal((await seedPerson(target.pool, 'neu@example.test', 'Neu', password)).id, 41);
  assert.deepEqual(await first(target.pool, "INSERT INTO events (title,location) VALUES ('Neu','Halle') RETURNING id"), { id: 11 });

  const origin = 'http://127.0.0.1:42694';
  const server = await startTestServer(target.url, origin, 'paused');
  t.after(() => stopTestServer(server));
  const login = (email: string) => fetch(`${origin}/anmelden`, { method: 'POST', redirect: 'manual', headers: { origin },
    body: new URLSearchParams({ email, password }) });
  assert.equal((await login('gesperrt@example.test')).status, 422);
  assert.equal((await fetch(origin + '/nachweis/12', { headers: { cookie: `crew_session=${token}` } })).status, 404);
  assert.equal((await fetch(origin + '/api/auth/sign-up/email', { method: 'POST', headers: { origin } })).status, 404);
  const mira = await login('mira=abend@example.test');
  assert.equal(mira.status, 303);
  const cookie = mira.headers.getSetCookie()[0].split(';')[0];
  const result = await fetch(origin + '/nachweis/12', { headers: { cookie } });
  assert.deepEqual(Buffer.from(await result.arrayBuffer()), proof);
  const admin = await login('dispo@example.test');
  assert.equal(admin.headers.get('location'), '/dispo');
});
