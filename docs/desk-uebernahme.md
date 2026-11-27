# Übernahme der Arbeitsweise aus Desk

Die Grundlage stammt aus [Vemoro/desk, Commit 00d01308](https://github.com/Vemoro/desk/tree/00d01308b16c4d7d975f7c2224b1e213a6697d5e) unter AGPL-3.0-only. Desk dokumentiert seinerseits die [Herkunft der aus Haben übernommenen Arbeitsweise](https://github.com/Vemoro/desk/blob/00d01308b16c4d7d975f7c2224b1e213a6697d5e/docs/haben-uebernahme.md).

- Crew übernimmt Agenten-Einstieg, alle zehn Skills, Mitwirkungs- und Sicherheitsregeln, Issue- und PR-Vorlagen, Review-Nachweise und den Doku-Check.
- Die fachlichen Beispiele, Produktgrenzen, Betriebsanweisungen, Projektverweise und technischen Prüfbefehle richten sich nach Crew. Die Anforderungen an unabhängige Prüfungen und die Freigabe durch Maintainer gelten weiter.
- Desk-spezifische Anbindungsanleitungen, Bestandsbewertungen, Abnahmeprotokolle und Screenshots bleiben im Desk-Repository dokumentiert. Crew führt eine eigene [Release-Abnahme](release-abnahme.md). Die Board-Automatik braucht ein eigenes Crew-Board.

## Abgleich mit der aktuellen Arbeitsgrundlage

Der zweite Abgleich verwendet [Desk `3e94e59`](https://github.com/Vemoro/desk/tree/3e94e593ce2dea9962506700757d2685bec0593a) und [Haben `e3ece9c`](https://github.com/Speicherstadt/haben/tree/e3ece9cbc19c4b649d35693fd13e27bbf49a1f3a). Die Crew-Regeln beziehen beide Quellen ein und verwenden Crew-Beispiele.

| Quelle | Übernahme in Crew |
| --- | --- |
| Desk-Layout und Arbeitsansichten | [Crew-Gestaltung](../DESIGN.md) und [Layout-Skill](../.agents/skills/crew-layout/SKILL.md) regeln Navigation, Felder, Zustände, Seitenköpfe, Dialoge, Touch, Fokus sowie künftig benötigte Komponenten. |
| Gemeinsame Felder und Barrierefreiheit | Crew verwendet das eigene React-`Field` mit zugeordnetem Label und die aus Desk angepasste Feldprüfung. Axe prüft ausgewählte Crew-Zustände in Chromium. WebKit ergänzt die Bedienprüfung. |
| Regeln und Größenprüfungen | [Entwicklung](entwicklung.md) verankert den Abgleich mit Desk und Haben. Die Tokenzählung kommt aus Desk. Crews bestehende breitere Datei- und Rastersicht bleibt Teil derselben Prüfung. |
| Screenshot-Ablauf | [Vergleichsbilder](../.agents/skills/crew-pr-screenshots/SKILL.md) folgen dem reproduzierbaren Vergleich zweier Git-Stände. Crew nutzt seine eigenen synthetischen Rollen und Browserzustände. |
| Freigabe | [Release-Abnahme](release-abnahme.md) prüft Größe, Felder, Gestaltung, Bedienung, Rechte, Import und Wiederanlauf am Crew-Kandidaten. |

Die Crew-Marke bleibt orange. Crews Seitenleiste übernimmt Desks Aufbau mit Übersicht, fachlichen Gruppen und einem gemeinsamen Fußbereich. Die konkreten Gruppen folgen Personalpool, Einsatzplanung und Personalportal. Habens Firmen-, Bank-, Steuer- und Belegmuster setzen andere Fachbereiche voraus. Die Dateiauswahl übernimmt den deutsch beschrifteten Knopf und zeigt den gewählten Namen am Feld. Der native Dateidialog bleibt erhalten. [Desk-Navigation](https://github.com/Vemoro/desk/blob/3e94e593ce2dea9962506700757d2685bec0593a/src/ui/navigation.tsx) · [Haben-Navigation](https://github.com/Speicherstadt/haben/blob/e3ece9cbc19c4b649d35693fd13e27bbf49a1f3a/apps/web/src/components/NavMenu.tsx)

Desk verwendet eine befristete Größen-Ausnahmeliste für Altbestand. Crew hält die Grenzen direkt ein. Desks Releaseversionen, Projektlisten-Screenshotbefehl und projektspezifische GitHub-Automatik bleiben an ihren jeweiligen Projektaufbau, Demodaten und Berechtigungen gebunden.
