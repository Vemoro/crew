import type { Person } from '../server/auth';
import { rows, type Query } from '../server/db';
import { missingQualifications, shiftQuery, type CrewEvent, type Reply, type Requirement, type Shift } from '../server/planning';
import { loadQualifications, loadRequests } from './staff';
import { Alert, Box, Confirmation, Empty, Form, Hidden, Label, Qualifications, Requests, ShiftFacts, Status,
  Submit, date, page, valueOf } from './ui';

export interface Failure { message: string; form?: FormData; type?: 'event' | 'correction' | 'shift' | 'request'; event?: number; shift?: number; person?: number }
type Staff = Pick<Person,'id'|'name'|'email'|'status'|'availability'|'access_suspended'|'access_revision'>;
type NamedReply = Reply & { name: string; access_suspended: number };

async function staffReview(db: Query, person: Staff, failure?: Failure) {
  const [qualifications,requests] = await Promise.all([loadQualifications(db, person.id),loadRequests(db,person.id)]);
  const values = failure?.type === 'request' ? failure.form : undefined;
  const suspended = Boolean(person.access_suspended);
  const accessTitle = suspended ? 'Zugang wieder freigeben?' : 'Zugang sperren?';
  return <li id={`person-${person.id}`} key={person.id}><details open={Boolean(failure)}><summary>{person.name}{' '}
    {suspended ? <span className="status danger">Zugang gesperrt</span> : <Status state={person.status}/>}</summary>
    <Alert message={failure?.message}/><p>{person.email}</p><p className="preserve">{person.availability || 'Keine typische Verfügbarkeit hinterlegt.'}</p>
    <Qualifications entries={qualifications} admin/><Requests entries={requests}/>
    {person.status === 'active' && !suspended && <details open={Boolean(values)}><summary>Nachweis anfordern</summary>
      <Form action="/dispo/nachforderung"><Hidden name="person" value={person.id}/>
        <Label title="Bezeichnung (wie im Personalnachweis)"><input name="name" maxLength={100} required defaultValue={valueOf(values,'name')}/></Label>
        <Label title="Anforderung für das Personalportal"><textarea name="note" maxLength={1000} required defaultValue={valueOf(values,'note')}/></Label>
        <Submit>Nachweis anfordern</Submit></Form></details>}
    {person.status !== 'active' ? <Form action="/dispo/freigabe"><Hidden name="person" value={person.id}/>
      <Label title="Rückmeldung an die Person (optional)"><textarea name="note" maxLength={1000}/></Label>
      <Label title="Entscheidung"><select name="status"><option value="pending">In Prüfung belassen</option>
        <option value="active">In den Pool aufnehmen</option><option value="rejected">Ablehnen</option></select></Label>
      <Submit>Entscheidung speichern</Submit></Form>
      : <Confirmation id={`access-${person.id}`} title={accessTitle} toggle={accessTitle.slice(0,-1)} action="/dispo/kontozugang"
        submit={suspended ? 'Zugang freigeben' : 'Sperre bestätigen'} danger={!suspended}
        detail={<><p><strong>{person.name}</strong></p><p>{suspended ? 'Die Person kann sich wieder anmelden. Frühere Sitzungen bleiben ungültig.'
          : 'Die Person wird abgemeldet. Bestätigte Schichten bleiben reserviert, bis die Dispo sie prüft.'}</p></>}>
        <Hidden name="person" value={person.id}/><Hidden name="revision" value={person.access_revision}/><Hidden name="action" value={suspended ? 'resume' : 'suspend'}/>
      </Confirmation>}
  </details></li>;
}

