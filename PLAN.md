# Umsetzungsplan: Web-App „Greenprint“

Stand: 18.11.2026 (zuletzt aktualisiert) · Status: **Umgesetzt** – App unter https://claude.ai/artifact/YChJDwMuERSuFfqSoLoAUg, Code in `app/`

Dieser Plan beschreibt in einfachen Worten, was die Web-App können soll, wie sie aussieht, wie sie rechnet und in welchen Schritten sie gebaut wird. Programmiert wird erst nach der Freigabe.

---

## 1. Ziel

Du lädst einen oder mehrere **Pläne** oder ein **3D-/BIM-Modell** (IFC, OBJ, glTF) eines Architekturprojekts hoch. Das Projekt kann fertig gebaut sein oder noch im Entwurf stecken. Bei einem Modell siehst du die Auswertung farbig direkt am 3D-Modell und kannst dort auch Bauteile ändern. Die App liefert:

1. eine **Analyse der Ökobilanz**: CO₂, nicht erneuerbare Primärenergie, gespeicherter Kohlenstoff und Kreislauffähigkeit
2. eine **Analyse der Energieeffizienz**: Heiz- und Kühlbedarf, Effizienzklasse A+ bis H, sommerlicher Wärmeschutz
3. **Optimierungsvorschläge** für Entwurf, Konstruktion und Material, Gebäudehülle und Technik, jeweils mit Wirkung, Kosten und Amortisation
4. einen **Vorher/Nachher-Vergleich** und einen **Variantenvergleich** (bis zu 3 Varianten)
5. einen Vergleich mit **Zielwerten**: Passivhaus, Niedrigstenergie (EU), EU Level(s) und RIBA 2030
6. einen **Projekt-Chat**, in dem du der KI Rückfragen zu deinem Projekt stellst
7. einen **PDF-Bericht** (mit Deckblatt und Inhaltsverzeichnis) und eine **Projektdatei** zum Speichern
8. bei 3D-/BIM-Modellen eine **Maßnahmenliste mit Bauteil-Kennungen (IFC-GUIDs)**, mit der du jede Änderung in deinem BIM-Programm wiederfindest

---

## 2. Alle Entscheidungen im Überblick

### 2.1 Grundlagen

| Thema | Entscheidung |
|---|---|
| Wie werden die Pläne gelesen? | **KI + Formular**: Die KI liest die Pläne und schlägt Werte vor, du prüfst und korrigierst sie, dann rechnet die App. |
| KI-Stufe | **Stärkste Stufe** (am genauesten, eine Analyse dauert ca. 1 bis 3 Minuten) |
| Wo läuft die App? | **Online-Link auf claude.ai** (privat, die KI läuft über dein Claude-Konto, kein API-Schlüssel nötig). Eine Kopie liegt im lokalen Ordner. |
| GitHub | **Nur auf ausdrücklichen Wunsch.** Bisher hochgeladen: PLAN.md (16.11.2026) und die App mit den Commits „Herkunft entfernt“, „Titel geändert“, „Curser angepasst“, „Curser Reiter“ (17.11.2026) und „PDF Dokument angepasst“ (18.11.2026). |
| KI-Anbieter | **claude.ai (eingebaut)** in der Online-Version oder **OpenRouter mit eigenem API-Key** in der lokalen Version (App-lokal-starten.bat). Genutzt werden die **kostenlosen OpenRouter-Modelle** (Gemma 4, mit Ausweichmodellen bei Überlastung). Der Key liegt nur im Browser. Auf claude.ai sind Verbindungen zu OpenRouter gesperrt. |
| Sprache | **Deutsch + Englisch**, umschaltbar |
| Zielgruppe | **Studierende**: Fachbegriffe werden erklärt (Fragezeichen-Symbol und Glossar), die Rechenwege sind fürs Lernen aufbereitet. |

### 2.2 Gestaltung

| Thema | Entscheidung |
|---|---|
| Name | **Greenprint** (bis 17.11.2026 „Ökobilanz-Check“), Unterzeile „Energieeffizienz und Ökobilanz für deine Projektplanung“. Kopfzeile: Logo links, Titel oben, darunter in einer Zeile Unterzeile, Projekt/Variante und Knöpfe DE/EN, „Projekt speichern“ und „+ Neues Projekt“ |
| Akzentfarbe | **Waldgrün** |
| Schrift | **Nunito** für die ganze App (Überschriften, Texte, Zahlen) |
| Hintergrund | **Grauer Grund** (leicht grünlich abgestimmt), Kacheln heller darauf |
| Aufbau | **Schritt-für-Schritt-Assistent** mit Fortschrittsleiste in Pillenform, 6 Reiter: ① Projekt & Pläne, ② Auslesen, ③ Werte prüfen, ④ Ergebnis, ⑤ Optimierungsvorschläge (mit Vorher/Nachher), ⑥ Varianten. Zurückspringen jederzeit möglich. „Standort im europäischen Vergleich“ und „Annahmen & Quellen“ stehen nicht mehr auf der Ergebnisseite (Quellen über die Fußzeile). |
| Ergebnisseite | **Bento-Grid:** Kacheln in unterschiedlichen Größen auf einem 12-Spalten-Raster |
| Hingucker | Große waldgrüne Kachel mit der **Endenergie als große Zahl** und der **Effizienzklasse** |
| Formensprache | **Große Rundungen** (Kacheln 28 px, Karten 20 px, Knöpfe pillenförmig), weiche Flächen statt Linien |
| Gestaltungswerkzeug | **Tailwind CSS** für Raster, Abstände und Schrift |
| Hell/Dunkel | **Immer hell**, unabhängig von der Einstellung des Computers (geändert am 17.11.2026, vorher automatisch hell/dunkel) |
| Effizienzskala | **Klassisch bunt** (Grün → Gelb → Rot), wie auf dem Energieausweis |
| Symbole | **Feine Liniensymbole** im Stil einer Planzeichnung (Wand, Dach, Fenster, Sonne, Heizung …) |
| PDF-Bericht | **A4 hoch, mit Deckblatt** (Intro-Zeichnung, Name, Projektangaben inkl. Verfasser/in, Hochschule, Datum), **Inhaltsverzeichnis**, jedes Hauptthema auf neuer Seite und **Fußzeile** mit Hinweis, KI-Hinweis und Seitenzahl (nicht auf dem Deckblatt). Das frühere Schriftfeld entfällt. |
| Intro | **„Greenprint wird gezeichnet“**: Ein Haus entsteht als grüner Bauplan, füllt sich, Blatt-Logo, Schriftzug und Unterzeile erscheinen (ca. 5 s, weicher Übergang). Einmal pro Browser-Tab, überspringbar. |
| Mauszeiger | **Fußabdruck**: weiß mit waldgrünem Rand, beim Klicken waldgrün gefüllt, feste Ausrichtung. Beim Bewegen entsteht alle 50 Bildpunkte eine waldgrüne **Fußspur** (abwechselnd links/rechts, in Laufrichtung gedreht, max. 5, verblassend). In Textfeldern bleibt der Text-Cursor. Ein kleiner Reiter mit Zeiger-Symbol direkt unter dem Chat-Reiter schaltet auf den normalen Mauszeiger um (und zurück); die Wahl wird im Browser gemerkt. |
| Ladesymbol | runder Ring in Salbei mit waldgrünem Bogen, abgerundeter Fortschrittsbalken |

