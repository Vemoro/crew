import { first, rows, type Query } from './db';
import { requireInput } from './inputs';
import type { ProfileStatus } from './auth';

export type Timing = 'apply' | 'assign';
export type ReplyStatus = 'interested' | 'assigned' | 'withdrawn';

export interface CrewEvent {
  id: number;
  title: string;
  location: string;
  reference: string;
  instructions: string;
  revision: number;
}

export interface Shift {
  id: number;
  event: number;
  title: string;
  starts: string;
  ends: string;
  slots: number;
  cents: number;
  requirements: string;
  questions: string;
  visibility: 'draft' | 'pool' | 'invite';
  cancelled_at: string | null;
  placement_revision: number;
  anonymous_assigned: number;
  event_title: string;
  location: string;
  instructions: string;
  filled: number;
}

export interface Reply {
  shift: number;
  person: number;
  status: ReplyStatus;
  answers: string;
  revision: number;
  released_by_dispo: number;
}

export interface Requirement { name: string; timing: Timing }

export const shiftQuery = `
  SELECT s.*,e.title AS event_title,coalesce(s.locked_location,e.location) AS location,
    coalesce(s.locked_instructions,e.instructions) AS instructions,
    s.anonymous_assigned+(SELECT count(*)::integer FROM responses r WHERE r.shift=s.id AND r.status='assigned') AS filled
  FROM shifts s JOIN events e ON e.id=s.event
`;

export async function missingQualifications(db: Query, shift: Shift, person: number, timing: Timing, timezone: string) {
  const verified = await rows<{ name: string; valid_until: string }>(db,
    'SELECT name,valid_until FROM qualifications WHERE person=$1 AND verified=1', [person]);
  const lastDay = new Intl.DateTimeFormat('sv-SE', { timeZone: timezone }).format(new Date(Date.parse(shift.ends) - 1));
  return (JSON.parse(shift.requirements) as Requirement[])
    .filter(requirement => timing === 'assign' || requirement.timing === 'apply')
    .filter(requirement => !verified.some(q => q.name === requirement.name && (!q.valid_until || q.valid_until >= lastDay)))
    .map(requirement => requirement.name);
}

export async function canSee(db: Query, shift: Shift, person: number) {
  if (shift.cancelled_at) return false;
  return shift.visibility === 'pool' || (shift.visibility === 'invite' && Boolean(await first(db,
    'SELECT 1 FROM invitations WHERE shift=$1 AND person=$2', [shift.id, person])));
}

export async function respond(db: Query, shiftId: number, person: number, answers: string[], timezone: string) {
  const shift = await first<Shift>(db, shiftQuery + ' WHERE s.id=$1', [shiftId]);
  requireInput(shift && await canSee(db, shift, person), 'Der Einsatz ist nicht verfügbar.');
  requireInput(shift.starts > new Date().toISOString(), 'Die Schicht hat bereits begonnen.');
  requireInput((await missingQualifications(db, shift, person, 'apply', timezone)).length === 0,
    'Für diese Bewerbung fehlen geprüfte Qualifikationen.');
  const questions = JSON.parse(shift.questions) as string[];
  requireInput(answers.length === questions.length && answers.every(answer => answer.length > 0 && answer.length <= 2000),
    'Bitte beantworte alle Fragen mit höchstens 2.000 Zeichen pro Antwort.');
  await db.query(`INSERT INTO responses (shift,person,status,answers) VALUES ($1,$2,'interested',$3)
    ON CONFLICT (shift,person) DO UPDATE SET status='interested',answers=excluded.answers,revision=responses.revision+1,released_by_dispo=0
    WHERE responses.status='withdrawn' OR (responses.status='interested' AND responses.answers<>excluded.answers)`,
  [shiftId, person, JSON.stringify(answers)]);
}

export async function assign(db: Query, shiftId: number, person: number, revision: number, timezone: string) {
  const shift = await first<Shift>(db, shiftQuery + ' WHERE s.id=$1', [shiftId]);
  const response = await first<Reply & {person_status: ProfileStatus; access_suspended: number}>(db,
    `SELECT r.*,p.status AS person_status,p.access_suspended FROM responses r JOIN people p ON p.id=r.person
    WHERE r.shift=$1 AND r.person=$2`, [shiftId, person]);
  requireInput(response?.revision === revision, 'Die Bewerbung hat sich geändert. Bitte prüfe die aktuelle Rückmeldung.');
  requireInput(shift && !shift.cancelled_at, 'Die Schicht steht nicht mehr zur Besetzung bereit.');
  if (response.status === 'assigned') return;
  requireInput(response.status === 'interested' && response.person_status === 'active' && !response.access_suspended
    && await canSee(db, shift, person), 'Es liegt keine gültige Einsatzbewerbung vor.');
  requireInput(shift.starts > new Date().toISOString(), 'Die Schicht hat bereits begonnen.');
  requireInput(shift.filled < shift.slots, 'Alle Plätze sind bereits besetzt.');
  const missing = await missingQualifications(db, shift, person, 'assign', timezone);
  requireInput(!missing.length, 'Fehlende geprüfte Qualifikationen: ' + missing.join(', '));
  requireInput(!await first(db, `SELECT 1 FROM responses r JOIN shifts s ON s.id=r.shift
    WHERE r.person=$1 AND r.status='assigned' AND s.cancelled_at IS NULL AND s.starts<$2 AND s.ends>$3`,
  [person, shift.ends, shift.starts]), 'Die Person ist zeitgleich bereits eingeteilt.');
  await db.query(`UPDATE responses SET status='assigned' WHERE shift=$1 AND person=$2`, [shiftId, person]);
  await db.query('UPDATE shifts SET placement_revision=placement_revision+1 WHERE id=$1', [shiftId]);
}

