import type { ReactNode } from 'react';
import type { Person } from '../server/auth';
import { first, rows, type Query } from '../server/db';
import { canSee, missingQualifications, shiftQuery, type Reply, type Shift } from '../server/planning';
import type { Qualification, QualificationRequest } from '../server/qualifications';
import { Alert, Box, Confirmation, Empty, Form, Hidden, Field, Qualifications, Requests, ShiftFacts, Status,
  Submit, money, page, valueOf, type StatusName } from './ui';

export function authView(path: string, registrationOpen: boolean, failure?: { message: string; form?: FormData }) {
  const registering = path === '/registrieren' && registrationOpen;
  const title = registering ? 'Für den Personalpool bewerben' : 'Bei Crew anmelden';
  return page({ title, registrationOpen, children: <div className="narrow"><h1>{title}</h1>
    {registering && <p>Die Dispo prüft deine Bewerbung. Den Status und deine Nachweise siehst du anschließend im Portal.</p>}
    {path === '/registrieren' && !registrationOpen && <p>Die Selbstregistrierung ist derzeit pausiert.</p>}
    <Alert message={failure?.message}/><Form action={registering ? '/registrieren' : '/anmelden'}>
      {registering && <Field title="Name">{control => <input {...control} name="name" autoComplete="name" defaultValue={valueOf(failure?.form,'name')} required maxLength={100}/>}</Field>}
      <Field title="E-Mail-Adresse">{control => <input {...control} type="email" name="email" autoComplete="email" defaultValue={valueOf(failure?.form,'email')} required/>}</Field>
      <Field title="Passwort" hint={registering ? 'Mindestens 12 Zeichen.' : undefined}>{control =>
        <input {...control} name="password" type="password" autoComplete={registering ? 'new-password' : 'current-password'}
          required minLength={registering ? 12 : undefined} maxLength={128}/>}</Field>
      {registering && <Field title="Verfügbarkeit">{control => <textarea {...control} name="availability" maxLength={1000} defaultValue={valueOf(failure?.form,'availability')}/>}</Field>}
      <Submit>{registering ? 'Bewerbung starten' : 'Anmelden'}</Submit>
    </Form></div> });
}

export async function loadQualifications(db: Query, person: number) {
  return rows<Qualification>(db, 'SELECT id,person,name,valid_until,verified,revision,evidence IS NOT NULL AS has_evidence FROM qualifications WHERE person=$1 ORDER BY name', [person]);
}

export async function loadRequests(db: Query, person: number) {
  return rows<QualificationRequest>(db, `SELECT name,note,state FROM qualification_requests WHERE person=$1 ORDER BY state='done',name`, [person]);
}

type EvidenceFailure = { message: string; form: FormData };

function Profile({ user, qualifications, evidenceFailure }: { user: Person; qualifications: Qualification[]; evidenceFailure?: EvidenceFailure }) {
  return <Box title="Profil und Qualifikationen" id="profil">
    <Form action="/verfuegbarkeit"><Field title="Typische Verfügbarkeit oder Hinweis">{control => <textarea {...control} name="availability" maxLength={1000} defaultValue={user.availability}/>}</Field>
      <Submit>Verfügbarkeit speichern</Submit></Form>
    <Qualifications entries={qualifications}/>
    {user.status !== 'rejected' && <Form action="/qualifikation" multipart>
      <h3>Qualifikation einreichen oder erneuern</h3><p className="muted">Wenn du dieselbe Bezeichnung verwendest, ersetzt du den bisherigen Eintrag. Die Dispo prüft den neuen Stand.</p>
      <Field title="Bezeichnung">{control => <input {...control} name="name" maxLength={100} required
        defaultValue={valueOf(evidenceFailure?.form, 'name')}/>}</Field>
      <Field title="Gültig bis (optional)">{control => <input {...control} name="validUntil" type="date"
        defaultValue={valueOf(evidenceFailure?.form, 'validUntil')}/>}</Field>
      <Field title="Nachweis als PDF" hint="Optional, bis 2 MB." error={evidenceFailure?.message}>{control =>
        <input {...control} name="evidence" type="file" accept="application/pdf" autoFocus={Boolean(evidenceFailure)}/>}</Field>
      <Submit>Qualifikation einreichen</Submit></Form>}
  </Box>;
}