### 2.3 Inhalt

| Thema | Entscheidung |
|---|---|
| Standorte | **Alle Länder Europas**, große Länder mit mehreren Klimaregionen |
| Gebäudetypen | **Wohnen, Büro & Verwaltung, Bildung & Kultur, Gewerbe & Sonstiges** |
| Planarten | **Grundrisse, Schnitte, Ansichten, Lageplan, Details & Wandaufbauten** (JPG, PNG, PDF) |
| Bauteile | **Katalog mit ca. 40 typischen Aufbauten + eigene Schichten** (Material und Dicke frei wählbar) |
| Bezugsfläche | **Energie pro m² NRF/NGF** (wie beim Energieausweis), **CO₂ zusätzlich pro m² BGF** (wie bei Level(s)/RIBA) |
| Betrachtungszeitraum | **50 Jahre** |
| Bestandsgebäude | **Beides zeigen**: Das CO₂ im Bestand wird angezeigt, optimiert werden nur neue Baustoffe und der Betrieb. Zusätzlich gibt es den Vergleich Erhalt gegen Neubau. |
| Kennwerte | **CO₂ (Treibhauspotenzial)**, **Primärenergie nicht erneuerbar**, **gespeicherter Kohlenstoff**, **Kreislauffähigkeit** |
| Weitere Aspekte | **Sommerlicher Wärmeschutz, Photovoltaik/Solarthermie, Begrünung & Wasser, Tageslicht & Komfort** |
| Zielwerte | **Passivhaus / Niedrigstenergie (EU)**, **EU Level(s) / RIBA 2030** |
| Kosten | **Kosten in €/m² + Amortisation** (Jahre, bis sich eine Maßnahme bezahlt macht) |
| Vorschläge | **Sortiert nach Wirkung, gruppiert** in Entwurf, Konstruktion & Material, Gebäudehülle und Technik; umschaltbar auf Sortierung nach Aufwand |

### 2.4 Nutzung

| Thema | Entscheidung |
|---|---|
| Varianten | **Bis zu 3 Varianten** (A, B, C) nebeneinander |
| Speichern | **Projektdatei**: Alle Werte und Varianten werden als kleine Datei auf deinem Rechner gespeichert, ohne die Pläne. Später kannst du sie wieder öffnen. |
| Export | **PDF-Bericht** (die Excel-Tabelle wurde am 18.11.2026 entfernt) |
| Projekt-Chat | **Ja**, als **Reiter am rechten Bildschirmrand** auf jeder Seite (am Handy unten rechts). Ein Klick öffnet ein Chat-Fenster, die KI kennt die aktuellen Werte deines Projekts. |
| KI-Einstellungen | über die **KI-Statuszeile in der Fußzeile** (bzw. „KI einrichten“, wenn keine KI aktiv ist) |

### 2.5 3D- und BIM-Modelle

| Thema | Entscheidung |
|---|---|
| Wann | **Gleich von Anfang an**, gleichberechtigt neben dem Plan-Upload |
| Formate | **IFC** (BIM, z. B. aus Revit, Archicad, Vectorworks, Allplan) und **OBJ / glTF** (3D-Geometrie, z. B. aus SketchUp, Rhino, Blender) |
| Am Modell | **farbige Auswertung**, **Bauteile anklicken & ändern**, **Vorschläge am Modell**, **einfache Varianten** (Drehen, Fensteranteil, Verschattung) |
| Zurück ins BIM-Programm | **Maßnahmenliste mit GUIDs** als Excel-Tabelle |
| Nicht möglich | Originaldateien (.rvt, .pln, .skp, .3dm) direkt öffnen (bitte als IFC bzw. OBJ/glTF exportieren); Geometrie in der App umzeichnen; eine geänderte IFC-Datei zurückschreiben |
| Beispielprojekt | **Mehrfamilienhaus, Neubau** (4 Geschosse, Massivbau, Deutschland), klar als Beispiel gekennzeichnet |

---

## 3. So benutzt du die App

```
 ① Projekt & Pläne  →  ② KI liest die Pläne  →  ③ Werte prüfen  →  ④ Ergebnis & Vorschläge  →  ⑤ Varianten
```

Oben zeigt eine Fortschrittsleiste den aktuellen Schritt. Mit einem Klick auf einen Schritt springst du zurück. Oben rechts gibt es die Knöpfe **DE/EN**, **Projekt speichern** und **+ Neues Projekt**. („Projekt öffnen“ wurde am 18.11.2026 entfernt.)

### ① Projekt & Pläne
- **Zwei Wege:** „Pläne hochladen“ oder „3D-/BIM-Modell hochladen“. Beides lässt sich kombinieren, z. B. ein IFC-Modell plus ein Detailplan mit Wandaufbau.
- **Modell hochladen:** eine IFC-, OBJ-, glTF- oder GLB-Datei. Bei OBJ/glTF fragt die App nach der Einheit (m, cm oder mm) und nach der Nordrichtung, falls diese nicht im Modell steht.
- **Pläne hochladen:** Dateien ins Feld ziehen oder auswählen (JPG, PNG, PDF, auch mehrere). PDF-Seiten werden im Browser automatisch in Bilder umgewandelt. Für jede Datei wählst du die Planart: Grundriss, Schnitt, Ansicht, Lageplan oder Detail.
- **Projektangaben:**
  - Projektname
  - **Neubau / Entwurf** oder **Bestand** (mit geplanter Sanierung bzw. geplantem Anbau oder ohne)
  - Gebäudetyp aus den vier Gruppen, mit Untertyp (z. B. Wohnen → Mehrfamilienhaus)
  - **Standort:** Land, danach Klimaregion bzw. nächste Großstadt
  - Baujahr bzw. geplantes Fertigstellungsjahr, Heizungsart (falls bekannt), kurze Beschreibung