function ShiftForm({ event, timezone, failure }: { event: CrewEvent; timezone: string; failure?: Failure }) {
  const form = failure?.form;
  return <details open={Boolean(failure)}><summary>Schicht hinzufügen</summary><Alert message={failure?.message}/>
    <Form action="/dispo/schicht"><Hidden name="event" value={event.id}/>
      <Label title="Schichtname"><input name="title" required maxLength={120} defaultValue={valueOf(form,'title')}/></Label>
      <div className="form-grid"><Label title="Beginn"><input name="starts" type="datetime-local" required defaultValue={valueOf(form,'starts')}/></Label>
        <Label title="Ende"><input name="ends" type="datetime-local" required defaultValue={valueOf(form,'ends')}/></Label></div>
      <p className="muted">Zeitzone: {timezone}</p><div className="form-grid">
        <Label title="Plätze"><input name="slots" type="number" min={1} max={999} required defaultValue={valueOf(form,'slots','1')}/></Label>
        <Label title="Vergütung pro Person in Euro"><input name="pay" inputMode="decimal" maxLength={10} required defaultValue={valueOf(form,'pay')}/></Label></div>
      <Label title="Vor Bewerbung nötig (eine Qualifikation pro Zeile)"><textarea name="apply" maxLength={2000} defaultValue={valueOf(form,'apply')}/></Label>
      <Label title="Vor Einteilung nötig (eine Qualifikation pro Zeile)"><textarea name="assign" maxLength={2000} defaultValue={valueOf(form,'assign')}/></Label>
      <Label title="Pflichtfragen (eine Frage pro Zeile)"><textarea name="questions" maxLength={2000} defaultValue={valueOf(form,'questions')}/></Label>
      <Submit>Schichtentwurf speichern</Submit></Form></details>;
}

function Correction({ event, shifts, timezone, failure }: { event: CrewEvent; shifts: Shift[]; timezone: string; failure?: Failure }) {
  const form = failure?.form;
  return <details open={Boolean(failure)}><summary>Ort und Hinweise korrigieren</summary><Alert message={failure?.message}/>
    {shifts.length ? <><p>Die Änderung betrifft diese Schichten</p><ul>{shifts.map(shift => <li key={shift.id}>{shift.title} · {date(shift.starts,timezone)}</li>)}</ul></>
      : <p>Derzeit sind keine bevorstehenden Schichten betroffen.</p>}
    <p>Begonnene, vergangene und zurückgenommene Schichten behalten ihre bisherigen Angaben.</p>
    <Form action="/dispo/einsatz-korrigieren"><Hidden name="event" value={event.id}/><Hidden name="revision" value={event.revision}/>
      <Label title="Korrigierter Ort"><input name="location" required maxLength={180} defaultValue={valueOf(form,'location',event.location)}/></Label>
      <Label title="Korrigierter Treffpunkt und Hinweise"><textarea name="instructions" maxLength={2000} defaultValue={valueOf(form,'instructions',event.instructions)}/></Label>
      <Submit>Angaben aktualisieren</Submit></Form></details>;
}

function Invitation({ shift, staff }: { shift: Shift; staff: Staff[] }) {
  const id = `invite-${shift.id}`;
  return <><div className="secondary"><button type="button" data-open-dialog={id}>Poolmitglied einladen</button></div>
    <dialog id={id} aria-labelledby={`${id}-title`}><h3 id={`${id}-title`}>Poolmitglied einladen</h3>
      <Form action="/dispo/einladen"><Hidden name="shift" value={shift.id}/><Label title="Poolmitglied"><select name="person" autoFocus>
        {staff.map(person => <option key={person.id} value={person.id}>{person.name} · {person.email}</option>)}</select></Label>
        <div className="dialog-actions"><button className="quiet" type="submit" formMethod="dialog">Abbrechen</button><Submit>Einladung im Portal bereitstellen</Submit></div>
      </Form></dialog></>;
}

function ShiftReply({ shift, response, upcoming, needsQualification, missing }: {
  shift: Shift; response: NamedReply; upcoming: boolean; needsQualification: boolean; missing: string[];
}) {
  const answers = JSON.parse(response.answers) as string[];
  const questions = JSON.parse(shift.questions) as string[];
  return <li><strong>{response.name}</strong>{' '}<Status state={response.released_by_dispo ? 'released' : response.status}/>
    {response.status === 'assigned' && upcoming && Boolean(response.access_suspended) && <p>Zugang gesperrt. Besetzung prüfen.</p>}
    {response.status === 'assigned' && needsQualification && missing.length > 0 && <p>Besetzung prüfen. Fehlende geprüfte Nachweise: {missing.join(', ')}</p>}
    {answers.length > 0 && <dl>{answers.map((answer, i) => <ResponseAnswer key={i} question={questions[i]} answer={answer}/>)}</dl>}
    {response.status === 'interested' && missing.length > 0 && <p>Fehlende Nachweise: {missing.join(', ')}</p>}
    {response.status === 'interested' && upcoming && !response.access_suspended && !missing.length && shift.filled < shift.slots &&
      <Form action="/dispo/einteilen"><ReplyFields shift={shift} response={response}/><Submit>Besetzung bestätigen</Submit></Form>}
    {upcoming && response.status === 'assigned' && <Confirmation id={`release-${shift.id}-${response.person}`} toggle="Platz freigeben" title="Platz freigeben?"
      action="/dispo/platz-freigeben" submit="Platzfreigabe bestätigen"
      detail={<p>Der Platz von {response.name} in „{shift.title}“ wird wieder frei. Für diese Person entfällt die erwartete Vergütung für die Schicht.</p>}>
      <ReplyFields shift={shift} response={response}/></Confirmation>}
  </li>;
}

