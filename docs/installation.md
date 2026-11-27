# Crew installieren

Crew läuft mit Bun, TanStack Start und React. PostgreSQL speichert die Fachdaten und die Sitzungen von Better Auth. Für einen lokalen Probelauf nutze ausschließlich Beispieldaten.

## Docker Compose

Setze `CREW_AUTH_SECRET` für die Sitzungssignatur und `CREW_DB_PASSWORD` für PostgreSQL in einer geschützten lokalen `.env` oder deiner Shell. Erzeuge dafür zwei verschiedene Zufallswerte mit jeweils `openssl rand -hex 32`. Bewahre die Werte über Neustarts hinweg auf.

Setze `CREW_ADMIN_PASSWORD` in der Umgebung deiner Shell auf ein eigenes Passwort mit 12 bis 128 Zeichen ohne Zeilenumbrüche. Entferne die Variable nach der Kontoanlage wieder aus der Shell.

```sh
docker compose up --build -d
docker compose exec crew bun run migrate
docker compose run --rm -e CREW_ADMIN_PASSWORD crew bun run admin dispo@example.test "Crew Dispo"
unset CREW_ADMIN_PASSWORD
```

Öffne `http://localhost:8080` und melde dich mit dem Dispo-Konto an. Registriere ein separates Personalprofil über die Startseite in einem zweiten Browserprofil. Die PostgreSQL-Daten liegen im Compose-Volume `crew-postgres`. Der Datenbankport bleibt im internen Compose-Netz.

## Nativer Betrieb mit Bun

Installiere Bun 1.4.5. Stelle eine leere PostgreSQL-18-Datenbank bereit und setze `DATABASE_URL` auf deren Verbindungsadresse. Alternativ kannst du `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER` und `PGPASSWORD` setzen. Lege `CREW_AUTH_SECRET` und `CREW_ADMIN_PASSWORD` wie oben beschrieben fest.

```sh
bun install --frozen-lockfile
bun run build
bun run migrate
bun run admin dispo@example.test "Crew Dispo"
unset CREW_ADMIN_PASSWORD
HOST=127.0.0.1 PORT=8080 TZ=Europe/Berlin bun run start
```

Die Beispiele verwenden eine POSIX-Shell. In PowerShell entfernst du das Initialpasswort mit `Remove-Item Env:CREW_ADMIN_PASSWORD`. Starte für Entwicklungsänderungen nach der Schemaeinrichtung `bun run dev --host 127.0.0.1 --port 8080`.

## Zugang sperren oder wiederherstellen

Die Dispo öffnet das Profil eines aktiven Poolmitglieds und kann den Zugang dort sperren oder wieder freigeben. Eine Sperre beendet bestehende Sitzungen. Bevorstehende bestätigte Schichten bleiben reserviert und zeigen der Dispo den Prüfbedarf. Nach der Wiederfreigabe meldet sich die Person neu an.

Betreiber mit Zugriff auf Crew und dessen Datenbank können ein verlorenes Passwort ersetzen. Setze `CREW_ADMIN_PASSWORD` für den Befehl auf ein Passwort, das sich vom bisherigen unterscheidet, und entferne die Variable anschließend aus der Shell.

```sh
docker compose run --rm -e CREW_ADMIN_PASSWORD crew bun run admin reset-password personal@example.test
unset CREW_ADMIN_PASSWORD
```

Bei nativer Installation verwende dieselbe PostgreSQL-Verbindung wie der Webdienst und führe `bun run admin reset-password personal@example.test` aus. Ein Passwortwechsel beendet die bestehenden Sitzungen. Wirksame Kontosperren bleiben bestehen.

Für bestehende SQLite-Installationen gibt es einen Import mit Erhalt der Konten und Nachweise. [Wechsel von SQLite zu PostgreSQL](migration.md)

## Adresse und Zeitzone

Die Beispiele binden den Host-Port an `127.0.0.1:8080`. Setze `PORT` beim nativen Start oder `CREW_PORT` für Compose, wenn ein anderer Host-Port benötigt wird. Setze auch `CREW_ORIGIN` auf die im Browser verwendete Adresse. HTTP ist ausschließlich für die lokale Loopback-Adresse vorgesehen. Eine externe Adresse braucht HTTPS. In Compose kannst du die Werte in der Shell oder einer lokalen `.env` konfigurieren.

`TZ` legt die Zeitzone für alle Schichten auf dieser Instanz fest. Das Compose-Setup verwendet standardmäßig `Europe/Berlin`. Die Dispo erfasst lokale Uhrzeiten, Crew speichert Schichtgrenzen in UTC. In der doppelt vorkommenden Stunde bei der Zeitumstellung verwendet die Eingabe das frühere Vorkommen.

Betreibe Crew mit genau einer Anwendungsinstanz. Schütze Datenbank und Sicherungen durch passende Zugriffsrechte. [Sicherung und Wiederanlauf](sicherung.md) · [Personendaten exportieren und bereinigen](personendaten.md)

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

`bun test test/proxy.test.ts` prüft den synthetischen HTTPS-Proxy, die abgeschaltete Registrierung und die Anmeldebegrenzung auf einem lokalen Prüfstand. Die Probe benötigt OpenSSL, einen gebauten Crew-Stand und die PostgreSQL-Testverbindung `CREW_TEST_DATABASE_URL`. Unter Windows kann `CREW_OPENSSL` auf dessen ausführbare Datei zeigen.

## Crew als App installieren

Öffne deine Crew-Instanz über HTTPS. Lokal funktioniert die Prüfung auch über `localhost` oder `127.0.0.1`. Nutze einen Browser mit Web-App-Installation.

- **Chrome und Edge am Desktop:** Wähle das Installationssymbol in der Adressleiste oder den Eintrag für die App-Installation im Browsermenü.
- **Chrome auf Android.** Öffne das Dreipunkt-Menü, wähle **Installieren und Verknüpfung erstellen** und dann **Installieren**. Je nach Chrome-Version ist der Einstieg als **Zum Startbildschirm hinzufügen** beschriftet. [Chrome-Hilfe](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=de-DE)
- **Safari auf iPhone und iPad.** Öffne das Teilen-Menü und wähle **Zum Home-Bildschirm**. Aktiviere **Als Web-App öffnen**, wenn Safari die Option anbietet, und bestätige mit **Hinzufügen**. [Apple-Anleitung](https://support.apple.com/de-de/guide/iphone/iphea86e5236/ios)

Crew öffnet sich im eigenen Fenster oder vom Startbildschirm. Anmeldung, Schichten, Nachweise und Formularübermittlungen brauchen eine Verbindung zu deiner Instanz. Wenn Crew vorher online geöffnet wurde und der Service Worker aktiv ist, zeigt die App beim nächsten Öffnen ohne Verbindung einen Hinweis. Crew speichert keine Inhalte im Offline-Cache und führt keine offline abgeschickten Änderungen nachträglich aus.