- **Ohne Pläne:** Mit „Ohne Pläne weiter“ springst du direkt zum Formular in Schritt ③.

### ② Pläne bzw. Modell auslesen
- **Bei einem Modell** liest die App die Daten selbst aus, ohne KI-Schätzung (Details in Abschnitt 6a). Die KI hilft nur, wenn etwas fehlt: Sie ordnet unklare Materialnamen wie „Wand_Typ_07“ einem Katalogaufbau zu, und das kann man prüfen.
- **Bei Plänen** wertet die KI Maßstab, Bemaßung, Raumbezeichnungen, Schnitte und Details aus und schätzt:
  - BGF, NRF/NGF, Geschosszahl, Geschosshöhen, Volumen
  - die Flächen der Gebäudehülle: Außenwand, Dach, Bodenplatte bzw. Kellerdecke, Fenster (je Himmelsrichtung, mit der Nordrichtung aus dem Lageplan)
  - die Bauweise und die Bauteilaufbauten. Aus Detailplänen liest die KI Schichten mit Material und Dicke.
  - Hinweise für die weiteren Aspekte: Verschattung, Dachform (PV-Eignung), Freiflächen (Begrünung), Raumtiefen (Tageslicht)
- Zu jedem Wert gibt die KI eine **Sicherheit** (hoch / mittel / niedrig) und eine **Herkunft** an („aus Bemaßung abgelesen“, „aus Maßstab gemessen“ oder „geschätzt“).
- Während die KI arbeitet, zeigt die App einen Fortschrittshinweis und einen **Stopp**-Knopf.
- Beim ersten Mal fragt claude.ai, ob die App die KI benutzen darf. Die Nutzung zählt zu deinem Claude-Kontingent.

### ③ Werte prüfen
- Alle Werte stehen in einem gegliederten Formular: Geometrie, Bauteile, Fenster, Technik, Klima. **Geschätzte Werte sind markiert**, und neben jedem Wert steht ein Fragezeichen mit einer Erklärung.
- **Bauteile:** Ein Klick auf das Feld „Aufbau“ öffnet die Liste aller Aufbauten. Fährst du mit der Maus über einen Eintrag, zeigt ein **Infofenster** daneben die Schichten (Material, Dicke, λ), die Gesamtdicke und den U-Wert. Du wählst einen Aufbau aus dem **Katalog** oder „**Eigene Schichten**“. Dort fügst du Schichten hinzu (Material aus einer Liste und Dicke in cm). Die App rechnet daraus sofort U-Wert, CO₂ und Kreislaufbewertung.
- **Bestand:** Bei jedem Bauteil gibt es ein Häkchen „Bestand“ oder „neu“.
- **Klimadaten** sind vom Standort vorausgefüllt und lassen sich überschreiben.
- **Bei einem Modell** steht neben dem Formular die 3D-Ansicht. Klickst du eine Zeile im Formular an, leuchten die zugehörigen Bauteile im Modell auf, und umgekehrt.

### ④ Ergebnis
- Kennzahlen, Diagramme, Zielwertvergleich und Rechenweg als Bento-Grid (Details in Abschnitt 7).
- Knöpfe oben rechts: **PDF-Bericht**, ggf. **Maßnahmenliste (GUIDs)**, **Variante anlegen**.

### ⑤ Optimierungsvorschläge
- Oben: **Vorher/Nachher** (Effizienzklasse, Anzahl Maßnahmen, Kosten) und **Wirkung der Maßnahmen** (drei Vergleichsdiagramme).
- Darunter alle Vorschläge zum Anhaken, nach Gruppe eingefärbt. Der Vergleich rechnet sofort neu.

**Projekt-Chat:** auf jeder Seite über den Reiter „Frag zu deinem Projekt“ am rechten Rand, z. B. „Was würde Lehm statt Kalksandstein bringen?“

### ⑥ Varianten vergleichen
- Mit „Variante anlegen“ kopierst du das aktuelle Projekt. Danach änderst du einzelne Werte oder lädst neue Pläne für die Variante hoch.
- Es gibt bis zu 3 Varianten (A, B, C) mit eigenen Namen, z. B. „A – Massivbau“ und „B – Holzhybrid“.
- Die Vergleichsansicht zeigt eine Tabelle und Diagramme nebeneinander, die beste Variante je Kennzahl ist hervorgehoben.

---

## 4. Wie die App rechnet

Wichtig vorab: Die App liefert eine **überschlägige Abschätzung für Entwurf und Lehre**. Sie ersetzt keinen Energieausweis, keine Berechnung nach DIN V 18599 oder nach nationalen Normen und keine vollständige Ökobilanz nach EN 15978. Alle Annahmen werden offen angezeigt.

### 4.1 Energiebedarf

Die App rechnet mit einem vereinfachten **Heizperiodenverfahren**, ergänzt um eine Kühlabschätzung:

1. **Wärmeverlust über die Hülle (Transmission):** Für jedes Bauteil wird *Fläche × U-Wert* gerechnet, dazu kommt ein Wärmebrückenzuschlag. Der U-Wert gibt an, wie viel Wärme durch 1 m² Bauteil verloren geht. Je kleiner er ist, desto besser.
2. **Wärmeverlust durch Lüftung:** Volumen × Luftwechsel, mit Wärmerückgewinnung, falls vorhanden.
3. **Wärmegewinne:** Sonne durch die Fenster (je Himmelsrichtung und Standort) und interne Wärme von Personen und Geräten (je nach Gebäudetyp).
4. **Heizwärmebedarf** = Verluste × Heizgradtage − nutzbare Gewinne, in kWh/m²a.
5. **Kühlbedarf:** Er wird aus Kühlgradtagen, Sonnengewinnen, Sonnenschutz und internen Lasten geschätzt.
6. **Warmwasser:** ein Pauschalwert je Gebäudetyp.
7. **Endenergie:** Heizen, Kühlen und Warmwasser, jeweils mit dem Aufwand der Anlage. Bei der Wärmepumpe wird z. B. durch ihre Jahresarbeitszahl geteilt.
8. **Photovoltaik:** Der mögliche Ertrag auf der Dachfläche (je Standort) wird angezeigt. Eine Eigennutzung wird mit einem Anteil gegengerechnet.
9. **Effizienzklasse A+ bis H:** Für alle Länder gilt dieselbe Skala, nämlich die Klassengrenzen des deutschen Energieausweises, angewendet auf die Endenergie. So sind Projekte vergleichbar. Die App weist darauf hin, dass andere Länder eigene Skalen haben.

