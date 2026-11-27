import type { Pool } from 'pg';
import { adminHome, type Failure } from '../views/admin';
import { authView, shiftView, staffHome } from '../views/staff';
import { page } from '../views/ui';
import { createAccountActions, sessionOwner } from './accounts';
import { submitPlanning, submitStaff } from './actions';
import { createAuth, type Person } from './auth';
import { createPool, first, writeTransaction } from './db';
import { readForm } from './forms';
import { EvidenceInputError, InputError, requireInput } from './inputs';
import { webConfig } from './web-config';

function recordId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 && id <= 2147483647 ? id : undefined;
}

async function adminFailure(pool: Pool, path: string, form: FormData, message: string): Promise<Failure | undefined> {
  const event = recordId(form.get('event'));
  const shift = recordId(form.get('shift'));
  const person = recordId(form.get('person'));
  if (path === '/dispo/einsatz') return { type: 'event', message, form };
  if (event && ['/dispo/schicht', '/dispo/einsatz-korrigieren'].includes(path) && await first(pool, 'SELECT 1 FROM events WHERE id=$1', [event])) {
    return { type: path.endsWith('korrigieren') ? 'correction' : 'shift', event, message, form };
  }
  if (shift && ['/dispo/schicht-zuruecknehmen','/dispo/platz-freigeben','/dispo/einteilen','/dispo/einladen','/dispo/sichtbarkeit'].includes(path)
    && await first(pool, 'SELECT 1 FROM shifts WHERE id=$1', [shift])) return { shift, message };
  if (person && ['/dispo/kontozugang','/dispo/nachforderung'].includes(path)
    && await first(pool, "SELECT 1 FROM people WHERE id=$1 AND role='staff'", [person])) {
    return path === '/dispo/nachforderung' ? { type: 'request', person, message, form } : { person, message };
  }
  const qualification = recordId(form.get('qualification'));
  if (qualification && ['/dispo/nachweis','/dispo/nachweis-zuruecknehmen'].includes(path)) {
    const owner = await first<{ person: number }>(pool, 'SELECT person FROM qualifications WHERE id=$1', [qualification]);
    if (owner) return { person: owner.person, message };
  }
}

