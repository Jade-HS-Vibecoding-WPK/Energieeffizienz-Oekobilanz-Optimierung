/* Ökobilanz-Check – Diagramme (SVG) und Liniensymbole */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Farbsatz für Bildschirm (CSS-Variablen) und PDF (feste Werte)
  const SCREEN = {
    fg: 'var(--fg)', muted: 'var(--muted)', grid: 'var(--line)', bg: 'var(--bg)', accent: 'var(--accent)',
    s: ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)', 'var(--c7)'],
    good: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)', grey: 'var(--grey)', font: 'Inter, system-ui, sans-serif',
  };
  const PRINT = {
    fg: '#1d2620', muted: '#5f6b63', grid: '#d5dbd6', bg: '#ffffff', accent: '#1f5a3d',
    s: ['#1f5a3d', '#5f9a6e', '#a9c8a0', '#c98a3c', '#7b8f99', '#3f6f8f', '#b5653f'],
    good: '#2f8a45', warn: '#d29a16', bad: '#c2412d', grey: '#a8aea9', font: 'Helvetica, Arial, sans-serif',
  };

  function fmt(v, d) { return window.OBC_I18N.fmt(v, d); }

  // Horizontale Balken
  function hbars(items, o) {
    o = Object.assign({ w: 640, unit: '', dec: 0, labelW: 190, C: SCREEN, rowH: 30, max: null }, o || {});
    const C = o.C;
    const max = o.max || Math.max(1e-9, ...items.map(i => Math.abs(i.value)));
    const plotW = o.w - o.labelW - 110;
    const h = items.length * o.rowH + 10;
    let s = `<svg viewBox="0 0 ${o.w} ${h}" width="100%" role="img" xmlns="http://www.w3.org/2000/svg" style="font-family:${C.font}">`;
    items.forEach((it, i) => {
      const y = 5 + i * o.rowH;
      const bw = Math.max(0, (Math.abs(it.value) / max) * plotW);
      const col = it.color || C.s[i % C.s.length];
      s += `<text x="${o.labelW - 10}" y="${y + o.rowH / 2 + 4}" text-anchor="end" font-size="12" fill="${C.fg}">${esc(it.label)}</text>`;
      s += `<line x1="${o.labelW}" x2="${o.labelW}" y1="${y + 2}" y2="${y + o.rowH - 2}" stroke="${C.grid}"/>`;
      s += `<rect x="${o.labelW}" y="${y + 6}" width="${bw}" height="${o.rowH - 12}" fill="${col}" ${it.hatch ? `fill-opacity="0.35" stroke="${col}" stroke-dasharray="3 2"` : ''}/>`;
      s += `<text x="${o.labelW + bw + 8}" y="${y + o.rowH / 2 + 4}" font-size="12" fill="${C.fg}" style="font-variant-numeric:tabular-nums">${fmt(it.value, o.dec)} ${esc(o.unit)}${it.note ? ' · ' + esc(it.note) : ''}</text>`;
    });
    return s + '</svg>';
  }

  // Gestapelte horizontale Balken mit Legende
  function stacked(rows, o) {
    o = Object.assign({ w: 640, unit: '', dec: 0, labelW: 150, C: SCREEN, rowH: 34, max: null, legend: true }, o || {});
    const C = o.C;
    const totals = rows.map(r => r.parts.reduce((a, p) => a + Math.max(0, p.v), 0));
    const max = o.max || Math.max(1e-9, ...totals);
    const plotW = o.w - o.labelW - 100;
    const names = [];
    rows.forEach(r => r.parts.forEach((p, i) => { if (!names.find(n => n.name === p.name)) names.push({ name: p.name, color: p.color || C.s[i % C.s.length] }); }));
    const legH = o.legend ? Math.ceil(names.length / 3) * 20 + 8 : 0;
    const h = rows.length * o.rowH + 10 + legH;
    let s = `<svg viewBox="0 0 ${o.w} ${h}" width="100%" role="img" xmlns="http://www.w3.org/2000/svg" style="font-family:${C.font}">`;
    rows.forEach((r, i) => {
      const y = 5 + i * o.rowH;
      let x = o.labelW;
      s += `<text x="${o.labelW - 10}" y="${y + o.rowH / 2 + 4}" text-anchor="end" font-size="12" fill="${C.fg}">${esc(r.label)}</text>`;
      r.parts.forEach((p, j) => {
        const bw = (Math.max(0, p.v) / max) * plotW;
        const col = p.color || C.s[j % C.s.length];
        if (bw > 0) s += `<rect x="${x}" y="${y + 7}" width="${bw}" height="${o.rowH - 14}" fill="${col}" stroke="${C.bg}" stroke-width="1"><title>${esc(p.name)}: ${fmt(p.v, o.dec)} ${esc(o.unit)}</title></rect>`;
        x += bw;
      });
      s += `<text x="${x + 8}" y="${y + o.rowH / 2 + 4}" font-size="12" fill="${C.fg}" style="font-variant-numeric:tabular-nums">${fmt(totals[i], o.dec)} ${esc(o.unit)}</text>`;
    });
    if (o.legend) {
      const y0 = rows.length * o.rowH + 16;
      names.forEach((n, i) => {
        const cx = (i % 3) * (o.w / 3) + 10, cy = y0 + Math.floor(i / 3) * 20;
        s += `<rect x="${cx}" y="${cy}" width="11" height="11" fill="${n.color}"/><text x="${cx + 17}" y="${cy + 10}" font-size="11.5" fill="${C.muted}">${esc(n.name)}</text>`;
      });
    }
    return s + '</svg>';
  }

  // Gruppierte senkrechte Balken (Vorher/Nachher, Varianten)
  function grouped(cats, series, o) {
    o = Object.assign({ w: 640, h: 230, unit: '', dec: 0, C: SCREEN }, o || {});
    const C = o.C;
    const max = Math.max(1e-9, ...series.flatMap(s => s.values.map(v => Math.abs(v || 0))));
    const top = 22, bottom = 44, left = 12;
    const plotH = o.h - top - bottom;
    const gw = (o.w - left * 2) / cats.length;
    const bw = Math.min(46, (gw - 24) / series.length);
    let s = `<svg viewBox="0 0 ${o.w} ${o.h}" width="100%" role="img" xmlns="http://www.w3.org/2000/svg" style="font-family:${C.font}">`;
    s += `<line x1="${left}" x2="${o.w - left}" y1="${top + plotH}" y2="${top + plotH}" stroke="${C.grid}"/>`;
    cats.forEach((c, i) => {
      const gx = left + i * gw + (gw - bw * series.length) / 2;
      series.forEach((se, j) => {
        const v = se.values[i] || 0;
        const bh = (Math.abs(v) / max) * plotH;
        const x = gx + j * bw;
        const col = se.color || C.s[j % C.s.length];
        s += `<rect x="${x + 2}" y="${top + plotH - bh}" width="${bw - 4}" height="${bh}" fill="${col}" ${se.mark && se.mark[i] ? `stroke="${C.fg}" stroke-width="2"` : ''}><title>${esc(se.name)}: ${fmt(v, o.dec)}</title></rect>`;
        s += `<text x="${x + bw / 2}" y="${top + plotH - bh - 5}" text-anchor="middle" font-size="10.5" fill="${C.fg}" style="font-variant-numeric:tabular-nums">${fmt(v, o.dec)}</text>`;
      });
      s += `<text x="${left + i * gw + gw / 2}" y="${top + plotH + 16}" text-anchor="middle" font-size="11.5" fill="${C.fg}">${esc(c)}</text>`;
    });
    // Legende
    let lx = left;
    series.forEach((se, j) => {
      const col = se.color || C.s[j % C.s.length];
      s += `<rect x="${lx}" y="${o.h - 14}" width="11" height="11" fill="${col}"/><text x="${lx + 16}" y="${o.h - 5}" font-size="11.5" fill="${C.muted}">${esc(se.name)}</text>`;
      lx += 22 + esc(se.name).length * 6.6;
    });
    if (o.unit) s += `<text x="${o.w - left}" y="12" text-anchor="end" font-size="11" fill="${C.muted}">${esc(o.unit)}</text>`;
    return s + '</svg>';
  }

  // Effizienzskala A+ bis H
  function classScale(value, o) {
    o = Object.assign({ w: 640, C: SCREEN }, o || {});
    const C = o.C;
    const cls = window.OBC_DATA.CLASSES;
    const n = cls.length, segW = (o.w - 20) / n, y = 30, h = 30;
    const active = cls.findIndex(c => value < c.max);
    let s = `<svg viewBox="0 0 ${o.w} 92" width="100%" role="img" xmlns="http://www.w3.org/2000/svg" style="font-family:${C.font}">`;
    cls.forEach((c, i) => {
      const x = 10 + i * segW;
      s += `<path d="M${x} ${y} h${segW - 8} l8 ${h / 2} l-8 ${h / 2} h-${segW - 8} z" fill="${c.col}" ${i === active ? `stroke="${C.fg}" stroke-width="2.5"` : 'opacity="0.85"'}/>`;
      s += `<text x="${x + segW / 2 - 4}" y="${y + 20}" text-anchor="middle" font-size="13" font-weight="700" fill="${i >= 3 && i <= 5 ? '#1d2620' : '#ffffff'}">${c.c}</text>`;
      const lim = c.max === Infinity ? '' : c.max;
      s += `<text x="${x + segW - 4}" y="${y + h + 16}" text-anchor="middle" font-size="10" fill="${C.muted}">${lim}</text>`;
    });
    // Zeiger
    let pos = 10;
    if (active >= 0) {
      const lo = active === 0 ? 0 : cls[active - 1].max;
      const hi = cls[active].max === Infinity ? lo + 100 : cls[active].max;
      pos = 10 + active * segW + Math.min(1, (value - lo) / (hi - lo)) * (segW - 8);
    }
    s += `<path d="M${pos - 7} 6 h14 l-7 14 z" fill="${C.fg}"/><text x="${Math.min(o.w - 60, Math.max(40, pos))}" y="${4}" dy="0" text-anchor="middle" font-size="0" fill="${C.fg}"></text>`;
    s += `<text x="${o.w - 10}" y="${y + h + 16}" text-anchor="end" font-size="10" fill="${C.muted}">kWh/m²a</text>`;
    return s + '</svg>';
  }

  // Balken mit Zielmarke
  function targetBar(value, limit, o) {
    o = Object.assign({ w: 300, C: SCREEN, limit2: null, status: 'ok' }, o || {});
    const C = o.C;
    const max = Math.max(value, limit, o.limit2 || 0) * 1.15 || 1;
    const sx = v => 4 + (v / max) * (o.w - 8);
    const col = { ok: C.good, near: C.warn, fail: C.bad }[o.status] || C.grey;
    let s = `<svg viewBox="0 0 ${o.w} 30" width="100%" role="img" xmlns="http://www.w3.org/2000/svg" style="font-family:${C.font}">`;
    s += `<rect x="4" y="10" width="${o.w - 8}" height="10" fill="${C.grid}" opacity="0.6"/>`;
    s += `<rect x="4" y="10" width="${Math.max(2, sx(value) - 4)}" height="10" fill="${col}"/>`;
    if (o.limit2) s += `<line x1="${sx(o.limit2)}" x2="${sx(o.limit2)}" y1="5" y2="25" stroke="${C.muted}" stroke-width="1.5" stroke-dasharray="3 2"/>`;
    s += `<line x1="${sx(limit)}" x2="${sx(limit)}" y1="3" y2="27" stroke="${C.fg}" stroke-width="2"/>`;
    return s + '</svg>';
  }

  // Vergleichsleiste Standort vs. EU
  function compareRow(label, v, ref, max, o) {
    o = Object.assign({ w: 640, C: SCREEN, unit: '' }, o || {});
    const C = o.C;
    const lw = 190, pw = o.w - lw - 120;
    const sx = x => lw + (Math.min(x, max) / max) * pw;
    let s = `<svg viewBox="0 0 ${o.w} 34" width="100%" role="img" xmlns="http://www.w3.org/2000/svg" style="font-family:${C.font}">`;
    s += `<text x="${lw - 10}" y="21" text-anchor="end" font-size="12" fill="${C.fg}">${esc(label)}</text>`;
    s += `<rect x="${lw}" y="12" width="${pw}" height="10" fill="${C.grid}" opacity="0.6"/>`;
    s += `<rect x="${lw}" y="12" width="${Math.max(2, sx(v) - lw)}" height="10" fill="${C.accent}"/>`;
    s += `<line x1="${sx(ref)}" x2="${sx(ref)}" y1="6" y2="28" stroke="${C.fg}" stroke-width="1.5" stroke-dasharray="3 2"/>`;
    s += `<text x="${lw + pw + 8}" y="21" font-size="12" fill="${C.fg}" style="font-variant-numeric:tabular-nums">${fmt(v, 0)} ${esc(o.unit)}</text>`;
    return s + '</svg>';
  }

  // ---------- Liniensymbole (24×24, Strich) ----------
  const P = {
    wall: 'M3 4h18v16H3zM3 9h18M3 14h18M9 4v5M15 9v5M9 14v6',
    roof: 'M2 12 12 4l10 8M5 10v10h14V10',
    floor: 'M3 15h18M3 19h18M6 15l3-6h6l3 6',
    slab: 'M3 9h18v4H3zM6 13v6M18 13v6',
    window: 'M5 3h14v18H5zM12 3v18M5 12h14',
    sun: 'M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10M12 1v3M12 20v3M1 12h3M20 12h3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1',
    heat: 'M8 21c-2-2-2-4 0-6s2-4 0-6M12 21c-2-2-2-4 0-6s2-4 0-6M16 21c-2-2-2-4 0-6s2-4 0-6',
    leaf: 'M5 19c0-9 6-14 15-14c0 9-5 15-14 15M5 19l7-7',
    recycle: 'M7 9 4 14h6M17 9l3 5h-6M10 4h4l2 4M8 18l-2 2M12 20H8l-2-3M18 17l-2 3h-4',
    euro: 'M17 6a7 7 0 1 0 0 12M4 10h9M4 14h9',
    drop: 'M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11',
    plant: 'M12 21v-9M12 12c0-4 3-7 7-7c0 4-3 7-7 7M12 15c0-3-2-5-6-5c0 3 2 5 6 5M7 21h10',
    light: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3',
    cube: 'M12 2 3 7v10l9 5 9-5V7zM3 7l9 5 9-5M12 12v10',
    chat: 'M4 5h16v11H9l-5 4z',
    upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
    download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
    plan: 'M3 3h18v18H3zM3 10h8v11M11 14h10M15 3v7',
    pump: 'M4 4h16v16H4zM12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8M12 12l3-2',
    fan: 'M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M12 10c0-4 1-6 4-6c1 3-1 5-4 6M14 12c4 0 6 1 6 4c-3 1-5-1-6-4M12 14c0 4-1 6-4 6c-1-3 1-5 4-6M10 12c-4 0-6-1-6-4c3-1 5 1 6 4',
    target: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8M12 11.5v1',
    layers: 'M12 3 2 8l10 5 10-5zM2 13l10 5 10-5M2 17l10 5 10-5',
    pin: 'M12 22s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12M12 7a3 3 0 1 0 0 6a3 3 0 1 0 0-6',
    variants: 'M3 4h7v7H3zM14 4h7v7h-7zM3 15h7v5H3zM14 15h7v5h-7z',
    info: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 11v6M12 7.5v.5',
    stop: 'M6 6h12v12H6z',
    plus: 'M12 5v14M5 12h14',
    x: 'M6 6l12 12M18 6 6 18',
    file: 'M6 2h9l5 5v15H6zM15 2v5h5',
    globe: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
    rotate: 'M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4',
  };
  function icon(name, size) {
    const d = P[name] || P.info;
    const z = size || 18;
    return `<svg class="ico" width="${z}" height="${z}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="${d}"/></svg>`;
  }
  const KIND_ICON = { AW: 'wall', DA: 'roof', BO: 'floor', DE: 'slab', IW: 'wall', FE: 'window' };

  window.OBC_CHARTS = { hbars, stacked, grouped, classScale, targetBar, compareRow, icon, KIND_ICON, SCREEN, PRINT, esc };
})();