### 4.2 Klimadaten für Europa

Für jeden Standort sind hinterlegt:

| Wert | Was er bedeutet | Beispiel |
|---|---|---|
| **Heizgradtage** | wie kalt und lang der Winter ist | Helsinki ca. 4.500 · Berlin ca. 3.000 · Lissabon ca. 900 |
| **Kühlgradtage** | wie heiß der Sommer ist | Berlin ca. 50 · Athen ca. 900 |
| **Sonneneinstrahlung** | Sonnenenergie pro Jahr auf Nord-, Ost-, Süd-, Westfassade und das Dach | Stockholm deutlich weniger als Sevilla |
| **Strom-CO₂-Faktor** | wie „sauber“ der Strom im Land ist | Norwegen sehr niedrig · Polen hoch |
| **Primärenergiefaktor Strom** | wie viel fossile Energie pro kWh Strom verbraucht wird | je Land |

- **Länder:** alle EU-Staaten, dazu Norwegen, Island, Schweiz, Liechtenstein, Vereinigtes Königreich, die Westbalkanstaaten, Moldau, Ukraine, Türkei und die Kleinstaaten.
- **Regionen:** Große bzw. klimatisch gemischte Länder bekommen 2 bis 5 Regionen, etwa Frankreich, Spanien, Italien, Norwegen, Schweden, Finnland, Türkei, Vereinigtes Königreich, Deutschland und Griechenland. Insgesamt sind es ca. 80 bis 100 Standorte.
- **Quellen:** Gradtage nach Eurostat, Sonneneinstrahlung nach PVGIS (EU-Kommission), Stromfaktoren nach der Europäischen Umweltagentur (EEA). Es sind gerundete Mittelwerte.

### 4.3 Ökobilanz

**Lebensphasen** (Kürzel aus der Norm EN 15978):

| Phase | Was es ist | In der App |
|---|---|---|
| A1–A3 | Herstellung der Baustoffe | ja |
| B4 | Austausch von Bauteilen in 50 Jahren (z. B. Fenster nach ca. 30 Jahren) | ja, über typische Nutzungsdauern |
| B6 | Energie im Betrieb | ja |
| C3–C4 | Entsorgung am Ende | ja, mit Pauschalwerten je Material |
| A4–A5, B1–B3, C1–C2 | Transport, Baustelle, Wartung u. a. | nein, wird als Hinweis genannt |

**Kennwerte:**

| Kennwert | Was er bedeutet | Einheit |
|---|---|---|
| **CO₂ (Treibhauspotenzial, GWP)** | Beitrag zum Klimawandel | kg CO₂e gesamt, pro m² BGF, pro m² NRF und Jahr |
| **Primärenergie nicht erneuerbar (PENRT)** | verbrauchte fossile und nukleare Energie | kWh gesamt und pro m² NRF und Jahr |
| **Gespeicherter Kohlenstoff** | CO₂, das in Holz, Stroh, Hanf, Zellulose usw. gebunden ist. Er wird getrennt ausgewiesen und nicht verrechnet. | kg CO₂e |
| **Kreislauffähigkeit** | wie gut sich die Baustoffe wiederverwenden oder recyceln lassen | Punktwert 0–100 und eine Note A–E |

**Wie gerechnet wird:**
- **Baustoffe:** Für jedes Bauteil wird *Fläche × Kennwert des Aufbaus* gerechnet. Bei eigenen Schichten gilt: *Fläche × Dicke × Dichte × Kennwert je kg*. Die Kennwerte stammen aus einer eingebauten Materialliste mit ca. 40 Materialien. Sie orientieren sich an europäischen Durchschnittswerten (z. B. ÖKOBAUDAT bzw. EPDs) und sind als Näherung gekennzeichnet.
- **Betrieb:** Endenergie × CO₂- bzw. Primärenergiefaktor des Energieträgers (beim Strom je Land) × 50 Jahre.
- **Kreislauffähigkeit:** Jedes Material bekommt eine Bewertung für Wiederverwendbarkeit, Recyclingfähigkeit und Trennbarkeit der Verbindung (geschraubt, gesteckt, geklebt oder verputzt). Die App bildet daraus einen nach Masse gewichteten Mittelwert. Die Methode ist angelehnt an gängige Ansätze wie den Urban Mining Index, aber stark vereinfacht.

### 4.4 Bestandsgebäude

- **„Gebundenes CO₂ im Bestand“** wird angezeigt (grau). Es zählt nicht zur optimierten Bilanz.
- **Gezählt und optimiert** werden nur neue Baustoffe (Sanierung, Anbau) und der Betrieb über 50 Jahre.
- **Erhalt oder Abriss:** Zum Vergleich rechnet die App einen gleich großen Neubau. So wird sichtbar, wie viel CO₂ der Erhalt einspart.
- **Neubau oder Entwurf:** Alle Bauteile zählen voll.

### 4.5 Weitere Aspekte

| Aspekt | Was die App macht |
|---|---|
| **Sommerlicher Wärmeschutz** | eine Ampel für das Überhitzungsrisiko aus Fensteranteil je Himmelsrichtung, Sonnenschutz, Speichermasse, Nachtlüftung und Kühlgradtagen; vereinfacht nach dem Prinzip des Sonneneintragskennwerts |
| **Photovoltaik / Solarthermie** | möglicher Ertrag (kWh/a) für die geeignete Dachfläche am Standort, Deckungsanteil am Strom- bzw. Warmwasserbedarf und eingesparte CO₂-Menge |
| **Begrünung & Wasser** | Hinweise und grobe Kennzahlen zu Gründach, Fassadengrün, Regenwassernutzung und Versiegelung, z. B. Rückhaltevolumen eines Gründachs |
| **Tageslicht & Komfort** | eine grobe Einschätzung aus Fensterflächenanteil und Raumtiefe sowie Warnhinweise, falls eine Optimierung das Tageslicht verschlechtert (z. B. zu kleine Fenster) |

### 4.6 Zielwerte und Standards

