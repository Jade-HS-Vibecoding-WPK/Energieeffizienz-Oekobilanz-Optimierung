# Greenprint – Energieeffizienz und Ökobilanz für deine Projektplanung

**Greenprint** ist eine Web-App für Architekturstudierende. Du lädst Pläne oder ein 3D-/BIM-Modell eines Gebäudes hoch und bekommst eine **Energie- und Ökobilanz-Auswertung** mit konkreten **Optimierungsvorschlägen** für Bauweise und Materialwahl. Das Gebäude kann schon gebaut sein oder noch im Entwurf stecken.

Entstanden im Wahlpflichtkurs *Vibecoding / KI-Anwendungen* (5. Semester Architektur, Jade Hochschule), 2026.

## ▶ Live-Demo

**https://jade-hs-vibecoding-wpk.github.io/Energieeffizienz-Oekobilanz-Optimierung/**

Die App läuft direkt im Browser. Du musst nichts installieren, und ein Konto brauchst du auch nicht. Rechnen, 3D-Modell, PDF-Bericht und „Meine Projekte“ funktionieren sofort. Nur die KI-Funktionen brauchen einen eigenen, kostenlosen Schlüssel (siehe [KI einrichten](#ki-einrichten-optional)).

---

## Was die App kann

| Bereich | Funktionen |
|---|---|
| **Eingabe** | Pläne als JPG, PNG oder PDF (Grundriss, Schnitt, Ansicht, Lageplan, Detail) **und/oder** ein 3D-/BIM-Modell (IFC, OBJ, glTF, GLB). Dazu Projektangaben und ein Standort in ganz Europa. |
| **Auslesen** | Die KI liest Pläne: Flächen, Fenster, Bauweise, Schichtaufbauten. IFC-Modelle wertet die App direkt aus: Flächen, Ausrichtung, innen/außen, Materialschichten und IFC-GUIDs. Schichtweise modellierte Wände fasst sie zu einer Außenwand zusammen. |
| **Werte prüfen** | Alle Bauteile in einer Tabelle. Beim Überfahren der Aufbau-Liste zeigt ein Infofenster Schichten, Dicken, λ-Werte und U-Wert. Dazu kommen eigene Schichtaufbauten, Fenster, Technik und Klimadaten. |
| **Ergebnis** | Effizienzklasse (A+ bis H), Energiebilanz, Ökobilanz über 50 Jahre (Module A1–A3, B4, B6, C3–C4), Kreislauffähigkeit, gespeicherter Kohlenstoff und Zielwerte (Passivhaus, NZEB, Level(s), RIBA 2030). Außerdem sommerlicher Wärmeschutz, Tageslicht, PV und Regenwasser. |
| **Optimierungsvorschläge** | Maßnahmen zum Anhaken, jeweils mit Einsparung, Kosten, Amortisation und € pro t CO₂. Dazu ein Vorher/Nachher-Vergleich und auf Wunsch KI-Erklärungen. |
| **Varianten** | Bis zu 3 Varianten nebeneinander vergleichen. |
| **3D-Ansicht** | Das Modell wird farbig nach Wärmeverlust, CO₂, Kreislauf oder Sonne eingefärbt. Bauteile lassen sich anklicken und ändern. Werkzeuge: **Sprengen** und **Schnitt** (waagerecht, längs, quer) mit Schieberegler sowie **Dachaufsicht**. |
| **Projekt-Chat** | Reiter am rechten Rand: Fragen zum eigenen Projekt an die KI, die die aktuellen Werte kennt. |
| **Meine Projekte** | Projekte werden automatisch im Browser gespeichert und lassen sich wieder öffnen, kopieren oder löschen. Ohne Konto, nur auf dem eigenen Gerät. |
| **Export** | **PDF-Bericht**: A4 mit Deckblatt, Inhaltsverzeichnis, Kapiteln und Fußzeile. Bei Modellen zusätzlich eine **Maßnahmenliste mit IFC-GUIDs** als Excel-Datei, mit der man jede Änderung im BIM-Programm wiederfindet. |
| **Sonstiges** | Deutsch/Englisch, Glossar mit Erklärungen zu jedem Fachbegriff, Intro-Animation, Fußabdruck-Mauszeiger (umschaltbar). Läuft auch auf Tablet und Handy. |

## So benutzt du die App

1. **Projekt & Pläne:** Pläne und/oder ein 3D-Modell hochladen, Gebäudetyp, Neubau oder Bestand und Standort wählen.
2. **Auslesen:** Die App bzw. die KI liest Pläne und Modell aus.
3. **Werte prüfen:** Flächen und Bauteilaufbauten kontrollieren und bei Bedarf anpassen.
4. **Ergebnis:** Kennzahlen, Diagramme und Zielwerte ansehen. Hier lässt sich auch der PDF-Bericht erstellen.
5. **Optimierungsvorschläge:** Maßnahmen anhaken und die Wirkung im Vorher/Nachher-Vergleich sehen.
6. **Varianten:** Varianten anlegen und vergleichen.

Ohne eigene Dateien kannst du die App auch mit dem eingebauten **Beispielprojekt** ausprobieren.

## KI einrichten (optional)

Für Planlesen, Erklärungen und Chat nutzt die App **kostenlose KI-Modelle über [OpenRouter](https://openrouter.ai)**.

1. Bei OpenRouter ein kostenloses Konto anlegen und einen API-Key erstellen.
2. In der App unten in der Fußzeile auf die **KI-Statuszeile** klicken.
3. Key einfügen, auf „Verbindung testen“ und dann auf „Speichern“ klicken.

Der Key bleibt **nur in deinem Browser**. Er landet nicht in Dateien und nicht auf GitHub.

## Wichtiger Hinweis

> Greenprint ist eine **überschlägige Abschätzung für Entwurf und Lehre**. Die App ersetzt keinen Energieausweis, keine Berechnung nach DIN V 18599 und keine Ökobilanz nach EN 15978. KI-gestützte Inhalte (Planlesen, Erläuterungen, Fazit) sind ohne Gewähr und sollten fachlich geprüft werden.

**Rechenweg in Kürze:** Heizwärmebedarf nach dem vereinfachten Heizperiodenverfahren (Transmission, Lüftung, solare und interne Gewinne). Die Ökobilanz rechnet mit Materialkennwerten in Anlehnung an ÖKOBAUDAT und EPD-Durchschnittswerte über einen Betrachtungszeitraum von 50 Jahren. Klima- und Länderdaten decken ganz Europa ab. Alle Annahmen und Quellen stehen in der App unter „Annahmen & Quellen“ und am Ende des PDF-Berichts.

**Datenschutz:** Projekte werden nur im eigenen Browser gespeichert. Pläne werden nur zur Auswertung an die KI geschickt, wenn du sie dafür freigibst.

## Technik

Die App ist eine reine **Browser-App** aus HTML, CSS und JavaScript. Sie hat keinen eigenen Server und läuft über **GitHub Pages**.

```
├── index.html            Startseite (leitet zur App weiter)
├── App-lokal-starten.bat startet die App lokal (localhost:8765)
├── PLAN.md               ausführlicher Umsetzungsplan mit allen Entscheidungen
└── app/
    ├── index.html        Seite, Gestaltung, Intro, Mauszeiger
    ├── main.js           Oberfläche: Schritte, Formulare, Ergebnis, Chat, Meine Projekte
    ├── calc.js           Rechenkern: Energie, Ökobilanz, Maßnahmen
    ├── data.js           Baustoffe, Bauteilkatalog, Klima- und Länderdaten, Zielwerte
    ├── i18n.js           Texte Deutsch/Englisch, Glossar
    ├── charts.js         Diagramme und Symbole
    ├── ai.js             KI-Anfragen (Plan lesen, Erklärungen, Chat)
    ├── ai-openrouter.js  KI über OpenRouter mit eigenem Key
    ├── viewer.js         3D-/BIM-Import und -Ansicht, Sprengen, Schnitt
    ├── export.js         PDF-Bericht, Maßnahmenliste
    └── web-ifc.wasm      Baustein zum Lesen von IFC-Dateien
```

**Verwendete Bibliotheken** (aus dem Internet geladen): Tailwind CSS, three.js, web-ifc, pdf.js, jsPDF, SheetJS und die Schrift Nunito.

### Lokal starten

1. Doppelklick auf **`App-lokal-starten.bat`**, oder im Ordner `app` diesen Befehl ausführen: `python -m http.server 8765`
2. Im Browser **http://localhost:8765** öffnen.

## Mitwirkende

- **Caro255**: Idee, Konzept, Gestaltung, Tests
- Umsetzung mit Unterstützung von **Claude** (Anthropic) im Rahmen des Vibecoding-Kurses

## Lizenz

[MIT-Lizenz](LICENSE) · © 2026 Vibecoding KI-Werkstatt · Jade Hochschule
Der Baustein `web-ifc.wasm` stammt aus [web-ifc](https://github.com/ThatOpen/engine_web-ifc) (MPL-2.0).