function ResponseAnswer({ question, answer }: {question: string; answer: string}) { return <><dt>{question}</dt><dd>{answer}</dd></>; }
function ReplyFields({ shift, response }: {shift: Shift; response: Reply}) {
  return <><Hidden name="shift" value={shift.id}/><Hidden name="person" value={response.person}/><Hidden name="revision" value={response.revision}/></>;
}

async function planningShift(db: Query, shift: Shift, staff: Staff[], timezone: string, failure?: Failure) {
  const [responses, invited] = await Promise.all([
    rows<NamedReply>(db, `SELECT r.*,p.name,p.access_suspended FROM responses r JOIN people p ON p.id=r.person
      WHERE r.shift=$1 ORDER BY CASE r.status WHEN 'assigned' THEN 0 WHEN 'interested' THEN 1 ELSE 2 END,p.name`, [shift.id]),
    rows<{name:string}>(db, 'SELECT p.name FROM invitations i JOIN people p ON p.id=i.person WHERE i.shift=$1 ORDER BY p.name', [shift.id]),
  ]);
  const now = new Date().toISOString();
  const upcoming = shift.starts > now && !shift.cancelled_at;
  const needsQualification = shift.ends > now && !shift.cancelled_at;
  const eligible = staff.filter(person => person.status === 'active' && !person.access_suspended);
  const requirements = JSON.parse(shift.requirements) as Requirement[];
  const replies = await Promise.all(responses.map(async response => <ShiftReply key={response.person} shift={shift} response={response}
    upcoming={upcoming} needsQualification={needsQualification} missing={await missingQualifications(db,shift,response.person,'assign',timezone)}/>));
  return <div className="shift" id={`shift-${shift.id}`} key={shift.id}><h3>{shift.title}</h3><Alert message={failure?.message}/>
    <p><Status state={shift.cancelled_at ? 'cancelled' : shift.visibility}/></p><ShiftFacts shift={shift} timezone={timezone}/>
    {requirements.length > 0 && <p>{requirements.map(r => r.name + (r.timing === 'apply' ? ' (vor Bewerbung)' : ' (vor Einteilung)')).join(' · ')}</p>}
    {upcoming && shift.visibility === 'draft' && <Form action="/dispo/sichtbarkeit"><Hidden name="shift" value={shift.id}/>
      <Label title="Veröffentlichen für"><select name="visibility"><option value="pool">Aktiver Pool</option><option value="invite">Nur eingeladene Personen</option></select></Label>
      <Submit>Schicht veröffentlichen</Submit></Form>}
    {shift.visibility === 'invite' && invited.length > 0 && <p>Eingeladen: {invited.map(person => person.name).join(', ')}</p>}
    {upcoming && <Confirmation id={`cancel-dispo-${shift.id}`} toggle="Schicht zurücknehmen" title="Schicht zurücknehmen?"
      action="/dispo/schicht-zuruecknehmen" submit="Rücknahme bestätigen"
      detail={<p>„{shift.title}“ ist anschließend für weitere Bewerbungen und Einteilungen geschlossen. Die erwartete Vergütung für diese Schicht entfällt im Portal.</p>}>
      <Hidden name="shift" value={shift.id}/><Hidden name="revision" value={shift.placement_revision}/></Confirmation>}
    {upcoming && shift.visibility === 'invite' && eligible.length > 0 && <Invitation shift={shift} staff={eligible}/>}
    {replies.length ? <ul className="items">{replies}</ul> : <Empty>Noch keine Rückmeldungen.</Empty>}</div>;
}

