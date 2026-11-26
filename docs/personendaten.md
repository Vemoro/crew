# Poolprofile exportieren und bereinigen

Die Betreiber-CLI benötigt Zugriff auf den Crew-Datenbestand. Halte Crew für diese Arbeiten an und stelle sicher, dass `CREW_DB` bei einer nativen Installation auf die vorgesehene Datenbank zeigt. Verwende dieselbe Crew-Version wie der Dienst und prüfe die Zieladresse vor der Ausführung. Die Beispiele verwenden synthetische Adressen.

## Ein Profil exportieren

Wähle einen neuen Ordner innerhalb eines geschützten, bereits vorhandenen Verzeichnisses. Begrenze den Zugriff auf das übergeordnete Verzeichnis per Dateisystemberechtigung. Der Export enthält ein lesbares JSON-Profil und vorhandene PDF-Nachweise.

```sh
node people-admin.js export mira@example.test /geschuetzt/crew-export/mira
```

Bei Compose verwende nach `docker compose stop crew` ein zusätzliches Bind-Mount auf ein geschütztes Verzeichnis des Hosts. Das Dienstkonto aus dem Container muss dort schreiben können.

```sh
docker compose run --rm --no-deps -v /geschuetzt/crew-export:/export crew node people-admin.js export mira@example.test /export/mira
```

Prüfe nach erfolgreichem Abschluss `profil.json` und die dort aufgeführten PDF-Dateien. Wenn der Prozess unterbrochen wurde, prüfe und bereinige mögliche Teildateien im Zielordner eigenständig. Schütze den Export bei Übergabe und Aufbewahrung. Bestimme als Betreiber auch, wie lange du die Exportkopie brauchst und wann du sie entfernst.

## Ein Profil bereinigen

Wiederhole die Adresse zur Bestätigung. Die Vorprüfung zeigt laufende und zukünftige bestätigte Einteilungen mit Schicht-ID und Zeitfenster an. Warte bei laufenden Schichten das Ende ab. Kläre künftige Schichten mit der Dispo und gib die Plätze erforderlichenfalls vor der Bereinigung frei. Starte Crew dazu bei Bedarf erneut und halte es vor Wiederholung des Befehls wieder an.

```sh
node people-admin.js erase mira@example.test mira@example.test
# Alternativ in Compose nach docker compose stop crew
docker compose run --rm --no-deps crew node people-admin.js erase mira@example.test mira@example.test
```

Die Bereinigung entfernt das Poolprofil, Einladungen, Bewerbungen und Antworten, Einteilungen, Nachforderungen, Nachweise und Sitzungen aus dem aktiven Bestand. Für alte Schichten bleibt die Anzahl der eingeteilten Plätze erhalten. Prüfe bei einem späteren Restore, welche Bereinigungen du erneut ausführen musst, bevor der Dienst zugänglich wird. Führe dafür eine zugriffsgeschützte betriebliche Aufzeichnung mit angemessener eigener Aufbewahrung. Plane alte Sicherungen, Exportkopien und Dateisystem-Snapshots mit ein. [Sicherung und Wiederanlauf](sicherung.md)
