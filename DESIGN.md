# Crew-Gestaltung

## Farbe und Orientierung

Crew verwendet Orange für Markenakzent, Fokus, Links und Primäraktionen. Neutrale Arbeitsflächen und eine dunkle Kopfzeile geben den Inhalten Vorrang. Im dunklen Modus liegen die Flächen in neutralen Grautönen und der orange Akzent trägt dunkle Schrift. Fachzustände werden mit Text benannt und lassen sich ohne Farbe unterscheiden.

Das Crew-Signet verbindet ein C mit einem quadratischen Akzent. Die Kopfleiste verwendet es zusammen mit dem sichtbaren Namen. Die App nutzt das Vektor-Signet und die daraus gerenderten Rastergrößen. Die helle und dunkle Wort-Bild-Marke sind für Projektdokumentation und Website vorgesehen. [Vektor-Signet](public/icon.svg) · [Logo hell](docs/marke/crew-logo-hell.svg) · [Logo dunkel](docs/marke/crew-logo-dunkel.svg)

Installiere zum Erzeugen der Rasterdateien mit `npm ci` und `npx playwright install chromium` die Entwicklungswerkzeuge. Führe nach einer Änderung `node scripts/render-brand-icons.mjs` aus und prüfe die maskierbare Variante im Manifest.

Crew orientiert sich an Habens Gestaltungsregeln. Definiere Farben zentral für Hell und Dunkel. Verwende neutrale Flächen, feine Trennlinien und sparsame Akzente. Abstände folgen einem 4-Pixel-Raster. `npm run lint` prüft feste Pixelwerte in `padding`, `margin` und `gap` einschließlich ihrer Varianten. Beschriftungen stehen in Satzschreibung. Beträge und Kennzahlen verwenden gleich breite Ziffern. [Gestaltung von Haben](https://github.com/Speicherstadt/haben/blob/34fff56798bdcb4b5b7f728cf38888b161f65094/DESIGN.md)

Verwende eine konsistente Icon-Komponente mit verständlichen Beschriftungen. Ein allein stehendes Symbol braucht einen zugänglichen Namen. Am Smartphone öffnet ein beschrifteter Menüknopf die Hauptnavigation. Der aktuelle Bereich bleibt erkennbar.

## Aktionen und Formulare

Je Formular oder Aktionsgruppe gibt es eine hervorgehobene Hauptaktion. Bei einer gemeinsamen Knopfzeile steht sie am Ende. Nebenaktionen sind neutral. Eine Aktion mit bleibenden Folgen öffnet eine benannte Rückfrage zum betroffenen Objekt. Die Rückfrage enthält die konkrete Folge, einen eindeutigen Bestätigungsknopf und „Abbrechen“. Der Fokus beginnt aus Sicherheitsgründen bei „Abbrechen“. Escape schließt die Rückfrage ohne Änderung.

Baue Felder und Auswahllisten mit der gemeinsamen Feldstruktur. Jedes Feld hat ein zugängliches Label. Hinweise und Fehler gehören an das betroffene Feld oder den betroffenen Abschnitt und bleiben bei der Korrektur sichtbar. Erhalte die Eingaben, soweit der Vorgang das zulässt. Eine Hauptaktion bleibt bei lückenhaften Eingaben erreichbar, damit die Validierung erklärt, was fehlt.

Anordnung und Tab-Reihenfolge stimmen überein. Fokusmarkierungen, Texte und Bedienelemente brauchen ausreichenden Kontrast in beiden Themes. Normale Knöpfe und Formularfelder sind auf Touchgeräten mindestens 44 Pixel hoch.

## Aufbau von Arbeitsbereichen

- Zeige beim Öffnen zuerst den aktuellen Arbeitsstand. In detailreichen Ansichten bekommen Inhalte wie ein Nachrichtenverlauf die breite Spalte. Zugehörige Daten und seltene Aktionen stehen daneben. Auf kleinen Bildschirmen folgt der Kontext im Lesefluss.
- Setze im leeren Zustand die nächste sinnvolle Aktion an den Ort, an dem ihr Ergebnis erscheint. Zeige bestehende Werte zum Lesen. Selten geöffnete Bearbeitungsformulare, etwa eine Einladung, öffnen sich auf eine beschriftete Aktion im Dialog.
- Formular-Dialoge haben einen benannten Titel, fokussieren das erste relevante Feld und halten die Tastaturbedienung im Dialog. Escape schließt einen bearbeitbaren Dialog. Nach dem Schließen geht der Fokus an den Auslöser zurück, soweit dieser sichtbar bleibt. Fehler im Dialog erhalten die Eingabe.
- Bei Anbindungen richtet sich die Ansicht nach der Arbeit in Crew. Am Einsatz liegt der Schwerpunkt auf Schichten und Besetzung. Die Quelle bleibt an der externen Referenz und, soweit verfügbar, über einen Link zum Ursprung erkennbar.
- Karten gruppieren zusammengehörige Inhalte mit neutraler Oberfläche, Rand und feinem Schatten. Hat ein Dialog die Kartenhülle bereits selbst, braucht sein Formular keinen weiteren Rahmen. Leere Listen nennen knapp, was dort erscheint und welche Aktion zum ersten Eintrag führt.
- Fachzustände verwenden die gemeinsame Statusdarstellung mit kurzem Text und optionalem farbigem Punkt. Bei Entwürfen kann der Punkt als Ring erscheinen. Ein kurzer Zusatz erklärt bei Bedarf den nächsten Schritt oder ein relevantes Datum. Merkmale wie eine Rolle oder ein Tag erhalten eine eigene neutrale Darstellung.

## Oberfläche prüfen

Prüfe die Änderung mit Tastatur sowie auf der betroffenen Bildschirmgröße. Neue Ansichten erhalten einen Browserfall, der Erreichbarkeit und wesentliche Bedienung abdeckt. Prüfe zugängliche Namen, Reihenfolge und Dialogfokus nach WCAG 2.2 AA, Hell und Dunkel sowie bei mobiler Bedienung auf dem Smartphone. Warte im Browser auf den beobachteten Zustand. Bei Änderungen am Aussehen gehören reproduzierbare Vergleichsbilder ins Review. Der [Screenshot-Ablauf](.agents/skills/crew-pr-screenshots/SKILL.md) beschreibt die Aufnahme.