export function createCrewHandler(pool: Pool, authPool: Pool, config: ReturnType<typeof webConfig>, timezone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  const { origin, trustedProxy, registrationOpen } = config;
  const accounts = createAccountActions(pool, createAuth(authPool, origin), trustedProxy);
  const baseHeaders = {
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; style-src 'self'; script-src 'self'; img-src 'self'; worker-src 'self'; manifest-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    ...(origin.startsWith('https:') ? { 'Strict-Transport-Security': 'max-age=31536000' } : {}),
  };
  function respond(body: BodyInit | null, status: number, headers: Record<string, string> = {}, cookies: string[] = []) {
    const responseHeaders = new Headers({ ...baseHeaders, 'Content-Type': 'text/html; charset=utf-8', ...headers });
    for (const cookie of cookies) responseHeaders.append('Set-Cookie', cookie);
    return new Response(body, { status, headers: responseHeaders });
  }
  const redirect = (location: string, cookies?: string[]) => respond(null, 303, { Location: location }, cookies);
  const notice = (message: string, user?: Person) => page({ user, registrationOpen, title: 'Hinweis', children:
    <div className="narrow"><h1>Hinweis</h1><p role="alert">{message}</p><a href={user?.role === 'admin' ? '/dispo' : '/'}>Zur Übersicht</a></div> });

  async function failure(path: string, error: InputError, user?: Person, form?: FormData) {
    const { message } = error;
    if (error instanceof EvidenceInputError && form && user?.role === 'staff') {
      return staffHome(pool, user, timezone, { message, form });
    }
    if (!user && ['/anmelden', '/registrieren'].includes(path)) return authView(path, registrationOpen, { message, form });
    if (user?.role === 'admin' && form) {
      const details = await adminFailure(pool, path, form, message);
      if (details) return adminHome(pool, user, timezone, details);
    }
    const shift = recordId(form?.get('shift'));
    if (user?.role === 'staff' && user.status === 'active' && path === '/interesse' && form && shift) {
      return await shiftView(pool, user, shift, timezone, { message, form }) ?? notice(message, user);
    }
    return notice(message, user);
  }

  async function get(path: string, user?: Person) {
    const evidence = recordId(/^\/nachweis\/(\d+)$/.exec(path)?.[1]);
    if (evidence && user) {
      const file = await first<{ evidence: Buffer; person: number }>(pool, 'SELECT person,evidence FROM qualifications WHERE id=$1', [evidence]);
      if (file?.evidence && (user.role === 'admin' || user.id === file.person)) return respond(new Uint8Array(file.evidence), 200, {
        'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="qualifikationsnachweis.pdf"',
      });
    }
    const shift = recordId(/^\/schichten\/(\d+)$/.exec(path)?.[1]);
    if (shift && user?.role === 'staff' && user.status === 'active') {
      const body = await shiftView(pool, user, shift, timezone);
      if (body) return respond(body, 200);
    }
    if (!['/', '/registrieren', '/anmelden', '/dispo'].includes(path)) return respond(notice('Die Seite ist nicht verfügbar.', user), 404);
    if (user?.role === 'admin') return path === '/dispo' ? respond(await adminHome(pool, user, timezone), 200) : redirect('/dispo');
    if (path === '/dispo' || (user && path !== '/')) return redirect('/');
    return respond(user ? await staffHome(pool, user, timezone) : authView(path, registrationOpen), 200);
  }

  return async (request: Request, peer?: string) => {
    const path = new URL(request.url).pathname;
    let user: Person | undefined;
    let session: string | undefined;
    let form: FormData | undefined;
    try {
      if (path === '/ready' && ['GET', 'HEAD'].includes(request.method)) {
        await pool.query('SELECT 1 FROM people LIMIT 1');
        return respond(request.method === 'HEAD' ? null : 'OK', 200, { 'Content-Type': 'text/plain' });
      }
      if (path === '/api/auth' || path.startsWith('/api/auth/')) return respond(notice('Die Seite ist nicht verfügbar.'), 404);
      session = await accounts.currentSession(request);
      user = await sessionOwner(pool, session);
      if (request.method === 'GET' || request.method === 'HEAD') {
        const result = await get(path, user);
        return request.method === 'HEAD' ? new Response(null, result) : result;
      }
      if (request.method !== 'POST') return respond(notice('Die Seite ist nicht verfügbar.', user), 405, { Allow: 'GET, HEAD, POST' });
      requireInput(request.headers.get('origin') === origin, 'Der Ursprung des Formulars stimmt nicht. Öffne Crew über seine konfigurierte Adresse.');
      requireInput(registrationOpen || path !== '/registrieren', 'Die Selbstregistrierung ist derzeit pausiert.');
      const account = path === '/anmelden' || path === '/registrieren';
      requireInput(account || user, 'Bitte melde dich an.');
      form = await readForm(request);
      if (account) {
        const result = await accounts.submit(request, path, form, session, peer);
        return redirect(result.destination, result.cookies);
      }
      requireInput(session, 'Bitte melde dich an.');
      if (path === '/abmelden') return redirect('/', await accounts.signOut(request, session));
      const submitted = form;
      const destination = await writeTransaction(pool, async db => {
        const current = await sessionOwner(db, session);
        requireInput(current, 'Bitte melde dich an.');
        return current.role === 'staff' ? submitStaff(db, current, path, submitted, timezone) : submitPlanning(db, path, submitted, timezone);
      });
      return destination ? redirect(destination) : respond(notice('Die Seite ist nicht verfügbar.', user), 404);
    } catch (error) {
      if (error instanceof InputError) {
        const current = await sessionOwner(pool, session);
        return respond(await failure(path, error, current, form), 422);
      }
      console.error('Crew-Anfrage fehlgeschlagen.', error instanceof Error ? error.name : typeof error);
      return respond(notice('Die Anfrage konnte nicht abgeschlossen werden.'), 500);
    }
  };
}

let handler: ReturnType<typeof createCrewHandler> | undefined;
export function handleRequest(request: Request, peer?: string) {
  handler ??= createCrewHandler(createPool(), createPool(), webConfig(process.env));
  return handler(request, peer);
}
