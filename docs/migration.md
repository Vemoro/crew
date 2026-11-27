# Crew von SQLite auf PostgreSQL umstellen

Der Import ist für Crew-Bestände im SQLite-Schema 6 vorgesehen. Er übernimmt Konten mit ihren bisherigen Passwörtern, Rollen und Sperren. Profil-, Nachweis-, Einsatz- und Schicht-IDs, Antworten, Einladungen, Revisionen und PDF-Dateien bleiben erhalten. Bestehende Sitzungen enden. Die Anmeldung läuft anschließend über Better Auth.

## Sicherung und Probe

1. Halte den alten Crew-Webdienst an. Verwende dessen Laufzeit und Konfiguration, um die SQLite-Datei mit `PRAGMA quick_check` und `PRAGMA user_version` zu prüfen. Falls das Schema älter als 6 ist, starte den letzten SQLite-Stand mit einer isolierten Kopie, damit er das Schema dort aktualisiert. Halte diesen Prozess vor dem Export ebenfalls an.
2. Erstelle mit SQLite `VACUUM INTO` eine konsistente Datei außerhalb des alten Daten-Volumes. Verwahre den alten Anwendungsstand und eine geschützte Vorupdate-Sicherung separat. Eine Importdatei braucht weder eine `-wal`- noch eine `-journal`-Begleitdatei. Berechne für die Importdatei eine Prüfsumme.
3. Richte PostgreSQL mit einem neuen Compose-Projekt oder einer separaten Datenbank ein. Setze `CREW_AUTH_SECRET`, behalte den Registrierungsmodus der bestehenden Instanz bei und halte den Ziel-Webdienst für externe Nutzer unerreichbar.

Die folgenden Befehle verwenden ein Beispielprojekt und eine nur lesbar eingehängte Importdatei. Der Bun-Nutzer im Container benötigt Leserechte auf diese Datei. Die Dateien liegen in einem geschützten Hostverzeichnis.

```sh
docker compose -p crew-pg build
docker compose -p crew-pg up -d --wait postgres
docker compose -p crew-pg run --rm -T --no-deps \
  -v /geschuetzt/crew-snapshot.sqlite:/snapshot.sqlite:ro \
  crew bun run migrate import-sqlite /snapshot.sqlite
```

Bei nativem Betrieb setzt du `DATABASE_URL` auf das vorgesehene PostgreSQL-Ziel und führst `bun run migrate import-sqlite /geschuetzt/crew-snapshot.sqlite` aus. Der Befehl richtet das Schema ein. Der Import selbst läuft als Transaktion und verlangt einen leeren Zielbestand. Bei einem Fehler kannst du nach Klärung der Ursache denselben Import erneut starten. Für die Wiederholung eines erfolgreichen Imports richte ein neues, leeres Ziel ein.

## Freigabe und Rückweg

Prüfe die Prüfsumme der Importdatei erneut und vergleiche die Anzahlen der Personen, Einsätze, Einladungen, Schichten, Rückmeldungen, Nachweise und Nachforderungen. Prüfe mit berechtigten Testkonten Anmeldung, Profilsperre und Rollen, Stichproben der PDFs sowie offene und bestätigte Schichten. Rufe `/ready` auf und prüfe die App im Browser mit der vorgesehenen HTTPS-Adresse. Halte vor der Freigabe einen PostgreSQL-Dump fest. [Sicherung und Wiederanlauf](sicherung.md)

Solange das neue System isoliert bleibt, kannst du die Freigabe abbrechen. Starte dafür den alten Anwendungsstand mit einer separaten Kopie der Vorupdate-Sicherung. Widerrufe die Sitzungen auf dieser Kopie mit der alten CLI, führe zwischenzeitliche Profilbereinigungen erneut aus und leite den Proxy erst nach der Startprobe zurück.

Sobald PostgreSQL neue Schreibzugriffe angenommen hat, sperre die Nutzung am Proxy und sichere beide Datenstände. Vergleiche PostgreSQL mit der Vorupdate-Sicherung und erfasse neu angelegte oder geänderte Profile, Nachweise, Antworten, Schichten und Einteilungen sowie Löschungen, Sperren und Passwortwechsel. Übertrage die betrieblich erforderlichen Änderungen mit der Dispo über die alten Crew-Abläufe in eine isolierte Kopie. Vereinbare für später angelegte Konten und geänderte Passwörter neue Zugangsdaten. Prüfe die Einteilungen und wiederhole Bereinigungen vor der Freigabe. Wenn die nötigen Änderungen auf dem alten Stand nicht vollständig nachvollzogen werden können, halte den Rückweg geschlossen und behebe die Störung auf dem PostgreSQL-Stand. Der SQLite-Importer bietet nur die Richtung nach PostgreSQL.