| Standard | Was verglichen wird | Ungefährer Zielwert |
|---|---|---|
| **Passivhaus** | Heizwärmebedarf | ≤ 15 kWh/m²a |
| **Niedrigstenergie- / Nullemissionsgebäude (EU, NZEB/ZEB)** | Primärenergie und Betriebsemissionen | je nach Land verschieden, die App nutzt einen EU-Richtwert mit Hinweis |
| **EU Level(s)** | Lebenszyklus-CO₂ (Indikator 1.2) | kein fester Grenzwert; Ausgabe im Level(s)-Format und Vergleich mit typischen europäischen Bandbreiten |
| **RIBA 2030 Climate Challenge** | graue Emissionen und Betriebsenergie | Zielwerte je Gebäudetyp, z. B. Wohnen: graue Emissionen < 625 kg CO₂e/m², Betriebsenergie < 35 kWh/m²a |

Die Darstellung ist eine Ampel (erreicht / knapp verfehlt / deutlich verfehlt) plus ein Balken mit Zielmarke. Die genauen Zahlen werden beim Bau aus den aktuellen Veröffentlichungen übernommen, und zu jedem Wert steht die Quelle.

### 4.7 Kosten und Amortisation

- Jede Maßnahme hat **Kosten in €/m²** Bauteilfläche bzw. pauschal (z. B. die Wärmepumpe). Grundlage sind deutsche Richtwerte, die mit einem **Preisfaktor je Land** angepasst werden. Dieser orientiert sich am Baukostenniveau laut Eurostat.
- **Amortisation** = Kosten ÷ eingesparte Energiekosten pro Jahr. Die Energiepreise sind je Land hinterlegt und können im Formular geändert werden.
- Die App zeigt außerdem **€ pro eingesparter Tonne CO₂**. Daran erkennt man, welche Maßnahme am meisten Klimaschutz pro Euro bringt.
- Hinweis in der App: Die Kosten sind grobe Richtwerte. Preise schwanken stark nach Region und Zeitpunkt.

### 4.8 Transparenz

- Unter jedem Ergebnis kann man **„Rechenweg anzeigen“** aufklappen: die Formel mit den eingesetzten Zahlen.
- Eine Tabelle **„Annahmen & Quellen“** listet alle Kennwerte und Faktoren auf.
- Ein **Glossar** erklärt die Fachbegriffe (U-Wert, graue Energie, GWP, PENRT, NRF/BGF, Heizgradtage …). Ein Fragezeichen neben einem Begriff öffnet die Erklärung.

---

## 5. Optimierungsvorschläge

**Wie sie entstehen:**
1. **Feste Regeln in der App** prüfen jeden Wert gegen Zielwerte und erzeugen passende Maßnahmen. Für jede Maßnahme rechnet die App mit echten Zahlen aus: **Energie- und CO₂-Einsparung, Kosten, Amortisation, € pro Tonne CO₂**.
2. **Die KI** erklärt die Maßnahmen bezogen auf dein Projekt und deinen Standort und ergänzt Aspekte, die sich schlecht rechnen lassen.

**Gruppen** (innerhalb jeder Gruppe nach Wirkung sortiert, umschaltbar auf Aufwand):

| Gruppe | Beispiele |
|---|---|
| **Entwurf** | Kompaktheit (A/V-Verhältnis), Ausrichtung, Fensteranteil je Himmelsrichtung, Verschattung, Raumtiefen und Tageslicht, Erhalt statt Abriss |
| **Konstruktion & Material** | Holz- oder Hybridbau statt Stahlbeton, schlankere Decken, Recyclingbeton, zementreduzierter Beton, Lehm, nachwachsende Dämmstoffe, trennbare Verbindungen (Kreislauf) |
| **Gebäudehülle** | Dämmstärken, Dreifachverglasung, Wärmebrücken, Luftdichtheit, Sonnenschutz, helle Dächer und Fassaden (Süden), Gründach |
| **Technik** | Wärmepumpe, Lüftung mit Wärmerückgewinnung, Photovoltaik, Solarthermie, Nachtlüftung, Regenwassernutzung |

**Klimagerecht:** Im Norden stehen Dämmung und Sonnengewinne im Vordergrund. Im Süden geht es um Verschattung, Speichermasse, Nachtlüftung und weniger Glas nach Westen.

**Komfort-Check:** Wenn eine Maßnahme das Tageslicht oder den Sommerkomfort verschlechtert, zeigt die App einen Warnhinweis.

---

## 6a. 3D- und BIM-Modelle

### Was die App aus dem Modell liest

| | IFC (BIM) | OBJ / glTF (3D) |
|---|---|---|
| Bauteile (Wand, Dach, Decke, Bodenplatte, Fenster, Tür) | ✔ direkt aus dem Modell | Die App erkennt sie automatisch anhand von Lage und Neigung (senkrecht = Wand, waagerecht oben = Dach usw.). Du kannst die Zuordnung korrigieren. |
| Flächen und Ausrichtung je Bauteil | ✔ exakt | ✔ exakt aus der Geometrie |
| Geschosse, Volumen, BGF | ✔ | ✔ aus der Geometrie geschätzt |
| Innen oder Außen | ✔ über die Eigenschaft „IsExternal“, sonst über die Lage | über die Lage zur Hülle |
| Materialschichten mit Dicken | ✔, wenn im Modell gepflegt. Sind die Schichten als **einzelne, parallel aneinanderliegende Wände** modelliert (z. B. Holz + Dämmung + Platte), fasst die App sie zu **einer Außenwand mit Schichtaufbau** zusammen (von außen nach innen). Gängige Materialnamen (auch englische aus Revit, z. B. „Roofing, Tile“, „Rigid insulation“, „Screed“) werden automatisch zugeordnet. | ✘, Auswahl im Formular |
| U-Werte | ✔, wenn im Modell eingetragen; sind die Schichten nicht vollständig erkannt, wählt die App den Katalogaufbau mit dem passendsten U-Wert | ✘, aus dem Aufbau berechnet |
| Nordrichtung | ✔ meist im Modell | Eingabe in Schritt ① |

Beim Einlesen zeigt ein Ladebalken den Fortschritt, ebenso bei „Materialnamen mit KI zuordnen“. Den Baustein `web-ifc.wasm` lädt die App aus dem eigenen Ordner, notfalls aus dem Internet. Fehlende Angaben ergänzt du in Schritt ③. Bei sehr großen Modellen werden nur die Bauteile der Gebäudehülle und die Tragstruktur ausgewertet, Möbel und Ausstattung nicht.

### Was du am Modell machen kannst

