---
name: crew-checks
description: Plant und führt Crew-Prüfungen gegen den vorgesehenen Git-Stand mit isolierten Datenbanken, freien Ports und nachvollziehbaren Ergebnissen aus.
---

# Crew-Prüfungen ausführen

Verwende die [Prüfregeln](../../../docs/entwicklung.md#prüfungen-und-dokumentation) und die Befehle des konkreten Zielstands. Lies `package.json` und die GitHub-Workflows, falls vorhanden. Ein reiner Doku-Stand verlangt Quellen, ausführbare Beispiele, relative Links und eine saubere Git-Änderung.

Verwende bei einem Anwendungsstand die in der Zielbasis festgelegte Laufzeit und die dort dokumentierten Befehle. Starte Integrationsprüfungen mit einem getrennten temporären Datenbestand. Browserprüfungen verwenden eine eigene Instanz auf einem freien lokalen Port und einen synthetischen Ausgangsbestand. Vergewissere dich vor dem Start, dass weder Produktionsdaten noch Zugangsdaten für Fremdintegrationen im Testprozess geladen werden.

Prüfe bei Quellcodeänderungen [Codegröße und CSS-Abstandsraster](../../../docs/entwicklung.md#codegröße-und-aufräumen) mit `bun run lint`. Bei Formularänderungen gehört `bun run check:fields` dazu. Die Anwendungs-CI verbindet diese Prüfungen mit den [Browserläufen](../../../docs/entwicklung.md#prüfungen-und-dokumentation).

Beende nach der Prüfung nur die eigens gestarteten Testdienste. Notiere Befehle, Stand, Resultate und Gründe für ausgelassene Prüfungen im PR.
