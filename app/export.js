/* Greenprint – Speichern, PDF-Bericht, Excel, Maßnahmenliste */
(function () {
  'use strict';
  const D = window.OBC_DATA, I = window.OBC_I18N, K = window.OBC_CALC, CH = window.OBC_CHARTS;
  const LIB = {
    jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  };
  const t = (k, v) => I.t(k, v), fmt = (v, d) => I.fmt(v, d);

  // ---------- Speichern (claude.ai Downloads, lokal: Link) ----------
  async function save(downloads, filename, data) {
    if (downloads) {
      try { await downloads.save({ filename, data }); return 'saved'; }
      catch (e) { return e && e.code === 'declined' ? 'declined' : 'error:' + (e && e.code); }
    }
    try {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      return 'saved';
    } catch (e) { return 'unavailable'; }
  }
  const safeName = s => (String(s || 'projekt').replace(/[^\w\-äöüÄÖÜß ]+/g, '').trim().replace(/\s+/g, '_') || 'projekt');

  // ---------- Projektdatei ----------
  function projectJson(app) {
    const strip = v => { const c = K.clone(v); return c; };
    return JSON.stringify({ app: 'greenprint', version: 1, savedAt: new Date().toISOString(), meta: app.meta, active: app.active, variants: app.variants.map(strip) }, null, 1);
  }
  function parseProject(text) {
    const o = JSON.parse(text);
    if (!o || !['greenprint', 'oekobilanz-check'].includes(o.app) || !Array.isArray(o.variants) || !o.variants.length) throw new Error('format');
    return o;
  }

  // ---------- Text für PDF (Standardschrift ohne Sonderzeichen) ----------
  function pdfText(s) {
    return String(s == null ? '' : s)
      .replace(/­/g, '')
      .replace(/₂/g, '2').replace(/²/g, '²').replace(/³/g, '³').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/≈/g, '~')
      .replace(/→/g, '->').replace(/·/g, '·').replace(/[“”„]/g, '"').replace(/[‘’]/g, "'").replace(/−/g, '-').replace(/…/g, '...')
      .replace(/[^\x00-\xFF€–—]/g, '');
  }

  function svgToPng(svg, widthPx) {
    return new Promise(res => {
      const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
      const w = vb ? +vb[1] : 640, h = vb ? +vb[2] : 200;
      const W = widthPx || 1200, H = Math.round(W * h / w);
      const s2 = svg.replace('width="100%"', `width="${W}" height="${H}"`);
      const img = new Image();
      const url = URL.createObjectURL(new Blob([s2], { type: 'image/svg+xml' }));
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); g.drawImage(img, 0, 0, W, H);
        URL.revokeObjectURL(url);
        res({ data: c.toDataURL('image/jpeg', 0.88), ratio: h / w });
      };
      img.onerror = () => { URL.revokeObjectURL(url); res(null); };
      img.src = url;
    });
  }

  // ---------- PDF-Bericht ----------
  async function pdfReport(app, ctx) {
    await window.OBC_VIEWER.loadScript(LIB.jspdf);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const st = ctx.st, r = ctx.res, P = CH.PRINT;
    const W = 210, H = 297, M = 16, CW = W - 2 * M;
    const ACC = [31, 90, 61], FG = [29, 38, 32], MU = [95, 107, 99], LN = [200, 207, 201];
    let y = M;
    const meta = app.meta || {};
    const pages = [];

    function titleBlock() {
      const bw = 112, bh = 22, bx = W - M - bw, by = H - M - bh + 6;
      doc.setDrawColor(...FG); doc.setLineWidth(0.3); doc.rect(bx, by, bw, bh);
      doc.line(bx, by + 8, bx + bw, by + 8); doc.line(bx + 70, by + 8, bx + 70, by + bh); doc.line(bx, by + 15, bx + bw, by + 15);
      doc.setFontSize(7); doc.setTextColor(...MU);
      doc.text(pdfText(t('project')), bx + 2, by + 3); doc.text(pdfText(t('author')), bx + 2, by + 10.5); doc.text(pdfText(t('school')), bx + 2, by + 17.5);
      doc.text(pdfText(t('date')), bx + 72, by + 10.5); doc.text(pdfText(t('page')), bx + 72, by + 17.5);
      doc.setFontSize(9); doc.setTextColor(...FG);
      doc.text(pdfText((meta.project || t('appName')) + ' · ' + t('variant') + ' ' + (st.name || 'A')).slice(0, 70), bx + 2, by + 6.8);
      doc.setFontSize(8);
      doc.text(pdfText(meta.author || '–').slice(0, 40), bx + 2, by + 13.8); doc.text(pdfText(meta.school || '–').slice(0, 40), bx + 2, by + 20.8);
      doc.text(new Date().toLocaleDateString(I.lang === 'en' ? 'en-GB' : 'de-DE'), bx + 72, by + 13.8);
      pages.push([doc.getCurrentPageInfo().pageNumber, bx + 72, by + 20.8]);
      doc.setFontSize(7); doc.setTextColor(...MU);
      doc.text(pdfText(t('appName') + ' – ' + t('disclaimer')), M, H - M + 6, { maxWidth: CW - bw - 6 });
    }
    function newPage() { titleBlock(); doc.addPage(); y = M; }
    function need(h) { if (y + h > H - M - 26) newPage(); }
    function h1(s) { need(60); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...ACC); doc.text(pdfText(s), M, y + 6); y += 10; doc.setDrawColor(...ACC); doc.setLineWidth(0.5); doc.line(M, y, M + CW, y); y += 5; doc.setFont('helvetica', 'normal'); }
    function h2(s) { need(30); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...FG); doc.text(pdfText(s), M, y + 4); y += 7; doc.setFont('helvetica', 'normal'); }
    function para(s, size) { doc.setFontSize(size || 9); doc.setTextColor(...FG); const lines = doc.splitTextToSize(pdfText(s), CW); need(lines.length * 4.2 + 2); doc.text(lines, M, y + 3); y += lines.length * 4.2 + 2; }
    function small(s) { doc.setFontSize(7.5); doc.setTextColor(...MU); const lines = doc.splitTextToSize(pdfText(s), CW); need(lines.length * 3.4 + 1); doc.text(lines, M, y + 2.5); y += lines.length * 3.4 + 2; doc.setTextColor(...FG); }
    function table(head, rows, widths, opt) {
      opt = opt || {};
      const tw = widths.reduce((a, b) => a + b, 0), sc = CW / tw, ws = widths.map(w => w * sc);
      const rowH = opt.rowH || 5.6;
      const drawHead = () => {
        need(rowH + 2);
        doc.setFillColor(232, 238, 233); doc.rect(M, y, CW, rowH, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.6); doc.setTextColor(...FG);
        let x = M; head.forEach((h, i) => { doc.text(pdfText(h), x + 1.2, y + rowH - 1.7, { maxWidth: ws[i] - 2 }); x += ws[i]; });
        y += rowH; doc.setFont('helvetica', 'normal');
      };
      drawHead();
      rows.forEach(rw => {
        const cells = rw.map((c, i) => doc.splitTextToSize(pdfText(c), ws[i] - 2.4));
        const lines = Math.max(...cells.map(c => c.length));
        const h = Math.max(rowH, lines * 3.4 + 2.2);
        if (y + h > H - M - 26) { newPage(); drawHead(); }
        doc.setFontSize(7.6); doc.setTextColor(...FG);
        let x = M; cells.forEach((c, i) => { doc.text(c, x + 1.2, y + 3.6); x += ws[i]; });
        y += h; doc.setDrawColor(...LN); doc.setLineWidth(0.15); doc.line(M, y, M + CW, y);
      });
      y += 3;
    }
    async function chart(svg, wmm) {
      const img = await svgToPng(svg);
      if (!img) return;
      const w = wmm || CW, h = w * img.ratio;
      need(h + 3); doc.addImage(img.data, 'JPEG', M, y, w, h, undefined, 'FAST'); y += h + 3;
    }
    function kpis(list) {
      const n = list.length, bw = CW / n;
      need(20);
      list.forEach((k, i) => {
        const x = M + i * bw;
        doc.setDrawColor(...LN); doc.setLineWidth(0.2); doc.rect(x, y, bw - 2, 18);
        doc.setFontSize(7); doc.setTextColor(...MU); doc.text(doc.splitTextToSize(pdfText(k[0]), bw - 5), x + 2, y + 4);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...ACC); doc.text(pdfText(k[1]), x + 2, y + 13);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MU); doc.text(pdfText(k[2] || ''), x + 2, y + 16.5);
      });
      y += 22; doc.setTextColor(...FG);
    }

    const loc = D.LOC[st.loc];
    // ---- Deckblatt ----
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...ACC); doc.text(pdfText(t('appName').toUpperCase() + ' · ' + t('pdfTitle').toUpperCase()), M, y + 4);
    y += 12; doc.setFontSize(24); doc.setTextColor(...FG); doc.text(doc.splitTextToSize(pdfText(meta.project || t('appName')), CW), M, y + 8); y += 18;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...MU);
    doc.text(pdfText(`${I.nm(D.BT[st.type])} · ${st.mode === 'existing' ? t('modeExisting') : t('modeNew')} · ${loc ? I.nm(loc) + ', ' + I.nm(D.COUNTRIES[loc.cc]) : ''} · ${t('variant')} ${st.name}`), M, y + 2); y += 10;
    kpis([
      [t('endEnergy'), fmt(r.endSpec, 0), 'kWh/m²a'], [t('effClass'), r.cls.c, 'GEG'], [t('co2Total'), fmt(r.lifeTotal / 1000, 0) + ' t', 'CO2e'],
      [t('co2PerNrfA'), fmt(r.lifeSpec, 1), 'kg/m²a'], [t('circularity'), r.circGrade, fmt(r.circScore, 0) + '/100'],
    ]);
    await chart(CH.classScale(r.endSpec, { C: P }), CW * 0.9);
    small(t('classNote'));
    if (ctx.snapshot) { need(90); try { const pr = ctx.snapshotRatio || 0.6; doc.addImage(ctx.snapshot, 'JPEG', M, y, CW, CW * pr, undefined, 'FAST'); y += CW * pr + 4; } catch (e) { /* */ } }
    else if (ctx.planThumb) { need(90); try { doc.addImage(ctx.planThumb, 'JPEG', M, y, CW * 0.6, CW * 0.6 * (ctx.planRatio || 0.7)); y += CW * 0.6 * (ctx.planRatio || 0.7) + 4; } catch (e) { /* */ } }
    if (ctx.ai && ctx.ai.fazit) { h2(I.lang === 'en' ? 'Summary' : 'Fazit'); para(ctx.ai.fazit); }
    newPage();

    // ---- Projekt & Standort ----
    h1(t('projectData'));
    table([t('project'), ''], [
      [t('btype'), I.nm(D.BT[st.type]) + (st.sub ? ' / ' + st.sub : '')], [t('mode'), st.mode === 'existing' ? t('modeExisting') : t('modeNew')],
      [t('region'), loc ? I.nm(loc) + ', ' + I.nm(D.COUNTRIES[loc.cc]) : ''], [t('hdd') + ' / ' + t('cdd'), fmt(r.cl.hdd) + ' / ' + fmt(r.cl.cdd)], [t('gh'), fmt(r.cl.gh)],
      [t('gridCo2'), fmt(r.cl.country.co2, 2) + ' kg/kWh'], ['BGF / NRF', fmt(r.bgf) + ' / ' + fmt(r.nrf) + ' m²'], [t('volume'), fmt(r.vol) + ' m³ · A/V ' + fmt(r.av, 2)],
      [t('heating'), I.nm(r.heat)], [t('ventilation'), t('vent_' + r.tech.vent)],
    ], [60, 120]);
    h2(t('elements'));
    table([t('kind'), t('name'), t('construction'), t('area') + ' m²', 'U', 'kg CO2e/m²', t('grade')], r.els.map(e => [
      t('kind_' + e.kind) + (e.key ? ' ' + t('or_' + e.key) : ''), e.src.name || '', e.src.con === 'custom' ? t('customLayers') : I.nm(D.CON[e.src.con]),
      fmt(e.area), e.U != null ? fmt(e.U, 2) : '–', fmt(e.co2m2, 0) + (e.existing ? ' *' : ''), e.circGrade]), [26, 30, 62, 16, 12, 18, 10]);
    table([t('windows'), t('windowType'), t('area') + ' m²', 'Uw', 'g', t('shading')], r.wins.map(w => [t('or_' + w.key), I.nm(w.type), fmt(w.area, 1), fmt(w.type.uw, 2), fmt(w.type.g, 2), t('sh_' + w.shade)]), [20, 70, 18, 14, 12, 22]);
    if (st.mode === 'existing') small('* ' + t('boundCo2'));

    // ---- Energie ----
    h1(t('energyBalance'));
    kpis([[t('heatDemand'), fmt(r.qhSpec, 0), 'kWh/m²a'], [t('endEnergy'), fmt(r.endSpec, 0), 'kWh/m²a'], [t('coolDemand'), fmt(r.Qc / r.nrf, 0), 'kWh/m²a'], [t('penrt'), fmt(r.peSpec, 0), 'kWh/m²a']]);
    h2(t('lossesTitle'));
    await chart(ctx.charts.losses(P));
    h2(t('endByUse'));
    await chart(ctx.charts.endUse(P));
    small(`${t('calcWay')}: Qh = 0,024 × ${fmt(r.cl.hdd)} Kd × (HT ${fmt(r.HT, 0)} + HV ${fmt(r.HV, 0)} W/K) − η ${fmt(r.eta, 2)} × (Qs ${fmt(r.Qs, 0)} + Qi ${fmt(r.Qi, 0)} kWh) = ${fmt(r.Qh, 0)} kWh/a`);

    // ---- Ökobilanz ----
    h1(t('lcaTitle'));
    kpis([[t('co2Total'), fmt(r.lifeTotal / 1000, 0) + ' t', 'CO2e'], [t('co2PerBgf'), fmt(r.embPerBgf, 0), 'kg/m² (grau)'], [t('storedCarbon'), fmt(r.bio / 1000, 0) + ' t', 'CO2'], [t('circularity'), r.circGrade, fmt(r.circScore, 0) + '/100']]);
    h2(t('byPhase')); await chart(ctx.charts.phases(P));
    h2(t('byElement')); await chart(ctx.charts.byElement(P));
    if (ctx.demo) {
      h2(t('existingTitle'));
      para(`${t('boundCo2')}: ${fmt(r.exA13 / 1000, 0)} t CO2e. ${t('keepVariant')}: ${fmt(ctx.demo.keep / 1000, 0)} t · ${t('newVariant')}: ${fmt(ctx.demo.newBuild / 1000, 0)} t.`);
    }

    // ---- Zielwerte & Aspekte ----
    h1(t('targetsTitle'));
    const tg = r.targets;
    table([t('targetsTitle'), I.lang === 'en' ? 'Value' : 'Wert', I.lang === 'en' ? 'Target' : 'Ziel', 'Status'], [
      [t('t_passivhaus'), fmt(tg.passivhaus.value, 0) + ' kWh/m²a', '<= 15', t('st_' + tg.passivhaus.status)],
      [t('t_nzeb'), fmt(tg.nzeb.value, 0) + ' kWh/m²a PEnrt', '<= ' + tg.nzeb.limit, t('st_' + tg.nzeb.status)],
      [t('t_ribaOp'), fmt(tg.ribaOp.value, 0) + ' kWh/m²a', '2030: ' + tg.ribaOp.limit + ' · 2025: ' + tg.ribaOp.limit2025, t('st_' + tg.ribaOp.status)],
      [t('t_ribaEmb'), fmt(tg.ribaEmb.value, 0) + ' kg/m²', '2030: ' + tg.ribaEmb.limit + ' · 2025: ' + tg.ribaEmb.limit2025, t('st_' + tg.ribaEmb.status)],
      [t('t_levels'), fmt(tg.levels.value, 1) + ' kg/m²a', '–', t('lv_' + tg.levels.band)],
    ], [60, 40, 50, 30]);
    small(t('ribaNote') + ' ' + t('levelsNote'));
    h2(t('summerTitle') + ' · ' + t('solarGreenTitle'));
    table(['', ''], [
      [t('summerRisk'), t('risk_' + r.summerRisk)], [t('daylight'), t('dl_' + r.daylight) + ' (' + fmt(r.wfr * 100, 0) + ' %)'],
      [t('pvYield'), r.kwp ? fmt(r.pvYield, 0) + ' kWh/a (' + fmt(r.kwp, 1) + ' kWp)' : t('noPv')], [t('runoff'), fmt(r.runoff, 0) + ' m³/a'], [t('rainPotential'), fmt(r.rainPotential, 0) + ' m³/a'],
    ], [70, 110]);

    // ---- Vorschläge ----
    h1(t('measuresTitle'));
    const ms = ctx.measures;
    table([I.lang === 'en' ? 'Measure' : 'Maßnahme', t('effort'), 'kWh/a', 't CO2e/50a', t('cost') + ' €', t('payback'), t('eurPerT')], ms.map(m => [
      (ctx.selected.includes(m.id) ? '[x] ' : '[ ] ') + I.MEASURE_TEXT[m.id][I.lang][0], t('ef_' + m.effort), fmt(m.dEnd, 0), fmt(m.dLife / 1000, 1),
      m.cost == null ? t('designCost') : fmt(m.cost, 0), m.payback != null ? fmt(m.payback, 0) + ' ' + t('years') : t('noPayback'), m.eurPerT != null ? fmt(m.eurPerT, 0) : '–']), [62, 18, 16, 16, 18, 18, 14]);
    if (ctx.ai && ctx.ai.texts) {
      ms.forEach(m => { const tx = ctx.ai.texts[m.id]; if (tx) { h2(I.MEASURE_TEXT[m.id][I.lang][0]); para(tx); } });
      if (ctx.ai.extra && ctx.ai.extra.length) { h2(t('aiExtra')); ctx.ai.extra.forEach(x => para('• ' + x.titel + ': ' + x.text)); }
    }
    h2(t('beforeAfter') + (ctx.selected.length ? '' : ' (' + t('none') + ')'));
    const o = ctx.opt;
    table(['', t('before'), t('after')], [
      [t('endEnergy') + ' kWh/m²a', fmt(r.endSpec, 0), fmt(o.endSpec, 0)], [t('effClass'), r.cls.c, o.cls.c],
      ['CO2 ' + (I.lang === 'en' ? 'operation' : 'Betrieb') + ' t/a', fmt(r.co2Op / 1000, 1), fmt(o.co2Op / 1000, 1)],
      [t('co2Total') + ' t', fmt(r.lifeTotal / 1000, 0), fmt(o.lifeTotal / 1000, 0)], [t('co2PerNrfA'), fmt(r.lifeSpec, 1), fmt(o.lifeSpec, 1)],
      [t('totalCost'), '', fmt(ctx.totalCost, 0) + ' €'],
    ], [80, 50, 50]);

    // ---- Varianten ----
    if (ctx.variants && ctx.variants.length > 1) {
      h1(t('s5Title'));
      table([''].concat(ctx.variants.map(v => t('variant') + ' ' + v.name)), ctx.variantRows, [60].concat(ctx.variants.map(() => 40)));
    }

    // ---- Annahmen ----
    h1(t('assumptions'));
    table([I.lang === 'en' ? 'Topic' : 'Thema', I.lang === 'en' ? 'Source / assumption' : 'Quelle / Annahme'], D.SOURCES.map(s => I.lang === 'en' ? [s[1], s[3]] : [s[0], s[2]]), [50, 130]);
    small(t('disclaimer'));
    titleBlock();

    const total = doc.getNumberOfPages();
    pages.forEach(([pg, x, yy]) => { doc.setPage(pg); doc.setFontSize(8); doc.setTextColor(...FG); doc.text(`${pg} / ${total}`, x, yy); });
    return doc.output('blob');
  }

  // ---------- Excel ----------
  async function xlsxReport(app, ctx) {
    await window.OBC_VIEWER.loadScript(LIB.xlsx);
    const X = window.XLSX;
    const wb = X.utils.book_new();
    const r = ctx.res, st = ctx.st;
    const add = (name, aoa) => X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(aoa), name.slice(0, 31));
    const loc = D.LOC[st.loc];
    add(I.lang === 'en' ? 'Overview' : 'Übersicht', [
      [t('appName'), (app.meta && app.meta.project) || ''], [t('variant'), st.name], [t('btype'), I.nm(D.BT[st.type])], [t('mode'), st.mode], [t('region'), loc ? I.nm(loc) + ', ' + I.nm(D.COUNTRIES[loc.cc]) : ''],
      [], ['Kennwert', 'Wert', 'Einheit'],
      ['BGF', r.bgf, 'm²'], ['NRF', r.nrf, 'm²'], ['Volumen', r.vol, 'm³'], ['A/V', r.av, '1/m'],
      [t('heatDemand'), r.qhSpec, 'kWh/m²a'], [t('endEnergy'), r.endSpec, 'kWh/m²a'], [t('effClass'), r.cls.c, ''], [t('coolDemand'), r.Qc, 'kWh/a'],
      [t('penrt'), r.peSpec, 'kWh/m²a'], ['CO2 Betrieb', r.co2Op, 'kg/a'], ['CO2 grau (A1–A3, B4, C3–C4, TGA, PV)', r.embTotal, 'kg'], ['CO2 Betrieb 50 a (B6)', r.b6, 'kg'],
      [t('co2Total'), r.lifeTotal, 'kg'], [t('co2PerBgf'), r.embPerBgf, 'kg/m²'], [t('co2PerNrfA'), r.lifeSpec, 'kg/m²a'], [t('storedCarbon'), r.bio, 'kg CO2'],
      [t('circularity'), r.circScore, r.circGrade], ['Energiekosten', r.costOp, '€/a'], [t('summerRisk'), t('risk_' + r.summerRisk), ''],
    ]);
    add(I.lang === 'en' ? 'Elements' : 'Bauteile', [['ID', t('kind'), t('name'), t('orientation'), t('area') + ' m²', t('construction'), 'U W/m²K', 'HT W/K', 'A1–A3 kg', 'B4 kg', 'C3–C4 kg', 'Bestand A1–A3 kg', t('grade'), t('existing'), 'GUIDs']]
      .concat(r.els.map(e => [e.id, e.kind, e.src.name || '', e.key || '', e.area, e.src.con === 'custom' ? K.layersOf(e.src).map(l => l.mat + ' ' + Math.round(l.d * 1000) + 'mm').join(' | ') : e.src.con, e.U, e.HT || 0, e.emb.a13, e.emb.b4, e.emb.c34, e.emb.ex, e.circGrade, e.existing ? 1 : 0, (e.src.guids || []).join(' ')])));
    add(I.lang === 'en' ? 'Windows' : 'Fenster', [['ID', t('orientation'), 'Azimut °', t('area') + ' m²', t('windowType'), 'Uw', 'g', t('shading'), 'Qs kWh (Heizperiode)', t('existing')]]
      .concat(r.wins.map(w => [w.id, w.key, w.az, w.area, w.type.id, w.type.uw, w.type.g, w.shade, w.Qs, w.existing ? 1 : 0])));
    add(I.lang === 'en' ? 'Energy' : 'Energie', [['Größe', 'Wert', 'Einheit'],
      ['HT Außenwand', r.htParts.AW, 'W/K'], ['HT Dach', r.htParts.DA, 'W/K'], ['HT Boden', r.htParts.BO, 'W/K'], ['HT Fenster', r.htParts.FE, 'W/K'], ['HT Wärmebrücken', r.htParts.WB, 'W/K'],
      ['HV Lüftung', r.HV, 'W/K'], ['Heizgradtage', r.cl.hdd, 'Kd'], ['Verluste Heizperiode', r.loss, 'kWh'], ['Solare Gewinne', r.Qs, 'kWh'], ['Interne Gewinne', r.Qi, 'kWh'],
      ['Ausnutzungsgrad η', r.eta, ''], ['Heizwärmebedarf', r.Qh, 'kWh/a'], ['Warmwasser', r.Qww, 'kWh/a'], ['Kühlbedarf', r.Qc, 'kWh/a'], ['JAZ', r.jaz || '', ''],
      ['Endenergie Gas', r.end.gas, 'kWh/a'], ['Endenergie Öl', r.end.oil, 'kWh/a'], ['Endenergie Holz', r.end.wood, 'kWh/a'], ['Endenergie Fernwärme', r.end.district, 'kWh/a'], ['Endenergie Strom', r.end.el, 'kWh/a'],
      ['PV-Ertrag', r.pvYield, 'kWh/a'], ['PV Eigenverbrauch', r.pvSelf, 'kWh/a']]);
    add(I.lang === 'en' ? 'Measures' : 'Maßnahmen', [['ID', I.lang === 'en' ? 'Measure' : 'Maßnahme', 'Gruppe', 'gewählt', 'kWh/a', 'kg CO2e Betrieb/a', 'kg CO2e 50 a', 'Kosten €', 'Amortisation a', '€/t CO2', t('effort')]]
      .concat(ctx.measures.map(m => [m.id, I.MEASURE_TEXT[m.id][I.lang][0], m.group, ctx.selected.includes(m.id) ? 1 : 0, m.dEnd, m.dOp, m.dLife, m.cost, m.payback, m.eurPerT, m.effort])));
    if (ctx.guidRows && ctx.guidRows.length) add(I.lang === 'en' ? 'Measures list GUID' : 'Maßnahmenliste GUID', ctx.guidRows);
    if (ctx.variants && ctx.variants.length > 1) add(I.lang === 'en' ? 'Variants' : 'Varianten', [[''].concat(ctx.variants.map(v => v.name))].concat(ctx.variantRows));
    add(I.lang === 'en' ? 'Materials' : 'Materialien', [['ID', 'Name', 'λ W/mK', 'ρ kg/m³', 'GWP kg/kg A1–A3', 'PEnrt kWh/kg', 'Bio kg CO2/kg', 'C3–C4 kg/kg', 'Nutzungsdauer a', 'Kreislauf 0–100']]
      .concat(D.MATERIALS.map(m => [m.id, I.nm(m), m.lambda, m.rho, m.gwp, m.penrt, m.bio, m.eol, m.life, m.circ])));
    add(I.lang === 'en' ? 'Sources' : 'Quellen', [['Thema', 'Quelle / Annahme']].concat(D.SOURCES.map(s => I.lang === 'en' ? [s[1], s[3]] : [s[0], s[2]])));
    const out = X.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  async function guidList(rows) {
    await window.OBC_VIEWER.loadScript(LIB.xlsx);
    const X = window.XLSX;
    const wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(rows), I.lang === 'en' ? 'Measures' : 'Massnahmen');
    return new Blob([X.write(wb, { bookType: 'xlsx', type: 'array' })]);
  }

  window.OBC_EXPORT = { save, safeName, projectJson, parseProject, pdfReport, xlsxReport, guidList, svgToPng };
})();