- **Ansehen:** Das Modell lässt sich drehen, zoomen und verschieben. Es gibt Schnitte bzw. eine Geschoss-Ansicht und Ansichten wie „von Süden“ oder „von oben“.
- **Farbige Auswertung:** Ein Umschalter färbt alle Bauteile ein, wahlweise nach
  - Wärmeverlust (W/m²K bzw. Anteil am Gesamtverlust)
  - CO₂ (kg CO₂e/m² bzw. Anteil an der Ökobilanz)
  - Kreislaufnote (A–E)
  - Sonneneintrag bzw. Überhitzungsrisiko der Fenster

  Eine Legende zeigt die Werteskala. Bauteile im Bestand sind schraffiert bzw. grau.
- **Bauteile anklicken & ändern:** Klickst du ein Bauteil an, öffnet sich ein Seitenfeld mit Typ, Fläche, Aufbau, U-Wert, CO₂, Kreislaufnote und IFC-GUID. Dort wählst du einen anderen Katalogaufbau oder eigene Schichten, eine andere Verglasung oder Sonnenschutz. Die Änderung kann für **dieses Bauteil** oder für **alle Bauteile desselben Typs** gelten. Farben und Kennzahlen rechnen sofort neu.
- **Vorschläge am Modell:** Klickst du auf einen Vorschlag, werden die betroffenen Bauteile im Modell hervorgehoben. Ein Schalter „Vorher/Nachher“ zeigt die Farben vor und nach der Optimierung.
- **Einfache Varianten am Modell:**
  - **Ausrichtung drehen** in 15°-Schritten: Sonnengewinne und Sommerschutz werden neu berechnet.
  - **Fensteranteil je Fassade** mit einem Schieberegler (z. B. Süd +20 %, West −30 %): Die Rechnung passt sich an, die Geometrie bleibt aber unverändert. Im Modell wird das als Kennzeichnung angezeigt.
  - **Verschattung** (Sonnenschutz, Vordach bzw. Auskragung) je Fassade ein oder aus.
  - Jede dieser Varianten kann als Variante A/B/C gespeichert werden.
- **Bilder für Bericht und KI:** Die aktuelle 3D-Ansicht kann als Bild in den PDF-Bericht übernommen werden. Für die KI-Erklärungen schickt die App eine Ansicht des Modells mit, damit die KI das Gebäude „sieht“.

### Maßnahmenliste für dein BIM-Programm

- Als Excel-Tabelle (eigener Knopf „Maßnahmenliste (GUIDs)“): eine Zeile pro geändertem Bauteil mit **IFC-GUID**, Bauteiltyp, Geschoss, Fläche, alter und neuer Aufbau, altem und neuem U-Wert sowie CO₂-Einsparung.
- Über die GUID findest du jedes Bauteil in Revit, Archicad usw. sofort wieder und änderst es dort.
- Bei OBJ/glTF gibt es keine GUIDs. Dort nutzt die Liste die Objektnamen aus der Datei.

---

## 6. Projekt-Chat

- Auf jeder Seite gibt es am rechten Rand den Reiter „Frag zu deinem Projekt“ (am Handy unten rechts). Ein Klick öffnet ein Chat-Fenster über der Seite, „×“ oder Esc schließt es.
- Die KI bekommt alle Werte, Ergebnisse und Vorschläge des Projekts mitgeschickt (die Pläne nicht noch einmal, um Kontingent zu sparen) und antwortet in der gewählten Sprache.
- Beispielfragen als Knöpfe: „Was bringt Holzbau?“, „Welche Maßnahme lohnt sich zuerst?“, „Erklär mir den U-Wert der Außenwand“.
- Der Chat-Verlauf bleibt, solange die App geöffnet ist. Er wird nicht in der Projektdatei gespeichert.

---

## 7. Ergebnisseite im Detail

Die Ergebnisseite ist ein **Bento-Grid**: Kacheln in unterschiedlichen Größen auf einem Raster mit 12 Spalten (Tablet 6, Handy 1). Die Kacheln sind so angeordnet, dass jede Reihe voll ist.

| Bereich | Inhalt | Darstellung |
|---|---|---|
| Hingucker | Endenergie, Effizienzklasse, Heizwärmebedarf, PEnrt, ggf. Wert nach den Maßnahmen | große waldgrüne Kachel mit sehr großer Zahl, großem Klassen-Feld und Mini-Skala A+ bis H |
| Kennzahlen | CO₂ über 50 Jahre, CO₂ pro m² BGF, CO₂ pro m² NRF und Jahr, Energiekosten, Kreislaufnote, gespeicherter Kohlenstoff | sechs kleine Kacheln, teils farbig (Salbei, Ocker, Minze) |
| Effizienzskala | bunte Skala A+ bis H mit Zeiger | breite Kachel |
| Zielwerte | Passivhaus, NZEB, Level(s), RIBA 2030 | Ampel und Balken mit Zielmarke |
| Energiebilanz | Verluste nach Wand, Dach, Boden, Fenster, Lüftung; Gewinne; Kühlbedarf | Balkendiagramm mit Liniensymbolen |
| Ökobilanz | CO₂ nach Bauteilen; Herstellung, Austausch, Betrieb und Entsorgung; gespeicherter Kohlenstoff | gestapelte Balken |
| Bestand | gebundenes CO₂ im Bestand, Erhalt gegen Neubau | grau abgesetzter Balken |
| Kreislauf | Note A–E je Bauteil | Tabelle mit Balken |
| Sommer & Komfort | Überhitzungsrisiko, Tageslicht | Ampeln |
| Solar, Grün & Wasser | PV- und Solarthermie-Ertrag, Gründach-Potenzial | Kennzahlen |
| Vorschläge (Reiter ⑤) | vier Gruppen mit Wirkung, Kosten, Amortisation, € pro t CO₂, Erklärung, zum Anhaken | Karten |
| Vorher/Nachher (Reiter ⑤) | Energie und CO₂ im Ist-Zustand und optimiert | Zusammenfassung und gegenübergestellte Balken |
| Varianten (Reiter ⑥) | bis zu 3 Varianten | Tabelle und gruppierte Balken |
| Rechenweg | Formeln mit eingesetzten Zahlen | aufklappbar; Annahmen & Quellen über die Fußzeile |
| Pläne | deine hochgeladenen Pläne | Vorschaubilder |
| 3D-Modell | farbige Auswertung, Bauteil-Infos, Vorschläge und Varianten am Modell | interaktive 3D-Ansicht mit Legende |

---

## 8. Gestaltung im Detail

