import { randomBytes } from 'node:crypto';
import { createPool, type Query } from '../src/server/db';
import { createPerson, type Role } from '../src/server/auth';
import { migrate } from '../src/server/schema';

export async function seedPerson(db: Query, email: string, name: string, password: string, role: Role = 'staff') {
  const person = await createPerson(db, email, name, await Bun.password.hash(password), role);
  await db.query("UPDATE people SET status='active' WHERE id=$1", [person.id]);
  return person;
}

export async function createTestDatabase() {
  const base = process.env.CREW_TEST_DATABASE_URL;
  if (!base) throw new Error('CREW_TEST_DATABASE_URL muss auf eine PostgreSQL-Testinstanz zeigen.');
  const root = createPool(base);
  const name = `crew_test_${randomBytes(8).toString('hex')}`;
  const target = new URL(base);
  target.pathname = `/${name}`;
  await root.query(`CREATE DATABASE ${name}`);
  const pool = createPool(target.href);
  const close = async () => {
    await pool.end();
    try { await root.query(`DROP DATABASE ${name} WITH (FORCE)`); } finally { await root.end(); }
  };
  try {
    await migrate(pool);
    return { pool, url: target.href, close };
  } catch (error) {
    await close();
    throw error;
  }
}

export async function startTestServer(url: string, origin: string, registration = 'open', trustedProxy = '', port?: number) {
  const address = new URL(origin);
  const listenPort = String(port ?? address.port);
  const app = Bun.spawn([process.execPath, '.output/server/index.mjs'], { stdout: 'inherit', stderr: 'inherit', env: {
    ...process.env, HOST: '127.0.0.1', PORT: listenPort, TZ: 'Europe/Berlin', DATABASE_URL: url,
    CREW_ORIGIN: origin, CREW_AUTH_SECRET: 'synthetic-isolated-crew-test-signing-secret', CREW_REGISTRATION: registration,
    CREW_TRUSTED_PROXY: trustedProxy,
  } });
  for (let tries = 0; tries < 100; tries++) {
    try { if ((await fetch(`http://127.0.0.1:${listenPort}/ready`)).ok) return app; } catch { /* Der Server startet. */ }
    if (app.exitCode !== null) break;
    await Bun.sleep(50);
  }
  app.kill();
  await app.exited;
  throw new Error('Der gebaute Crew-Server wurde nicht bereit.');
}

export async function stopTestServer(app?: ReturnType<typeof Bun.spawn>) {
  if (app && app.exitCode === null) {
    app.kill();
    await app.exited;
  }
}
