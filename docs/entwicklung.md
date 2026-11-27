# Entwicklung an Crew

## Auftrag und Arbeitsstand

Prüfe vor einer Änderung [Produktumfang](roadmap.md), Status, Auftrag und erwartetes Ergebnis. Suche nach vorhandenen Lösungen und Abhängigkeiten. Bei einem Fehler belege am relevanten Stand, was aktuell passiert. Bei einer Integration gilt die Version der vorgesehenen Schnittstelle. Halte offene Entscheidungen des Maintainers in Issue oder PR fest.

Arbeite pro Thema auf einem eigenen Branch gegen die passende Git-Basis. Änderungen an `main` kommen über freigegebene Pull Requests. Wenn eine Vorarbeit in einem offenen PR steckt, nenne dessen Nummer, Basis und Head. Fremde Änderungen bleiben geschützt. Bestehende Routen, Daten und Exportformate sind Bestandteil der Abnahme, wenn die Änderung sie berührt.

Crew ist bis zur Freigabe von 0.1.0.0 privat. Behandle Repository, Git-Historie, Issues, PRs, Screenshots und Logs ab dem ersten Commit als zur Veröffentlichung vorgesehen. Verwende für Tests und Beispiele ausschließlich synthetische Daten. Zugangsdaten, personenbezogene Angaben und interne Infrastrukturdetails bleiben außerhalb dieser Flächen. Die Veröffentlichung folgt der [Release-Abnahme](release-abnahme.md).

## Umsetzung

Nutze vorhandene Komponenten und Abläufe, wenn ihr Verhalten passt. Halte Änderungen am Verhalten, passende Tests und die betroffene Nutzerdoku zusammen. Ein reproduzierbarer Bugfix beginnt mit einem Test, der aus dem erwarteten Grund fehlschlägt. Wähle Unit-Tests für Logik, Integrationstests für Datenbank und Schnittstellen und Browserfälle für kritische Bedienabläufe.

Behandle gespeicherte Geldbeträge in ganzen Cent. Prüfe bei Schreibvorgängen Wiederholungen, mögliche Konkurrenz und den Zustand nach einem Fehler. Ergänze beim Ändern der Datenbank eine neue Migration. Bereits angewendete Migrationen bleiben stabil. Änderungen an gespeicherten Daten brauchen eine Probe mit repräsentativem Altbestand und belegtem Wiederanlauf. Für die Oberfläche gelten die [Gestaltungsregeln](../DESIGN.md).

### Codegröße und Aufräumen

