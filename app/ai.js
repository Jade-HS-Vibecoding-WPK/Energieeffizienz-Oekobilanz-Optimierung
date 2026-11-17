/* Greenprint – KI-Anfragen (claude.use("sample")) */
(function () {
  'use strict';
  const D = window.OBC_DATA, I = window.OBC_I18N, K = window.OBC_CALC;

  function catalogText() {
    const byKind = {};
    D.CONSTRUCTIONS.forEach(c => { (byKind[c.kind] = byKind[c.kind] || []).push(c); });
    let s = '';
    for (const k of Object.keys(byKind)) {
      s += `\n${k}:\n` + byKind[k].map(c => {
        const u = K.uValue(c.kind, c.layers);
        return `- ${c.id}: ${c.de}${u ? ` (U≈${u.toFixed(2)})` : ''}`;
      }).join('\n');
    }
    return s;
  }
  const windowText = () => D.WINDOWS.map(w => `- ${w.id}: ${w.de} (Uw ${w.uw})`).join('\n');
  const heatText = () => D.HEATING.map(h => `- ${h.id}: ${h.de}`).join('\n');
  const matText = () => D.MATERIALS.map(m => `${m.id} (${m.de})`).join(', ');

  function planPrompt(st, plans, hasModel) {
    const loc = D.LOC[st.loc];
    const bt = D.BT[st.type];
    const list = plans.map((p, i) => `Bild ${i + 1}: ${p.label} – Planart: ${p.typeLabel}`).join('\n');
    const lang = I.lang === 'en' ? 'English' : 'Deutsch';
    return `Du bist Bauphysiker/in und Architekt/in. Werte die beigefügten Architekturpläne eines Gebäudes für eine überschlägige Energie- und Ökobilanz aus.

PROJEKT
- Projektart: ${st.mode === 'existing' ? 'Bestand' + (st.retrofit ? ' (Sanierung/Anbau geplant)' : '') : 'Neubau / Entwurf'}
- Gebäudetyp: ${bt ? bt.de : st.type}${st.sub ? ' / ' + st.sub : ''}
- Standort: ${loc ? loc.de + ', ' + D.COUNTRIES[loc.cc].de : ''}
- Baujahr/Fertigstellung: ${st.year || 'unbekannt'}
- Beschreibung: ${(st.meta && st.meta.desc) || '–'}
${hasModel ? '- Hinweis: Geometrie und Flächen kommen bereits aus einem 3D-Modell. Konzentriere dich auf Aufbauten (Details/Schnitte), Technik und Hinweise; Flächen nur grob.\n' : ''}
BILDER (in dieser Reihenfolge)
${list}

AUFGABE
1. Lies Maßstab, Bemaßung, Raumbezeichnungen, Geschosse, Nordpfeil. Ermittle Brutto-Grundfläche (BGF), Netto-Raumfläche (NRF), Geschosszahl, Geschosshöhe, Brutto-Volumen und Grundfläche.
2. Ermittle die Flächen der Gebäudehülle in m²: Außenwände NETTO (ohne Fenster) getrennt nach Himmelsrichtung (Azimut in Grad: 0 = Nord, 90 = Ost, 180 = Süd, 270 = West), Dach, Bodenplatte bzw. Kellerdecke, außerdem Geschossdecken (Summe) und Innenwände (Summe, Wandfläche einseitig).
3. Ermittle die Fensterflächen je Himmelsrichtung.
4. Ordne jedem Bauteil den passendsten Aufbau aus dem KATALOG zu. Wenn ein Detail/Schnitt einen Schichtaufbau zeigt, gib zusätzlich "schichten" an (Material-IDs aus der MATERIALLISTE, Dicke in Metern, von außen nach innen).
5. Gib zu jedem Wert die Sicherheit (hoch/mittel/niedrig) und die Herkunft an: "bemassung" (abgelesen), "massstab" (mit Maßstab gemessen) oder "geschaetzt".
6. Wenn kein Nordpfeil erkennbar ist: nimm an, dass oben im Plan Norden ist, und vermerke das.

KATALOG (aufbau_id)${catalogText()}

FENSTERTYPEN (typ_id)
${windowText()}

HEIZUNG (heizung_id)
${heatText()}

MATERIALLISTE (material_id): ${matText()}

ANTWORT: Antworte NUR mit einem JSON-Objekt genau in dieser Form (Texte auf ${lang}):
{
 "geometrie": {"bgf": 0, "nrf": 0, "geschosse": 0, "geschosshoehe": 0, "volumen": 0, "grundflaeche": 0,
   "conf": {"bgf": "hoch|mittel|niedrig", "nrf": "…", "geschosse": "…", "volumen": "…"},
   "src": {"bgf": "bemassung|massstab|geschaetzt", "nrf": "…", "geschosse": "…", "volumen": "…"}},
 "bauteile": [{"kind": "AW|DA|BO|DE|IW", "name": "z. B. Außenwand Süd", "flaeche": 0, "ausrichtung_grad": 180, "aufbau_id": "aw_ks_eps", "flachdach": false, "bestand": false, "schichten": [{"material_id": "ks", "dicke_m": 0.175}], "conf": "mittel", "src": "massstab", "notiz": ""}],
 "fenster": [{"ausrichtung_grad": 180, "flaeche": 0, "typ_id": "w_3_pvc", "sonnenschutz": "none|internal|external", "bestand": false, "conf": "mittel", "src": "massstab"}],
 "technik": {"heizung_id": null, "lueftung": null, "pv_kwp": null},
 "hinweise": {"nord_erkannt": true, "dachform": "flach|steil|gemischt", "verschattung": "", "raumtiefe_m": null, "freiflaeche": ""},
 "zusammenfassung": "2–4 Sätze, was du erkannt hast",
 "unsicherheiten": ["kurze Punkte"]
}
"ausrichtung_grad" nur bei AW und Fenster, sonst null. "schichten" nur wenn ein Aufbau wirklich erkennbar ist, sonst weglassen. Keine Kommentare, nur JSON.`;
  }

  function applyPlanResult(st, r, hasModel) {
    const conf = v => (['hoch', 'mittel', 'niedrig'].includes(v) ? v : 'mittel');
    const src = v => (['bemassung', 'massstab', 'geschaetzt'].includes(v) ? v : 'geschaetzt');
    const n = v => (Number.isFinite(+v) && +v > 0 ? +v : null);
    st.fieldConf = st.fieldConf || {};
    const g = r.geometrie || {};
    if (!hasModel) {
      const map = { bgf: 'bgf', nrf: 'nrf', geschosse: 'floors', geschosshoehe: 'hStorey', volumen: 'volume', grundflaeche: 'footprint' };
      for (const k in map) if (n(g[k])) st.geo[map[k]] = n(g[k]);
      for (const k of ['bgf', 'nrf', 'geschosse', 'volumen']) st.fieldConf[map[k]] = { conf: conf((g.conf || {})[k]), src: src((g.src || {})[k]) };
    }
    const toLayers = arr => (Array.isArray(arr) ? arr.filter(l => D.MAT[l.material_id] && n(l.dicke_m)).map(l => ({ mat: l.material_id, d: n(l.dicke_m), th: true })) : []);
    if (!hasModel && Array.isArray(r.bauteile)) {
      st.elements = r.bauteile.filter(b => ['AW', 'DA', 'BO', 'DE', 'IW'].includes(b.kind) && n(b.flaeche)).map(b => {
        const e = { id: K.newId('e'), kind: b.kind, name: String(b.name || ''), area: Math.round(n(b.flaeche)), az: b.kind === 'AW' ? (Number.isFinite(+b.ausrichtung_grad) ? +b.ausrichtung_grad : 180) : null,
          con: D.CON[b.aufbau_id] && D.CON[b.aufbau_id].kind === b.kind ? b.aufbau_id : K.REF[b.kind], existing: st.mode === 'existing' ? b.bestand !== false : false,
          conf: conf(b.conf), src: src(b.src), note: String(b.notiz || ''), flat: !!b.flachdach };
        const L = toLayers(b.schichten);
        if (L.length) { e.layers = L; e.conn = (D.CON[e.con] || {}).conn || 'teilweise'; e.con = 'custom'; }
        return e;
      });
    } else if (hasModel && Array.isArray(r.bauteile)) {
      // Nur Schichtaufbauten aus Details übernehmen
      r.bauteile.forEach(b => {
        const L = toLayers(b.schichten);
        if (!L.length) return;
        st.elements.filter(e => e.kind === b.kind && e.conf !== 'hoch').forEach(e => { e.layers = JSON.parse(JSON.stringify(L)); e.con = 'custom'; e.conn = e.conn || 'teilweise'; e.conf = conf(b.conf); e.src = 'bemassung'; });
      });
    }
    if (!hasModel && Array.isArray(r.fenster)) {
      st.windows = r.fenster.filter(f => n(f.flaeche)).map(f => ({ id: K.newId('w'), az: Number.isFinite(+f.ausrichtung_grad) ? +f.ausrichtung_grad : 180, area: Math.round(n(f.flaeche) * 10) / 10,
        type: D.WIN[f.typ_id] ? f.typ_id : (st.mode === 'existing' ? 'w_iso_alt' : 'w_3_pvc'), shade: ['none', 'internal', 'external'].includes(f.sonnenschutz) ? f.sonnenschutz : 'none',
        existing: st.mode === 'existing' ? f.bestand !== false : false, conf: conf(f.conf), src: src(f.src) }));
    }
    const tch = r.technik || {};
    if (tch.heizung_id && D.HEAT[tch.heizung_id]) st.tech.heat = tch.heizung_id;
    if (['window', 'exhaust', 'mvhr'].includes(tch.lueftung)) st.tech.vent = tch.lueftung;
    if (n(tch.pv_kwp)) st.tech.pv = n(tch.pv_kwp);
    st.hints = r.hinweise || {};
    delete st.example;
    return { summary: String(r.zusammenfassung || ''), uncertainties: Array.isArray(r.unsicherheiten) ? r.unsicherheiten.map(String) : [] };
  }

  function projectSummary(st, res, measures) {
    const loc = D.LOC[st.loc];
    const f = (v, d = 0) => Math.round(v * 10 ** d) / 10 ** d;
    return {
      projekt: { art: st.mode, typ: st.type, nutzung: st.sub, standort: loc ? `${loc.de}, ${D.COUNTRIES[loc.cc].de}` : '', klima: { heizgradtage: res.cl.hdd, kuehlgradtage: res.cl.cdd, globalstrahlung: res.cl.gh, strom_co2: res.cl.country.co2 } },
      geometrie: { bgf: f(res.bgf), nrf: f(res.nrf), av: f(res.av, 2), fensterflaeche: f(res.winArea), speichermasse: res.massClass },
      bauteile: res.els.map(e => ({ typ: e.kind, name: e.src.name || '', flaeche: f(e.area), u: e.U != null ? f(e.U, 2) : null, aufbau: e.src.con === 'custom' ? K.layersOf(e.src).map(l => `${l.mat} ${f(l.d * 100)}cm`).join(' / ') : (D.CON[e.src.con] || {}).de, bestand: e.existing, co2_kg_m2_50a: f(e.co2m2), kreislauf: e.circGrade })),
      fenster: res.wins.map(w => ({ richtung: w.key, flaeche: f(w.area, 1), typ: w.type.de, uw: w.type.uw, sonnenschutz: w.shade })),
      technik: { heizung: res.heat.de, lueftung: res.tech.vent, pv_kwp: res.kwp, nachtlueftung: !!res.tech.night },
      ergebnis: { heizwaerme_kwh_m2a: f(res.qhSpec), endenergie_kwh_m2a: f(res.endSpec), klasse: res.cls.c, kuehlbedarf_kwh_a: f(res.Qc), co2_betrieb_t_a: f(res.co2Op / 1000, 1), co2_grau_t: f(res.embTotal / 1000, 1), co2_50a_t: f(res.lifeTotal / 1000, 1), co2_kg_m2nrf_a: f(res.lifeSpec, 1), penrt_kwh_m2a: f(res.peSpec), kreislauf: res.circGrade, gespeicherter_kohlenstoff_t: f(res.bio / 1000, 1), ueberhitzung: res.summerRisk, tageslicht: res.daylight },
      massnahmen: (measures || []).map(m => ({ id: m.id, titel: I.MEASURE_TEXT[m.id].de[0], gruppe: m.group, einsparung_kwh_a: f(m.dEnd), co2_50a_t: f(m.dLife / 1000, 1), kosten_eur: m.cost != null ? f(m.cost) : null, amortisation_jahre: m.payback != null ? f(m.payback, 1) : null })),
    };
  }

  function explainPrompt(st, res, measures) {
    const lang = I.lang === 'en' ? 'English' : 'Deutsch';
    return `Du berätst Architekturstudierende zu Energieeffizienz und Ökobilanz. Unten stehen die Projektdaten und die von einem Rechenprogramm ermittelten Maßnahmen mit ihren Zahlen. Die Zahlen sind gesetzt – erfinde keine neuen Zahlen, beziehe dich auf die gegebenen.

DATEN (JSON):
${JSON.stringify(projectSummary(st, res, measures))}

AUFGABE (Sprache: ${lang}, einfach und konkret, ohne Floskeln):
1. Erkläre jede Maßnahme in 2–3 Sätzen projektbezogen: warum sie hier wirkt, worauf beim Entwurf/Detail zu achten ist, und ggf. klimaspezifische Hinweise zum Standort.
2. Ergänze 2–5 weitere Hinweise, die sich schlecht rechnen lassen (z. B. Ausrichtung, Verschattung durch Nachbarn, Kompaktheit, Rückbaubarkeit, Bestandserhalt, Begrünung, Tageslicht, Nutzerkomfort).
3. Schreibe ein Fazit in 2 Sätzen mit den 2–3 wirksamsten Hebeln.

Antworte NUR mit JSON:
{"massnahmen": [{"id": "m_aw", "text": "…"}], "weitere": [{"gruppe": "design|material|envelope|tech", "titel": "…", "text": "…"}], "fazit": "…"}`;
  }

  function chatRules(st, res, measures) {
    const lang = I.lang === 'en' ? 'English' : 'Deutsch';
    return `Du bist ein freundlicher Bauphysik- und Nachhaltigkeitsberater für Architekturstudierende. Antworte auf ${lang}, kurz (max. 150 Wörter), konkret und verständlich; erkläre Fachbegriffe kurz. Nutze die Projektdaten unten. Wenn du Zahlen schätzt, die nicht in den Daten stehen, sag, dass es eine grobe Schätzung ist. Die App rechnet vereinfacht (Heizperiodenverfahren, Ökobilanz A1–A3, B4, B6, C3–C4 über 50 Jahre).

PROJEKTDATEN (JSON):
${JSON.stringify(projectSummary(st, res, measures))}`;
  }

  function mapPrompt(names) {
    return `Ordne diese Materialnamen aus einem BIM-Modell der passendsten material_id zu. Wenn nichts passt, null.
MATERIALLISTE: ${matText()}
NAMEN: ${JSON.stringify(names)}
Antworte NUR mit JSON: {"Name aus Liste": "material_id oder null"}`;
  }

  window.OBC_AI = { planPrompt, applyPlanResult, explainPrompt, chatRules, mapPrompt, projectSummary };
})();
