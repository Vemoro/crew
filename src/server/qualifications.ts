import { first, type Query } from './db';
import { requireInput } from './inputs';

export interface Qualification {
  id: number; person: number; name: string; valid_until: string; verified: number; revision: number; has_evidence: boolean;
}

export interface QualificationRequest { name: string; note: string; state: 'open' | 'submitted' | 'done' }

const nextId = `(SELECT greatest(coalesce((SELECT max(id) FROM qualifications),0),greatest)+1
  FROM erased_ids WHERE kind='qualifications')`;

async function requirePlace(db: Query, person: number, name: string, message: string) {
  const count = await first<{ total: number; existing: number }>(db, `SELECT count(*)::int AS total,
    (count(*) FILTER (WHERE name=$1))::int AS existing FROM (
      SELECT name FROM qualifications WHERE person=$2
      UNION SELECT name FROM qualification_requests WHERE person=$2 AND state='open'
    ) AS reserved`, [name, person]);
  requireInput(count && (count.existing || count.total < 30), message);
}

export async function submitQualification(db: Query, person: number, name: string, validUntil: string, evidence: Buffer | null) {
  await requirePlace(db, person, name, 'Alle 30 Plätze für Qualifikationen sind belegt oder durch Nachforderungen reserviert.');
  await db.query(`INSERT INTO qualifications (id,person,name,valid_until,evidence) VALUES (${nextId},$1,$2,$3,$4)
    ON CONFLICT (person,name) DO UPDATE SET valid_until=excluded.valid_until,evidence=excluded.evidence,
    verified=0,revision=qualifications.revision+1`, [person, name, validUntil, evidence]);
  await db.query(`UPDATE qualification_requests SET state='submitted' WHERE person=$1 AND name=$2 AND state='open'`, [person, name]);
}

export async function reviewQualification(db: Query, id: number, revision: number, verified: number) {
  const entry = await first<Qualification>(db, `UPDATE qualifications SET verified=$1,revision=revision+1
    WHERE id=$2 AND revision=$3 AND verified<>$1 RETURNING person,name`, [verified, id, revision]);
  requireInput(entry, 'Der Nachweis hat sich geändert. Bitte öffne und prüfe den aktuellen Eintrag.');
  if (verified) await db.query(`UPDATE qualification_requests SET state='done'
    WHERE person=$1 AND name=$2 AND state='submitted'`, [entry.person, entry.name]);
}

export async function requestQualification(db: Query, person: number, name: string, note: string) {
  requireInput(await first(db, `SELECT 1 FROM people WHERE id=$1 AND role='staff' AND status='active' AND access_suspended=0`, [person]),
    'Eine Nachforderung benötigt ein aktives Poolmitglied.');
  await requirePlace(db, person, name, 'Alle 30 Plätze dieses Poolprofils sind belegt oder durch Nachforderungen reserviert.');
  const change = await db.query(`INSERT INTO qualification_requests (person,name,note,state) VALUES ($1,$2,$3,'open')
    ON CONFLICT (person,name) DO UPDATE SET note=excluded.note,state='open' WHERE qualification_requests.state='done'`, [person, name, note]);
  requireInput(change.rowCount === 1, 'Für diesen Nachweis läuft bereits eine Nachforderung.');
}
