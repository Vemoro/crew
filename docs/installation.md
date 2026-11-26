# Crew installieren

Crew läuft als einzelner Node.js-Dienst und speichert seine Daten in SQLite. Für einen lokalen Probelauf nutze ausschließlich Beispieldaten.

## Docker Compose

Setze `CREW_ADMIN_PASSWORD` in der Umgebung deiner Shell auf ein eigenes Passwort mit 12 bis 128 Zeichen. Entferne die Variable nach der Kontoanlage wieder aus der Shell.

```sh
docker compose build
docker compose run --rm -e CREW_ADMIN_PASSWORD crew node admin.js dispo@example.test "Crew Dispo"
unset CREW_ADMIN_PASSWORD
docker compose up -d
```

Öffne `http://localhost:8080` und melde dich mit dem Dispo-Konto an. Registriere ein separates Personalprofil über die Startseite in einem zweiten Browserprofil. Die Daten liegen im Compose-Volume `crew-data`.

## Node.js

Du brauchst Node.js 24 ab Version 24.14. Crew hat keine externen npm-Laufzeitpakete.

```sh
npm run admin -- dispo@example.test "Crew Dispo"
unset CREW_ADMIN_PASSWORD
npm start
```

Setze `CREW_ADMIN_PASSWORD` vor der Kontoanlage wie oben beschrieben. Die Beispiele verwenden eine POSIX-Shell. In PowerShell entfernst du die Variable mit `Remove-Item Env:CREW_ADMIN_PASSWORD`. Standardmäßig liegt der Datenbestand unter `data/crew.sqlite`. `CREW_DB` legt einen anderen Datenbankpfad fest. `npm test` prüft den HTTP-Ablauf in einer isolierten In-Memory-Datenbank.

## Adresse und Zeitzone

Der Dienst bindet lokal an `127.0.0.1:8080`. Setze `PORT` beim nativen Start oder `CREW_PORT` für Compose, wenn ein anderer Host-Port benötigt wird. Setze auch `CREW_ORIGIN` auf die im Browser verwendete Adresse. Verwende bei einem HTTPS-Reverse-Proxy dessen öffentliche HTTPS-Origin, damit Crew sichere Sitzungscookies ausgibt. In Compose kannst du die Werte in der Shell oder einer lokalen `.env` konfigurieren. Bei einem Proxy außerhalb des Compose-Netzwerks gilt die freigegebene Loopback-Adresse als Upstream auf demselben Host.

`TZ` legt die Zeitzone für alle Schichten auf dieser Instanz fest. Der Standard ist `Europe/Berlin`. Die Dispo erfasst lokale Uhrzeiten, Crew speichert Schichtgrenzen in UTC. In der doppelt vorkommenden Stunde bei der Zeitumstellung verwendet die Eingabe das frühere Vorkommen.

Betreibe Crew mit genau einer Anwendungsinstanz. Die einfache Anmeldebegrenzung verwendet die direkt verbundene IP-Adresse und das Konto. Hinter einem Reverse-Proxy zählt die Proxy-IP zum gemeinsamen Limit. Schütze Datenbank und Sicherungen durch passende Zugriffsrechte. [Sicherung und Wiederanlauf](sicherung.md)
