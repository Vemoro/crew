<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/marke/crew-logo-dunkel.svg">
  <img src="docs/marke/crew-logo-hell.svg" alt="Crew" width="206">
</picture>

# Schichten aus dem Personalpool besetzen

**Crew ist die selbst gehostete Personalplanung für Teams mit wechselnden Einsätzen.** Die Dispo nimmt Personal in den Pool auf, prüft Qualifikationen und besetzt Schichten. Poolmitglieder sehen ihre Angebote, Zusagen und erwartete Vergütung im eigenen Portal. Crew lässt sich aus einem unterstützten Browser als App installieren.

[Lizenz AGPL-3.0-only](LICENSE) · [Installation und Betrieb](docs/installation.md) · [Roadmap](docs/roadmap.md)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/ansichten/personalportal-dunkel.png">
  <img src="docs/ansichten/personalportal-hell.png" alt="Crew-Personalportal mit bestätigter Aufbauschicht, erwartetem Betrag von 80 Euro und Einladung zum Abbau eines Mustereinsatzes" width="960">
</picture>

[Einsatzablauf](#so-läuft-ein-einsatz) · [Funktionen](#funktionen) · [Schnellstart](#schnellstart) · [FAQ](#häufige-fragen)

## So läuft ein Einsatz

Beim fiktiven **Stadtfest West** organisiert die Dispo den Aufbau am Nachmittag und den Abbau am Abend. Die Aufbauschicht wird dem aktiven Pool angeboten. Für den Abbau werden ausgewählte Poolmitglieder eingeladen. Mira bestätigt ihr Interesse, beantwortet die Frage zum Treffpunkt und sieht nach ihrer Einteilung die Aufbauschicht mit 80 € erwarteter Vergütung im Portal.

1. **Personal aufnehmen.** Bewerbungen erfassen Angaben zur Verfügbarkeit und zu Qualifikationen. Die Dispo entscheidet über die Aufnahme und prüft eingereichte Nachweise getrennt.
2. **Schichten ausschreiben.** Die Dispo legt Zeiten, Ort, Plätze und Voraussetzungen fest. Ein Schichtentwurf wird für den Pool veröffentlicht oder für eingeladene Personen freigegeben.
3. **Verbindlich einteilen.** Interessierte beantworten bei Bedarf Pflichtfragen. Crew prüft die Anforderungen und verhindert zeitliche Überschneidungen sowie Überbuchungen.
4. **Änderungen koordinieren.** Die Dispo korrigiert Ort und Hinweise, gibt einzelne Plätze frei oder nimmt eine bevorstehende Schicht zurück. Poolmitglieder sehen im Portal, was sich an ihren Einsätzen und der erwarteten Vergütung geändert hat.

[Durchgespielter Musterfall](scripts/check-browser.mjs)

## Funktionen

| Bereich | Was du in Crew erledigst |
| --- | --- |
| **Bewerbung und Pool** | Grunddaten und typische Verfügbarkeit erfassen. Bewerbungen prüfen, Personen aufnehmen und Kontozugänge bei Bedarf sperren oder wieder freigeben. |
| **Nachweise und Aufgaben** | Qualifikationen und PDF-Nachweise einreichen, prüfen, erneut anfordern und Prüfungen zurücknehmen. |
| **Disposition** | Einsätze mit mehreren Schichten planen, schichtbezogene Fragen festlegen, Plätze verbindlich besetzen und Änderungen bearbeiten. |
| **Personalportal** | Offene und eingeladene Schichten sehen, Interesse melden, Zusagen einsehen, Nachweise einreichen und eigene Einteilungen absagen. |
| **Vergütung** | Pauschalen je Schicht hinterlegen und die Summe der erwarteten Vergütung aus bestätigten Schichten anzeigen. |
| **Betrieb** | Crew mit Docker Compose oder Node.js betreiben, SQLite-Bestände sichern und wiederherstellen sowie einzelne Poolprofile exportieren und bereinigen. |

Crew läuft eigenständig und kann externe Einsatzreferenzen aufnehmen. Schnittstellen zu Desk und Haben, Ist-Zeiten, Abrechnungsbelege, Urlaub und Benachrichtigungen sind spätere Ausbaustufen. [Roadmap](docs/roadmap.md)

## Schnellstart

Starte im ausgepackten Quellstand oder Checkout. Das Beispiel nutzt Bash und Docker Compose. Wähle ein eigenes Passwort mit mindestens zwölf Zeichen. Für einen lokalen Test genügen synthetische Personen und Schichten.

```sh
docker compose build
read -r -s -p 'Passwort für die Dispo eingeben: ' CREW_ADMIN_PASSWORD
printf '\n'
export CREW_ADMIN_PASSWORD
docker compose run --rm -e CREW_ADMIN_PASSWORD crew node admin.js dispo@example.test "Crew Dispo"
unset CREW_ADMIN_PASSWORD
docker compose up -d
```

Öffne `http://localhost:8080` und melde dich als Dispo an. Registriere in einem zweiten Browserprofil eine synthetische Person, nimm sie in den Pool auf und besetze mit ihr die erste Schicht. [Nativer Start, HTTPS und App-Installation](docs/installation.md) · [Sicherung](docs/sicherung.md) · [Personendaten](docs/personendaten.md)

## Häufige Fragen

**Eignet sich Crew für unterschiedliche Veranstaltungen und Einsatzorte?**

Ja. Du legst pro Einsatz Ort und Hinweise sowie mehrere Schichten über den jeweiligen Planungszeitraum an. Je Schicht bestimmst du Sichtbarkeit, Platzanzahl und erforderliche Qualifikationen.

**Kann ich Crew vom Startbildschirm öffnen?**

Ja. Unterstützte Browser installieren Crew als Web-App. Das Personalportal und die Dispo arbeiten bei bestehender Verbindung zur eigenen Crew-Instanz. [Crew als App installieren](docs/installation.md#crew-als-app-installieren)

**Was bedeutet der Vergütungsbetrag im Personalportal?**

Er ist die Summe der hinterlegten Pauschalen für die dort bestätigten bevorstehenden Schichten. Mit einer Absage oder Platzfreigabe ändert sich die Erwartung. Abrechnung und Lohnlauf erfolgen außerhalb von Crew.

## Mitwirken

Crew steht unter der AGPL-3.0-only. Fehlerberichte, Vorschläge und Beiträge sind willkommen. [Mitwirken](CONTRIBUTING.md) · [Entwicklungsregeln](docs/entwicklung.md) · [Sicherheitsmeldungen](SECURITY.md) · [Versionshinweise](CHANGELOG.md) · [Lizenz](LICENSE)
