# Quellpaket für Crew 0.1.0.0

Die öffentliche Versionsnummer lautet 0.1.0.0 und steht als `crewVersion` in `package.json`. Der vorgesehene Tag lautet `v0.1.0.0`. Die interne npm-Version verwendet SemVer und lautet `0.1.0`. Für Crew wird kein npm-Paket veröffentlicht. Das Quellpaket beschreibt einen Git-Commit vollständig und enthält die [Lizenz](../LICENSE), [Installation](installation.md) und [Versionshinweise](../CHANGELOG.md).

## Vorbereitung im privaten Repository

Der manuell gestartete Workflow **Privates Quellpaket prüfen** baut auf dem gewählten Commit von `main` ein Archiv und prüft dessen SHA-256. Er startet Crew aus dem entpackten Inhalt und prüft die Kontoanlage und Anmeldung mit synthetischen Angaben. Das private Workflow-Artefakt enthält das Archiv und `SHA256SUMS`.

In einem Checkout lässt sich das Paket auch mit Python 3.11 oder neuer erzeugen. Ersetze den Parameter `<vollständige-commit-id>` durch den Kandidatencommit.

```sh
python3 scripts/package-release-source.py <vollständige-commit-id> build/release
```

Im ausgegebenen Paketverzeichnis kontrollierst du die Prüfsumme mit `sha256sum --check SHA256SUMS`. Unter PowerShell vergleichst du `Get-FileHash -Algorithm SHA256` für das Archiv mit dem ersten Feld der Datei. Entpacke danach das geprüfte Archiv und folge der [Installation](installation.md). Die Laufzeit benötigt Node.js 24 ab 24.14 oder Docker Compose mit dem im Paket angegebenen Basisimage.

Der Packprozess übernimmt Dateien aus dem gewählten Git-Commit und vergleicht archivierte Dateien mit ihren Git-Blobs. Er basiert auf dem AGPL-3.0-only-Werkzeug aus Desk. [Desk-Quellpaketierung](https://github.com/Vemoro/desk/blob/00d01308b16c4d7d975f7c2224b1e213a6697d5e/scripts/package-release-source.py)

## Prüfung vor der Veröffentlichung

- Erfasse den Commit, das Archiv, seine Prüfsumme und den Lauf mit der Installationsprobe im Kandidatenprotokoll.
- Prüfe die für Besucher künftig lesbare Historie einschließlich Autorenmetadaten, Branches, Issues, PRs und verlinkten Berichten. Suche nach Zugangsdaten, personenbezogenen Angaben und internen Infrastrukturdetails. Prüfe auch die geplanten Auslieferungsdateien und Testartefakte. Verwende synthetische Beispiele.
- Prüfe die Versionshinweise, die Lizenzangaben für Crew und den enthaltenen Quellstand. Behandle sensible Befunde über den [vertraulichen Meldeweg](../SECURITY.md).
- Markiere im [Abnahmeprotokoll](release-abnahme.md) getrennt den geprüften Kandidaten und den späteren Freigabeentscheid. Bis dahin bleiben Repository und Vorbereitung privat.