Stand 17.11.2026: Der ursprüngliche Stil (eckig, feine Linien, Space Grotesk/Inter) wurde auf Wunsch durch ein Bento-Design ersetzt.

- **Farben:** hellgrauer Grund `#E7EBE7`, die App ist immer hell. Darauf helle und farbige Kacheln. Akzent **Waldgrün** `#1F5A3D` für Knöpfe, Fortschritt, Hervorhebungen und die Hingucker-Kachel. Dazu eine passende Palette:

  | Farbe | Einsatz |
  |---|---|
  | Waldgrün `#1F5A3D` | Akzent, Hingucker-Kachel, Diagramme |
  | Salbei `#C8DCCD` | Kacheln, z. B. CO₂ über 50 Jahre, Modell-Steuerung |
  | Minze `#E3F0E6` | Kacheln, z. B. Kreislauf, Sommer & Komfort |
  | Ocker `#F3E3BF` / `#B9832C` | warmer Gegenakzent, z. B. Energiekosten, Solar & Wasser, Bestand |
  | Moos `#D3E5CB`, Farn `#B8D4BE` | weitere Kacheln, Maßnahmen „Technik“ |
  | Moos `#5F9A6E`, Schiefer `#5B6B73` | Diagrammreihen |

  Die Palette wird auch für Knöpfe, Eingabefelder, Tabellenköpfe, Upload-Felder und die Maßnahmen-Karten verwendet (Entwurf Salbei, Material Minze, Hülle Ocker, Technik Moos). Ampeln und die 3D-Einfärbung laufen von Moosgrün über Ocker nach Rost. **Ausnahme:** Die Effizienzklassen A+ bis H behalten die Originalfarben des Energieausweises.
- **Schrift:** **Nunito** in der ganzen App, Überschriften und große Kennzahlen sehr fett (800–900). Zahlen in Tabellen haben gleich breite Ziffern. Lange deutsche Wörter werden in schmalen Kacheln mit Bindestrich getrennt.
- **Formen:** große Rundungen: Kacheln 28 px, Karten 20 px, Eingabefelder 12 px, Knöpfe, Schrittleiste und Kennzeichen pillenförmig. Weiche Flächen statt Rahmenlinien.
- **Bento-Grid:** Auf der Ergebnisseite sind die Kacheln unterschiedlich groß (z. B. 5, 7 oder 12 von 12 Spalten). Die Hingucker-Kachel steht oben links. Auf dem Handy stapeln sich alle Kacheln untereinander.
- **Symbole:** feine Liniensymbole, selbst gezeichnet.
- **Kopfzeile:** großes Logo, Titel „Greenprint“ bündig mit der Logo-Oberkante, darunter in einer Zeile Unterzeile (Grundlinie bündig mit der Logo-Unterkante), Projekt/Variante, DE/EN, „Projekt speichern“ und der hervorgehobene Knopf „+ Neues Projekt“.
- **Fußzeile:** Hinweis zur Genauigkeit, Glossar, Annahmen & Quellen und die KI-Statuszeile (klickbar → KI-Einstellungen).
- **Intro:** „Greenprint wird gezeichnet“ auf zartem Plan-Raster, einmal pro Browser-Tab, überspringbar; bei „Bewegung reduzieren“ nur kurz das fertige Bild.
- **Mauszeiger und Fußspur:** siehe Tabelle in 2.2; auf Handy/Tablet ohne Wirkung, die Spur entfällt bei „Bewegung reduzieren“.
- **Ladesymbol:** runder Ring (Salbei/Waldgrün), in grünen Knöpfen weiß; Fortschrittsbalken abgerundet und sanft animiert.
- **Handy:** Die App funktioniert auch auf dem Smartphone. Spalten stapeln sich dann untereinander.
- **PDF-Bericht:** A4 hoch, gleicher Aufbau für „Ergebnis“ und „Varianten“:
  - **Deckblatt:** Haus aus dem Intro auf Plan-Raster, „Greenprint“ mit Unterzeile, Projektname und ein Kasten mit Gebäudetyp, Projektart, Standort, BGF/NRF, Verfasser/in, Hochschule und Datum. Ohne Seitenzahl und Fußzeile.
  - **Inhaltsverzeichnis** mit Seitenzahlen (Einträge sind anklickbar).
  - **1 Ergebnisse:** Überblick (Kennzahlen, Effizienzskala, Modellbild, Fazit), Projektangaben & Bauteile (bei eigenen Schichten mit Schichtaufbau), Energiebilanz, Ökobilanz, Zielwerte & weitere Aspekte.
  - **2 Optimierungsvorschläge:** Vorher/Nachher, Maßnahmen, ggf. Erläuterungen der KI.
  - **3 Variantenvergleich** (nur bei mehreren Varianten).
  - **Annahmen & Quellen** als letztes Kapitel.
  - Jedes Hauptkapitel beginnt auf einer neuen Seite. **Fußzeile** ab Seite 2: Genauigkeitshinweis, KI-Hinweis und „Seite x / y“.

---

## 9. Technik (kurz erklärt)

Du musst hier nichts selbst tun. Dieser Abschnitt erklärt nur, woraus die App besteht.

- **Eine HTML-Datei:** Gestaltung (CSS) und Logik (JavaScript) stecken mit in dieser Datei.
- **KI:** online die eingebaute Claude-Funktion von claude.ai (stärkste Stufe, mit Bildern), lokal OpenRouter mit eigenem Key (`ai-openrouter.js`, kostenlose Modelle mit automatischen Ausweichmodellen und Wiederholung bei Überlastung). Genutzt für Planlesen, Erklärungen der Vorschläge und den Chat.
- **Zusatzbausteine (Bibliotheken),** die aus einer freigegebenen Quelle geladen werden:
  - *pdf.js* wandelt PDF-Pläne in Bilder um.
  - *jsPDF* erzeugt den PDF-Bericht.
  - *SheetJS* erzeugt die Maßnahmenliste (GUIDs).
  - *three.js* zeigt das 3D-Modell im Browser an und liest OBJ- und glTF-Dateien.
  - *web-ifc* liest IFC-Dateien. Es braucht eine Zusatzdatei (`web-ifc.wasm`, ein schneller Programmbaustein), die zusammen mit der App veröffentlicht wird.
  - *Tailwind CSS* (3.4.17) übernimmt Raster, Abstände und Schrift des Bento-Designs. Der Teil, der alle vorhandenen Stile zurücksetzt („Preflight“), ist abgeschaltet, damit Formulare und Tabellen ihre eigenen Stile behalten.
