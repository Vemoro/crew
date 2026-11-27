# Sicherung und Wiederanlauf

Sichere PostgreSQL regelmäßig mit `pg_dump`. Ein logischer Dump ist auch im laufenden Betrieb konsistent. Halte bei einer geplanten Umstellung den Webdienst vor der letzten Sicherung an, damit später keine Änderungen fehlen. Der Dump enthält Personaldaten, Passwort-Hashes, Sitzungen und PDF-Nachweise. Beschränke den Zugriff und verwahre den stabilen Sitzungsschlüssel separat in der Betriebsumgebung.

## Sicherung unter Docker Compose

Die Befehle laufen im Projekt der vorhandenen Installation. Ergänze `-p`, wenn du einen eigenen Projektnamen verwendest. Eine POSIX-Shell mit `umask 077` legt neue Sicherungsdateien nur für deinen Benutzer lesbar an.

```sh
backup="/geschuetzt/crew-sicherung-$(date -u +%Y%m%dT%H%M%SZ).sql"
(
  umask 077
  set -C
  docker compose exec -T postgres pg_dump -U crew -d crew --no-owner --no-acl > "$backup" &&
  sha256sum "$backup" > "$backup.sha256"
)
```

Prüfe, dass der Dump erfolgreich erstellt wurde. Bei nativer Installation verwende die zur Serverversion passenden PostgreSQL-Clientwerkzeuge und die Verbindungsdaten der vorgesehenen Quelldatenbank.

## Wiederherstellung auf einem getrennten Ziel

Wähle eine erfolgreich erstellte Sicherungsdatei aus und prüfe die zugehörige SHA-256-Summe. Lege für das Ziel ein leeres PostgreSQL-Volume, passende Zugangsdaten und einen separaten Host-Port fest. Die Beispiele verwenden den Projektnamen `crew-restore`. Halte den Dienst bis nach der Abnahme für andere Nutzer unerreichbar.

```sh
backup=/geschuetzt/crew-sicherung-20260101T120000Z.sql
sha256sum --check "$backup.sha256" &&
docker compose -p crew-restore up -d --wait postgres &&
docker compose -p crew-restore exec -T postgres psql -X -U crew -d crew \
  --single-transaction -v ON_ERROR_STOP=1 < "$backup" &&
docker compose -p crew-restore run --rm -T --no-deps crew bun run admin invalidate-sessions &&
docker compose -p crew-restore up -d crew
```

Für einen nativen Restore verwende `psql` mit denselben Optionen und der Verbindungsadresse der leeren Zieldatenbank. Beende alle aus dem Dump übernommenen Sitzungen mit `bun run admin invalidate-sessions`, bevor der Webdienst erreichbar wird. Prüfe die Anmeldung, Planung und stichprobenartig PDF-Nachweise. Führe zwischen Sicherung und Wiederanlauf erfolgte Profilbereinigungen erneut aus. [Profilbereinigung](personendaten.md)

`bun scripts/check-restore.mjs` erzeugt in der CI und lokal synthetische Daten in getrennten Compose-Projekten. Die Probe prüft einen beschädigten Dump, den Wiederanlauf und den Sitzungswiderruf. Sie entfernt danach die Container und Volumes der Prüfprojekte.

Für die Rückkehr zum letzten SQLite-Stand benötigst du dessen Anwendung sowie eine separate Kopie der Vorupdate-Sicherung. [Wechsel von SQLite zu PostgreSQL](migration.md#freigabe-und-rückweg)
