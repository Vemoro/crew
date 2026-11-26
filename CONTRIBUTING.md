# An Crew mitwirken

Du kannst Abläufe mit Beispieldaten testen, Fehler melden, die Doku verbessern oder an einer Funktion mitarbeiten.

## Fehler und Vorschläge

Prüfe die [vorhandenen Issues](https://github.com/Vemoro/crew/issues) und die [Crew-Roadmap](docs/roadmap.md). Ergänze eine neue Beobachtung im bestehenden Issue, wenn sie dieselbe Aufgabe betrifft. Über die [Issue-Auswahl](https://github.com/Vemoro/crew/issues/new/choose) findest du Formulare für Fehler und Verbesserungsvorschläge.

Bei einem Fehler helfen der geprüfte Stand, reproduzierbare Schritte sowie erwartetes und beobachtetes Verhalten. Bei einem Vorschlag beschreibe, wer die Änderung braucht, welchen Ablauf sie verbessert und woran sich das Ergebnis prüfen lässt. Beispiele und Screenshots verwenden synthetische oder anonymisierte Angaben. Für Sicherheitsprobleme und andere vertrauliche Informationen gilt der private Kontaktweg. [Sicherheitsmeldungen](SECURITY.md)

### Beispiel für einen Fehlerbericht

Der fiktive Bericht „Eine abgesagte Schicht bleibt besetzt“ braucht einen synthetischen Einsatz mit einem Platz und einer bestätigten Person. Notiere den geprüften Commit, ziehe die Zusage im Personalportal zurück und prüfe in der Dispo, ob der Platz wieder offen erscheint. Gib erwartetes und beobachtetes Ergebnis im Fehlerformular an.

## Beiträge vorbereiten

1. Such dir eine freie Aufgabe unter „Geplant“. Sobald die Roadmap-Automatik eingerichtet ist, kannst du `/übernehmen` (oder `/uebernehmen`) als Kommentar im Issue schreiben. Der Bot bestätigt die Zuweisung, falls GitHub sie erlaubt. Mit `/freigeben` gibst du die Aufgabe zurück. Wenn die Automatik noch nicht eingerichtet ist oder GitHub die Zuweisung ablehnt, wende dich im Issue an die Maintainer. [Regeln zur Übernahme](docs/roadmap.md#issues-übernehmen-und-freigeben)
2. Erstelle für deinen Beitrag einen Branch in deinem Fork. Wenn du Schreibzugriff auf Crew hast, kannst du auch einen Branch im Crew-Repository verwenden. Führe die passenden Prüfungen mit synthetischen Daten aus. Bei Änderungen an der Oberfläche gehören vergleichbare Vorher- und Nachher-Bilder zum PR. [Prüfbefehle und Screenshot-Workflow](docs/entwicklung.md#befehle-und-screenshot-workflow)
3. Nutze die PR-Vorlage für Ergebnis, Issue, Prüfnachweise und Updatehinweise. Kennzeichne wesentliche KI-Unterstützung. Die Entwicklungsdoku beschreibt den Ablauf für Entwurf, Selbstprüfung, unabhängiges Review, CI und Freigabe. [Pull Requests](docs/entwicklung.md#pull-requests) · [Review und Freigabe](docs/entwicklung.md#änderungen-prüfen)

Für Beiträge gelten die [Codegrößenregeln](docs/entwicklung.md#codegröße-und-aufräumen) und bei betroffener Oberfläche die [Gestaltungsregeln](DESIGN.md). Für den Einsatz von Coding-Agenten gilt [AGENTS.md](AGENTS.md).