function NewEvent({ open, failure }: { open: boolean; failure?: Failure }) {
  const form = failure?.form;
  return <details id="neuer-einsatz" open={open}><summary>Einsatz anlegen</summary><Alert message={failure?.message}/>
    <Form action="/dispo/einsatz"><div className="form-grid">
      <Label title="Einsatzname"><input name="title" required maxLength={120} defaultValue={valueOf(form,'title')}/></Label>
      <Label title="Ort"><input name="location" required maxLength={180} defaultValue={valueOf(form,'location')}/></Label></div>
      <Label title="Externe Referenz (optional)"><input name="reference" maxLength={250} defaultValue={valueOf(form,'reference')}/></Label>
      <Label title="Treffpunkt und Hinweise für eingeteiltes Personal"><textarea name="instructions" maxLength={2000} defaultValue={valueOf(form,'instructions')}/></Label>
      <Submit>Einsatz anlegen</Submit></Form></details>;
}

export async function adminHome(db: Query, user: Person, timezone: string, failure?: Failure) {
  const [staff,events,shifts] = await Promise.all([
    rows<Staff>(db, `SELECT id,name,email,status,availability,access_suspended,access_revision FROM people WHERE role='staff' ORDER BY status='pending' DESC,name`),
    rows<CrewEvent>(db,'SELECT * FROM events ORDER BY id DESC'), rows<Shift>(db,shiftQuery+' ORDER BY s.starts'),
  ]);
  const people = await Promise.all(staff.map(person => staffReview(db,person,failure?.person === person.id ? failure : undefined)));
  const now = new Date().toISOString();
  const eventViews = await Promise.all(events.map(async event => {
    const selected = shifts.filter(shift => shift.event === event.id);
    const eventShifts = await Promise.all(selected.map(shift => planningShift(db,shift,staff,timezone,failure?.shift === shift.id ? failure : undefined)));
    return <article id={`event-${event.id}`} key={event.id}><h3>{event.title}</h3><p className="muted">{event.location}{event.reference && ' · '+event.reference}</p>
      <Correction event={event} shifts={selected.filter(shift => !shift.cancelled_at && shift.starts > now)} timezone={timezone}
        failure={failure?.type === 'correction' && failure.event === event.id ? failure : undefined}/>
      <ShiftForm event={event} timezone={timezone} failure={failure?.type === 'shift' && failure.event === event.id ? failure : undefined}/>{eventShifts}</article>;
  }));
  const newEventFailure = failure?.type === 'event' ? failure : undefined;
  return page({ user, title: 'Disposition', children: <><p className="eyebrow">Disposition</p><h1>Personal und Einsätze</h1>
    {failure?.event && <p><a href={`#event-${failure.event}`}>{failure.type === 'correction' ? 'Zur Korrektur' : 'Zum Schichtformular'} mit der Fehlermeldung</a></p>}
    {failure?.shift && <p><a href={`#shift-${failure.shift}`}>Zur Schicht mit der Fehlermeldung</a></p>}
    {failure?.person && <p><a href={`#person-${failure.person}`}>Zum Personalprofil mit der Fehlermeldung</a></p>}
    {newEventFailure && <p><a href="#neuer-einsatz">Zum Einsatzformular mit der Fehlermeldung</a></p>}
    <div className="overview"><div><span className="muted">Bewerbungen in Prüfung</span><strong>{staff.filter(p => p.status === 'pending').length}</strong></div>
      <div><span className="muted">Aktive Poolmitglieder</span><strong>{staff.filter(p => p.status === 'active' && !p.access_suspended).length}</strong></div></div>
    <Box title="Personal" id="personal">{people.length ? <ul className="items">{people}</ul> : <Empty>Sobald sich jemand registriert, erscheint die Bewerbung hier.</Empty>}</Box>
    <Box title="Einsätze" id="einsaetze"><NewEvent open={!events.length || Boolean(newEventFailure)} failure={newEventFailure}/>{eventViews}</Box></> });
}