export async function correctEvent(db: Query, event: number, revision: number, location: string, instructions: string) {
  const previous = await first<CrewEvent>(db, 'SELECT * FROM events WHERE id=$1', [event]);
  requireInput(previous?.revision === revision, 'Der Einsatz hat sich geändert. Bitte öffne die aktuellen Angaben.');
  await db.query(`UPDATE shifts SET locked_location=$1,locked_instructions=$2
    WHERE event=$3 AND locked_location IS NULL AND (starts<=$4 OR cancelled_at IS NOT NULL)`,
  [previous.location, previous.instructions, event, new Date().toISOString()]);
  await db.query('UPDATE events SET location=$1,instructions=$2,revision=revision+1 WHERE id=$3', [location, instructions, event]);
}

export async function cancelShift(db: Query, shift: number, revision: number) {
  const result = await db.query(`UPDATE shifts SET cancelled_at=$1,placement_revision=placement_revision+1
    WHERE id=$2 AND placement_revision=$3 AND starts>$1 AND cancelled_at IS NULL`, [new Date().toISOString(), shift, revision]);
  if (result.rowCount === 1) {
    await db.query('UPDATE events SET revision=revision+1 WHERE id=(SELECT event FROM shifts WHERE id=$1)', [shift]);
    return;
  }
  const current = await first<Shift>(db, 'SELECT * FROM shifts WHERE id=$1', [shift]);
  requireInput(current?.cancelled_at && current.placement_revision === revision+1,
    'Die Schicht hat sich geändert oder bereits begonnen. Bitte prüfe den aktuellen Stand.');
}

export async function inviteToShift(db: Query, shift: number, person: number) {
  const open = await first(db, `SELECT 1 FROM shifts WHERE id=$1 AND visibility='invite' AND cancelled_at IS NULL AND starts>$2
    AND EXISTS (SELECT 1 FROM people WHERE id=$3 AND role='staff' AND status='active' AND access_suspended=0)`,
  [shift, new Date().toISOString(), person]);
  requireInput(open, 'Eine Einladung benötigt eine offene Einladungsschicht und ein aktives Poolmitglied.');
  const result = await db.query('INSERT INTO invitations VALUES ($1,$2) ON CONFLICT DO NOTHING', [shift, person]);
  if (result.rowCount === 1) await db.query('UPDATE shifts SET placement_revision=placement_revision+1 WHERE id=$1', [shift]);
}

export async function releasePlace(db: Query, shift: number, person: number, revision: number) {
  const result = await db.query(`UPDATE responses SET status='withdrawn',released_by_dispo=1,revision=revision+1
    WHERE shift=$1 AND person=$2 AND revision=$3 AND status='assigned'
    AND EXISTS (SELECT 1 FROM shifts WHERE id=$1 AND starts>$4 AND cancelled_at IS NULL)`,
  [shift, person, revision, new Date().toISOString()]);
  if (result.rowCount === 1) {
    await db.query('UPDATE shifts SET placement_revision=placement_revision+1 WHERE id=$1', [shift]);
    return;
  }
  const current = await first<Reply>(db,'SELECT * FROM responses WHERE shift=$1 AND person=$2', [shift, person]);
  requireInput(current?.status === 'withdrawn' && current.released_by_dispo && current.revision === revision+1,
    'Die Besetzung hat sich geändert oder die Schicht ist nicht mehr offen.');
}

export async function withdraw(db: Query, shift: number, person: number, revision: number, status: string) {
  requireInput(status === 'assigned' || status === 'interested', 'Antwortstatus prüfen.');
  const updated = await db.query(`UPDATE responses SET status='withdrawn'
    WHERE shift=$1 AND person=$2 AND revision=$3 AND status=$4
    AND EXISTS (SELECT 1 FROM shifts WHERE id=responses.shift AND starts>$5 AND cancelled_at IS NULL)`,
  [shift, person, revision, status, new Date().toISOString()]);
  if (updated.rowCount === 1) {
    await db.query('UPDATE shifts SET placement_revision=placement_revision+1 WHERE id=$1', [shift]);
    return;
  }
  const current = await first<Reply>(db, 'SELECT * FROM responses WHERE shift=$1 AND person=$2', [shift, person]);
  requireInput(current?.status === 'withdrawn' && current.revision === revision,
    'Die Rückmeldung hat sich geändert oder die Schicht hat begonnen. Bitte prüfe den aktuellen Stand.');
}
