# Crew sichern und wiederherstellen

1. Halte Crew vor der Offline-Sicherung an. Unter Compose verwende `docker compose stop crew`.
2. Sichere das ganze Datenverzeichnis oder Compose-Volume einschließlich möglicher SQLite-Begleitdateien. Darin liegen auch Sitzungen, Personaldaten und PDF-Nachweise. Verwahre die Kopie mit beschränktem Zugriff.
3. Für einen Restore stoppe den Zieldienst, sichere zunächst seinen vorhandenen Stand und stelle den Datenbestand in einem separaten Zielverzeichnis oder Volume wieder her. Erhalte die Schreibrechte des Dienstkontos.
4. Bevor du den Zieldienst erreichbar machst, widerrufe die in der Sicherung enthaltenen Sitzungen. Verwende den Namen des wiederhergestellten Compose-Projekts: `docker compose -p crew-restore run --rm crew node admin.js invalidate-sessions`. Ersetze `crew-restore` durch den tatsächlichen Zielprojektnamen. Nativ setze `CREW_DB` ausdrücklich auf die wiederhergestellte Datei und verwende `npm run admin -- invalidate-sessions`. Dies betrifft alle Konten des Ziels und verlangt eine neue Anmeldung.
5. Starte mit demselben Crew-Stand in einer isolierten Umgebung. Prüfe Anmeldung, Pool, Besetzung und Nachweise anhand synthetischer Daten. Prüfe auch, ob der Dienst eine separate Sicherung der Ausgangsversion starten kann. Wenn Invalidation oder Probe fehlschlagen, halte das Ziel geschlossen und bewahre die unveränderte Quelle.

`node scripts/check-restore.mjs` führt in der CI und lokal eine Wiederanlaufprobe mit getrennten Compose-Projekten durch. Der Test erstellt ausschließlich synthetische Daten, prüft einen absichtlich beschädigten Zielbestand und entfernt die dafür angelegten Container und Volumes.

## Rückkehr zu einem früheren Stand

Eine Rückkehr verwendet die separate Vorupdate-Sicherung, den damaligen Anwendungsstand und ein separates Ziel. Verwende die CLI dieses Stands, damit der neuere Prozess die Sicherung nicht vorab migriert. Wenn die frühere CLI keinen Sitzungswiderruf anbietet, halte den Dienst isoliert und lösche vor der Freigabe die Zeilen der Tabelle `sessions` mit SQLite in der ausdrücklich ausgewählten Zielkopie. Prüfe vorher, dass die gewählte Datei existiert und zum Ziel gehört. Führe danach die Start- und Anmeldeprobe mit der früheren Laufzeit aus.

[Release-Abnahme](release-abnahme.md)