Eine Quelldatei hat einen fachlichen Schwerpunkt. Handgeschriebene JavaScript-, TypeScript- und CSS-Quelldateien bleiben bei höchstens 400 physischen Zeilen. Der Funktionsrumpf bleibt bei höchstens 80 Zeilen ohne Leerzeilen, gezählt nach Biomes Regel `noExcessiveLinesPerFunction`. Teile neue oder gewachsene Funktionen vor dem Merge entlang eines verständlichen Arbeitsschritts. Testdateien und der Browserprüflauf sind von den Codegrößenlimits ausgenommen. [Konventionen in Haben](https://github.com/Speicherstadt/haben/blob/34fff56798bdcb4b5b7f728cf38888b161f65094/docs/entwicklung.md#konventionen)

Räume überlange Funktionen, toten Code oder instabile Tests in den berührten Dateien auf, wenn das ohne größeren Umbau möglich ist. Ein Strukturumbau erhält bestehendes Verhalten. Nenne eine solche Änderung im PR. [Mitwirken bei Haben](https://github.com/Speicherstadt/haben/blob/34fff56798bdcb4b5b7f728cf38888b161f65094/docs/mitwirken.md#automatische-prüfungen-der-regeln)

`bun install --frozen-lockfile` installiert die Abhängigkeiten. `bun run lint` prüft Datei- und Funktionslänge sowie das CSS-Abstandsraster. Eine zu große Datei oder ein fester Abstand außerhalb des Rasters lässt den Check fehlschlagen. Biome meldet lange Funktionen als Hinweis. Dieselbe Prüfung läuft in CI. Crew startet ohne Ausnahmeliste für Quelldateien oder Rasterwerte.

## Issue-Review vor der Planung

Ein umsetzbares Issue erklärt das konkrete Problem, belegt den aktuellen Stand und begründet die Lösungswahl. Die Abnahme nennt beobachtbare Ergebnisse und die Randfälle, die für den betroffenen Ablauf relevant sind. Umfang und Länge richten sich nach der Aufgabe. [Issue schreiben](../.agents/skills/crew-issue-schreiben/SKILL.md)

Ein frischer Agent ohne Entstehungsverlauf prüft die aktuelle Fassung. Plane ein Issue erst mit dem Urteil **Bereit für Geplant** für diese Fassung ein. Der Workflow zur Übernahme kann eine bereits zugewiesene Aufgabe nach „Geplant“ zurückgeben. Prüfe bei der Wiederaufnahme, ob der vorhandene Nachweis noch gilt, und hole fehlende Begründung und Prüfung vor der Fortsetzung nach. Halte am veröffentlichten Issue Urteil, Basis und Befunde fest. Identifiziere die geprüfte Fassung über eine eindeutige Revision oder den Fingerabdruck der Prüfdatei. Wenn sich Ansatz, Umfang oder Abnahme wesentlich ändern, folgt eine neue unabhängige Prüfung. [Issue unabhängig prüfen](../.agents/skills/crew-issue-pruefen/SKILL.md) · [Übernahme und Rückgabe](roadmap.md#issues-übernehmen-und-freigeben)

## Pull Requests

Nutze einen abgegrenzten Titel mit Bereich und betroffenen Issues. `Umgesetzt #…` kennzeichnet die vollständige Umsetzung, `Refs #…` einen Beitrag zu einem Teilumfang. Dokumentiere Ergebnis, Zielbasis, Prüfungen, betroffene Daten und Updatehinweise. Frage bei unklarem Abnahmekriterium nach der fachlichen Entscheidung. Kennzeichne wesentliche KI-Unterstützung im PR und nutze vorhandene Co-Autor-Trailer des Werkzeugs, wenn sie korrekt zuordenbar sind.

Verwende für laufende Arbeit einen Entwurf. Vor der Freigabe zur Prüfung müssen Selbstprüfung, unabhängiges Review und erforderliche CI für den aktuellen Stand vorliegen. Passe die PR-Beschreibung an, wenn sich Umfang oder Prüfnachweis ändern.

## Änderungen prüfen

1. **Selbstprüfung.** Zur Prüfung des eigenen Beitrags gehören Passung zum Umfang, jedes Akzeptanzkriterium, fachliche Quellen, Wiederverwendung und die einfachste tragfähige Umsetzung. Der Bericht nennt Basis, Head, Prüfnachweise und offene Folgen für bestehende Daten, Schnittstellen, Rechte und Updates.
2. **Unabhängiges Review.** Ein anderer Mensch oder ein frischer Agent erhält Issue, Zielbasis, Head, Diff und bei Bedarf den relevanten unveränderten Aufrufkontext. Gib ihm bei agentischem Review weder Entstehungsverlauf noch Selbstbewertung. Code und Markdown brauchen ihre jeweilige Prüfung. Wenn beide betroffen sind, prüft sie je eine unabhängige Person oder ein frischer Agent.
3. **Befunde und Nachprüfung.** Ein Codebefund nennt Datei, beobachtetes Verhalten und einen auf dem geprüften Stand fehlschlagenden Test. Fachliche Annahmen werden mit Quelle und Gegenprobe geprüft. Ist ein belastbarer automatisierter Nachweis technisch nicht möglich, dokumentiere die manuelle Reproduktion und die offene Grenze. Doku-Befunde brauchen eine Stelle und einen Abgleich mit Code, Befehlen oder Primärquelle. Trenne Vorschläge von Befunden. Wiederhole nach einer Änderung die einschlägige Prüfung und ordne sie dem neuen Head zu.
4. **Freigabe.** Der Maintainer entscheidet über Merge und Release. Änderungen an Anmeldung, Berechtigungen, Datenmigrationen, Schichtbesetzung, Vergütungsberechnungen und schreibenden Anbindungen brauchen eine gezielte fachliche Prüfung der Folgen und Fehlerfälle. Unsicherheit über den fachlichen Sollzustand wird vor Freigabe entschieden.

### Prüfnachweise im Pull Request

Veröffentliche die **Selbstprüfung** als eigenen Kommentar. Halte darin Passung, Akzeptanzkriterien mit Belegen, fachliche Quellen, Einfachheit, Regelverstöße und offene Entscheidungen fest. Bei agentischer Umsetzung erfolgt diese Prüfung in einer frischen Session ohne Entstehungsverlauf. Für jedes anschließende unabhängige Review erhält eine weitere frische Session oder eine andere Person den Auftrag nach Schritt 2.

Veröffentliche **Unabhängiges Code-Review** und **Unabhängige Doku-Prüfung** jeweils als eigenen Kommentar, auch bei einem Ergebnis ohne Befunde. Nenne in jedem Prüfkommentar Zielbasis, geprüften Head, Umfang, Befunde, gelaufene und ausgelassene Checks mit Grund sowie offene Punkte. Belege einen behobenen Befund mit Fix-Commit und Nachprüfung. Bei einem neuen Head oder einer neuen Zielbasis ergänze den Kommentar mit einem belegten Nachtrag oder einem erneuten Review. Ergebnisse eines frischen Agenten können unter demselben GitHub-Konto erscheinen. Kennzeichne, wer geprüft hat und ob du dessen Bericht zusammenfasst.

Verlinke die Kommentare in der PR-Beschreibung. Prüfe diese Links und den abgedeckten Stand vor „Ready for review“, vor Übergabe auf dem Freigabeboard und vor dem Merge. Fehlt ein erforderlicher Kommentar oder belegt er nur einen älteren Stand, hole die Prüfung und den Nachweis vor dem jeweiligen Schritt nach.

Für den fiktiven Einsatz „Stadtfest West“ verbessert ein PR die Personalsuche und passt ihre Anleitung an. Die Tabelle zeigt Auszüge aus den erforderlichen Prüfkommentaren. Die PR-Beschreibung verlinkt jeden dieser Kommentare.

| Kommentar | Beispiel für Code und Doku | Beispiel für einen reinen Doku-PR |
| --- | --- | --- |
| Selbstprüfung | Die Suche findet die Person über eine Qualifikation wie im Issue verlangt. | Die Anleitung erklärt den bereits vorhandenen Suchweg. |
| Unabhängiges Code-Review | Der Browserfall findet die Person über eine Qualifikation und erhält die übrigen Filter. | Entfällt. |
| Unabhängige Doku-Prüfung | Die Anleitung stimmt mit Feldbeschriftung, Suchverhalten und verlinkter Personalliste überein. | Feldbeschriftung, Schritte und Link stimmen. |

[Habens Selbstprüfung](https://github.com/Speicherstadt/haben/blob/4dd9603df8ecc2f08ac790897b627afe5a0619cd/.claude/skills/beitrag-pruefen/references/selbstpruefung.md) · [Habens Code-Review im PR](https://github.com/Speicherstadt/haben/pull/1945) · [Habens Doku-Prüfung im PR](https://github.com/Speicherstadt/haben/pull/1942)

### Überlappende Änderungen

Prüfe bekannte Überschneidungen zunächst mit Git, etwa mit `git merge-tree --write-tree <Head-A> <Head-B>`. Prüfe das gemeinsame Verhalten in einem getrennten Worktree. Bei einem Wechsel der Zielbasis müssen Diff, Review und CI zum neuen Stand passen. Nenne die tatsächliche Abhängigkeit und die Prüfreihenfolge in der PR-Beschreibung.

## Prüfungen und Dokumentation

Ergebnis, Fehlschläge und Auslassungen mit Grund gehören in den PR. Eine Wiederholung des CI-Laufs braucht einen erkannten Grund. Behebe die Ursache eines Fehlers, erhalte Umfang und Strenge der Prüfungen und wiederhole die betroffene Prüfung.

Sobald die Anwendung und ihr Workflow eingerichtet sind, meldet **Prüfungen** den Check `crew` bei Pull Requests und Pushes auf `main`. **Arbeitsgrundlage** meldet den Check `doku` bei passenden Pfaden im Pull Request und bei Pushes auf `main`. Wird ein Entwurf zur Prüfung freigegeben, gelten dieselben Kriterien wie beim Öffnen eines PRs.

Sobald die manuell startbaren Workflows auf `main` liegen, können Beitragende mit Repository-Schreibzugriff bei fehlendem automatischem Lauf **Actions → Run workflow** verwenden. Wähle den Branch mit dem aktuellen Prüfkandidaten und der manuell startbaren Workflow-Version. Halte den geprüften Commit und den Lauf im PR fest. Der manuelle Doku-Lauf prüft Leerzeichen gegen den direkten Vorgänger. Prüfe bei mehreren Commits den gesamten PR-Diff zusätzlich mit `git diff --check <Zielbranch>...HEAD`. Verwende den aktuellen Remote-Ref des Zielbranches, beispielsweise `origin/main`. Die GitHub-Freigabe für Workflow-Läufe aus Forks gilt auch weiterhin für automatische PR-Läufe.

### Befehle und Screenshot-Workflow

Nutze die Befehle der jeweiligen Zielbasis. Auf einem Stand mit Anwendung gehören Syntaxprüfung, automatisierte Tests sowie bei betroffener Bedienung Browserprüfungen in einer isolierten Instanz dazu. Prüfe Containeränderungen mit einem frischen Datenbestand. Das jeweilige README nennt die ausführbaren Befehle.

Verwende für Browserfälle und Screenshots denselben synthetischen Ausgangsbestand, feste Viewports und bei datumsabhängigen Ansichten vergleichbare Zeitpunkte. Prüfe Aufnahme und Lesbarkeit vor der Übernahme in PR oder Nutzerdoku.

Installiere Bun 1.4.5 und die Abhängigkeiten mit `bun install --frozen-lockfile`. Baue Crew mit `bun run build` und prüfe die TypeScript-Typen mit `bun run typecheck`. Setze `CREW_TEST_DATABASE_URL` auf eine isolierte PostgreSQL-18-Testinstanz. Die Testrolle benötigt die Berechtigung, dort temporäre Datenbanken anzulegen und zu entfernen. `bun run test` prüft HTTP, Import, Proxy und Betriebsbefehle mit synthetischen Daten. Installiere für Browserproben mit `bunx playwright install chromium webkit` beide Engines. `bun run test:browser` prüft Chromium gegen den gebauten Server. Setze für denselben Ablauf in WebKit `CREW_BROWSER_ENGINE=webkit`. Bei Portkonflikten wähle mit `CREW_BROWSER_PORT` einen freien Port. CI verwendet Ubuntu und stellt die Bilder als `crew-ansichten` und `crew-ansichten-webkit` bereit. Lokale Bilder liegen in `build/screenshots/` und `build/webkit/`.

Der Lauf protokolliert Engine-Version und Betriebssystem. Er deckt unter anderem PDF-Upload und -Download, Formatfehler, Tastaturfokus, Dialoge, Textkontrast von Dispo-Status und Fehlermeldung, 44-Pixel-Touch-Ziele und horizontales Scrollen ab. Beide Engines prüfen die Tab-Reihenfolge im Einladungsdialog. Bei WebKit wird der Sprunglink direkt fokussiert, da die verwendete Standardkonfiguration Links beim Durchtabben überspringt. Die Ansichten bei 360 und 390 CSS-Pixeln entstehen per Touch-Emulation. Für Geräteaussagen und die vollständige Bewertung nach WCAG 2.2 AA sind zusätzliche Prüfungen nötig.

Auf einem Stand mit Entwicklungsdoku allein prüfe die geänderten Regeln, Verweise, Skills und Beispiele. Halte dort offen fest, welche Anwendungstests mangels Anwendung auf dieser Zielbasis nicht laufen. Für Screenshots und Beispiele nutze fiktive oder anonymisierte Angaben. Zugangsdaten und personenbezogene Daten bleiben aus Repository, Issues, Prompts und Logs heraus.

Doku, Oberfläche und Beiträge werden auf Deutsch geschrieben, Code-Bezeichner auf Englisch. Eine Regel steht an einer maßgeblichen Stelle. Der Skill verweist dorthin und beschreibt den Ablauf. Vorher-Nachher-Bilder nutzen vollständige Git-Stände, gleiche Daten und Viewports sowie Hell, Dunkel und bei betroffener Bedienung Smartphone. Der [Screenshot-Skill](../.agents/skills/crew-pr-screenshots/SKILL.md) beschreibt Aufnahme und Veröffentlichung.

## Entwicklungsrunden für Agenten

Beginne mit dem höchsten belegten Nutzen für Crew. Prüfe vorhandene Issues, PRs und Abhängigkeiten, bevor du neue Arbeit anlegst. Bearbeite ein passendes bestehendes Issue weiter. Lege ein neues Issue an, wenn ein konkreter Bedarf einen eigenen Umfang und prüfbare Abnahmekriterien hat. Ein Umfang kann einen einzelnen PR oder mehrere fachlich begründete PRs brauchen.

Wende für neue und wiederaufgenommene Aufgaben das [Issue-Review](#issue-review-vor-der-planung) an. Ein PR ist nach Selbstprüfung, unabhängigem Review und grüner erforderlicher CI auf seinem aktuellen Stand prüfbereit. Bei betroffener Oberfläche gehören Vergleichsbilder zur Abnahme.

Die bisherige Viererfolge samt Startwert ist eine Orientierung für die Planung. Passe Aufgaben und Umfang an Priorität, Risiken, Abhängigkeiten und verfügbare Zeit für Tests und Reviews an. Kann ein geprüftes Issue sinnvoll umgesetzt werden, starte den PR direkt im vereinbarten Auftrag. Leert sich die umsetzbare Warteschlange, prüfe den Bestand und fülle sie mit geeigneten Aufgaben auf.

| Planungssituation | Richtwert für geprüfte Issues | Richtwert für prüfbereite PRs |
| --- | ---: | ---: |
| Start oder leere Warteschlange | 10 | 1 |
| Folgerunde 1 | 5 zusätzliche | 1 |
| Folgerunde 2 | 3 zusätzliche | 2 |
| Folgerunde 3 | 2 zusätzliche | 3 |
| Folgerunde 4 | 1 zusätzliches | 5 |

Halte nach abgeschlossenen PRs und bei einer Neuplanung kurz fest, was der Nutzer jetzt tun kann, welche Nachweise vorliegen, welche Abhängigkeiten und Entscheidungen offen sind und welcher Schritt als Nächstes sinnvoll ist. Nutze Board-Zahlen bei Bedarf, um die Warteschlange einzuschätzen. Halte sinnvolle Verbesserungen der Agenten-Doku fest.

Die [Übernahme aus Desk](desk-uebernahme.md) dokumentiert die Herkunft der Regeln.
