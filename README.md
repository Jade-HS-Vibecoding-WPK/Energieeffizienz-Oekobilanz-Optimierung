# Energieeffizienz-Ökobilanz-Optimierung
Ein bestehendes Projekt, egal ob bereits fertiggestellt oder noch in der Entwurfsphase, analysieren und Anpassungs-bzw. Optimierungsvorschläge für Bauweise sowie Materialwahl herausgeben, um eine höhere Energieeffizienz und bessere Ökobilanz zu erzielen.

## Web-App „Ökobilanz-Check“

**Online öffnen:** https://claude.ai/artifact/YChJDwMuERSuFfqSoLoAUg
(privat – nur für Personen sichtbar, mit denen der Link über „Teilen“ geteilt wurde)

### So funktioniert's
1. **Projekt & Pläne:** Pläne (JPG, PNG, PDF) und/oder ein 3D-/BIM-Modell (IFC, OBJ, glTF, GLB) hochladen, Projektangaben und Standort (ganz Europa) wählen.
2. **Auslesen:** Die KI liest die Pläne; Modelle werden direkt ausgewertet (Flächen, Ausrichtung, Materialschichten, IFC-GUIDs).
3. **Werte prüfen:** Flächen, Bauteilaufbauten (Katalog oder eigene Schichten), Fenster, Technik und Klima kontrollieren.
4. **Ergebnis:** Effizienzklasse, Energiebilanz, Ökobilanz über 50 Jahre (A1–A3, B4, B6, C3–C4), Zielwerte (Passivhaus, NZEB, Level(s), RIBA 2030), Optimierungsvorschläge mit Kosten und Amortisation, Vorher/Nachher, Projekt-Chat, 3D-Auswertung.
5. **Varianten:** bis zu 3 Varianten vergleichen.

Export: PDF-Bericht (A4 mit Schriftfeld), Excel-Tabelle, Maßnahmenliste mit IFC-GUIDs, Projektdatei (.json).

> Überschlägige Abschätzung für Entwurf und Lehre – ersetzt keinen Energieausweis, keine Berechnung nach DIN V 18599 und keine Ökobilanz nach EN 15978.

### Dateien
```
app/
├── index.html    Seite und Gestaltung
├── main.js       Oberfläche (Schritte, Formulare, Ergebnis, Varianten)
├── calc.js       Rechenkern (Energie, Ökobilanz, Maßnahmen)
├── data.js       Baustoffe, Bauteilkatalog, Klima- und Länderdaten Europa, Zielwerte
├── i18n.js       Texte Deutsch / Englisch, Glossar
├── charts.js     Diagramme und Symbole
├── ai.js         KI-Anfragen (Plan lesen, Erklärungen, Chat)
├── ai-openrouter.js  KI über OpenRouter mit eigenem API-Key (lokale Version)
├── viewer.js     3D-/BIM-Import und -Ansicht (three.js, web-ifc)
├── export.js     PDF, Excel, Projektdatei
└── web-ifc.wasm  Baustein zum Lesen von IFC-Dateien (web-ifc 0.0.66, MPL-2.0)
```
### Lokal starten (mit eigener KI über OpenRouter)
1. Doppelklick auf **`App-lokal-starten.bat`** (oder im Ordner `app`: `python -m http.server 8765`) – der Browser öffnet http://localhost:8765.
2. In der App oben auf **„KI-Einstellungen“** klicken, OpenRouter-API-Key einfügen, „Verbindung testen“, „Speichern“.
3. Der Key wird nur im Browser gespeichert (nicht in Dateien, nicht auf GitHub).

Hinweis: Unter dem claude.ai-Link sind Verbindungen zu anderen Servern gesperrt – dort nutzt die App die eingebaute claude.ai-KI, OpenRouter funktioniert nur lokal.

Details zu Umfang und Rechenweg: siehe [PLAN.md](PLAN.md).