function ShiftList({ shifts, render, timezone, empty }: { shifts: Shift[]; render: (shift: Shift) => ReactNode; timezone: string; empty: string }) {
  return shifts.length ? <ul className="items">{shifts.map(shift => <li key={shift.id}><h3>{shift.event_title} · {shift.title}</h3>
    <ShiftFacts shift={shift} timezone={timezone}/>{render(shift)}</li>)}</ul> : <Empty>{empty}</Empty>;
}

function Cancellation({ shift, revision }: { shift: Shift; revision: number }) {
  return <Confirmation id={`cancel-${shift.id}`} title="Einsatz absagen?" toggle="Einsatz absagen" action="/absagen" submit="Absage bestätigen"
    detail={<><p><strong>{shift.event_title} · {shift.title}</strong></p><p>Dein Platz wird wieder frei. Die Schicht entfällt aus deiner erwarteten Vergütung.</p></>}>
    <Hidden name="shift" value={shift.id}/><Hidden name="status" value="assigned"/><Hidden name="revision" value={revision}/>
  </Confirmation>;
}

export async function staffHome(db: Query, user: Person, timezone: string, evidenceFailure?: EvidenceFailure) {
  const qualifications = await loadQualifications(db, user.id);
  const profile = <Profile user={user} qualifications={qualifications} evidenceFailure={evidenceFailure}/>;
  const heading = <><p className="eyebrow">Personalportal</p><h1>Hallo, {user.name}</h1></>;
  if (user.status !== 'active') return page({ user, title: 'Meine Bewerbung', children: <>{heading}
    <Box title="Meine Bewerbung" id="bewerbungen"><p><Status state={user.status}/></p>
      {user.review_note && <p>{user.review_note}</p>}</Box>{profile}</> });
  const now = new Date().toISOString();
  const [responses, relations, cancelledInvites, offers, requests] = await Promise.all([
    rows<Shift>(db, shiftQuery + ' JOIN responses r ON r.shift=s.id WHERE r.person=$1 ORDER BY s.starts', [user.id]),
    rows<Reply>(db, 'SELECT * FROM responses WHERE person=$1', [user.id]),
    rows<Shift>(db, shiftQuery + ` JOIN invitations i ON i.shift=s.id WHERE i.person=$1 AND s.cancelled_at IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM responses r WHERE r.shift=s.id AND r.person=i.person) ORDER BY s.starts`, [user.id]),
    rows<Shift>(db, shiftQuery + ` WHERE s.starts>$1 AND s.cancelled_at IS NULL AND (s.visibility='pool' OR
      (s.visibility='invite' AND EXISTS (SELECT 1 FROM invitations i WHERE i.shift=s.id AND i.person=$2))) ORDER BY s.starts`, [now, user.id]),
    loadRequests(db, user.id),
  ]);
  const states = new Map(relations.map(item => [item.shift,item]));
  const state = (shift: Shift): StatusName => shift.cancelled_at ? 'cancelled'
    : states.get(shift.id)?.released_by_dispo ? 'released' : states.get(shift.id)?.status ?? 'interested';
  const upcoming = responses.filter(shift => shift.ends > now && state(shift) === 'assigned');
  const open = offers.filter(shift => !states.has(shift.id) || !['assigned','interested'].includes(state(shift)));
  const tasks = (await Promise.all(responses.filter(shift => state(shift) === 'interested' && shift.starts > now)
    .map(async shift => (await missingQualifications(db, shift, user.id, 'assign', timezone))
      .map(name => ({ id: `${shift.id}-${name}`, text: `${shift.title} · ${name} prüfen lassen` }))))).flat();
  return page({ user, title: 'Meine Einsätze', children: <>{heading}
    <div className="overview"><div><span className="muted">Bevorstehende Schichten</span><strong>{upcoming.length}</strong></div>
      <div><span className="muted">Erwartete Vergütung</span><strong>{money(upcoming.reduce((sum, shift) => sum + shift.cents, 0))}</strong></div></div>
    <Box title="Als Nächstes"><ShiftList shifts={upcoming} timezone={timezone} empty="Du bist für keine bevorstehende Schicht eingeteilt."
      render={shift => <><p className="preserve">{shift.instructions}</p>{shift.starts > now && <Cancellation shift={shift} revision={states.get(shift.id)!.revision}/>}</>}/></Box>
    <Box title="Offene Schichten" id="schichten"><ShiftList shifts={open} timezone={timezone} empty="Zurzeit gibt es keine neuen Schichtangebote für dich."
      render={shift => <a href={`/schichten/${shift.id}`}>{shift.filled >= shift.slots ? 'Für die Nachbesetzung vormerken' : 'Schicht ansehen'}</a>}/></Box>
    <Box title="Meine Rückmeldungen" id="bewerbungen"><ShiftList shifts={[...responses,...cancelledInvites]} timezone={timezone} empty="Deine Bewerbungen und Zusagen erscheinen hier."
      render={shift => <><p><Status state={state(shift)}/></p>{state(shift) === 'interested' && shift.starts > now && <Form action="/absagen" secondary>
        <Hidden name="shift" value={shift.id}/><Hidden name="status" value="interested"/><Hidden name="revision" value={states.get(shift.id)!.revision}/>
        <Submit>Interesse zurückziehen</Submit></Form>}</>}/></Box>
    <Box title="Aufgaben"><Requests entries={requests}/>{user.review_note && <p>{user.review_note}</p>}
      {tasks.length ? <ul>{tasks.map(task => <li key={task.id}>{task.text}</li>)}</ul> : <Empty>Für deine offenen Einsatzbewerbungen fehlen keine Qualifikationen.</Empty>}</Box>
    {profile}</> });
}

