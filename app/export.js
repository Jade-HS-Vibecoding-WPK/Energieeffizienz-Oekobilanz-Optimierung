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
  // Aufbau: Deckblatt (Intro-Zeichnung, Name, Projektangaben) · Inhaltsverzeichnis · 1 Ergebnisse ·
  // 2 Optimierungsvorschläge · (3 Variantenvergleich) · Annahmen & Quellen.
  // Jedes Oberthema beginnt auf einer neuen Seite; Fußzeile mit Hinweisen und Seitenzahl auf jeder Seite.

  // Intro-Bild „Greenprint wird gezeichnet“ im fertigen Zustand (für das Deckblatt)
  function introSvg() {
    const A = '#1f5a3d';
    let grid = '';
    for (let x = 0; x <= 220; x += 11) grid += `<line x1="${x}" y1="0" x2="${x}" y2="170" stroke="#e3ece6" stroke-width="0.5"/>`;
    for (let y = 5; y <= 170; y += 11) grid += `<line x1="0" y1="${y}" x2="220" y2="${y}" stroke="#e3ece6" stroke-width="0.5"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 170" width="100%">
      <rect width="220" height="170" fill="#ffffff"/>${grid}
      <path d="M50 140 V84 L110 34 L170 84 V140 Z" fill="${A}"/>
      <g fill="none" stroke="${A}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 140 H206"/><path d="M50 140 V84 M170 140 V84"/><path d="M38 92 L110 30 L182 92"/>
        <path d="M50 156 H170 M50 151 v10 M170 151 v10" stroke-width="1.2" opacity="0.6"/>
      </g>
      <g fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M64 100 h22 v18 h-22 Z M134 100 h22 v18 h-22 Z"/><path d="M100 140 V116 h20 V140"/>
      </g>
      <path d="M96 108 c0-16 10-26 28-26 c0 16-10 26-28 26 M96 108 l14-14" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  async function pdfReport(app, ctx) {
    await window.OBC_VIEWER.loadScript(LIB.jspdf);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const st = ctx.st, r = ctx.res, P = CH.PRINT, EN = I.lang === 'en';
    const W = 210, H = 297, M = 16, CW = W - 2 * M;
    const BOTTOM = H - 26; // darunter liegt die Fußzeile
    const ACC = [31, 90, 61], FG = [29, 38, 32], MU = [95, 107, 99], LN = [200, 207, 201], MINT = [232, 238, 233];
    let y = M;
    const meta = app.meta || {};
    const toc = []; // { lvl, title, page }
    const loc = D.LOC[st.loc];
    const dateStr = new Date().toLocaleDateString(EN ? 'en-GB' : 'de-DE');
    const L = (de, en) => (EN ? en : de);
    const subE = st.sub && ((D.BT[st.type] || {}).sub || []).find(x => x[0] === st.sub);
    const btLabel = I.nm(D.BT[st.type]) + (st.sub ? ' / ' + (subE ? (EN ? subE[2] : subE[1]) : st.sub) : '');

    function addPage() { doc.addPage(); y = M; }
    function need(h) { if (y + h > BOTTOM) addPage(); }
    const pageNo = () => doc.getCurrentPageInfo().pageNumber;
    // Oberthema: immer neue Seite
    let chapNo = 0, secNo = 0;
    function chapter(title, numbered) {
      addPage();
      if (numbered !== false) { chapNo++; secNo = 0; }
      const label = numbered !== false ? `${chapNo}  ${title}` : title;
      toc.push({ lvl: 1, title: label, page: pageNo() });
      doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...ACC);
      doc.text(pdfText(label), M, y + 8); y += 13;
      doc.setDrawColor(...ACC); doc.setLineWidth(0.6); doc.line(M, y, M + CW, y); y += 7;
      doc.setFont('helvetica', 'normal');
    }
    // Unterkapitel: läuft auf der Seite weiter
    function section(title) {
      need(45);
      secNo++;
      const label = `${chapNo}.${secNo}  ${title}`;
      toc.push({ lvl: 2, title: label, page: pageNo() });
      if (y > M + 2) y += 3;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...ACC); doc.text(pdfText(label), M, y + 5); y += 8;
      doc.setDrawColor(...LN); doc.setLineWidth(0.3); doc.line(M, y, M + CW, y); y += 4;
      doc.setFont('helvetica', 'normal');
    }
    function h2(s) { need(30); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...FG); doc.text(pdfText(s), M, y + 4); y += 7; doc.setFont('helvetica', 'normal'); }
    function para(s, size) { doc.setFontSize(size || 9); doc.setTextColor(...FG); const lines = doc.splitTextToSize(pdfText(s), CW); need(lines.length * 4.2 + 2); doc.text(lines, M, y + 3); y += lines.length * 4.2 + 2; }
    function small(s) { doc.setFontSize(7.5); doc.setTextColor(...MU); const lines = doc.splitTextToSize(pdfText(s), CW); need(lines.length * 3.4 + 1); doc.text(lines, M, y + 2.5); y += lines.length * 3.4 + 2; doc.setTextColor(...FG); }
    function table(head, rows, widths, opt) {
      opt = opt || {};
      const tw = widths.reduce((a, b) => a + b, 0), sc = CW / tw, ws = widths.map(w => w * sc);
      const rowH = opt.rowH || 5.6;
      const drawHead = () => {
        need(rowH + 8);
        doc.setFillColor(...MINT); doc.rect(M, y, CW, rowH, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.6); doc.setTextColor(...FG);
        let x = M; head.forEach((h, i) => { doc.text(pdfText(h), x + 1.2, y + rowH - 1.7, { maxWidth: ws[i] - 2 }); x += ws[i]; });
        y += rowH; doc.setFont('helvetica', 'normal');
      };
      drawHead();
      rows.forEach(rw => {
        doc.setFontSize(7.6);
        const cells = rw.map((c, i) => doc.splitTextToSize(pdfText(c), ws[i] - 2.4));
        const lines = Math.max(...cells.map(c => c.length));
        const h = Math.max(rowH, lines * 3.4 + 2.2);
        if (y + h > BOTTOM) { addPage(); drawHead(); }
        doc.setFontSize(7.6); doc.setTextColor(...FG);
        let x = M; cells.forEach((c, i) => { doc.text(c, x + 1.2, y + 3.6); x += ws[i]; });
        y += h; doc.setDrawColor(...LN); doc.setLineWidth(0.15); doc.line(M, y, M + CW, y);
      });
      y += 4;
    }
    async function chart(svg, wmm) {
      const img = await svgToPng(svg);
      if (!img) return;
      const w = wmm || CW, h = w * img.ratio;
      need(h + 3); doc.addImage(img.data, 'JPEG', M, y, w, h, undefined, 'FAST'); y += h + 3;
    }
    function kpis(list) {
      const n = list.length, bw = CW / n;
      need(22);
      list.forEach((k, i) => {
        const x = M + i * bw;
        doc.setDrawColor(...LN); doc.setLineWidth(0.2); doc.roundedRect(x, y, bw - 2, 18, 1.5, 1.5);
        doc.setFontSize(7); doc.setTextColor(...MU); doc.text(doc.splitTextToSize(pdfText(k[0]), bw - 5), x + 2, y + 4);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...ACC); doc.text(pdfText(k[1]), x + 2, y + 13);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MU); doc.text(pdfText(k[2] || ''), x + 2, y + 16.5);
      });
      y += 22; doc.setTextColor(...FG);
    }

    // ===== Deckblatt =====
    doc.setFillColor(...MINT); doc.rect(0, 0, W, 6, 'F');
    const img = await svgToPng(introSvg(), 1400);
    const iw = 120, ih = img ? iw * img.ratio : 0;
    if (img) doc.addImage(img.data, 'JPEG', (W - iw) / 2, 30, iw, ih, undefined, 'FAST');
    y = 30 + ih + 14;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(38); doc.setTextColor(...FG);
    doc.text('Greenprint', W / 2, y, { align: 'center' }); y += 9;
    doc.setFontSize(12); doc.setTextColor(...ACC);
    doc.text(pdfText(t('tagline')), W / 2, y, { align: 'center' }); y += 18;
    // Projekttitel
    doc.setFontSize(9); doc.setTextColor(...MU);
    doc.text(pdfText((t('pdfTitle') + ' · ' + t('variant') + ' ' + (st.name || 'A')).toUpperCase()), W / 2, y, { align: 'center' }); y += 9;
    doc.setFontSize(22); doc.setTextColor(...FG);
    const ptl = doc.splitTextToSize(pdfText(meta.project || t('appName')), CW - 20);
    doc.text(ptl, W / 2, y, { align: 'center' }); y += ptl.length * 9 + 6;
    // Projektangaben als Kasten
    doc.setFont('helvetica', 'normal');
    const facts = [
      [t('btype'), btLabel],
      [t('mode'), st.mode === 'existing' ? t('modeExisting') : t('modeNew')],
      [t('region'), loc ? I.nm(loc) + ', ' + I.nm(D.COUNTRIES[loc.cc]) : '–'],
      ['BGF / NRF', fmt(r.bgf) + ' / ' + fmt(r.nrf) + ' m²'],
      [t('author'), meta.author || '–'],
      [t('school'), meta.school || '–'],
      [t('date'), dateStr],
    ];
    const bx = M + 14, bwid = CW - 28, rh = 7.4, bh = facts.length * rh + 6;
    const by = Math.max(y, BOTTOM - bh - 4);
    doc.setFillColor(246, 249, 247); doc.setDrawColor(...LN); doc.setLineWidth(0.25); doc.roundedRect(bx, by, bwid, bh, 3, 3, 'FD');
    facts.forEach((f, i) => {
      const yy = by + 3 + i * rh;
      doc.setFontSize(8); doc.setTextColor(...MU); doc.text(pdfText(f[0]), bx + 6, yy + 5);
      doc.setFontSize(10); doc.setTextColor(...FG); doc.text(pdfText(String(f[1])).slice(0, 80), bx + 52, yy + 5);
      if (i < facts.length - 1) { doc.setDrawColor(225, 231, 226); doc.setLineWidth(0.15); doc.line(bx + 4, yy + rh, bx + bwid - 4, yy + rh); }
    });

    // ===== Inhaltsverzeichnis (wird am Ende ausgefüllt) =====
    addPage();
    const tocPage = pageNo();

    // ===== 1 Ergebnisse =====
    chapter(L('Ergebnisse', 'Results'));
    section(L('Überblick', 'Overview'));
    kpis([
      [t('endEnergy'), fmt(r.endSpec, 0), 'kWh/m²a'], [t('effClass'), r.cls.c, 'GEG'], [t('co2Total'), fmt(r.lifeTotal / 1000, 0) + ' t', 'CO2e'],
      [t('co2PerNrfA'), fmt(r.lifeSpec, 1), 'kg/m²a'], [t('circularity'), r.circGrade, fmt(r.circScore, 0) + '/100'],
    ]);
    await chart(CH.classScale(r.endSpec, { C: P }), CW * 0.9);
    small(t('classNote'));
    if (ctx.snapshot) { const pr = ctx.snapshotRatio || 0.6, w = CW * 0.8; need(w * pr + 4); try { doc.addImage(ctx.snapshot, 'JPEG', M + (CW - w) / 2, y, w, w * pr, undefined, 'FAST'); y += w * pr + 4; } catch (e) { /* */ } }
    else if (ctx.planThumb) { const pr = ctx.planRatio || 0.7, w = CW * 0.6; need(w * pr + 4); try { doc.addImage(ctx.planThumb, 'JPEG', M + (CW - w) / 2, y, w, w * pr); y += w * pr + 4; } catch (e) { /* */ } }
    if (ctx.ai && ctx.ai.fazit) { h2(L('Fazit', 'Summary')); para(ctx.ai.fazit); }

    section(t('projectData'));
    table([t('project'), ''], [
      [t('btype'), btLabel], [t('mode'), st.mode === 'existing' ? t('modeExisting') : t('modeNew')],
      [t('region'), loc ? I.nm(loc) + ', ' + I.nm(D.COUNTRIES[loc.cc]) : ''], [t('hdd') + ' / ' + t('cdd'), fmt(r.cl.hdd) + ' / ' + fmt(r.cl.cdd)], [t('gh'), fmt(r.cl.gh)],
      [t('gridCo2'), fmt(r.cl.country.co2, 2) + ' kg/kWh'], ['BGF / NRF', fmt(r.bgf) + ' / ' + fmt(r.nrf) + ' m²'], [t('volume'), fmt(r.vol) + ' m³ · A/V ' + fmt(r.av, 2)],
      [t('heating'), I.nm(r.heat)], [t('ventilation'), t('vent_' + r.tech.vent)],
    ], [60, 120]);
    h2(t('elements'));
    table([t('kind'), t('name'), t('construction'), t('area') + ' m²', 'U', 'kg CO2e/m²', t('grade')], r.els.map(e => [
      t('kind_' + e.kind) + (e.key ? ' ' + t('or_' + e.key) : ''), e.src.name || '', e.src.con === 'custom' ? K.layersOf(e.src).map(l => `${I.nm(D.MAT[l.mat])} ${fmt(l.d * 100, l.d * 100 % 1 ? 1 : 0)} cm`).join(' / ') : I.nm(D.CON[e.src.con]),
      fmt(e.area), e.U != null ? fmt(e.U, 2) : '–', fmt(e.co2m2, 0) + (e.existing ? ' *' : ''), e.circGrade]), [26, 30, 62, 16, 12, 18, 10]);
    if (r.wins.length) table([t('windows'), t('windowType'), t('area') + ' m²', 'Uw', 'g', t('shading')], r.wins.map(w => [t('or_' + w.key), I.nm(w.type), fmt(w.area, 1), fmt(w.type.uw, 2), fmt(w.type.g, 2), t('sh_' + w.shade)]), [20, 70, 18, 14, 12, 22]);
    if (st.mode === 'existing') small('* ' + t('boundCo2'));

    section(t('energyBalance'));
    kpis([[t('heatDemand'), fmt(r.qhSpec, 0), 'kWh/m²a'], [t('endEnergy'), fmt(r.endSpec, 0), 'kWh/m²a'], [t('coolDemand'), fmt(r.Qc / r.nrf, 0), 'kWh/m²a'], [t('penrt'), fmt(r.peSpec, 0), 'kWh/m²a']]);
    h2(t('lossesTitle'));
    await chart(ctx.charts.losses(P));
    h2(t('endByUse'));
    await chart(ctx.charts.endUse(P));
    small(`${t('calcWay')}: Qh = 0,024 × ${fmt(r.cl.hdd)} Kd × (HT ${fmt(r.HT, 0)} + HV ${fmt(r.HV, 0)} W/K) − η ${fmt(r.eta, 2)} × (Qs ${fmt(r.Qs, 0)} + Qi ${fmt(r.Qi, 0)} kWh) = ${fmt(r.Qh, 0)} kWh/a`);

    section(t('lcaTitle'));
    kpis([[t('co2Total'), fmt(r.lifeTotal / 1000, 0) + ' t', 'CO2e'], [t('co2PerBgf'), fmt(r.embPerBgf, 0), 'kg/m² (grau)'], [t('storedCarbon'), fmt(r.bio / 1000, 0) + ' t', 'CO2'], [t('circularity'), r.circGrade, fmt(r.circScore, 0) + '/100']]);
    h2(t('byPhase')); await chart(ctx.charts.phases(P));
    h2(t('byElement')); await chart(ctx.charts.byElement(P));
    if (ctx.demo) {
      h2(t('existingTitle'));
      para(`${t('boundCo2')}: ${fmt(r.exA13 / 1000, 0)} t CO2e. ${t('keepVariant')}: ${fmt(ctx.demo.keep / 1000, 0)} t · ${t('newVariant')}: ${fmt(ctx.demo.newBuild / 1000, 0)} t.`);
    }

    section(t('targetsTitle'));
    const tg = r.targets;
    table([t('targetsTitle'), L('Wert', 'Value'), L('Ziel', 'Target'), 'Status'], [
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

    // ===== 2 Optimierungsvorschläge =====
    chapter(t('step5'));
    const ms = ctx.measures, o = ctx.opt;
    section(t('beforeAfter') + (ctx.selected.length ? '' : ' (' + t('none') + ')'));
    table(['', t('before'), t('after')], [
      [t('endEnergy') + ' kWh/m²a', fmt(r.endSpec, 0), fmt(o.endSpec, 0)], [t('effClass'), r.cls.c, o.cls.c],
      ['CO2 ' + L('Betrieb', 'operation') + ' t/a', fmt(r.co2Op / 1000, 1), fmt(o.co2Op / 1000, 1)],
      [t('co2Total') + ' t', fmt(r.lifeTotal / 1000, 0), fmt(o.lifeTotal / 1000, 0)], [t('co2PerNrfA'), fmt(r.lifeSpec, 1), fmt(o.lifeSpec, 1)],
      [t('totalCost'), '', fmt(ctx.totalCost, 0) + ' €'],
    ], [80, 50, 50]);
    section(L('Maßnahmen', 'Measures'));
    small(L('[x] = ausgewählt und im Vorher/Nachher-Vergleich berücksichtigt', '[x] = selected and included in the before/after comparison'));
    table([L('Maßnahme', 'Measure'), t('effort'), 'kWh/a', 't CO2e/50a', t('cost') + ' €', t('payback'), t('eurPerT')], ms.map(m => [
      (ctx.selected.includes(m.id) ? '[x] ' : '[ ] ') + I.MEASURE_TEXT[m.id][I.lang][0], t('ef_' + m.effort), fmt(m.dEnd, 0), fmt(m.dLife / 1000, 1),
      m.cost == null ? t('designCost') : fmt(m.cost, 0), m.payback != null ? fmt(m.payback, 0) + ' ' + t('years') : t('noPayback'), m.eurPerT != null ? fmt(m.eurPerT, 0) : '–']), [62, 18, 16, 16, 18, 18, 14]);
    if (ctx.ai && ctx.ai.texts && ms.some(m => ctx.ai.texts[m.id])) {
      section(L('Erläuterungen', 'Explanations'));
      ms.forEach(m => { const tx = ctx.ai.texts[m.id]; if (tx) { h2(I.MEASURE_TEXT[m.id][I.lang][0]); para(tx); } });
      if (ctx.ai.extra && ctx.ai.extra.length) { h2(t('aiExtra')); ctx.ai.extra.forEach(x => para('• ' + x.titel + ': ' + x.text)); }
    }

    // ===== 3 Variantenvergleich =====
    if (ctx.variants && ctx.variants.length > 1) {
      chapter(L('Variantenvergleich', 'Variant comparison'));
      table([''].concat(ctx.variants.map(v => t('variant') + ' ' + v.name)), ctx.variantRows, [60].concat(ctx.variants.map(() => 40)));
    }

    // ===== Annahmen & Quellen =====
    chapter(t('assumptions'));
    table([L('Thema', 'Topic'), L('Quelle / Annahme', 'Source / assumption')], D.SOURCES.map(s => EN ? [s[1], s[3]] : [s[0], s[2]]), [50, 130]);
    small(t('disclaimer'));

    // ===== Inhaltsverzeichnis ausfüllen =====
    doc.setPage(tocPage); y = M;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...ACC);
    doc.text(L('Inhalt', 'Contents'), M, y + 8); y += 13;
    doc.setDrawColor(...ACC); doc.setLineWidth(0.6); doc.line(M, y, M + CW, y); y += 9;
    toc.forEach(e => {
      const x = M + (e.lvl === 2 ? 9 : 0);
      if (e.lvl === 1 && y > M + 30) y += 3;
      doc.setFont('helvetica', e.lvl === 1 ? 'bold' : 'normal'); doc.setFontSize(e.lvl === 1 ? 11.5 : 10);
      doc.setTextColor(...(e.lvl === 1 ? FG : MU));
      const txt = pdfText(e.title), num = String(e.page);
      doc.text(txt, x, y);
      const tw = doc.getTextWidth(txt), nw = doc.getTextWidth(num);
      // Punktlinie bis zur Seitenzahl
      doc.setDrawColor(...LN); doc.setLineWidth(0.25); doc.setLineDashPattern([0.4, 1.2], 0);
      doc.line(x + tw + 2, y - 0.6, M + CW - nw - 2, y - 0.6); doc.setLineDashPattern([], 0);
      doc.text(num, M + CW, y, { align: 'right' });
      doc.link(x, y - 4.5, CW - (x - M), 6, { pageNumber: e.page });
      y += e.lvl === 1 ? 8.5 : 6.8;
    });

    // ===== Fußzeile auf jeder Seite =====
    const total = doc.getNumberOfPages();
    const aiNote = L('Teile der Auswertung (Planlesen, Erläuterungen, Fazit) können KI-gestützt erstellt sein – Angaben ohne Gewähr, bitte fachlich prüfen.',
      'Parts of this report (plan reading, explanations, summary) may be AI-assisted – no liability, please check professionally.');
    for (let p = 2; p <= total; p++) { // Deckblatt (Seite 1) ohne Fußzeile und Seitenzahl
      doc.setPage(p);
      const fy = H - 18;
      doc.setDrawColor(...LN); doc.setLineWidth(0.25); doc.line(M, fy, M + CW, fy);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(...MU);
      const lines = doc.splitTextToSize(pdfText('Greenprint – ' + t('disclaimer')), CW - 30).concat(doc.splitTextToSize(pdfText(aiNote), CW - 30));
      doc.text(lines, M, fy + 4);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...FG);
      doc.text(pdfText(`${L('Seite', 'Page')} ${p} / ${total}`), M + CW, fy + 4.6, { align: 'right' });
      doc.setFont('helvetica', 'normal');
    }
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
