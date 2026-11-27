import { password as bunPassword } from 'bun';
import { APIError } from 'better-auth/api';
import type { Pool } from 'pg';
import { createPerson, verifyCredential, type CrewAuth, type Person } from './auth';
import { first, writeTransaction, type Query } from './db';
import { field } from './forms';
import { InputError, normalizeEmail, requireInput, verifyPasswordLength } from './inputs';
import { clientAddress } from './web-config';

function createLimit() {
  const attempts = new Map<string, { count: number; until: number }>();
  return (ip: string, email: string) => {
    const now = Date.now();
    for (const [key, entry] of attempts) {
      if (entry.until <= now) attempts.delete(key);
    }
    const keys = [`ip:${ip}`, `account:${email}`];
    requireInput(attempts.size < 4096, 'Bitte versuche es später erneut.');
    for (const [index, key] of keys.entries()) {
      requireInput((attempts.get(key)?.count ?? 0) < (index === 0 ? 50 : 8), 'Zu viele Versuche. Bitte versuche es später erneut.');
    }
    for (const key of keys) {
      const entry = attempts.get(key) ?? { until: now + 900_000, count: 0 };
      entry.count += 1;
      attempts.set(key, entry);
    }
    return () => attempts.delete(keys[1]);
  };
}

export async function sessionOwner(db: Query, sessionId?: string) {
  if (!sessionId) return undefined;
  return first<Person>(db, `SELECT p.* FROM auth_sessions s JOIN people p ON p.auth_id=s."userId"
    WHERE s.id=$1 AND s."expiresAt">now() AND p.access_suspended=0`, [sessionId]);
}

const loginError = 'E-Mail-Adresse oder Passwort stimmt nicht.';
const registerError = 'Registrierung nicht möglich. Wenn du bereits ein Konto hast, melde dich an.';

function authenticationHeaders(request: Request) {
  const headers = new Headers();
  for (const name of ['cookie', 'origin']) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  return headers;
}

export function createAccountActions(pool: Pool, auth: CrewAuth, trustedProxy: string) {
  const limit = createLimit();
  const currentSession = async (request: Request) => {
    if (!request.headers.get('cookie')) return undefined;
    return (await auth.api.getSession({ headers: authenticationHeaders(request) }))?.session.id;
  };

  async function signIn(db: Query, request: Request, email: string, password: string, prior?: string) {
    const person = await first<Person>(db, 'SELECT * FROM people WHERE email=$1', [email]);
    try {
      if (person?.access_suspended) {
        const credential = await first<{ password: string }>(db, `SELECT password FROM auth_accounts WHERE "userId"=$1 AND "providerId"='credential'`, [person.auth_id]);
        if (credential?.password) await verifyCredential(password, credential.password);
        throw new InputError(loginError);
      }
      const result = await auth.api.signInEmail({ body: { email, password },
        headers: authenticationHeaders(request), returnHeaders: true });
      requireInput(person, loginError);
      await db.query('DELETE FROM auth_sessions WHERE "expiresAt"<=now() OR id=$1', [prior ?? null]);
      return { destination: person.role === 'admin' ? '/dispo' : '/', cookies: result.headers.getSetCookie() };
    } catch (error) {
      if (error instanceof APIError && [400, 401, 403].includes(error.statusCode)) throw new InputError(loginError);
      throw error;
    }
  }

  async function submit(request: Request, path: string, form: FormData, prior: string | undefined, peer?: string) {
    const email = normalizeEmail(field(form, 'email', 254));
    const password = form.get('password');
    requireInput(typeof password === 'string' && password.length <= 128, 'Anmeldedaten prüfen.');
    const clear = limit(clientAddress(request.headers, peer, trustedProxy), email);
    if (path === '/registrieren') {
      verifyPasswordLength(password);
      const name = field(form, 'name', 100);
      const availability = field(form, 'availability', 1000, false);
      const hash = await bunPassword.hash(password);
      await writeTransaction(pool, async db => {
        requireInput(!await first(db, 'SELECT 1 FROM people WHERE email=$1', [email]), registerError);
        await createPerson(db, email, name, hash, 'staff', availability);
      });
    }
    const result = await writeTransaction(pool, db => signIn(db, request, email, password, prior));
    clear();
    return result;
  }

  async function signOut(request: Request, sessionId: string) {
    return writeTransaction(pool, async db => {
      const result = await auth.api.signOut({ headers: authenticationHeaders(request), returnHeaders: true });
      await db.query('DELETE FROM auth_sessions WHERE id=$1', [sessionId]);
      return result.headers.getSetCookie();
    });
  }

  return { currentSession, submit, signOut };
}
