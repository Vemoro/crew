# Crew installieren

Crew läuft als einzelner Node.js-Dienst und speichert seine Daten in SQLite. Für einen lokalen Probelauf nutze ausschließlich Beispieldaten.

## Docker Compose

Setze `CREW_ADMIN_PASSWORD` in der Umgebung deiner Shell auf ein eigenes Passwort mit 12 bis 128 Zeichen ohne Zeilenumbrüche. Entferne die Variable nach der Kontoanlage wieder aus der Shell.

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

## Zugang sperren oder wiederherstellen

Die Dispo öffnet das Profil eines aktiven Poolmitglieds und kann den Zugang dort sperren oder wieder freigeben. Eine Sperre beendet bestehende Sitzungen. Bevorstehende bestätigte Schichten bleiben reserviert und zeigen der Dispo den Prüfbedarf. Nach der Wiederfreigabe meldet sich die Person neu an.

Betreiber mit Zugriff auf Crew und dessen Datenbank können ein verlorenes Passwort ersetzen. Setze `CREW_ADMIN_PASSWORD` für den Befehl auf ein Passwort, das sich vom bisherigen unterscheidet, und entferne die Variable anschließend aus der Shell.

```sh
docker compose run --rm -e CREW_ADMIN_PASSWORD crew node admin.js reset-password personal@example.test
unset CREW_ADMIN_PASSWORD
```

Beim nativen Start verwende mit demselben Datenbankpfad `npm run admin -- reset-password personal@example.test`. Ein Passwortwechsel beendet die bestehenden Sitzungen. Wirksame Kontosperren bleiben bestehen.

Dieser Crew-Stand migriert die Datenbank beim Start der Anwendung oder CLI auf Schema 4. Sichere den Ausgangsstand vor dem Update. Für eine Rückkehr zur älteren Crew-Version verwende eine separate Kopie der Vorupdate-Sicherung. [Sicherung und Wiederanlauf](sicherung.md)

## Adresse und Zeitzone

Der Dienst bindet lokal an `127.0.0.1:8080`. Setze `PORT` beim nativen Start oder `CREW_PORT` für Compose, wenn ein anderer Host-Port benötigt wird. Setze auch `CREW_ORIGIN` auf die im Browser verwendete Adresse. HTTP ist ausschließlich für die lokale Loopback-Adresse vorgesehen. Eine externe Adresse braucht HTTPS. In Compose kannst du die Werte in der Shell oder einer lokalen `.env` konfigurieren.

`TZ` legt die Zeitzone für alle Schichten auf dieser Instanz fest. Der Standard ist `Europe/Berlin`. Die Dispo erfasst lokale Uhrzeiten, Crew speichert Schichtgrenzen in UTC. In der doppelt vorkommenden Stunde bei der Zeitumstellung verwendet die Eingabe das frühere Vorkommen.

Betreibe Crew mit genau einer Anwendungsinstanz. Schütze Datenbank und Sicherungen durch passende Zugriffsrechte. [Sicherung und Wiederanlauf](sicherung.md)

## HTTPS hinter einem Reverse-Proxy

Beende TLS am Reverse-Proxy und setze `CREW_ORIGIN` auf seine HTTPS-Origin. Crew erstellt dafür sichere Sitzungscookies. Halte den HTTP-Upstream nur für den Proxy erreichbar und leite Browser auf HTTPS um. Setze `CREW_TRUSTED_PROXY` nur auf die einzelne IP-Adresse, mit der sich der unmittelbar vorgeschaltete Proxy bei Crew meldet. Bei nativer Installation mit einem Proxy auf demselben Host kann das `127.0.0.1` sein. In Compose kann sich die intern sichtbare Adresse von der Hostadresse unterscheiden.

Vertraue einer Loopback- oder Gateway-IP nur, wenn alle über diese IP sichtbaren Zugriffe durch den Proxy kontrolliert werden. Sonst lasse die Einstellung leer. Nach einer Konfigurationsänderung übernimmt `docker compose up -d` die geänderten Werte in einen neu erstellten Container. Bei nativer Installation starte den Prozess mit den neuen Werten neu.

Der vertrauenswürdige Proxy überschreibt `X-Forwarded-For` mit genau der Client-IP. Ein Nginx-Abschnitt für einen nativen Crew-Dienst auf demselben Rechner kann so aussehen:

```nginx
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
}
```

Die Anmeldebegrenzung zählt Versuche getrennt pro Client-IP und pro Konto. Ohne konfigurierten vertrauenswürdigen Proxy oder bei einem ungültigen weitergeleiteten Wert verwendet Crew die direkt verbundene IP. Direkte Verbindungen aus dem öffentlichen Netz gehören nicht an den HTTP-Upstream.

## Selbstregistrierung pausieren

Mit `CREW_REGISTRATION=paused` nimmt Crew keine neuen Selbstregistrierungen an. Übernimm die Änderung mit `docker compose up -d` oder starte den nativen Prozess mit dem neuen Wert. Bestehende Konten können sich weiter anmelden. Setze den Wert auf `open` und übernimm die Änderung auf demselben Weg, um den Bewerberzugang wieder zu öffnen.

`node scripts/check-proxy.mjs` prüft den synthetischen HTTPS-Proxy, die abgeschaltete Registrierung und die Anmeldebegrenzung auf einem lokalen Prüfstand. Die Probe benötigt OpenSSL. Unter Windows kann `CREW_OPENSSL` auf dessen ausführbare Datei zeigen.
