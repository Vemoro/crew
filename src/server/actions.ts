import { updatePoolAccess, type Person } from './auth';
import { first, type Query } from './db';
import { expiration, field, id, lines, localTime } from './forms';
import { qualificationName, requireInput } from './inputs';
import { assign, cancelShift, correctEvent, inviteToShift, releasePlace, respond, withdraw, type Requirement } from './planning';
import { requestQualification, reviewQualification, submitQualification } from './qualifications';

export async function submitStaff(db: Query, user: Person, path: string, form: FormData, timezone: string) {
  if (path === '/verfuegbarkeit') {
    await db.query('UPDATE people SET availability=$1 WHERE id=$2', [field(form, 'availability', 1000, false), user.id]);
    return '/#profil';
  }
  if (path === '/qualifikation') {
    requireInput(user.status !== 'rejected', 'Deine Bewerbung wurde abgelehnt.');
    const name = qualificationName(field(form, 'name', 100));
    const validUntil = expiration(field(form, 'validUntil', 10, false));
    const file = form.get('evidence');
    let evidence = null;
    if (file instanceof File && file.size) {
      requireInput(file.size <= 2_000_000 && file.type === 'application/pdf', 'Erlaubt sind PDF-Dateien bis 2 MB.');
      evidence = Buffer.from(await file.arrayBuffer());
      requireInput(evidence.subarray(0, 5).toString() === '%PDF-', 'Die Datei ist keine PDF-Datei.');
    }
    await submitQualification(db, user.id, name, validUntil, evidence);
    return '/#profil';
  }
  if (path !== '/interesse' && path !== '/absagen') return null;
  requireInput(user.status === 'active', 'Die Dispo muss deine Bewerbung zuerst freigeben.');
  const shift = id(form, 'shift');
  if (path === '/interesse') {
    const answers = form.getAll('answer').map(value => typeof value === 'string' ? value.trim() : '');
    await respond(db, shift, user.id, answers, timezone);
  } else {
    const status = field(form, 'status', 10);
    requireInput(status === 'interested' || status === 'assigned', 'Antwortstatus prüfen.');
    await withdraw(db, shift, user.id, id(form, 'revision'), status);
  }
  return '/#bewerbungen';
}

async function addShift(db: Query, form: FormData) {
  const event = id(form, 'event');
  requireInput(await first(db, 'SELECT 1 FROM events WHERE id=$1', [event]), 'Einsatz nicht gefunden.');
  const starts = localTime(field(form, 'starts', 16));
  const ends = localTime(field(form, 'ends', 16));
  requireInput(starts < ends && starts > new Date().toISOString(), 'Die Schicht muss in der Zukunft starten und danach enden.');
  const slots = id(form, 'slots');
  const pay = field(form, 'pay', 10).replace(',', '.');
  requireInput(slots <= 999 && /^\d{1,7}(\.\d{1,2})?$/.test(pay), 'Platzanzahl oder Vergütung prüfen.');
  const [euros, fraction = ''] = pay.split('.');
  const cents = Number(euros) * 100 + Number(fraction.padEnd(2, '0'));
  const requirements = new Map<string, Requirement>();
  for (const timing of ['apply', 'assign'] as const) {
    for (const value of lines(form, timing)) {
      const name = qualificationName(value);
      requireInput(value.length <= 100, 'Qualifikationen dürfen höchstens 100 Zeichen lang sein.');
      if (!requirements.has(name)) requirements.set(name, { name, timing });
    }
  }
  await db.query(`INSERT INTO shifts (event,title,starts,ends,slots,cents,requirements,questions,visibility)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft')`, [event, field(form, 'title', 120), starts, ends, slots, cents,
    JSON.stringify([...requirements.values()]), JSON.stringify(lines(form, 'questions'))]);
  await db.query('UPDATE events SET revision=revision+1 WHERE id=$1', [event]);
  return `/dispo#event-${event}`;
}

async function changeShift(db: Query, shift: number, path: string, form: FormData, timezone: string) {
  if (path === '/dispo/sichtbarkeit') {
    const visibility = field(form, 'visibility', 10);
    requireInput(visibility === 'pool' || visibility === 'invite', 'Sichtbarkeit prüfen.');
    const published = await db.query(`UPDATE shifts SET visibility=$1,placement_revision=placement_revision+1
      WHERE id=$2 AND visibility='draft' AND starts>$3 AND cancelled_at IS NULL`, [visibility, shift, new Date().toISOString()]);
    requireInput(published.rowCount === 1, 'Diese Schicht ist bereits veröffentlicht oder hat begonnen.');
  } else if (path === '/dispo/einladen') await inviteToShift(db, shift, id(form, 'person'));
  else await assign(db, shift, id(form, 'person'), id(form, 'revision'), timezone);
  return `/dispo#shift-${shift}`;
}

export async function submitPlanning(db: Query, path: string, form: FormData, timezone: string) {
  switch (path) {
    case '/dispo/einsatz-korrigieren': {
      const event = id(form, 'event');
      await correctEvent(db, event, id(form, 'revision'), field(form, 'location', 180), field(form, 'instructions', 2000, false));
      return `/dispo#event-${event}`;
    }
    case '/dispo/schicht-zuruecknehmen':
    case '/dispo/platz-freigeben': {
      const shift = id(form, 'shift');
      const revision = id(form, 'revision');
      if (path === '/dispo/schicht-zuruecknehmen') await cancelShift(db, shift, revision);
      else await releasePlace(db, shift, id(form, 'person'), revision);
      return `/dispo#shift-${shift}`;
    }
    case '/dispo/kontozugang': {
      const action = field(form, 'action', 10);
      requireInput(action === 'suspend' || action === 'resume', 'Kontozugang prüfen.');
      const person = id(form, 'person');
      await updatePoolAccess(db, person, id(form, 'revision'), action === 'suspend' ? 1 : 0);
      return `/dispo#person-${person}`;
    }
    case '/dispo/freigabe': {
      const status = field(form, 'status', 10);
      requireInput(['active', 'rejected', 'pending'].includes(status), 'Ungültiger Bewerbungsstatus.');
      await db.query(`UPDATE people SET status=$1,review_note=$2 WHERE id=$3 AND role='staff' AND status<>'active'`,
        [status, field(form, 'note', 1000, false), id(form, 'person')]);
      return '/dispo#personal';
    }
    case '/dispo/nachweis':
    case '/dispo/nachweis-zuruecknehmen':
      await reviewQualification(db, id(form, 'qualification'), id(form, 'revision'), path === '/dispo/nachweis' ? 1 : 0);
      return '/dispo#personal';
    case '/dispo/nachforderung': {
      const person = id(form, 'person');
      await requestQualification(db, person, qualificationName(field(form, 'name', 100)), field(form, 'note', 1000));
      return `/dispo#person-${person}`;
    }
    case '/dispo/einsatz': {
      const created = await first<{ id: number }>(db, 'INSERT INTO events (title,location,reference,instructions) VALUES ($1,$2,$3,$4) RETURNING id',
        [field(form, 'title', 120), field(form, 'location', 180), field(form, 'reference', 250, false), field(form, 'instructions', 2000, false)]);
      return `/dispo#event-${created?.id}`;
    }
    case '/dispo/schicht': return addShift(db, form);
    case '/dispo/sichtbarkeit':
    case '/dispo/einladen':
    case '/dispo/einteilen': {
      const shift = id(form, 'shift');
      requireInput(await first(db, 'SELECT 1 FROM shifts WHERE id=$1', [shift]), 'Schicht nicht gefunden.');
      return changeShift(db, shift, path, form, timezone);
    }
    default: return null;
  }
}
