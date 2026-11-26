# Crew

Crew ist eine selbst gehostete Personalverwaltung für wechselnde Einsätze. Das Projekt verbindet Bewerbung, Personalpool, Schichtbesetzung und Personalportal. Crew ergänzt bei Bedarf Desk und Haben.

Das Projekt wird für die öffentliche Auslieferung ab Version 0.1.0.0 vorbereitet und steht unter AGPL-3.0-only.

## Kernablauf

1. Personal bewirbt sich, gibt Verfügbarkeiten an und reicht Qualifikationen ein. Die Dispo prüft Bewerbung und Nachweise getrennt.
2. Die Dispo legt Einsätze mit einer oder mehreren Schichten an. Ein Entwurf wird für den Pool veröffentlicht oder per Einladung angeboten.
3. Personal meldet Interesse und beantwortet Pflichtfragen. Die Dispo sieht Rückmeldungen und besetzt freie Plätze verbindlich.
4. Das Portal zeigt bestätigte Schichten, offene Nachweise und erwartete Vergütung. Absagen machen Plätze für die Nachbesetzung frei.

Die Dispo kann Ort und Hinweise für zukünftige Schichten korrigieren, einzelne bestätigte Plätze wieder freigeben oder eine bevorstehende Schicht vollständig zurücknehmen. Vor einer Korrektur zeigt das Formular die betroffenen Schichten. Bereits begonnene, vergangene und zurückgenommene Schichten behalten ihre bisherigen Angaben. Änderungen an Zeit, Vergütung und Voraussetzungen benötigen eine neue Schicht.

Der erste Stand unterstützt pauschale Schichtvergütung und externe Einsatzreferenzen. Schnittstellen zu Desk und Haben, Ist-Zeiten, Abrechnungsbelege und Urlaub sind spätere Ausbaustufen.

## Schnellstart

Mit Node.js 24 ab 24.14 oder Docker Compose. Die Startanleitung beschreibt beide Wege und die Anlage des Dispo-Kontos. [Installation](docs/installation.md)

[Roadmap](docs/roadmap.md) · [Mitwirken](CONTRIBUTING.md) · [Entwicklung](docs/entwicklung.md) · [Sicherheitsmeldungen](SECURITY.md) · [Lizenz](LICENSE)
