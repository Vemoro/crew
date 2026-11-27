---
name: crew-layout
description: Leitet Crew-Navigation, Seitenaufbau, Typografie und UI-Abnahme an und prüft gemeinsame Muster aus Desk und Haben.
---

# Crew-Layout

Lies die [Crew-Gestaltung](../../../DESIGN.md) und vergleiche die Aufgabe mit verwandten Ansichten. Verwende die gemeinsamen [Ansichten und Felder](../../../src/views/ui.tsx) und das [Stylesheet](../../../public/crew.css). Prüfe bei fehlenden Vorgaben den [Abgleich mit Desk und Haben](../../../docs/entwicklung.md#auftrag-und-arbeitsstand).

## Umsetzung

- Beginne mit dem aktuellen Arbeitsstand für die Rolle. Halte Hauptaktionen, Detailkontext und seltene Nebenaktionen an vergleichbaren Stellen. Auf kleinen Ansichten folgt der Kontext im Lesefluss. Verwende vorhandene Muster für Karten, Zustände, Formulare und Dialoge.
- Prüfe die Navigation im offenen Handymenü. Escape bringt den Fokus zum Auslöser zurück. Ein interner Sprung schließt das Menü und führt den Fokus zum Hauptinhalt. Prüfe aktive Ansicht, Rollen, verständliche Namen und Touchziele.
- Prüfe bei neuen Feldern Namen, getrennte Hinweise und Fehlermeldungen. Verwende `bun run check:fields` und die einschlägige [Browserprüfung](../../../docs/entwicklung.md#prüfungen-und-dokumentation).

## Abnahme

1. Sichere Ausgangs- und Vergleichsansicht nach [crew-pr-screenshots](../crew-pr-screenshots/SKILL.md).
2. Prüfe Tastatur, Fokus und Fehlerkorrektur in den betroffenen Zuständen. Vergleiche Hell und Dunkel auf Desktop und Smartphone. Bei Navigationsänderungen gehört das offene Menü dazu.
3. Begründe bewusst vereinbarte Abweichungen im PR. Aktualisiere bei einer dauerhaften Änderung die maßgebliche Gestaltungsregel im selben PR.
