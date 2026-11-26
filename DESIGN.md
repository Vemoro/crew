# Crew-Gestaltung

## Farbe und Orientierung

Crew verwendet Orange für Markenakzent, Fokus, Links und Primäraktionen. Neutrale Arbeitsflächen und eine dunkle Kopfzeile geben den Inhalten Vorrang. Im dunklen Modus liegen die Flächen in neutralen Grautönen und der orange Akzent trägt dunkle Schrift. Fachzustände werden mit Text benannt und lassen sich ohne Farbe unterscheiden.

Crew orientiert sich an Habens schlichten Arbeitsflächen, dem 4-Pixel-Raster, kompakten Formularen und der Anordnung von Haupt- und Nebenaktionen. Beträge und Kennzahlen verwenden gleich breite Ziffern. [Gestaltung von Haben](https://github.com/Speicherstadt/haben/blob/main/DESIGN.md)

Verwende eine konsistente Icon-Komponente mit verständlichen Beschriftungen. Ein allein stehendes Symbol braucht einen zugänglichen Namen. Am Smartphone öffnet ein beschrifteter Menüknopf die Hauptnavigation. Der aktuelle Bereich bleibt erkennbar.

## Aktionen und Formulare

Prominente Aktionen entsprechen dem nächsten sinnvollen Schritt. Nebenaktionen bleiben erkennbar. Hat eine gefährliche Aktion bleibende Folgen, zeigt der Bestätigungsdialog die betroffenen Daten oder die konkrete Folge. Anordnung und Tab-Reihenfolge stimmen überein. Jedes Formularfeld hat ein zugängliches Label. Fokusmarkierungen, Texte und Bedienelemente brauchen ausreichenden Kontrast in beiden Themes.

Zeige Fehler, Lade- und Leerzustände am betroffenen Bereich. Formulare nennen den Grund, wenn eine Aktion nicht verfügbar ist. Daten bleiben nach Fehlern zur Korrektur verfügbar, soweit der Vorgang dies zulässt.

## Aufbau von Arbeitsbereichen

- Zeige beim Öffnen zuerst den aktuellen Arbeitsstand. In detailreichen Ansichten bekommen Inhalte wie ein Nachrichtenverlauf die breite Spalte. Zugehörige Daten und seltene Aktionen stehen daneben. Auf kleinen Bildschirmen folgt der Kontext im Lesefluss.
- Setze im leeren Zustand die nächste sinnvolle Aktion an den Ort, an dem ihr Ergebnis erscheint. Zeige bestehende Werte zum Lesen. Selten geöffnete Bearbeitungsformulare, etwa eine Einladung, öffnen sich auf eine beschriftete Aktion im Dialog.
- Formular-Dialoge haben einen benannten Titel, fokussieren das erste relevante Feld und halten die Tastaturbedienung im Dialog. Escape schließt einen bearbeitbaren Dialog. Nach dem Schließen geht der Fokus an den Auslöser zurück, soweit dieser sichtbar bleibt. Fehler im Dialog erhalten die Eingabe.
- Bei Anbindungen richtet sich die Ansicht nach der Arbeit in Crew. Am Einsatz liegt der Schwerpunkt auf Schichten und Besetzung. Die Quelle bleibt an der externen Referenz und, soweit verfügbar, über einen Link zum Ursprung erkennbar.

## Oberfläche prüfen

Prüfe die Änderung mit Tastatur sowie auf der betroffenen Bildschirmgröße. Bei Änderungen am Aussehen gehören reproduzierbare Vergleichsbilder ins Review. Der [Screenshot-Ablauf](.agents/skills/crew-pr-screenshots/SKILL.md) beschreibt die Aufnahme.
