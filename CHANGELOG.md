# Änderungen in Crew

## 0.1.0.0

- Arbeitsgrundlage für Beiträge, Reviews und Veröffentlichung aus Desk übernommen.
- Personalpool, Einsatzschichten, Nachweise, Einladungen, Bewerbungen und verbindliche Besetzung ergänzt.
- Personalportal mit Aufgaben und erwarteter Schichtvergütung sowie einen eigenständigen Betrieb mit Docker Compose hinzugefügt.
- Kontozugang für Poolmitglieder, Sitzungswiderruf und betreibergeführte Passwortwiederherstellung ergänzt.
- Private Quellpaketierung mit SHA-256-Prüfsumme und Installationsprobe hinzugefügt.
- Externen HTTPS-Betrieb am Reverse Proxy und die Pause für neue Registrierungen eingerichtet.
- Getrennten Wiederanlauf mit Sitzungswiderruf für gesicherte Bestände geprobt.
- Einsatzkorrekturen, Schichtrücknahme und Platzfreigabe für die Dispo ergänzt.
- Nachforderungen und Widerruf von Nachweisprüfungen ergänzt. Bestehende Zusagen mit Handlungsbedarf bleiben für die Dispo sichtbar.
- Betreiber-Export und gezielte Bereinigung von Poolprofilen ergänzt. Historische Besetzungssummen bleiben erhalten.
- Browserprüfungen für Chromium und WebKit mit PDF-Ablauf und schmalen Touch-Ansichten erweitert.
- Orange Crew-Marke, App-Symbole und installierbare Web-App ergänzt. Bei fehlender Verbindung zeigt Crew einen Hinweis.
- Auf TypeScript, Bun, React und TanStack Start umgestellt. PostgreSQL und Better Auth übernehmen Fachdaten und Anmeldung. Der Import aus SQLite übernimmt bestehende Konten, Planungsdaten und PDF-Nachweise.