- **Speichern und Herunterladen:** Über die Download-Funktion von claude.ai, die vor jedem Speichern kurz nachfragt. Das gilt für den PDF-Bericht, die Maßnahmenliste und die Projektdatei (`.json`).
- **Diagramme und Symbole** werden direkt in der App gezeichnet. Die App ist immer hell.
- **Zweisprachig:** Alle Texte liegen auf Deutsch und Englisch vor. Die KI antwortet in der gewählten Sprache.
- **Datenschutz:** Pläne werden nicht gespeichert, sie gehen nur zur Analyse an Claude. Die Projektdatei enthält nur Zahlen und Texte und liegt bei dir.
- **Ablage** (lokal und auf GitHub):
  ```
  Energieeffizienz-Oekobilanz-Optimierung/
  ├── PLAN.md                ← dieser Plan
  ├── README.md              ← Kurzanleitung und Link
  ├── App-lokal-starten.bat  ← startet die lokale Version (localhost:8765)
  └── app/
      ├── index.html         ← Seite, Gestaltung, Intro, Mauszeiger
      ├── main.js            ← Oberfläche (Reiter, Formulare, Ergebnis, Chat, Fußspur)
      ├── calc.js, data.js   ← Rechenkern und Daten
      ├── i18n.js, charts.js ← Texte DE/EN, Diagramme
      ├── ai.js, ai-openrouter.js ← KI-Anfragen (claude.ai / OpenRouter)
      ├── viewer.js, export.js    ← 3D/BIM, PDF-Bericht
      └── web-ifc.wasm       ← Baustein zum Lesen von IFC-Dateien
  ```

---

## 10. Arbeitsschritte

| Nr. | Schritt | Ergebnis |
|---|---|---|
| 1 | Plan schreiben und abstimmen | diese Datei ✔ |
| 2 | **Daten:** Materialliste (CO₂, PENRT, Dichte, Wärmeleitfähigkeit, Nutzungsdauer, Kreislauf, Kosten), Bauteilkatalog, Klima- und Länderdaten für Europa, Zielwerte | Datentabellen in der App |
| 3 | **Rechenkern:** Energie (Heizen, Kühlen, Warmwasser, PV), Ökobilanz, Bestandslogik, Sommerschutz, Kosten und Amortisation | Rechenfunktionen, an Beispielhäusern in Nord-, Mittel- und Südeuropa überprüft |
| 4 | **Oberfläche:** Assistent ① bis ⑥, Formulare, eigene Schichten, Gestaltung, Symbole, DE/EN | App mit Beispielprojekt |
| 5 | **Ergebnisseite:** Kennzahlen, Diagramme, Zielwerte, Vorschläge, Vorher/Nachher, Rechenweg, Glossar | vollständige Auswertung |
| 6 | **KI:** Pläne lesen, Vorschläge erklären, Projekt-Chat | App liest echte Pläne |
| 6a | **3D/BIM:** IFC- und OBJ/glTF-Import, Bauteilerkennung, 3D-Ansicht, farbige Auswertung, Anklicken & Ändern, Vorschläge und Varianten am Modell | App liest Modelle |
| 7 | **Varianten, Speichern und Export:** Variantenvergleich, Projektdatei, PDF-Bericht mit Deckblatt und Inhaltsverzeichnis, Maßnahmenliste mit GUIDs | vollständige App |
| 8 | **Testen:** Rechenwerte gegenprüfen, Test-IFC- und OBJ-Modelle, Handy- und Dunkelmodus, beide Sprachen | geprüfte App |
| 9 | **Veröffentlichen** als Online-Link, Dateien in den lokalen Ordner legen, README ergänzen | Link und Dateien im Ordner |

Bei jedem Schritt erkläre ich dir in einfachen Worten, was passiert. Weil die App groß ist, baue ich sie in Etappen und zeige dir Zwischenstände nach Schritt 5, nach Schritt 6a und nach Schritt 7. Für den Test nach Schritt 6a hilft es sehr, wenn du ein eigenes IFC-Modell hast, z. B. aus einem Semesterprojekt. Ein kleines Testmodell kann ich aber auch selbst erzeugen.

---

## 11. Grenzen und Hinweise

- **Genauigkeit:** Die KI kann Maße falsch ablesen, besonders bei unscharfen Scans oder fehlender Bemaßung. Deshalb gibt es Schritt ③. Die Ergebnisse sind Richtwerte für Variantenvergleiche und keine Nachweise.
- **Bilder:** Am besten funktionieren saubere, bemaßte Pläne mit Maßstabsangabe und Nordpfeil. Wie viele Bilder pro Analyse möglich sind, gibt claude.ai vor.
- **KI-Nutzung:** Planlesen, Vorschlagstexte und Chat verbrauchen dein Claude-Kontingent, das Planlesen mit der stärksten Stufe am meisten. Ohne KI funktioniert alles außer Planlesen und Chat. Die Vorschläge kommen dann ohne KI-Erklärtext.
- **Teilen:** Wer den Link bekommt, nutzt die KI über das eigene Claude-Konto.
- **Europäische Daten:** gerundete Mittelwerte je Land bzw. Region. Im Gebirge besser eigene Klimawerte eintragen. Der Strommix ändert sich jährlich.
- **3D-/BIM-Modelle:**
  - Wie gut die Auswertung wird, hängt von der Qualität des Modells ab. Fehlen Materialien, Außen-Kennzeichnungen oder Nordrichtung, musst du in Schritt ③ mehr ergänzen.
  - OBJ/glTF-Modelle müssen geschlossene Hüllflächen haben, damit Flächen und Volumen stimmen.
  - Sehr große Modelle (über ca. 100 MB) können den Browser verlangsamen.
  - Änderungen an der Geometrie (Fenster vergrößern, drehen) wirken nur in der Rechnung. Das Modell selbst änderst du in deinem BIM-Programm, mithilfe der Maßnahmenliste.
- **Kosten:** grobe Richtwerte mit Länderfaktor, nicht für Kostenschätzungen nach DIN 276 geeignet.
- **Kreislauffähigkeit:** eine vereinfachte Bewertung und kein zertifiziertes Verfahren.
- **OneDrive:** Das Repo liegt in einem OneDrive-Ordner. Das funktioniert, kann Git aber gelegentlich ausbremsen.

---

## 12. Offene Fragen

Keine. Alle Fragen zu Grundlagen, Gestaltung, Inhalt, Nutzung und 3D/BIM sind beantwortet (siehe Abschnitt 2).
