# Crew-Gestaltung

## Farbe und Orientierung

Crew verwendet Orange für Markenakzent, Fokus, Links und Primäraktionen. Neutrale Arbeitsflächen und eine dunkle Kopfzeile geben den Inhalten Vorrang. Im dunklen Modus liegen die Flächen in neutralen Grautönen und der orange Akzent trägt dunkle Schrift. Fachzustände werden mit Text benannt und lassen sich ohne Farbe unterscheiden.

Das Crew-Signet verbindet ein C mit einem quadratischen Akzent. Die Kopfleiste verwendet es zusammen mit dem sichtbaren Namen. Die App nutzt das Vektor-Signet und die daraus gerenderten Rastergrößen. Die helle und dunkle Wort-Bild-Marke sind für Projektdokumentation und Website vorgesehen. [Vektor-Signet](public/icon.svg) · [Logo hell](docs/marke/crew-logo-hell.svg) · [Logo dunkel](docs/marke/crew-logo-dunkel.svg)

Installiere zum Erzeugen der Rasterdateien mit `bun install --frozen-lockfile` und `bunx playwright install chromium` die Entwicklungswerkzeuge. Führe nach einer Änderung `bun scripts/render-brand-icons.ts` aus und prüfe die maskierbare Variante im Manifest.

Crew orientiert sich an Habens Gestaltungsregeln. Definiere Farben zentral für Hell und Dunkel. Verwende neutrale Flächen, feine Trennlinien und sparsame Akzente. Abstände folgen einem 4-Pixel-Raster. `bun run lint` prüft feste Pixelwerte in `padding`, `margin` und `gap` einschließlich ihrer Varianten. Beschriftungen stehen in Satzschreibung. Beträge und Kennzahlen verwenden gleich breite Ziffern. [Gestaltung von Haben](https://github.com/Speicherstadt/haben/blob/e3ece9cbc19c4b649d35693fd13e27bbf49a1f3a/DESIGN.md)

Verwende eine konsistente Icon-Komponente mit verständlichen Beschriftungen. Ein allein stehendes Symbol braucht einen zugänglichen Namen. Am Smartphone öffnet ein beschrifteter Menüknopf die Hauptnavigation. Der aktuelle Bereich bleibt erkennbar.

### Navigation

Crew verwendet am Desktop eine durchgehende Seitenleiste. Sie beginnt mit der Übersicht der jeweiligen Rolle. In der Dispo folgen **Personalpool** mit Personal und **Einsatzplanung** mit Einsätzen. Für aktive Poolmitglieder enthält **Einsatzplanung** die Schichten und Bewerbungen. **Personalportal** führt zu Aufgaben. Bewerbende sehen ihren Bewerbungsstand unter **Personalpool**. Anmeldeseiten fassen die verfügbaren Wege unter **Zugang** zusammen.

Der Fußbereich bündelt Konto, Profil für Personal, Dokumentation, GitHub, Abmelden und Version. Ergänze Erscheinungsbild oder Dispo-Einstellungen dort, sobald es dafür eine Crew-Funktion gibt. Der bestehende GitHub-Link führt zum Crew-Repository. Falls Crew später eine Quellcodeadresse des ausgelieferten Stands anbietet, führt ein entsprechend beschrifteter Link dorthin. Auf dem Smartphone stehen dieselben Gruppen im aufklappbaren Menü unter der Marke.

Verwende für Fachlinks 14 Pixel, für Nebenaktionen 13 Pixel und für Gruppenüberschriften oder Versionsangaben 12 Pixel. In kurzen Fenstern bleibt die Navigation scrollbar. Mobile Menüziele sind mindestens 44 × 44 Pixel groß. Escape schließt das Menü und gibt den Fokus an den Auslöser zurück. Bei einer Navigation bleibt das Ziel erreichbar. Ein lokaler Sprung schließt das Menü und fokussiert den angesprungenen Abschnitt. Beim Wechsel zur Desktopansicht geht der Menüfokus zum entsprechenden sichtbaren Link.

## Raster und Schrift

[`public/crew.css`](public/crew.css) ist die zentrale Quelle für Farbrollen, Schrift und Bedienelemente. Verwende Schriftstufen von 12, 13, 14, 16, 18, 24 oder 28 Pixel. Beschriftungen und Tabellenköpfe stehen in Satzschreibung. Beträge verwenden gleich breite Ziffern und stehen in Tabellen rechtsbündig. Kennungen und Code dürfen eine Festbreitenschrift verwenden. Knöpfe, Eingaben und Auswahllisten verwenden die gemeinsame Mindesthöhe. Der Fokusring steht an Knöpfen außen und an Eingabefeldern innen. Bewegungen berücksichtigen die Systemeinstellung für reduzierte Bewegung.

## Aktionen und Formulare

Je Formular oder Aktionsgruppe gibt es eine hervorgehobene Hauptaktion. Bei einer gemeinsamen Knopfzeile steht sie am Ende. Nebenaktionen sind neutral. Eine Aktion mit bleibenden Folgen öffnet eine benannte Rückfrage zum betroffenen Objekt. Die Rückfrage enthält die konkrete Folge, einen eindeutigen Bestätigungsknopf und „Abbrechen“. Der Fokus beginnt aus Sicherheitsgründen bei „Abbrechen“. Escape schließt die Rückfrage ohne Änderung.

Baue Felder und Auswahllisten mit der gemeinsamen Feldstruktur. Jedes Feld hat ein zugängliches Label. Hinweise und Fehler gehören an das betroffene Feld oder den betroffenen Abschnitt und bleiben bei der Korrektur sichtbar. Erhalte die Eingaben, soweit der Vorgang das zulässt. Eine Hauptaktion bleibt bei lückenhaften Eingaben erreichbar, damit die Validierung erklärt, was fehlt.

Anordnung und Tab-Reihenfolge stimmen überein. Fokusmarkierungen, Texte und Bedienelemente brauchen ausreichenden Kontrast in beiden Themes. Normale Knöpfe und Formularfelder sind auf Touchgeräten mindestens 44 Pixel hoch.

### Voraussetzungen, Felder und Auswahl

- Verwende `Field` für sichtbare Eingaben, Auswahllisten und mehrzeilige Felder. Der Name gehört in ein eigenes zugeordnetes Label. Hinweise und Fehler stehen daneben und werden über `aria-describedby` zugeordnet. Setze `aria-invalid`, wenn ein Fehler einem Feld zugeordnet ist. Bei zusammengehörigen Kästchen oder Optionen benennt eine Legende die Gruppe. Versteckte IDs und Revisionen kommen ohne sichtbare Felder aus.
- Eingabefehler halten die Hauptaktion erreichbar. Die Prüfung beim Absenden zeigt den Fehler beim Feld und führt zum ersten korrigierbaren Feld. Öffne dabei einen eingeklappten Bereich bei Bedarf. Erhalte korrigierbare Eingaben. Ein fachlicher Sperrgrund steht bei der Aktion, ist mit ihr über `aria-describedby` verknüpft und verweist auf einen für die Rolle erreichbaren Lösungsweg. Laufende Vorgänge benennen ihre Phase, Ladefehler bieten bei wiederholbaren Vorgängen einen erneuten Versuch an.
- Kleine feste Listen verwenden native Auswahlelemente. Wachsende Listen wie Poolmitglieder verwenden bei Bedarf eine durchsuchbare Auswahl mit unterscheidbaren Treffern. Tastatur, Touch, leere Treffer und Abbruch gehören zur Abnahme. Bietet eine Aufgabe mehrere Wege, benennt der Menüknopf die Aufgabe. Entscheidungen mit verschiedenen Folgen können in einem Dialog erklärt werden. Vorübergehend gesperrte Optionen zeigen ihren Grund am jeweiligen Eintrag und verknüpfen ihn mit `aria-describedby`.
- Dateiauswahl öffnet den nativen Dateidialog über „Datei wählen“ und zeigt den gewählten Namen vor dem Absenden. Ohne JavaScript bleibt das native Feld bedienbar. Ein eigenständiger Sofort-Upload ist eine benannte Aktion mit Rückmeldung über Fortschritt oder Ergebnis.

## Aufbau von Arbeitsbereichen

- Zeige beim Öffnen zuerst den aktuellen Arbeitsstand. In detailreichen Ansichten bekommen Inhalte wie ein Nachrichtenverlauf die breite Spalte. Zugehörige Daten und seltene Aktionen stehen daneben. Auf kleinen Bildschirmen folgt der Kontext im Lesefluss.
- Setze im leeren Zustand die nächste sinnvolle Aktion an den Ort, an dem ihr Ergebnis erscheint. Zeige bestehende Werte zum Lesen. Selten geöffnete Bearbeitungsformulare, etwa eine Einladung, öffnen sich auf eine beschriftete Aktion im Dialog.
- Formular-Dialoge haben einen benannten Titel, fokussieren das erste relevante Feld und halten die Tastaturbedienung im Dialog. Escape schließt einen bearbeitbaren Dialog. Nach dem Schließen geht der Fokus an den Auslöser zurück, soweit dieser sichtbar bleibt. Fehler im Dialog erhalten die Eingabe.
- Bei Anbindungen richtet sich die Ansicht nach der Arbeit in Crew. Am Einsatz liegt der Schwerpunkt auf Schichten und Besetzung. Die Quelle bleibt an der externen Referenz und, soweit verfügbar, über einen Link zum Ursprung erkennbar.
- Karten gruppieren zusammengehörige Inhalte mit neutraler Oberfläche, Rand und feinem Schatten. Hat ein Dialog die Kartenhülle bereits selbst, braucht sein Formular keinen weiteren Rahmen. Leere Listen nennen knapp, was dort erscheint und welche Aktion zum ersten Eintrag führt.
- Fachzustände verwenden die gemeinsame Statusdarstellung mit kurzem Text und optionalem farbigem Punkt. Bei Entwürfen kann der Punkt als Ring erscheinen. Ein kurzer Zusatz erklärt bei Bedarf den nächsten Schritt oder ein relevantes Datum. Merkmale wie eine Rolle oder ein Tag erhalten eine eigene neutrale Darstellung.

### Seitenköpfe, Karte und Leerstand

Ein vergleichbarer Seitenkopf steht vor dem Arbeitsinhalt und zeigt Titel, Zustand und wichtigste Aktion. Fixierte Kopf- oder Aktionsleisten lassen den angesprungenen oder fokussierten Inhalt sichtbar. Ein echter Leerstand beschreibt, was hier entsteht. Falls die Rolle anlegen darf, führt er zur Aktion. Leere Filterergebnisse nennen den Filter und bieten das Zurücksetzen an. Gewählte Karten zeigen Auswahl und Fokus getrennt. Kennzahlen nennen Einheit oder Zeitraum, wenn die Bedeutung sonst offen ist.

### Listen und Tabellen

Häufige Aktionen stehen am Ende der Zeile nach dem Status und bleiben direkt erreichbar. Die Aktion zur Statusbehebung steht vor Symbolaktionen. Seltene Aktionen stehen bei Bedarf im gemeinsamen Menü am Zeilenende. Bei derselben Aktionsgruppe steht eine gefährliche Daueraktion vorn und die Hauptaktion am Ende. Inhaltslinks gehören zu ihrer Zelle. Symbolaktionen brauchen bei mehreren gleichartigen Zeilen einen zugänglichen Namen mit Objektbezug. Escape gibt den Fokus an den Menüauslöser zurück. Verschwindet eine Zeile, erhält ein sinnvoller Nachfolger den Fokus. Mobil bleiben Bezeichnung, Wert und Aktionen zugeordnet. Eingebettete Knöpfe und Menüs liegen außerhalb eines anklickbaren Zeilenlinks.

### Status und Handlungsbedarf

Wartezustände bleiben visuell ruhig. Kennzeichne akuten Handlungsbedarf wie eine gesperrte Besetzung oder einen fehlgeschlagenen Vorgang mit verständlichem Text. Farbe und Punkt unterstützen die Bezeichnung. Rolle und Kategorie bleiben Merkmale. Ein Hinweis mit genau einer Aktion verwendet eine neutrale Aktion bei seinem Text.

### Dialoge auf kleinen Bildschirmen

Bewahre Titel und Aktionsbereich beim Scrollen gut erreichbar. Prüfe Dialoge mit kurzer Bildschirmhöhe und eingeblendeter Tastatur. Bestätigungen für bleibende Folgen nennen das Objekt und die Folge. „Abbrechen“ erhält den ersten Fokus. Eine gegebenenfalls angebotene Wischgeste hat dieselbe Wirkung wie Abbrechen. Bei einem Bestätigungsblatt am unteren Rand bleibt die sichere Bildschirmkante frei. Die sichtbare Reihenfolge und die Tab-Reihenfolge stimmen überein.

### Einstellungen, Schritte und Suche

- Wenn Einstellungen wachsen, gruppiere sie nach Aufgaben. Am Desktop können Bereichsliste und Inhalt nebeneinander stehen. Am Smartphone gehören der sichtbare Rückweg, Direktlinks, Neuladen und Browser-Zurück zur Abnahme. Beim Öffnen fokussiert der Bereichstitel, beim Rückweg der bisher gewählte Eintrag.
- Eine geführte Aufgabe mit fester Reihenfolge verwendet eine geordnete Liste und `aria-current="step"`. Ein Text kennzeichnet erledigte Schritte. Frei wechselbare Bewerbungs- und Schichtzustände bleiben als fachliche Zustände erkennbar.
- Neue Tastenkürzel stehen im zugehörigen Auslöser. Steuertasten richten sich nach der Plattform. Buchstaben und Zeichen bleiben auf deutschsprachigen Tastaturen direkt erreichbar. Eingaben und geöffnete Dialoge behalten Vorrang. Eine künftige globale Suche berücksichtigt Rollen und zeigt Treffer mit verständlichem Kontext.

## Oberfläche prüfen

Prüfe die Änderung mit Tastatur sowie auf der betroffenen Bildschirmgröße. Neue Ansichten erhalten einen Browserfall, der Erreichbarkeit und wesentliche Bedienung abdeckt. Prüfe zugängliche Namen, Reihenfolge und Dialogfokus nach WCAG 2.2 AA, Hell und Dunkel sowie bei mobiler Bedienung auf dem Smartphone. Warte im Browser auf den beobachteten Zustand. Bei Änderungen am Aussehen gehören reproduzierbare Vergleichsbilder ins Review. Der [Screenshot-Ablauf](.agents/skills/crew-pr-screenshots/SKILL.md) beschreibt die Aufnahme.

`bun run check:fields` prüft `Field` und die Weitergabe seiner Attribute. Chromium prüft ausgewählte Anmeldungs-, Personal-, Dispo-, Menü-, Dialog- und Fehlerzustände mit Axe. Der Lauf ergänzt die Sicht- und Tastaturprüfung. Prüfe bei Formularänderungen zusätzlich den Zugang zum ersten Fehler und seine Behebung. [Crew-Layout](.agents/skills/crew-layout/SKILL.md)

## Bestehende Abweichungen

Der PDF-Formatfehler im Personalprofil wird dem Dateifeld zugeordnet und setzt dort den Fokus. Bei bestehenden Einsatz- und Schichtformularen stehen serverseitige Meldungen am betroffenen Abschnitt. Migriere bei Änderungen am jeweiligen Formular eindeutig zuordenbare Eingabefehler zum Feld. Fehler zu Rollen, parallelen Änderungen oder zum ganzen Vorgang bleiben am zugehörigen Formular oder Abschnitt.
