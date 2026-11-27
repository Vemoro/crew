# Einen Crew-Release-Kandidaten prüfen

Halte Commit, Laufzeitversion, isolierte Prüfstände und Datum fest. Verknüpfe die CI und die praktische Abnahme für denselben Stand. Kennzeichne ausgelassene Schritte mit Grund. Verwende synthetische Personen, Einsätze und Nachweise.

| Prüfung | Erwartetes Ergebnis |
| --- | --- |
| Erstinstallation | In einem frischen Checkout starten, ein Administrationskonto anlegen und die Anmeldung prüfen. Die Probe mit dem vorgesehenen Laufzeitimage wiederholen. |
| Kernablauf | Bewerbung, Aufnahme, offener und eingeladener Einsatz, verbindliche Einteilung und Rückgabe eines Platzes sind mit synthetischen Daten nachvollziehbar. Das Personalportal trennt Anfrage, Einteilung und erwartete Vergütung. |
| Rechte und Wiederholung | Fremde Personaldaten und an Einladungen gebundene Einsätze bleiben beschränkt. Gleichzeitige Zusagen führen weder zu Doppelbelegung noch zu Überbuchung. |
| Anbindungen | Für ausgelieferte Anbindungen Schnittstellenversion, Rechte, Wiederholbarkeit und Verhalten bei Störungen mit autorisierten Testdaten prüfen. |
| Update und Wiederanlauf | SQLite-Schema-6-Import und PostgreSQL-Restore mit synthetischem Bestand erproben. Prüfe Passwörter, Sitzungswiderruf, Rollen, IDs und PDF-Inhalte. |
| Codegröße und Felder | `bun run lint` und `bun run check:fields` am Kandidaten ausführen. Datei- und Funktionsgrenzen, Raster und gemeinsame Felder bestehen die Prüfung. |
| Gestaltung und Bedienung | Browserläufe in Chromium und WebKit am Kandidaten ausführen. Halte die Axe-Ergebnisse in Chromium sowie die Prüfung von Tastatur, Fokus, Fehlerkorrektur, Dialogen, Hell und Dunkel und schmalen Touch-Ansichten fest. Vergleiche geänderte Ansichten mit dem dokumentierten Ausgangsstand. |
| Öffentliche Auslieferung | Git-Historie, Issues, PRs, Beispiele, Auslieferungsdateien und Prüfnachweise auf veröffentlichbare Inhalte kontrollieren. Lizenz und zugehörigen Quellstand prüfen. |
| Freigabe | Abnahme am Kandidatenstand dokumentieren. Merge, Release 0.1.0.0 und öffentliche Sichtbarkeit erfordern die Freigabe der Maintainer. |

[Entwicklung](entwicklung.md#änderungen-prüfen) · [Quellpaket](quellpaket.md) · [Versionshinweise](../CHANGELOG.md)
