import { scrypt, timingSafeEqual } from 'node:crypto';
import { password } from 'bun';
import { betterAuth } from 'better-auth';
import type { Pool } from 'pg';
import { first, type Query } from './db';
import { requireInput, verifyPasswordLength } from './inputs';

export type Role = 'staff' | 'admin';
export type ProfileStatus = 'pending' | 'active' | 'rejected';
export interface Person {
  id: number;
  auth_id: string;
  email: string;
  name: string;
  role: Role;
  status: ProfileStatus;
  availability: string;
  review_note: string;
  access_suspended: number;
  access_revision: number;
}

export const nextPersonId = `(SELECT greatest(coalesce((SELECT max(id) FROM people),0),greatest)+1
  FROM erased_ids WHERE kind='people')`;

export async function verifyCredential(value: string, hash: string) {
  if (!hash.startsWith('crew-sqlite:')) return password.verify(value, hash);
  const match = /^crew-sqlite:([a-f0-9]{32}):([a-f0-9]{128})$/.exec(hash);
  if (!match) return false;
  const actual = await new Promise<Buffer>((resolve, reject) => {
    scrypt(value, match[1], 64, (error, derived) => error ? reject(error) : resolve(derived));
  });
  return timingSafeEqual(actual, Buffer.from(match[2], 'hex'));
}

export function createAuth(pool: Pool, origin: string, secret = process.env.CREW_AUTH_SECRET) {
  if (!secret || secret.length < 32) throw new Error('CREW_AUTH_SECRET braucht mindestens 32 Zeichen.');
  return betterAuth({
    baseURL: origin,
    secret,
    database: pool,
    advanced: { cookiePrefix: 'crew-auth', database: { generateId: 'uuid' }, ipAddress: { disableIpTracking: true } },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      password: { hash: value => password.hash(value), verify: ({ password: value, hash }) => verifyCredential(value, hash) },
    },
    user: { modelName: 'auth_users' },
    account: { modelName: 'auth_accounts', accountLinking: { enabled: false } },
    session: { modelName: 'auth_sessions', expiresIn: 43_200, disableSessionRefresh: true },
    verification: { modelName: 'auth_verifications' },
    telemetry: { enabled: false },
    logger: { disabled: true },
  });
}

export type CrewAuth = ReturnType<typeof createAuth>;

export async function insertCredential(db: Query, authId: string, hash: string) {
  await db.query(`INSERT INTO auth_accounts ("userId","providerId","accountId",password)
    VALUES ($1,'credential',$2,$3)`, [authId, authId, hash]);
}

export async function createPerson(db: Query, email: string, name: string, hash: string, role: Role, availability = '') {
  const person = await first<Person>(db, `INSERT INTO people (id,email,name,role,status,availability)
    VALUES (${nextPersonId},$1,$2,$3,$4,$5) ON CONFLICT (email) DO NOTHING RETURNING *`,
  [email, name, role, role === 'admin' ? 'active' : 'pending', availability]);
  requireInput(person, 'Für diese Adresse existiert bereits ein Konto.');
  await insertCredential(db, person.auth_id, hash);
  return person;
}

export async function revokeSessions(db: Query, authId?: string) {
  if (authId) await db.query('DELETE FROM auth_sessions WHERE "userId"=$1', [authId]);
  else await db.query('DELETE FROM auth_sessions');
}

export async function resetPassword(db: Query, email: string, value: string) {
  verifyPasswordLength(value);
  const person = await first<{ auth_id: string; password: string }>(db, `SELECT p.auth_id,a.password
    FROM people p JOIN auth_accounts a ON a."userId"=p.auth_id AND a."providerId"='credential' WHERE p.email=$1`, [email]);
  requireInput(person, 'Für diese Adresse existiert kein Konto.');
  requireInput(!await verifyCredential(value, person.password), 'Das neue Passwort muss sich vom bisherigen unterscheiden.');
  await db.query(`UPDATE auth_accounts SET password=$1,"updatedAt"=now()
    WHERE "userId"=$2 AND "providerId"='credential'`, [await password.hash(value), person.auth_id]);
  await revokeSessions(db, person.auth_id);
}

export async function updatePoolAccess(db: Query, id: number, revision: number, suspended: number) {
  const person = await first<{ auth_id: string }>(db, `UPDATE people SET access_suspended=$1,access_revision=access_revision+1
    WHERE id=$2 AND role='staff' AND status='active' AND access_revision=$3 AND access_suspended<>$1 RETURNING auth_id`,
  [suspended, id, revision]);
  requireInput(person, 'Der Kontozugang hat sich geändert oder das Konto ist kein aktives Poolmitglied.');
  await revokeSessions(db, person.auth_id);
}
