# Crew sichern und wiederherstellen

1. Halte Crew vor der Offline-Sicherung an. Unter Compose verwende `docker compose stop crew`.
2. Sichere das ganze Datenverzeichnis oder Compose-Volume einschließlich möglicher SQLite-Begleitdateien. Darin liegen auch Sitzungen, Personaldaten und PDF-Nachweise. Verwahre die Kopie mit beschränktem Zugriff.
3. Für einen Restore stoppe den Zieldienst, sichere zunächst seinen vorhandenen Stand und stelle den Datenbestand in einem separaten Zielverzeichnis oder Volume wieder her. Erhalte die Schreibrechte des Dienstkontos.
4. Starte mit demselben Crew-Stand in einer isolierten Umgebung. Prüfe Anmeldung, Pool, Besetzung und Nachweise anhand synthetischer Daten. Prüfe auch, ob der Dienst eine separate Sicherung der Ausgangsversion starten kann.

[Release-Abnahme](release-abnahme.md)
