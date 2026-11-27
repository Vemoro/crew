# Poolprofile exportieren und bereinigen

Die Betreiber-CLI benötigt Zugriff auf den Crew-Datenbestand. Halte Crew für diese Arbeiten an und stelle sicher, dass `DATABASE_URL` bei einer nativen Installation auf die vorgesehene PostgreSQL-Datenbank zeigt. Verwende dieselbe Crew-Version wie der Dienst und prüfe die Zieladresse vor der Ausführung. Die Beispiele verwenden synthetische Adressen.

## Ein Profil exportieren

Wähle einen neuen Ordner innerhalb eines geschützten, bereits vorhandenen Verzeichnisses. Begrenze den Zugriff auf das übergeordnete Verzeichnis per Dateisystemberechtigung. Der Export enthält ein lesbares JSON-Profil und vorhandene PDF-Nachweise.

```sh
bun run people export mira@example.test /geschuetzt/crew-export/mira
```

Bei Compose verwende nach `docker compose stop crew` ein zusätzliches Bind-Mount auf ein geschütztes Verzeichnis des Hosts. Das Dienstkonto aus dem Container muss dort schreiben können. Führe die Befehle mit demselben Compose-Projekt wie der Dienst aus. Wenn du den Projektnamen mit `-p` gesetzt hast, gib ihn weiter an.

```sh
docker compose run --rm --no-deps -v /geschuetzt/crew-export:/export crew bun run people export mira@example.test /export/mira
```

Prüfe nach erfolgreichem Abschluss `profil.json` und die dort aufgeführten PDF-Dateien. Wenn der Prozess unterbrochen wurde, prüfe und bereinige mögliche Teildateien im Zielordner eigenständig. Schütze den Export bei Übergabe und Aufbewahrung. Bestimme als Betreiber auch, wie lange du die Exportkopie brauchst und wann du sie entfernst.

## Ein Profil bereinigen

Ermittle zuerst die Profil-ID mit `inspect` und prüfe sie für die vorgesehene Adresse. Bestätige beim Löschen Adresse und Profil-ID. Bei erneuter Registrierung derselben Adresse schützt die neue ID das neue Profil vor einem wiederholten Löschbefehl. Die Vorprüfung zeigt laufende und zukünftige bestätigte Einteilungen mit Schicht-ID und Zeitfenster an. Warte bei laufenden Schichten das Ende ab. Kläre künftige Schichten mit der Dispo und gib die Plätze erforderlichenfalls vor der Bereinigung frei. Starte Crew dazu bei Bedarf erneut und halte es vor Wiederholung des Befehls wieder an.

```sh
bun run people inspect mira@example.test
# Ausgabe im Beispiel: Profil-ID: 3
bun run people erase mira@example.test 3
# Alternativ in Compose nach docker compose stop crew
docker compose run --rm --no-deps crew bun run people inspect mira@example.test
docker compose run --rm --no-deps crew bun run people erase mira@example.test 3
```

Die Bereinigung entfernt das Poolprofil, Einladungen, Bewerbungen und Antworten, Einteilungen, Nachforderungen, Nachweise und Sitzungen aus dem aktiven Bestand. Für alte Schichten bleibt die Anzahl der eingeteilten Plätze erhalten. Prüfe bei einem späteren Restore, welche Bereinigungen du erneut ausführen musst, bevor der Dienst zugänglich wird. Führe dafür eine zugriffsgeschützte betriebliche Aufzeichnung mit angemessener eigener Aufbewahrung. Plane alte Sicherungen, Exportkopien und Dateisystem-Snapshots mit ein. [Sicherung und Wiederanlauf](sicherung.md)

Starte nach Abschluss den angehaltenen Dienst wieder. Unter Compose verwende `docker compose up -d crew` mit demselben Projektnamen.
