/* Ökobilanz-Check – Rechenkern
   Vereinfachtes Heizperiodenverfahren + Kühlabschätzung, Ökobilanz A1–A3, B4, B6, C3–C4 über 50 Jahre.
*/
(function () {
  'use strict';
  const D = window.OBC_DATA;
  const YEARS = D.YEARS;
  const RS = { AW: [0.13, 0.04], DA: [0.10, 0.04], BO: [0.17, 0.0] };
  const FX = { AW: 1, DA: 1, BO: 0.6 };
  const ENVELOPE = ['AW', 'DA', 'BO'];

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
  const clone = o => JSON.parse(JSON.stringify(o));
  let uid = 0;
  const newId = p => (p || 'id') + '_' + Date.now().toString(36) + '_' + (uid++).toString(36);

  function orientKey(az) {
    const a = ((num(az) % 360) + 360) % 360;
    if (a >= 315 || a < 45) return 'N';
    if (a < 135) return 'E';
    if (a < 225) return 'S';
    return 'W';
  }

  // Einstrahlung auf senkrechte Fläche relativ zur Globalstrahlung
  function solarFactor(az) {
    const r = (num(az) * Math.PI) / 180;
    return 0.28 + (0.68 - 0.28) * (1 - Math.cos(r)) / 2 + 0.07 * Math.sin(r) ** 2;
  }
  // Gewichtung für sommerliche Last (Westen am ungünstigsten)
  function summerWeight(az) {
    const r = (num(az) * Math.PI) / 180;
    return 0.3 + 0.5 * (1 - Math.cos(r)) / 2 + 0.25 * Math.max(0, -Math.sin(r)) + 0.1 * Math.max(0, Math.sin(r));
  }

  function climateOf(st) {
    const loc = D.LOC[st.loc] || D.LOC.de_ol;
    const c = D.COUNTRIES[loc.cc];
    const o = st.clim || {};
    return {
      loc, country: c, cc: loc.cc,
      hdd: o.hdd != null && o.hdd !== '' ? num(o.hdd) : loc.hdd,
      cdd: o.cdd != null && o.cdd !== '' ? num(o.cdd) : loc.cdd,
      gh: o.gh != null && o.gh !== '' ? num(o.gh) : loc.gh,
    };
  }

  function prices(st, cl) {
    const p = st.prices || {};
    const el = p.el != null && p.el !== '' ? num(p.el) : cl.country.pel;
    const gas = p.gas != null && p.gas !== '' ? num(p.gas) : cl.country.pgas;
    return { el, gas, oil: gas * 1.1, wood: 0.08, district: gas * 1.2 };
  }

  function layersOf(el) {
    if (el.layers && el.layers.length) return el.layers;
    const c = D.CON[el.con];
    return c ? c.layers : [];
  }
  function connOf(el) {
    return el.conn || (D.CON[el.con] && D.CON[el.con].conn) || 'teilweise';
  }

  function uValue(kind, layers) {
    const rs = RS[kind];
    if (!rs) return null;
    let R = rs[0] + rs[1];
    for (const l of layers) {
      const m = D.MAT[l.mat];
      if (!m || l.th === false) continue;
      R += num(l.d) / m.lambda;
    }
    return 1 / R;
  }

  // Kennwerte je m² Bauteil; split: gezählt (neu) vs. Bestand
  function elementPerM2(el) {
    const layers = layersOf(el);
    const out = { mass: 0, a13: 0, b4: 0, c34: 0, penrt: 0, bio: 0, exA13: 0, exBio: 0, circMass: 0, circSum: 0 };
    for (const l of layers) {
      const m = D.MAT[l.mat];
      if (!m) continue;
      const mass = num(l.d) * m.rho;
      const isNew = !el.existing || l.n;
      const a13 = mass * m.gwp, c34 = mass * m.eol;
      const repl = Math.max(0, Math.ceil(YEARS / m.life) - 1);
      out.mass += mass;
      out.circMass += mass; out.circSum += mass * m.circ;
      if (isNew) {
        out.a13 += a13; out.c34 += c34; out.b4 += repl * (a13 + c34);
        out.penrt += mass * m.penrt * (1 + repl); out.bio += mass * m.bio;
      } else {
        out.exA13 += a13; out.exBio += mass * m.bio;
        // Bauteile im Bestand, die in 50 Jahren ersetzt werden müssten (z. B. Putz), zählen als künftige Erneuerung
        if (el.retrofit !== false && repl > 0) { out.b4 += repl * (a13 + c34); out.penrt += mass * m.penrt * repl; }
      }
    }
    const connF = { loesbar: 1, teilweise: 0.85, verklebt: 0.65 }[connOf(el)] || 0.85;
    out.circ = out.circMass ? (out.circSum / out.circMass) * connF : 0;
    return out;
  }

  function circGrade(s) {
    return s >= 80 ? 'A' : s >= 65 ? 'B' : s >= 50 ? 'C' : s >= 35 ? 'D' : 'E';
  }
  function energyClass(e) {
    return D.CLASSES.find(c => e < c.max) || D.CLASSES[D.CLASSES.length - 1];
  }

  function hpJaz(kind, hdd) {
    return kind === 'ground' ? clamp(4.2 - hdd / 10000, 3.4, 4.2) : clamp(3.6 - hdd / 5000, 2.3, 3.6);
  }

  // ---------- Hauptberechnung ----------
  function calc(stIn) {
    const st = stIn;
    const cl = climateOf(st);
    const bt = D.BT[st.type] || D.BT.wohnen;
    const g = st.geo || {};
    const bgf = Math.max(1, num(g.bgf, 100));
    const nrf = Math.max(1, num(g.nrf, bgf * 0.8));
    const vol = Math.max(1, num(g.volume, bgf * 3));
    const tech = Object.assign({ heat: 'gas_bw', cool: 'auto', vent: 'window', night: false, pv: 0, st: false, rain: false, coolRoof: false, wb: 0.05, n: 0.6 }, st.tech || {});
    const adj = Object.assign({ rot: 0, win: { N: 1, E: 1, S: 1, W: 1 }, shade: {} }, st.adj || {});
    const pr = prices(st, cl);
    const country = cl.country;
    const costF = country.cost / 100;

    // Fenster mit Anpassungen (Drehung, Fensteranteil, Verschattung)
    const winDelta = { N: 0, E: 0, S: 0, W: 0 };
    const wins = (st.windows || []).map(w => {
      const az = (num(w.az) + num(adj.rot)) % 360;
      const keyBase = orientKey(num(w.az));
      const key = orientKey(az);
      const sc = num((adj.win || {})[keyBase], 1);
      const area = Math.max(0, num(w.area) * sc);
      winDelta[keyBase] += area - num(w.area);
      const type = D.WIN[w.type] || D.WIN.w_2wsv;
      const shOver = (adj.shade || {})[keyBase];
      const shade = shOver === true ? 'external' : shOver === false ? 'none' : (w.shade || 'none');
      return { src: w, id: w.id, az, key, area, type, shade, existing: !!w.existing };
    });

    // Wandflächen um zusätzliche Fensterfläche reduzieren
    const awByKey = { N: 0, E: 0, S: 0, W: 0 };
    (st.elements || []).forEach(e => { if (e.kind === 'AW') awByKey[orientKey(num(e.az))] += num(e.area); });

    const els = (st.elements || []).map(e => {
      let area = Math.max(0, num(e.area));
      let az = e.kind === 'AW' ? (num(e.az) + num(adj.rot)) % 360 : null;
      if (e.kind === 'AW') {
        const k = orientKey(num(e.az));
        if (awByKey[k] > 0 && winDelta[k]) area = Math.max(0, area - winDelta[k] * (num(e.area) / awByKey[k]));
      }
      const layers = layersOf(e);
      const U = ENVELOPE.includes(e.kind) ? uValue(e.kind, layers) : null;
      const p = elementPerM2(e);
      return { src: e, id: e.id, kind: e.kind, area, az, key: az != null ? orientKey(az) : null, U, p, existing: !!e.existing };
    });

    // ---- Wärmeverluste ----
    const env = els.filter(e => ENVELOPE.includes(e.kind));
    const winArea = wins.reduce((s, w) => s + w.area, 0);
    const envArea = env.reduce((s, e) => s + e.area, 0) + winArea;
    const htParts = { AW: 0, DA: 0, BO: 0, FE: 0, WB: 0 };
    env.forEach(e => { e.HT = e.U * e.area * FX[e.kind]; htParts[e.kind] += e.HT; });
    wins.forEach(w => { w.HT = w.type.uw * w.area; htParts.FE += w.HT; });
    htParts.WB = num(tech.wb, 0.05) * envArea;
    const HT = htParts.AW + htParts.DA + htParts.BO + htParts.FE + htParts.WB;
    const nBase = num(tech.n, 0.6);
    const nEff = tech.vent === 'mvhr' ? 0.25 * nBase + 0.1 : tech.vent === 'exhaust' ? nBase * 0.9 : nBase;
    const Vn = 0.8 * vol;
    const HV = 0.34 * nEff * Vn;

    // ---- Heizperiode ----
    const hdd = cl.hdd, cdd = cl.cdd, gh = cl.gh;
    const days = clamp(hdd / 17, 0, 300);
    const fhp = (days / 365) * 0.75;
    let Qs = 0;
    wins.forEach(w => { w.Ihp = solarFactor(w.az) * gh * fhp; w.Qs = w.area * w.type.g * 0.9 * 0.7 * 0.9 * w.Ihp; Qs += w.Qs; });
    const Qi = bt.qi * nrf * days * 24 / 1000;
    const lossT = 0.024 * hdd * HT, lossV = 0.024 * hdd * HV;
    const loss = lossT + lossV;
    // Speichermasse
    const massTot = els.reduce((s, e) => s + e.p.mass * e.area, 0);
    const massPerNrf = massTot / nrf;
    const massClass = massPerNrf > 1000 ? 'heavy' : massPerNrf < 500 ? 'light' : 'medium';
    const cm = { light: 50, medium: 90, heavy: 130 }[massClass];
    const tau = (cm * nrf) / Math.max(1, HT + HV);
    const a = 1 + tau / 15;
    const gains = Qs + Qi;
    const gamma = loss > 0 ? gains / loss : 99;
    const eta = Math.abs(gamma - 1) < 1e-6 ? a / (a + 1) : (1 - gamma ** a) / (1 - gamma ** (a + 1));
    const Qh = Math.max(0, loss - eta * gains);

    // ---- Kühlung / Sommer ----
    const FC = { none: 1, internal: 0.65, external: 0.25 };
    let gainIdx = 0;
    wins.forEach(w => { gainIdx += w.area * w.type.g * FC[w.shade] * summerWeight(w.az); });
    const fGain = gainIdx / Math.max(1, nrf * 0.2 * 0.6 * 0.65 * 0.6);
    const massF = { heavy: 0.85, medium: 1, light: 1.15 }[massClass];
    const nightF = tech.night ? 0.75 : 1;
    const roofF = tech.coolRoof ? 0.92 : 1;
    const greenRoof = els.some(e => e.kind === 'DA' && (D.CON[e.src.con] || {}).green) || !!tech.green;
    const greenF = greenRoof ? 0.95 : 1;
    const Qc = cdd * 0.04 * nrf * (0.4 + 0.6 * fGain) * bt.cool * massF * nightF * roofF * greenF;
    const coolActive = tech.cool === 'split' || (tech.cool === 'auto' && cdd >= 150);
    const riskIdx = (0.4 + 0.6 * fGain) * (0.35 + cdd / 300) * massF * nightF;
    const summerRisk = riskIdx < 0.7 ? 'low' : riskIdx < 1.2 ? 'medium' : 'high';

    // ---- Warmwasser ----
    const Qww = bt.ww * nrf;
    const stShare = tech.st ? (st.type === 'wohnen' ? 0.55 : 0.4) : 0;

    // ---- Endenergie ----
    const heat = D.HEAT[tech.heat] || D.HEAT.gas_bw;
    const end = { gas: 0, oil: 0, wood: 0, district: 0, el: 0 };
    let jaz = null;
    let eHeat, eWw;
    if (heat.hp) {
      jaz = hpJaz(heat.hp, hdd);
      eHeat = Qh / jaz; eWw = (Qww * (1 - stShare)) / (jaz * 0.85);
    } else {
      eHeat = Qh * heat.eff; eWw = Qww * (1 - stShare) * heat.eff * 1.15;
    }
    end[heat.carrier] += eHeat + eWw;
    const eCool = coolActive ? Qc / 3.0 : 0;
    const eAux = bt.aux * nrf + (tech.vent === 'mvhr' ? 3 * nrf : tech.vent === 'exhaust' ? 1.5 * nrf : 0) + (tech.st ? 0.5 * nrf * 0.1 : 0);
    end.el += eCool + eAux;
    const elDemand = end.el;
    // Photovoltaik
    const kwp = Math.max(0, num(tech.pv));
    const pvYield = kwp * gh * 0.85;
    const selfShare = Math.min(0.6, 0.3 + (heat.hp ? 0.1 : 0) + (coolActive ? 0.1 : 0));
    const pvSelf = Math.min(pvYield * selfShare, elDemand * 0.6);
    const pvExport = pvYield - pvSelf;
    end.el = Math.max(0, end.el - pvSelf);
    const endTotal = end.gas + end.oil + end.wood + end.district + end.el;
    const endSpec = endTotal / nrf;
    const cls = energyClass(endSpec);

    // ---- Betrieb: CO2 / PEnrt / Kosten ----
    const co2f = { gas: D.CARRIERS.gas.co2, oil: D.CARRIERS.oil.co2, wood: D.CARRIERS.wood.co2, district: D.CARRIERS.district.co2, el: country.co2 };
    const pef = { gas: D.CARRIERS.gas.pe, oil: D.CARRIERS.oil.pe, wood: D.CARRIERS.wood.pe, district: D.CARRIERS.district.pe, el: country.pe };
    let co2Op = 0, peOp = 0, costOp = 0;
    for (const k of Object.keys(end)) { co2Op += end[k] * co2f[k]; peOp += end[k] * pef[k]; costOp += end[k] * pr[k]; }
    const pvExportCo2 = pvExport * country.co2; // nur Information (Modul D)

    // ---- Graue Emissionen ----
    let a13 = 0, b4 = 0, c34 = 0, penrtEmb = 0, bio = 0, exA13 = 0, exBio = 0;
    const embByKind = { AW: 0, DA: 0, BO: 0, DE: 0, IW: 0, FE: 0, TGA: 0, PV: 0 };
    let circMass = 0, circSum = 0;
    els.forEach(e => {
      const A = e.area;
      e.emb = { a13: e.p.a13 * A, b4: e.p.b4 * A, c34: e.p.c34 * A, ex: e.p.exA13 * A, bio: e.p.bio * A };
      a13 += e.emb.a13; b4 += e.emb.b4; c34 += e.emb.c34; penrtEmb += e.p.penrt * A; bio += e.emb.bio;
      exA13 += e.emb.ex; exBio += e.p.exBio * A;
      embByKind[e.kind] += e.emb.a13 + e.emb.b4 + e.emb.c34;
      circMass += e.p.mass * A; circSum += e.p.circ * e.p.mass * A;
      e.co2m2 = e.p.a13 + e.p.b4 + e.p.c34;
      e.circGrade = circGrade(e.p.circ);
    });
    wins.forEach(w => {
      const isNew = !w.existing;
      const repl = Math.max(0, Math.ceil(YEARS / w.type.life) - 1);
      const A = w.area;
      if (isNew) {
        const ea = w.type.gwp * A, eb = repl * w.type.gwp * A * 1.05, ec = 0.05 * w.type.gwp * A;
        a13 += ea; b4 += eb; c34 += ec; penrtEmb += w.type.penrt * A * (1 + repl); bio += w.type.bio * A;
        embByKind.FE += ea + eb + ec; w.co2m2 = w.type.gwp * (1 + repl * 1.05 + 0.05);
      } else {
        exA13 += w.type.gwp * A; exBio += w.type.bio * A;
        const eb = repl * w.type.gwp * A; b4 += eb; embByKind.FE += eb; w.co2m2 = repl * w.type.gwp;
      }
      const wm = 30; circMass += wm * A; circSum += w.type.circ * wm * A;
    });
    // Technik (TGA) pauschal, nur Neubau bzw. neue Anlage
    const tgaCount = st.mode === 'new' ? bt.tga * bgf : (st.tech && st.tech.newSystem ? bt.tga * 0.5 * bgf : 0);
    const tgaB4 = tgaCount * 0.6; // Austausch Anlagentechnik nach ca. 20–30 Jahren
    embByKind.TGA = tgaCount + tgaB4;
    a13 += tgaCount; b4 += tgaB4;
    // PV
    const pvEmb = kwp * 700, pvB4 = kwp * 700;
    embByKind.PV = pvEmb + pvB4; a13 += pvEmb; b4 += pvB4;

    const embTotal = a13 + b4 + c34;
    const b6 = co2Op * YEARS;
    const lifeTotal = embTotal + b6;
    const gia = 0.92 * bgf;

    // ---- Kreislauf ----
    const circScore = circMass ? circSum / circMass : 0;

    // ---- Tageslicht / Komfort ----
    const wfr = winArea / nrf;
    const daylight = wfr < 0.1 ? 'low' : wfr > 0.35 ? 'high' : 'ok';

    // ---- Begrünung & Wasser ----
    const roofArea = els.filter(e => e.kind === 'DA').reduce((s, e) => s + e.area, 0);
    const flatRoof = els.filter(e => e.kind === 'DA' && (e.src.flat || (D.CON[e.src.con] || {}).flat)).reduce((s, e) => s + e.area, 0);
    const rain = 0.7; // m/a (Annahme)
    const runoff = roofArea * rain * (greenRoof ? 0.5 : 0.9);
    const rainPotential = roofArea * rain * 0.8;

    // ---- Heizlast (für Kosten Wärmepumpe) ----
    const dT = clamp(15 + hdd / 150, 15, 45);
    const heatLoad = ((HT + HV) * dT) / 1000;

    // ---- Zielwerte ----
    const qhSpec = Qh / nrf;
    const peSpec = peOp / nrf;
    const lifeSpec = lifeTotal / nrf / YEARS;
    const ribaKey = bt.riba;
    const riba = D.TARGETS.riba[ribaKey];
    const ribaOp = endTotal / gia;
    const ribaEmb = embTotal / gia;
    const nzebLim = st.type === 'wohnen' ? D.TARGETS.nzeb.penrtRes : D.TARGETS.nzeb.penrtNonRes;
    const status = (v, lim, near = 1.3) => (v <= lim ? 'ok' : v <= lim * near ? 'near' : 'fail');
    const levelsBand = D.TARGETS.levels.find(b => lifeSpec < b.max);
    const targets = {
      passivhaus: { value: qhSpec, limit: D.TARGETS.passivhaus.qh, status: status(qhSpec, 15, 1.67) },
      nzeb: { value: peSpec, limit: nzebLim, status: status(peSpec, nzebLim), fossil: !!heat.fossil },
      ribaOp: { value: ribaOp, limit: riba.op2030, limit2025: riba.op2025, status: status(ribaOp, riba.op2030, riba.op2025 / riba.op2030) },
      ribaEmb: { value: ribaEmb, limit: riba.emb2030, limit2025: riba.emb2025, status: status(ribaEmb, riba.emb2030, riba.emb2025 / riba.emb2030) },
      levels: { value: lifeSpec, band: levelsBand.key, status: levelsBand.key === 'veryGood' || levelsBand.key === 'good' ? 'ok' : levelsBand.key === 'medium' ? 'near' : 'fail' },
    };

    // A/V
    const av = (envArea) / vol;

    return {
      cl, bt, heat, pr, costF, bgf, nrf, vol, gia, av,
      els, wins, winArea, envArea, roofArea, flatRoof,
      HT, HV, htParts, nEff, lossT, lossV, loss, Qs, Qi, gains, gamma, eta, a, tau, days, fhp, massClass, massPerNrf,
      Qh, qhSpec, Qc, coolActive, fGain, riskIdx, summerRisk, Qww, stShare,
      jaz, end, eHeat, eWw, eCool, eAux, endTotal, endSpec, cls,
      kwp, pvYield, pvSelf, pvExport, pvExportCo2,
      co2Op, peOp, peSpec, costOp, co2f, pef,
      a13, b4, c34, penrtEmb, bio, exA13, exBio, embByKind, embTotal, b6, lifeTotal, lifeSpec,
      embPerBgf: embTotal / bgf, lifePerBgf: lifeTotal / bgf,
      circScore, circGrade: circGrade(circScore),
      wfr, daylight, greenRoof, runoff, rainPotential,
      heatLoad, dT, targets, tech,
    };
  }

  // ---------- Bestand: Vergleich Erhalt vs. Neubau ----------
  const REF = { AW: 'aw_ref_neubau', DA: 'da_ref_neubau', BO: 'bo_ref_neubau', DE: 'de_stb', IW: 'iw_ks' };
  function demolitionCompare(st, res) {
    if (st.mode !== 'existing') return null;
    const ref = clone(st);
    ref.mode = 'new';
    ref.elements.forEach(e => { e.existing = false; e.con = REF[e.kind] || e.con; delete e.layers; delete e.conn; });
    ref.windows.forEach(w => { w.existing = false; w.type = 'w_3_pvc'; });
    ref.tech = Object.assign({}, ref.tech, { heat: 'hp_air', wb: 0.05, n: 0.6, vent: 'exhaust' });
    ref.adj = null;
    const r = calc(ref);
    // Abriss: Entsorgung der vorhandenen Baustoffe
    let demo = 0;
    (st.elements || []).forEach(e => {
      if (!e.existing) return;
      layersOf(e).forEach(l => { const m = D.MAT[l.mat]; if (m && !l.n) demo += num(l.d) * m.rho * m.eol * num(e.area); });
    });
    return { keep: res.lifeTotal, newBuild: r.lifeTotal + demo, newEmb: r.embTotal, demo, newOp: r.b6, keepEmb: res.embTotal, keepOp: res.b6, saving: r.lifeTotal + demo - res.lifeTotal };
  }

  // ---------- Optimierungsmaßnahmen ----------
  function ensureLayers(e) {
    if (!e.layers || !e.layers.length) {
      const c = D.CON[e.con];
      e.layers = c ? clone(c.layers) : [];
      e.conn = e.conn || (c && c.conn) || 'teilweise';
      e.con = 'custom';
    }
    return e.layers;
  }
  function addInsulation(e, mat, targetU) {
    const L = ensureLayers(e);
    const U = uValue(e.kind, L);
    if (!U || U <= targetU) return 0;
    const m = D.MAT[mat];
    let d = m.lambda * (1 / targetU - 1 / U);
    d = Math.max(0.04, Math.ceil(d * 50) / 50);
    const layer = { mat, d, th: true, n: true };
    if (e.kind === 'BO') L.push(layer); else L.unshift(layer);
    if (e.kind === 'AW') L.unshift({ mat: 'kalkzementputz', d: 0.01, th: true, n: true });
    return d;
  }
  const isWoodish = e => layersOf(e).some(l => (D.MAT[l.mat] || {}).cat === 'wood');
  const hasMat = (e, ids) => layersOf(e).some(l => ids.includes(l.mat) && (!e.existing || l.n));

  const MEASURES = [
    // Entwurf
    { id: 'm_compact', group: 'design', effort: 'design',
      ok: (s, r) => s.mode === 'new' && r.av > (r.bgf < 400 ? 0.75 : r.bgf < 2000 ? 0.5 : 0.35),
      apply: s => { s.elements.forEach(e => { if (e.kind === 'AW' || e.kind === 'DA') e.area = num(e.area) * 0.9; }); },
      cost: () => null, affected: s => s.elements.filter(e => e.kind === 'AW' || e.kind === 'DA').map(e => e.id) },
    { id: 'm_orient', group: 'design', effort: 'design',
      ok: (s, r) => {
        if (s.mode !== 'new') return false;
        const by = { N: 0, E: 0, S: 0, W: 0 }; r.wins.forEach(w => { by[w.key] += w.area; });
        const tot = r.winArea || 1;
        return (r.cl.hdd > 2000 && by.N > by.S * 0.8 && by.N > 0) || (r.cl.cdd > 300 && by.W / tot > 0.15);
      },
      apply: (s, r) => {
        const hot = r.cl.cdd > 300 && r.cl.hdd <= 2000;
        s.windows.forEach(w => {
          const k = orientKey(w.az);
          if (!hot && k === 'N') { const mv = num(w.area) * 0.25; w.area = num(w.area) - mv; s.windows.push({ id: newId('w'), az: 180, area: mv, type: w.type, shade: w.shade, existing: false, moved: true }); }
          if (hot && k === 'W') { const mv = num(w.area) * 0.3; w.area = num(w.area) - mv; s.windows.push({ id: newId('w'), az: 0, area: mv, type: w.type, shade: w.shade, existing: false, moved: true }); }
        });
      },
      cost: () => null, affected: s => s.windows.map(w => w.id) },

    // Konstruktion & Material
    { id: 'm_timber', group: 'material', effort: 'high',
      ok: (s) => s.mode === 'new' && s.elements.some(e => (e.kind === 'AW' || e.kind === 'IW') && !e.existing && !isWoodish(e)),
      apply: s => s.elements.forEach(e => {
        if (e.existing) return;
        const flat = e.kind === 'DA' && (D.CON[e.con] || {}).flat;
        const map = { AW: 'aw_holzrahmen_zell', IW: 'iw_holz_lehm', DA: flat ? ((D.CON[e.con] || {}).green ? 'da_gruen_bsp' : 'da_flach_bsp') : 'da_steil_zell' };
        if (map[e.kind] && !isWoodish(e)) { e.con = map[e.kind]; delete e.layers; delete e.conn; }
      }),
      cost: (s, r) => 25 * r.bgf, affected: s => s.elements.filter(e => ['AW', 'IW', 'DA'].includes(e.kind) && !e.existing).map(e => e.id) },
    { id: 'm_hbv', group: 'material', effort: 'med',
      ok: s => s.elements.some(e => e.kind === 'DE' && !e.existing && hasMat(e, ['stahlbeton', 'beton', 'cem3_beton', 'rc_beton'])),
      apply: s => s.elements.forEach(e => { if (e.kind === 'DE' && !e.existing) { e.con = 'de_hbv'; delete e.layers; delete e.conn; } }),
      cost: s => 40 * s.elements.filter(e => e.kind === 'DE' && !e.existing).reduce((a, e) => a + num(e.area), 0),
      affected: s => s.elements.filter(e => e.kind === 'DE' && !e.existing).map(e => e.id) },
    { id: 'm_lowcem', group: 'material', effort: 'low',
      ok: s => s.elements.some(e => hasMat(e, ['stahlbeton', 'beton'])),
      apply: s => s.elements.forEach(e => {
        if (!hasMat(e, ['stahlbeton', 'beton'])) return;
        ensureLayers(e).forEach(l => { if (e.existing && !l.n) return; if (l.mat === 'stahlbeton') l.mat = 'cem3_beton'; else if (l.mat === 'beton') l.mat = 'rc_beton'; });
      }),
      cost: (s, r) => 4 * r.bgf, affected: s => s.elements.filter(e => hasMat(e, ['stahlbeton', 'beton'])).map(e => e.id) },
    { id: 'm_bioins', group: 'material', effort: 'low',
      ok: s => s.elements.some(e => e.kind !== 'BO' && hasMat(e, ['eps', 'pir', 'glaswolle', 'steinwolle'])),
      apply: s => s.elements.forEach(e => {
        if (e.kind === 'BO' || !hasMat(e, ['eps', 'pir', 'glaswolle', 'steinwolle'])) return;
        ensureLayers(e).forEach(l => {
          if ((e.existing && !l.n) || !['eps', 'pir', 'glaswolle', 'steinwolle'].includes(l.mat)) return;
          const old = D.MAT[l.mat], nw = D.MAT[e.kind === 'IW' ? 'zellulose' : 'holzfaser'];
          l.d = Math.ceil((l.d * nw.lambda / old.lambda) * 100) / 100; l.mat = nw.id;
        });
      }),
      cost: s => 8 * s.elements.filter(e => e.kind !== 'BO' && hasMat(e, ['eps', 'pir', 'glaswolle', 'steinwolle'])).reduce((a, e) => a + num(e.area), 0),
      affected: s => s.elements.filter(e => e.kind !== 'BO' && hasMat(e, ['eps', 'pir', 'glaswolle', 'steinwolle'])).map(e => e.id) },
    { id: 'm_detach', group: 'material', effort: 'low',
      ok: (s, r) => r.els.some(e => !e.existing && connOf(e.src) === 'verklebt'),
      apply: s => s.elements.forEach(e => { if (!e.existing && connOf(e) === 'verklebt') { ensureLayers(e); e.conn = 'teilweise'; } }),
      cost: s => 8 * s.elements.filter(e => !e.existing && connOf(e) === 'verklebt').reduce((a, e) => a + num(e.area), 0),
      affected: s => s.elements.filter(e => !e.existing && connOf(e) === 'verklebt').map(e => e.id) },

    // Gebäudehülle
    { id: 'm_aw', group: 'envelope', effort: 'auto',
      ok: (s, r) => r.els.some(e => e.kind === 'AW' && e.U > (s.mode === 'new' ? 0.20 : 0.24)),
      apply: (s) => { s._d = s._d || {}; s.elements.forEach(e => { if (e.kind === 'AW') { const U = uValue('AW', layersOf(e)); if (U > (s.mode === 'new' ? 0.20 : 0.24)) s._d[e.id] = addInsulation(e, 'holzfaser', s.mode === 'new' ? 0.15 : 0.18); } }); },
      cost: (s, r) => r.els.filter(e => e.kind === 'AW' && e.U > (s.mode === 'new' ? 0.20 : 0.24)).reduce((a, e) => a + e.area * (s.mode === 'new' ? 35 : 170), 0),
      affected: (s, r) => r.els.filter(e => e.kind === 'AW' && e.U > (s.mode === 'new' ? 0.20 : 0.24)).map(e => e.id) },
    { id: 'm_da', group: 'envelope', effort: 'auto',
      ok: (s, r) => r.els.some(e => e.kind === 'DA' && e.U > (s.mode === 'new' ? 0.16 : 0.20)),
      apply: s => s.elements.forEach(e => { if (e.kind === 'DA' && uValue('DA', layersOf(e)) > (s.mode === 'new' ? 0.16 : 0.20)) addInsulation(e, 'holzfaser', s.mode === 'new' ? 0.12 : 0.14); }),
      cost: (s, r) => r.els.filter(e => e.kind === 'DA' && e.U > (s.mode === 'new' ? 0.16 : 0.20)).reduce((a, e) => a + e.area * (s.mode === 'new' ? 30 : 130), 0),
      affected: (s, r) => r.els.filter(e => e.kind === 'DA' && e.U > (s.mode === 'new' ? 0.16 : 0.20)).map(e => e.id) },
    { id: 'm_bo', group: 'envelope', effort: 'auto',
      ok: (s, r) => r.els.some(e => e.kind === 'BO' && e.U > (s.mode === 'new' ? 0.25 : 0.35)),
      apply: s => s.elements.forEach(e => { if (e.kind === 'BO' && uValue('BO', layersOf(e)) > (s.mode === 'new' ? 0.25 : 0.35)) addInsulation(e, s.mode === 'new' ? 'schaumglas' : 'holzfaser', s.mode === 'new' ? 0.18 : 0.25); }),
      cost: (s, r) => r.els.filter(e => e.kind === 'BO' && e.U > (s.mode === 'new' ? 0.25 : 0.35)).reduce((a, e) => a + e.area * (s.mode === 'new' ? 30 : 70), 0),
      affected: (s, r) => r.els.filter(e => e.kind === 'BO' && e.U > (s.mode === 'new' ? 0.25 : 0.35)).map(e => e.id) },
    { id: 'm_win', group: 'envelope', effort: 'auto',
      ok: (s, r) => r.wins.some(w => w.type.uw > (s.mode === 'new' ? 0.9 : 1.3)),
      apply: s => s.windows.forEach(w => { const t = D.WIN[w.type]; if (t && t.uw > (s.mode === 'new' ? 0.9 : 1.3)) { w.type = 'w_3_holz'; w.existing = false; } }),
      cost: (s, r) => r.wins.filter(w => w.type.uw > (s.mode === 'new' ? 0.9 : 1.3)).reduce((a, w) => a + w.area * (s.mode === 'new' ? Math.max(50, D.WIN.w_3_holz.cost - w.type.cost) : D.WIN.w_3_holz.cost), 0),
      affected: (s, r) => r.wins.filter(w => w.type.uw > (s.mode === 'new' ? 0.9 : 1.3)).map(w => w.id) },
    { id: 'm_wb', group: 'envelope', effort: 'low',
      ok: (s, r) => num(r.tech.wb) > (s.mode === 'new' ? 0.03 : 0.05),
      apply: s => { s.tech.wb = s.mode === 'new' ? 0.03 : 0.05; },
      cost: (s, r) => r.envArea * (s.mode === 'new' ? 6 : 12), affected: () => [] },
    { id: 'm_shade', group: 'envelope', effort: 'auto',
      ok: (s, r) => (r.cl.cdd >= 50 || r.summerRisk !== 'low') && r.wins.some(w => w.key !== 'N' && w.shade !== 'external'),
      apply: s => s.windows.forEach(w => { if (orientKey(w.az) !== 'N') w.shade = 'external'; }),
      cost: (s, r) => r.wins.filter(w => w.key !== 'N' && w.shade !== 'external').reduce((a, w) => a + w.area * 280, 0),
      affected: (s, r) => r.wins.filter(w => w.key !== 'N' && w.shade !== 'external').map(w => w.id) },
    { id: 'm_coolroof', group: 'envelope', effort: 'low',
      ok: (s, r) => r.cl.cdd >= 300 && !r.tech.coolRoof && r.roofArea > 0,
      apply: s => { s.tech.coolRoof = true; },
      cost: (s, r) => 15 * r.roofArea, affected: s => s.elements.filter(e => e.kind === 'DA').map(e => e.id) },
    { id: 'm_green', group: 'envelope', effort: 'med',
      ok: (s, r) => r.flatRoof > 0 && !r.greenRoof,
      apply: s => s.elements.forEach(e => { if (e.kind === 'DA' && (e.flat || (D.CON[e.con] || {}).flat)) { ensureLayers(e).unshift({ mat: 'substrat', d: 0.10, th: false, n: true }); e.flat = true; } s.tech.green = true; }),
      cost: (s, r) => 55 * r.flatRoof, affected: s => s.elements.filter(e => e.kind === 'DA').map(e => e.id) },

    // Technik
    { id: 'm_hp', group: 'tech', effort: 'auto',
      ok: (s, r) => r.heat.fossil || r.heat.id === 'direct_el',
      apply: s => { s.tech.heat = 'hp_air'; s.tech.newSystem = true; },
      cost: (s, r) => (D.HEAT.hp_air.costKW * r.heatLoad + D.HEAT.hp_air.costBase), affected: () => [] },
    { id: 'm_mvhr', group: 'tech', effort: 'auto',
      ok: (s, r) => r.tech.vent !== 'mvhr' && r.cl.hdd > 2000,
      apply: s => { s.tech.vent = 'mvhr'; },
      cost: (s, r) => r.nrf * (s.mode === 'new' ? 55 : 85), affected: () => [] },
    { id: 'm_pv', group: 'tech', effort: 'auto',
      ok: (s, r) => num(r.tech.pv) === 0 && r.roofArea > 20,
      apply: (s, r) => { s.tech.pv = Math.round((r.flatRoof > 0 ? r.roofArea * 0.45 : r.roofArea * 0.35) * 0.2 * 10) / 10; },
      cost: (s, r) => 1300 * Math.round((r.flatRoof > 0 ? r.roofArea * 0.45 : r.roofArea * 0.35) * 0.2 * 10) / 10, affected: s => s.elements.filter(e => e.kind === 'DA').map(e => e.id) },
    { id: 'm_st', group: 'tech', effort: 'med',
      ok: (s, r) => !r.tech.st && !r.heat.hp && r.Qww > 2000,
      apply: s => { s.tech.st = true; },
      cost: (s, r) => 900 * (r.Qww * 0.5) / (r.cl.gh * 0.45), affected: s => s.elements.filter(e => e.kind === 'DA').map(e => e.id) },
    { id: 'm_night', group: 'tech', effort: 'low',
      ok: (s, r) => r.cl.cdd >= 100 && !r.tech.night,
      apply: s => { s.tech.night = true; },
      cost: (s, r) => 6 * r.nrf, affected: () => [] },
    { id: 'm_rain', group: 'tech', effort: 'med',
      ok: (s, r) => !r.tech.rain && r.roofArea > 50,
      apply: s => { s.tech.rain = true; },
      cost: (s, r) => 3500 + 8 * r.roofArea, affected: () => [] },
  ];
  const GROUP_ORDER = ['design', 'material', 'envelope', 'tech'];

  function prep(st) {
    const s = clone(st);
    s.tech = Object.assign({ heat: 'gas_bw', cool: 'auto', vent: 'window', night: false, pv: 0, st: false, rain: false, coolRoof: false, wb: 0.05, n: 0.6 }, s.tech || {});
    s.elements = s.elements || []; s.windows = s.windows || [];
    return s;
  }

  function applyMeasures(st, ids) {
    let s = prep(st);
    for (const m of MEASURES) {
      if (!ids.includes(m.id)) continue;
      const r = calc(s);
      if (!m.ok(s, r)) continue;
      m.apply(s, r);
      delete s._d;
    }
    return s;
  }

  function evaluateMeasures(st, base) {
    const s0 = prep(st);
    const r0 = base || calc(s0);
    const out = [];
    for (const m of MEASURES) {
      if (!m.ok(s0, r0)) continue;
      const s1 = prep(st);
      m.apply(s1, r0);
      delete s1._d;
      const r1 = calc(s1);
      const rawCost = m.cost(s0, r0);
      const cost = rawCost == null ? null : rawCost * r0.costF;
      const dEnd = r0.endTotal - r1.endTotal;
      const dOp = r0.co2Op - r1.co2Op;
      const dLife = r0.lifeTotal - r1.lifeTotal;
      const dEmb = r0.embTotal - r1.embTotal;
      const dCost = r0.costOp - r1.costOp;
      const payback = cost != null && dCost > 1 ? cost / dCost : null;
      const eurPerT = cost != null && dLife > 1 ? cost / (dLife / 1000) : null;
      let effort = m.effort;
      if (effort === 'auto') { const pm = cost == null ? 0 : cost / r0.bgf; effort = pm < 15 ? 'low' : pm < 80 ? 'med' : 'high'; }
      const warn = [];
      if (r1.daylight === 'low' && r0.daylight !== 'low') warn.push('daylight');
      if (r1.summerRisk === 'high' && r0.summerRisk !== 'high') warn.push('summer');
      if (m.id === 'm_shade') warn.push('shadeDaylight');
      out.push({ id: m.id, group: m.group, effort, cost, dEnd, dOp, dLife, dEmb, dCost, payback, eurPerT, warn, affected: m.affected(s0, r0), r1, extra: { qc: r0.Qc - r1.Qc, runoff: r0.runoff - r1.runoff, rain: m.id === 'm_rain' ? r0.rainPotential : 0, circ: r1.circScore - r0.circScore } });
    }
    return out;
  }

  // ---------- Beispielprojekt ----------
  function example() {
    const e = (kind, con, area, az, extra) => Object.assign({ id: newId('e'), kind, con, area, az: az == null ? null : az, existing: false, conf: 'hoch', src: 'example' }, extra || {});
    const w = (az, area, type) => ({ id: newId('w'), az, area, type, shade: 'internal', existing: false, conf: 'hoch', src: 'example' });
    return {
      id: newId('v'), name: 'A',
      mode: 'new', type: 'wohnen', sub: 'mfh', loc: 'de_ol', year: 2027,
      meta: { desc: '' },
      geo: { bgf: 1120, nrf: 918, floors: 4, hStorey: 3.0, volume: 3360, footprint: 280 },
      elements: [
        e('AW', 'aw_ks_eps', 200, 0, { name: 'Außenwand Nord' }),
        e('AW', 'aw_ks_eps', 128, 90, { name: 'Außenwand Ost' }),
        e('AW', 'aw_ks_eps', 160, 180, { name: 'Außenwand Süd' }),
        e('AW', 'aw_ks_eps', 128, 270, { name: 'Außenwand West' }),
        e('DA', 'da_flach_eps', 280, null, { name: 'Flachdach', flat: true }),
        e('BO', 'bo_stb_xps', 280, null, { name: 'Bodenplatte' }),
        e('DE', 'de_stb', 840, null, { name: 'Geschossdecken' }),
        e('IW', 'iw_ks', 616, null, { name: 'Innenwände' }),
      ],
      windows: [w(0, 40, 'w_3_pvc'), w(90, 40, 'w_3_pvc'), w(180, 80, 'w_3_pvc'), w(270, 40, 'w_3_pvc')],
      tech: { heat: 'gas_bw', cool: 'auto', vent: 'exhaust', night: false, pv: 0, st: false, rain: false, wb: 0.05, n: 0.6 },
      adj: { rot: 0, win: { N: 1, E: 1, S: 1, W: 1 }, shade: {} },
      measures: [],
      example: true,
    };
  }

  function emptyState() {
    return {
      id: newId('v'), name: 'A', mode: 'new', type: 'wohnen', sub: 'mfh', loc: 'de_ol', year: new Date().getFullYear(),
      meta: { desc: '' }, geo: { bgf: 0, nrf: 0, floors: 1, hStorey: 3, volume: 0, footprint: 0 },
      elements: [], windows: [], tech: { heat: 'gas_bw', cool: 'auto', vent: 'window', night: false, pv: 0, st: false, rain: false, wb: 0.05, n: 0.6 },
      adj: { rot: 0, win: { N: 1, E: 1, S: 1, W: 1 }, shade: {} }, measures: [],
    };
  }

  window.OBC_CALC = {
    calc, evaluateMeasures, applyMeasures, demolitionCompare, MEASURES, GROUP_ORDER,
    uValue, layersOf, connOf, elementPerM2, orientKey, solarFactor, energyClass, circGrade,
    example, emptyState, clone, newId, num, prep, REF,
  };
})();
