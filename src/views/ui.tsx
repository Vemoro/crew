import { useId, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Person } from '../server/auth';
import type { Shift } from '../server/planning';
import type { Qualification, QualificationRequest } from '../server/qualifications';
import { Sidebar } from './navigation';

const labels = {
  pending: 'In Prüfung', active: 'Im Pool', rejected: 'Abgelehnt', interested: 'Interesse gemeldet',
  assigned: 'Eingeteilt', withdrawn: 'Zurückgezogen', draft: 'Entwurf', pool: 'Im Pool sichtbar',
  invite: 'Nur auf Einladung', cancelled: 'Schicht zurückgenommen', released: 'Durch die Dispo freigegeben',
  open: 'Nachweis angefordert', submitted: 'In Prüfung', done: 'Erledigt',
};
const tones: Partial<Record<keyof typeof labels, string>> = {
  pending: 'warning', active: 'ok', rejected: 'danger', interested: 'info', assigned: 'ok',
  draft: 'draft', open: 'warning', submitted: 'info', done: 'ok',
};

export type StatusName = keyof typeof labels;
export const money = (cents: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
export const date = (value: string, timezone: string) => new Intl.DateTimeFormat('de-DE',
  { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone }).format(new Date(value));

export function Status({ state }: { state: StatusName }) {
  return <span className={`status ${tones[state] ?? 'neutral'}`}><span aria-hidden="true"/>{labels[state]}</span>;
}

export function Box({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return <section id={id}><h2>{title}</h2>{children}</section>;
}

export function Empty({ children }: { children: ReactNode }) { return <p className="muted">{children}</p>; }
export function Alert({ message }: { message?: string }) { return message ? <p className="form-error" role="alert">{message}</p> : null; }
type FieldControl = { id: string; 'aria-describedby'?: string; 'aria-invalid'?: true };

export function Field({ title, hint, error, children }: {
  title: string; hint?: string; error?: string; children: (control: FieldControl) => ReactNode;
}) {
  const id = useId();
  const description = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ');
  return <div className="field">
    <label id={`${id}-label`} htmlFor={id}>{title}</label>
    {children({ id, 'aria-describedby': description || undefined, 'aria-invalid': error ? true : undefined })}
    {hint && <span className="muted" id={`${id}-hint`}>{hint}</span>}
    {error && <span className="field-error" id={`${id}-error`}>{error}</span>}
  </div>;
}
export function Hidden({ name, value }: { name: string; value: string | number }) { return <input type="hidden" name={name} value={value}/>; }
export function Submit({ children }: { children: ReactNode }) { return <button type="submit">{children}</button>; }
export function Form({ action, secondary, multipart, children }: { action: string; secondary?: boolean; multipart?: boolean; children: ReactNode }) {
  return <form method="post" action={action} className={secondary ? 'secondary' : undefined}
    encType={multipart ? 'multipart/form-data' : undefined}>{children}</form>;
}

export function valueOf(form: FormData | undefined, key: string, fallback = '') {
  const value = form?.get(key);
  return typeof value === 'string' ? value : fallback;
}

export function Confirmation({ id, title, toggle, action, submit, detail, children, danger = true }: {
  id: string; title: string; toggle: string; action: string; submit: string; detail: ReactNode; children: ReactNode; danger?: boolean;
}) {
  return <><div className="secondary"><button type="button" data-open-dialog={id}>{toggle}</button></div>
    <dialog id={id} aria-labelledby={`${id}-title`}><h3 id={`${id}-title`}>{title}</h3>{detail}
      <Form action={action}>{children}<div className="dialog-actions">
        <button className="quiet" type="submit" formMethod="dialog" autoFocus>Abbrechen</button>
        <button className={danger ? 'danger' : undefined} type="submit">{submit}</button>
      </div></Form>
    </dialog></>;
}

export function ShiftFacts({ shift, timezone }: { shift: Shift; timezone: string }) {
  return <><p className="muted">{shift.location} · {date(shift.starts, timezone)} bis {date(shift.ends, timezone)}</p>
    {!shift.cancelled_at && <p className="facts"><strong>{money(shift.cents)}</strong> pro Schicht · {shift.filled} von {shift.slots} Plätzen besetzt</p>}</>;
}

export function Qualifications({ entries, admin = false }: { entries: Qualification[]; admin?: boolean }) {
  if (!entries.length) return <Empty>Noch keine Qualifikationen eingetragen.</Empty>;
  return <ul className="items">{entries.map(q => <li key={q.id}><strong>{q.name}</strong>
    <span className="muted">{q.verified ? 'Geprüft' : 'Prüfung offen'}{q.valid_until ? ' · Gültig bis ' + q.valid_until : ''}</span>
    {q.has_evidence && <a href={`/nachweis/${q.id}`}>PDF herunterladen</a>}
    {admin && <QualificationReview qualification={q}/>}</li>)}</ul>;
}

function QualificationReview({ qualification }: { qualification: Qualification }) {
  const fields = <><Hidden name="qualification" value={qualification.id}/><Hidden name="revision" value={qualification.revision}/></>;
  return qualification.verified ? <Confirmation id={`revoke-${qualification.id}`} toggle="Prüfung zurücknehmen" title="Prüfung zurücknehmen?"
    detail={<p>„{qualification.name}“ gilt danach als ungeprüft. Neue Bewerbungen oder Einteilungen können dadurch gesperrt sein. Bestehende Zusagen bleiben erhalten.</p>}
    action="/dispo/nachweis-zuruecknehmen" submit="Rücknahme bestätigen">{fields}</Confirmation>
    : <Form action="/dispo/nachweis">{fields}<Submit>Als geprüft markieren</Submit></Form>;
}

export function Requests({ entries }: { entries: QualificationRequest[] }) {
  return entries.length ? <ul className="items">{entries.map(request => <li key={request.name}><strong>{request.name}</strong>
    <Status state={request.state}/><p className="preserve">{request.note}</p></li>)}</ul> : null;
}

export function page({ user, registrationOpen = true, title, children }: {
  user?: Person; registrationOpen?: boolean; title: string; children: ReactNode;
}) {
  const document = <html lang="de"><head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>{`${title} · Crew`}</title><link rel="stylesheet" href="/crew.css"/><meta name="theme-color" content="#30231d"/>
    <link rel="manifest" href="/manifest.webmanifest"/><link rel="icon" type="image/svg+xml" href="/icon.svg"/>
    <link rel="apple-touch-icon" href="/icon-180.png"/><script src="/pwa.js" type="module"/>
    <script src="/dialogs.js" type="module"/></head><body>
    <a href="#inhalt" className="skip">Zum Inhalt</a><div className="workspace">
      <Sidebar user={user} registrationOpen={registrationOpen}/>
      <main id="inhalt" tabIndex={-1}>{children}</main>
    </div></body></html>;
  return '<!doctype html>' + renderToStaticMarkup(document);
}