export async function shiftView(db: Query, user: Person, id: number, timezone: string, failure?: { message: string; form: FormData }) {
  const shift = await first<Shift>(db, shiftQuery + ' WHERE s.id=$1 AND s.starts>$2', [id,new Date().toISOString()]);
  if (!shift || !await canSee(db, shift, user.id)) return null;
  const [missing, allMissing, response] = await Promise.all([
    missingQualifications(db,shift,user.id,'apply',timezone), missingQualifications(db,shift,user.id,'assign',timezone),
    first<Reply>(db,'SELECT * FROM responses WHERE shift=$1 AND person=$2',[id,user.id]),
  ]);
  const questions = JSON.parse(shift.questions) as string[];
  const answers = failure?.form.getAll('answer') ?? [];
  return page({ user, title: shift.title, children: <><a href="/#schichten">Alle offenen Schichten</a><p className="eyebrow">{shift.event_title}</p>
    <h1>{shift.title}</h1><ShiftFacts shift={shift} timezone={timezone}/><Alert message={failure?.message}/>
    {allMissing.length > 0 && <p>Noch zu prüfen: {allMissing.join(', ')}</p>}
    {response && response.status !== 'withdrawn' ? <p><Status state={response.status}/></p> : missing.length
      ? <Box title="Vor der Bewerbung erforderlich"><p>{missing.join(', ')}</p><a href="/#profil">Qualifikationen ansehen</a></Box>
      : <Box title="Für die Schicht bewerben"><Form action="/interesse"><Hidden name="shift" value={id}/>
        {questions.map((question, index) => <Field title={question} key={index}>{control => <textarea {...control} name="answer" maxLength={2000} required
          defaultValue={typeof answers[index] === 'string' ? answers[index].slice(0,2000) : ''}/>}</Field>)}
        <Submit>Interesse melden</Submit></Form></Box>}</> });
}
