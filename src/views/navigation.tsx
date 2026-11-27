import type { Person } from '../server/auth';
import { crewVersion } from '../../package.json';

type Destination = readonly [href: string, label: string];
type Group = { title: string; entries: readonly Destination[] };

function groups(user: Person | undefined, registrationOpen: boolean): Group[] {
  if (user?.role === 'admin') return [
    { title: 'Personalpool', entries: [['/dispo#personal', 'Personal']] },
    { title: 'Einsatzplanung', entries: [['/dispo#einsaetze', 'Einsätze']] },
  ];
  if (user?.status === 'active') return [
    { title: 'Einsatzplanung', entries: [['/#schichten', 'Schichten'], ['/#bewerbungen', 'Bewerbungen']] },
    { title: 'Personalportal', entries: [['/#aufgaben', 'Aufgaben']] },
  ];
  if (user) return [{ title: 'Personalpool', entries: [['/#bewerbungen', 'Bewerbung']] }];
  return [{ title: 'Zugang', entries: registrationOpen
    ? [['/anmelden', 'Anmelden'], ['/registrieren', 'Registrieren']] : [['/anmelden', 'Anmelden']] }];
}

function SidebarPanel({ user, registrationOpen, compact }: { user?: Person; registrationOpen: boolean; compact?: boolean }) {
  return <nav className={`sidebar-panel ${compact ? 'mobile-nav-panel' : 'desktop-nav'}`} aria-label="Hauptnavigation">
    <div className="sidebar-work">
      {user && <a data-overview href={user.role === 'admin' ? '/dispo' : '/'}>Übersicht</a>}
      {groups(user, registrationOpen).map(({ title, entries }) => <div className="sidebar-group" key={title} role="group" aria-label={title}>
        <span aria-hidden="true">{title}</span>
        {entries.map(([href, label]) => <a href={href} key={href}>{label}</a>)}
      </div>)}
    </div>
    <div className="sidebar-footer" role="group" aria-label="Konto und Hilfe">
      {user && <><div className="sidebar-account"><strong>{user.name}</strong>
        <small>{user.role === 'admin' ? 'Disposition' : 'Personal'}</small></div>
        {user.role === 'staff' && <a href="/#profil">Profil</a>}</>}
      <a href="https://github.com/Vemoro/crew/blob/main/docs/installation.md#crew-als-app-installieren">Dokumentation</a>
      <a href="https://github.com/Vemoro/crew">Crew-Projekt auf GitHub</a>
      {user && <form method="post" action="/abmelden" className="sign-out"><button type="submit">Abmelden</button></form>}
      <small className="sidebar-version">Crew {crewVersion}</small>
    </div>
  </nav>;
}

export function Sidebar({ user, registrationOpen }: { user?: Person; registrationOpen: boolean }) {
  const home = user?.role === 'admin' ? '/dispo' : '/';
  return <aside className="sidebar">
    <a className="brand" href={home}><img src="/icon.svg" alt="" width="28" height="28"/>Crew<span aria-hidden="true">.</span></a>
    <SidebarPanel user={user} registrationOpen={registrationOpen}/>
    <details className="mobile-nav"><summary>Menü</summary>
      <SidebarPanel user={user} registrationOpen={registrationOpen} compact/>
    </details>
  </aside>;
}
