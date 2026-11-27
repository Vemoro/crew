# Crew Roadmap

Crew unterstützt Teams mit wechselnden Einsatzorten und einem Personalpool für unregelmäßige Einsätze. Der Kern führt von der Bewerbung mit Grunddaten, Qualifikationen und Verfügbarkeiten über die Aufnahme in den Pool zur verbindlichen Besetzung einer Schicht. Im Portal sieht das Personal offene Schichten, Rückmeldungen, Aufgaben, bevorstehende Einsätze und erwartete Vergütung.

Schichten können im freigegebenen Pool sichtbar sein oder einen Einladungskreis haben. Anforderungen können vor der Bewerbung oder vor der Einteilung fällig sein. Individuelle Fragebögen werden manuell ausgewertet. Crew ist eigenständig lauffähig. Desk und andere Tools sind mögliche Quellen für Einsätze. Haben oder andere Abrechnungssysteme können später Abrechnungsdaten liefern, soweit die jeweilige Schnittstelle das fachlich unterstützt.

Spätere Ausbaustufen sind Benachrichtigungen, Vorlagen, Zeitfreigaben, Abrechnungsbelege, Abwesenheiten für festes Personal und produktive Integrationen.

## Board-Zustände

Die [Crew Roadmap](https://github.com/orgs/Vemoro/projects/3/views/1) zeigt die Issues von Crew als Board. Anforderungen, Prüfnachweise und fachliche Entscheidungen stehen am verknüpften Issue.

| Status | Bedingung |
| --- | --- |
| Später | Sinnvoller Umfang für eine spätere Ausbaustufe oder mit noch offenen Vorarbeiten |
| Geplant | Für Crew umsetzbarer Umfang mit geprüfter Issue-Fassung und nachvollziehbarer Abnahme |
| In Arbeit | Ausgewählte Umsetzung mit festgehaltenem Stand und offenem Arbeits- oder Prüfweg |
| Externe Integrationen | Die Umsetzung braucht eine konkrete Änderung in einem anderen Projekt |
| Im nächsten Release | Die vollständige Umsetzung ist gemergt und für die nächste Auslieferung vorgesehen |
| Erledigt | Die Auslieferung ist nachvollziehbar belegt. Bei reiner Repository-Dokumentation kann der vereinbarte Auslieferungspunkt der Merge auf den Standardbranch sein. |

Setze bei Planung zuerst den Kernablauf und Risiken für Daten, Berechtigungen und die Wiederholbarkeit von Buchungen. Ein Crew-Adapter erhält eine eigene Crew-Aufgabe. Änderungen in Desk oder Haben werden dort verfolgt. Verlinke eine erforderliche externe Änderung mit dem vorhandenen externen Issue oder der belegten Schnittstellenlücke.

Die [Entwicklungsrunden](entwicklung.md#entwicklungsrunden-für-agenten) beschreiben die flexible Planung nach Nutzen, Risiken und Abhängigkeiten.

## Issues übernehmen und freigeben

Bis zur Einrichtung der Automatik erfolgt die Übernahme über einen Kommentar im Issue und Zuweisung durch die Maintainer. Für eine spätere Automatik gelten folgende Abläufe.

Schreibe `/übernehmen` oder `/uebernehmen` am Anfang einer Zeile in einem neuen Kommentar. Die Befehle gelten für offene, freie Issues mit aktiver Karte unter „Geplant“ oder „In Arbeit“. Wenn GitHub die Zuweisung bestätigt, steht die Karte unter „In Arbeit“. Mit `/freigeben` hebst du deine Zuweisung auf. Eine dadurch frei gewordene aktive Karte unter „In Arbeit“ geht nach „Geplant“ zurück. Befehle in Zitaten oder Codeblöcken bleiben ohne Wirkung.

Der tägliche Lauf erinnert bei Übernahmen per Bot, sobald 14 Tage ohne Rückmeldung verstrichen sind. Nach weiteren sieben Tagen ohne Rückmeldung gibt er das Issue frei. Ein Kommentar der zugewiesenen Person startet die Frist neu. Ein offener PR einschließlich Entwurf schützt die Aufgabe, wenn in seiner Beschreibung etwa `Refs #123` oder `Umgesetzt #123` steht. Manuelle Zuweisungen ohne Übernahmebefehl und GitHub-Collaborators dieses Repositorys sind von der automatischen Rückgabe ausgenommen. Für Pull Requests gilt der [Review- und Freigabeprozess](entwicklung.md#änderungen-prüfen).

### Automatik einrichten

Richte als Org-Owner eine GitHub App im Besitz von Vemoro ein. Deaktiviere den Webhook und erteile **Organization permissions → Projects: Read and write** sowie **Repository permissions → Issues: Read-only**. Installiere die App für `Vemoro/crew`. Hinterlege dort unter **Settings → Secrets and variables → Actions** die Client-ID als Variable `CREW_ROADMAP_APP_CLIENT_ID` und den vollständigen privaten App-Schlüssel als Secret `CREW_ROADMAP_APP_PRIVATE_KEY`. Der Workflow verwendet für das Board ein kurzlebiges Installationstoken. Issue-Zuweisungen und Kommentare laufen über das eigene `GITHUB_TOKEN` von GitHub Actions. [GitHub App registrieren](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app) · [GitHub Projects in Actions](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/automating-projects-using-actions)

Starte nach Implementierung und Merge der Automatik den Workflow **Übernehmen** auf `main` mit aktivierter Option `probe`. Prüfe, dass die App-Anmeldung erfolgreich war. Das Protokoll zeigt fällige Erinnerungen und Rückgaben, ohne sie auszuführen. Prüfe die Schreibrechte anschließend mit beiden Kommentarbefehlen an einer freien Testkarte mit synthetischen Daten.
