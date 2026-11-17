/* Greenprint – Datengrundlage
   Alle Kennwerte sind gerundete Näherungswerte für Entwurf und Lehre.
   Orientierung: ÖKOBAUDAT / EPD-Durchschnittswerte (A1–A3, C3–C4), Eurostat (Gradtage, Preise),
   PVGIS (Einstrahlung), EEA (Strom-CO2), GEG (Effizienzklassen), RIBA 2030 Climate Challenge.
*/
(function () {
  'use strict';

  // ---------- Baustoffe ----------
  // lambda W/mK · rho kg/m³ · gwp kg CO2e/kg (A1–A3) · penrt kWh/kg (A1–A3)
  // bio kg CO2/kg gespeicherter Kohlenstoff · eol kg CO2e/kg (C3–C4) · life Jahre · circ 0–100
  const M = (id, de, en, cat, lambda, rho, gwp, penrt, bio, eol, life, circ) =>
    ({ id, de, en, cat, lambda, rho, gwp, penrt, bio, eol, life, circ });

  const MATERIALS = [
    M('stahlbeton', 'Stahlbeton C30/37', 'Reinforced concrete C30/37', 'mineral', 2.3, 2400, 0.13, 0.28, 0, 0.010, 100, 35),
    M('beton', 'Beton unbewehrt', 'Plain concrete', 'mineral', 2.0, 2350, 0.10, 0.22, 0, 0.010, 100, 40),
    M('rc_beton', 'Recyclingbeton (RC)', 'Recycled concrete', 'mineral', 2.0, 2350, 0.095, 0.21, 0, 0.010, 100, 55),
    M('cem3_beton', 'Zementreduzierter Beton (CEM III)', 'Low-cement concrete (CEM III)', 'mineral', 2.3, 2400, 0.075, 0.20, 0, 0.010, 100, 40),
    M('ks', 'Kalksandstein', 'Calcium silicate brick', 'mineral', 0.99, 1800, 0.07, 0.25, 0, 0.008, 100, 45),
    M('hlz_alt', 'Hochlochziegel (alt)', 'Perforated brick (old)', 'mineral', 0.39, 1200, 0.18, 0.65, 0, 0.008, 100, 50),
    M('vollziegel', 'Vollziegel', 'Solid brick', 'mineral', 0.80, 1800, 0.20, 0.70, 0, 0.008, 100, 60),
    M('hlz_gef', 'Ziegel, dämmstoffgefüllt', 'Insulated clay block', 'mineral', 0.08, 650, 0.22, 0.80, 0, 0.010, 100, 35),
    M('porenbeton', 'Porenbeton', 'Aerated concrete', 'mineral', 0.08, 350, 0.38, 0.90, 0, 0.010, 100, 40),
    M('leichtbeton', 'Leichtbeton / Bims', 'Lightweight concrete', 'mineral', 0.25, 800, 0.17, 0.45, 0, 0.008, 100, 40),
    M('lehmstein', 'Lehmstein', 'Earth block', 'earth', 0.70, 1600, 0.03, 0.06, 0, 0.002, 100, 95),
    M('stampflehm', 'Stampflehm', 'Rammed earth', 'earth', 1.10, 2000, 0.02, 0.04, 0, 0.002, 100, 95),
    M('kvh', 'Konstruktionsvollholz', 'Structural timber', 'wood', 0.13, 450, 0.10, 0.80, 1.60, 0.020, 100, 80),
    M('bsh', 'Brettschichtholz', 'Glulam', 'wood', 0.13, 460, 0.14, 1.10, 1.60, 0.020, 100, 75),
    M('bsp', 'Brettsperrholz (CLT)', 'Cross-laminated timber (CLT)', 'wood', 0.13, 470, 0.15, 1.20, 1.60, 0.020, 100, 75),
    M('osb', 'OSB-Platte', 'OSB board', 'wood', 0.13, 600, 0.25, 2.00, 1.50, 0.020, 50, 55),
    M('laerche', 'Holzschalung Lärche', 'Larch cladding', 'wood', 0.13, 550, 0.12, 0.60, 1.60, 0.020, 40, 80),
    M('holzfaser', 'Holzfaserdämmung', 'Wood fibre insulation', 'insul_bio', 0.040, 140, 0.55, 2.50, 1.50, 0.020, 50, 80),
    M('zellulose', 'Zellulosedämmung', 'Cellulose insulation', 'insul_bio', 0.040, 50, 0.20, 0.60, 1.30, 0.020, 50, 80),
    M('stroh', 'Strohballen', 'Straw bales', 'insul_bio', 0.052, 100, 0.03, 0.10, 1.40, 0.010, 50, 95),
    M('kork', 'Korkdämmung', 'Cork insulation', 'insul_bio', 0.042, 120, 0.30, 1.00, 1.60, 0.020, 50, 85),
    M('hanf', 'Hanfdämmung', 'Hemp insulation', 'insul_bio', 0.042, 40, 0.50, 2.00, 1.30, 0.020, 50, 80),
    M('glaswolle', 'Glaswolle', 'Glass wool', 'insul_min', 0.035, 20, 1.30, 5.50, 0, 0.050, 50, 50),
    M('steinwolle', 'Steinwolle', 'Stone wool', 'insul_min', 0.036, 60, 1.20, 4.50, 0, 0.050, 50, 50),
    M('schaumglas', 'Schaumglas', 'Cellular glass', 'insul_min', 0.042, 120, 1.10, 4.00, 0, 0.020, 60, 50),
    M('eps', 'EPS (Polystyrol)', 'EPS (polystyrene)', 'insul_fossil', 0.035, 20, 3.30, 25.0, 0, 3.000, 40, 30),
    M('xps', 'XPS', 'XPS', 'insul_fossil', 0.035, 35, 3.50, 27.0, 0, 3.000, 50, 25),
    M('pir', 'PUR/PIR-Hartschaum', 'PUR/PIR board', 'insul_fossil', 0.024, 32, 4.00, 25.0, 0, 2.500, 50, 20),
    M('kalkzementputz', 'Kalkzementputz', 'Lime-cement render', 'finish', 0.87, 1800, 0.25, 0.40, 0, 0.005, 40, 15),
    M('lehmputz', 'Lehmputz', 'Clay plaster', 'earth', 0.80, 1700, 0.03, 0.05, 0, 0.002, 50, 90),
    M('gipsputz', 'Gipsputz', 'Gypsum plaster', 'finish', 0.50, 1200, 0.15, 0.35, 0, 0.005, 50, 30),
    M('gipskarton', 'Gipskartonplatte', 'Gypsum board', 'finish', 0.25, 850, 0.18, 1.00, 0, 0.010, 50, 50),
    M('lehmplatte', 'Lehmbauplatte', 'Clay board', 'earth', 0.35, 1400, 0.05, 0.15, 0, 0.002, 50, 90),
    M('zementestrich', 'Zementestrich', 'Cement screed', 'mineral', 1.40, 2000, 0.12, 0.30, 0, 0.008, 50, 30),
    M('trockenestrich', 'Trockenestrich (Gipsfaser)', 'Dry screed (gypsum fibre)', 'finish', 0.32, 1150, 0.20, 0.90, 0, 0.010, 50, 55),
    M('lehmschuettung', 'Lehm-/Splittschüttung', 'Earth/grit fill', 'earth', 0.70, 1500, 0.01, 0.03, 0, 0.002, 100, 90),
    M('stahl', 'Baustahl', 'Structural steel', 'metal', 50, 7850, 1.20, 4.00, 0, 0.020, 100, 90),
    M('alu', 'Aluminium', 'Aluminium', 'metal', 160, 2700, 8.00, 40.0, 0, 0.050, 50, 85),
    M('bitumen', 'Bitumenbahn', 'Bitumen membrane', 'membrane', 0.17, 1100, 0.50, 12.0, 0, 1.500, 30, 10),
    M('epdm', 'Kunststoffbahn (EPDM/FPO)', 'Synthetic membrane (EPDM/FPO)', 'membrane', 0.20, 1200, 2.50, 25.0, 0, 2.000, 30, 20),
    M('dachziegel', 'Dachziegel (Ton)', 'Clay roof tiles', 'mineral', 1.0, 2000, 0.30, 0.90, 0, 0.005, 60, 70),
    M('faserzement', 'Faserzementplatte', 'Fibre cement panel', 'mineral', 0.58, 1800, 0.60, 2.00, 0, 0.010, 40, 30),
    M('substrat', 'Gründach-Substrat', 'Green roof substrate', 'earth', 1.00, 1200, 0.02, 0.05, 0, 0.002, 50, 80),
    M('kies', 'Kies / Schotter', 'Gravel', 'mineral', 2.0, 1800, 0.005, 0.02, 0, 0.002, 100, 90),
  ];

  // ---------- Bauteilkatalog ----------
  // kind: AW Außenwand · DA Dach · BO Boden gegen Erdreich/Keller · DE Geschossdecke · IW Innenwand
  // layers: [materialId, Dicke in m, wärmetechnisch wirksam (default true)]
  // conn: 'loesbar' | 'teilweise' | 'verklebt' · cost: €/m² (Neubau, Referenz Deutschland) · flat: Flachdach
  const C = (id, kind, de, en, layers, conn, cost, extra) =>
    Object.assign({ id, kind, de, en, layers: layers.map(l => ({ mat: l[0], d: l[1], th: l[2] !== false })), conn, cost }, extra || {});

  const CONSTRUCTIONS = [
    // Außenwände
    C('aw_ziegel_alt', 'AW', 'Ziegel 36,5 cm, ungedämmt (Bestand 1950–80)', 'Brick 36.5 cm, uninsulated (1950–80)', [['kalkzementputz', 0.02], ['hlz_alt', 0.365], ['gipsputz', 0.015]], 'verklebt', 260),
    C('aw_vollziegel', 'AW', 'Vollziegel 38 cm (Altbau vor 1950)', 'Solid brick 38 cm (pre-1950)', [['kalkzementputz', 0.02], ['vollziegel', 0.38], ['gipsputz', 0.015]], 'verklebt', 280),
    C('aw_betonsandwich', 'AW', 'Betonsandwich 1970er (Plattenbau)', 'Concrete sandwich panel 1970s', [['stahlbeton', 0.15], ['steinwolle', 0.05], ['stahlbeton', 0.06]], 'verklebt', 300),
    C('aw_bims', 'AW', 'Leichtbeton/Bims 30 cm (1960er)', 'Lightweight concrete 30 cm (1960s)', [['kalkzementputz', 0.02], ['leichtbeton', 0.30], ['gipsputz', 0.015]], 'verklebt', 240),
    C('aw_ks_eps', 'AW', 'Kalksandstein 17,5 + 16 cm EPS (WDVS)', 'Calcium silicate 17.5 + 16 cm EPS (ETICS)', [['kalkzementputz', 0.01], ['eps', 0.16], ['ks', 0.175], ['gipsputz', 0.015]], 'verklebt', 270),
    C('aw_ks_mw', 'AW', 'Kalksandstein 17,5 + 20 cm Mineralwolle', 'Calcium silicate 17.5 + 20 cm mineral wool', [['kalkzementputz', 0.01], ['steinwolle', 0.20], ['ks', 0.175], ['gipsputz', 0.015]], 'verklebt', 300),
    C('aw_stb_eps', 'AW', 'Stahlbeton 20 + 20 cm EPS', 'Reinforced concrete 20 + 20 cm EPS', [['kalkzementputz', 0.01], ['eps', 0.20], ['stahlbeton', 0.20], ['gipsputz', 0.015]], 'verklebt', 320),
    C('aw_rc_sw', 'AW', 'Recyclingbeton 20 + 20 cm Steinwolle, hinterlüftet', 'Recycled concrete 20 + 20 cm stone wool, ventilated', [['faserzement', 0.012, false], ['steinwolle', 0.20], ['rc_beton', 0.20], ['gipsputz', 0.015]], 'teilweise', 340),
    C('aw_ziegel_mono', 'AW', 'Ziegel monolithisch 42,5 cm, gefüllt', 'Monolithic insulated clay block 42.5 cm', [['kalkzementputz', 0.02], ['hlz_gef', 0.425], ['gipsputz', 0.015]], 'verklebt', 290),
    C('aw_porenbeton', 'AW', 'Porenbeton 48 cm monolithisch', 'Aerated concrete 48 cm monolithic', [['kalkzementputz', 0.015], ['porenbeton', 0.48], ['gipsputz', 0.01]], 'verklebt', 270),
    C('aw_holzrahmen_zell', 'AW', 'Holzrahmen 24 cm Zellulose + 6 cm Holzfaser, Lärche', 'Timber frame 24 cm cellulose + 6 cm wood fibre, larch', [['laerche', 0.024, false], ['holzfaser', 0.06], ['zellulose', 0.22], ['kvh', 0.02], ['osb', 0.015], ['gipskarton', 0.0125]], 'loesbar', 310),
    C('aw_holzrahmen_mw', 'AW', 'Holzrahmen 24 cm Mineralwolle, Faserzement', 'Timber frame 24 cm mineral wool, fibre cement', [['faserzement', 0.012, false], ['glaswolle', 0.22], ['kvh', 0.02], ['osb', 0.015], ['gipskarton', 0.0125]], 'teilweise', 290),
    C('aw_bsp_hf', 'AW', 'Brettsperrholz 10 + 20 cm Holzfaser, verputzt', 'CLT 10 + 20 cm wood fibre, rendered', [['kalkzementputz', 0.01], ['holzfaser', 0.20], ['bsp', 0.10]], 'teilweise', 360),
    C('aw_stroh', 'AW', 'Strohballen 46 cm, Lehmputz', 'Straw bale 46 cm, clay plaster', [['kalkzementputz', 0.03], ['stroh', 0.46], ['kvh', 0.01], ['lehmputz', 0.04]], 'loesbar', 280),
    C('aw_lehm_hf', 'AW', 'Lehmstein 36,5 + 16 cm Holzfaser', 'Earth block 36.5 + 16 cm wood fibre', [['kalkzementputz', 0.01], ['holzfaser', 0.16], ['lehmstein', 0.365], ['lehmputz', 0.02]], 'teilweise', 340),
    C('aw_ref_neubau', 'AW', 'Referenz Neubau: KS + 14 cm EPS', 'Reference new build: CaSi + 14 cm EPS', [['kalkzementputz', 0.01], ['eps', 0.14], ['ks', 0.175], ['gipsputz', 0.015]], 'verklebt', 250),

    // Dächer
    C('da_steil_alt', 'DA', 'Steildach 1970er, 6 cm Mineralwolle', 'Pitched roof 1970s, 6 cm mineral wool', [['dachziegel', 0.02, false], ['kvh', 0.03], ['glaswolle', 0.06], ['gipskarton', 0.0125]], 'teilweise', 200),
    C('da_steil_mw', 'DA', 'Steildach 22 cm Mineralwolle + 6 cm Holzfaser', 'Pitched roof 22 cm mineral wool + 6 cm wood fibre', [['dachziegel', 0.02, false], ['holzfaser', 0.06], ['glaswolle', 0.22], ['kvh', 0.03], ['gipskarton', 0.0125]], 'teilweise', 260),
    C('da_steil_zell', 'DA', 'Steildach Holz 24 cm Zellulose + 8 cm Holzfaser', 'Pitched timber roof 24 cm cellulose + 8 cm wood fibre', [['dachziegel', 0.02, false], ['holzfaser', 0.08], ['zellulose', 0.24], ['kvh', 0.03], ['osb', 0.015], ['gipskarton', 0.0125]], 'loesbar', 270),
    C('da_flach_alt', 'DA', 'Flachdach Stahlbeton 18 + 4 cm EPS (1960/70er)', 'Flat roof concrete 18 + 4 cm EPS (1960/70s)', [['bitumen', 0.01], ['eps', 0.04], ['stahlbeton', 0.18], ['gipsputz', 0.01]], 'verklebt', 220, { flat: true }),
    C('da_flach_eps', 'DA', 'Flachdach Stahlbeton 22 + 20 cm EPS', 'Flat roof concrete 22 + 20 cm EPS', [['kies', 0.05, false], ['bitumen', 0.01], ['eps', 0.20], ['bitumen', 0.004], ['stahlbeton', 0.22], ['gipsputz', 0.01]], 'verklebt', 260, { flat: true }),
    C('da_flach_pir', 'DA', 'Flachdach Stahlbeton 22 + 16 cm PIR', 'Flat roof concrete 22 + 16 cm PIR', [['bitumen', 0.01], ['pir', 0.16], ['bitumen', 0.004], ['stahlbeton', 0.22], ['gipsputz', 0.01]], 'verklebt', 270, { flat: true }),
    C('da_flach_rc_sg', 'DA', 'Flachdach Recyclingbeton + 18 cm Schaumglas', 'Flat roof recycled concrete + 18 cm cellular glass', [['epdm', 0.003], ['schaumglas', 0.18], ['rc_beton', 0.22], ['gipsputz', 0.01]], 'teilweise', 300, { flat: true }),
    C('da_flach_bsp', 'DA', 'Flachdach Brettsperrholz 16 + 24 cm Holzfaser', 'Flat roof CLT 16 + 24 cm wood fibre', [['epdm', 0.003], ['holzfaser', 0.24], ['bsp', 0.16]], 'teilweise', 290, { flat: true }),
    C('da_gruen_bsp', 'DA', 'Gründach Brettsperrholz + 24 cm Holzfaser, 10 cm Substrat', 'Green roof CLT + 24 cm wood fibre, 10 cm substrate', [['substrat', 0.10, false], ['epdm', 0.003], ['holzfaser', 0.24], ['bsp', 0.16]], 'teilweise', 340, { flat: true, green: true }),
    C('da_ref_neubau', 'DA', 'Referenz Neubau: Stahlbeton + 18 cm EPS', 'Reference new build: concrete + 18 cm EPS', [['bitumen', 0.01], ['eps', 0.18], ['stahlbeton', 0.20], ['gipsputz', 0.01]], 'verklebt', 240, { flat: true }),

    // Boden gegen Erdreich / Kellerdecke
    C('bo_alt', 'BO', 'Bodenplatte Beton ungedämmt + Estrich (Bestand)', 'Concrete slab uninsulated + screed (existing)', [['zementestrich', 0.05], ['beton', 0.15]], 'verklebt', 150),
    C('bo_kellerdecke_alt', 'BO', 'Kellerdecke 1970er, 2 cm EPS', 'Basement ceiling 1970s, 2 cm EPS', [['zementestrich', 0.045], ['eps', 0.02], ['stahlbeton', 0.16]], 'verklebt', 160),
    C('bo_stb_xps', 'BO', 'Bodenplatte Stahlbeton 25 + 12 cm XPS', 'Concrete slab 25 + 12 cm XPS', [['zementestrich', 0.06], ['eps', 0.04], ['stahlbeton', 0.25], ['xps', 0.12]], 'verklebt', 210),
    C('bo_stb_sg', 'BO', 'Bodenplatte Stahlbeton 25 + 20 cm Schaumglasschotter', 'Concrete slab 25 + 20 cm cellular glass gravel', [['zementestrich', 0.06], ['eps', 0.03], ['stahlbeton', 0.25], ['schaumglas', 0.20]], 'teilweise', 230),
    C('bo_rc_xps', 'BO', 'Bodenplatte Recyclingbeton + 16 cm XPS', 'Recycled concrete slab + 16 cm XPS', [['zementestrich', 0.06], ['eps', 0.03], ['rc_beton', 0.25], ['xps', 0.16]], 'verklebt', 220),
    C('bo_holz', 'BO', 'Holzboden auf Punktfundament, 20 cm Holzfaser', 'Timber floor on pad footings, 20 cm wood fibre', [['trockenestrich', 0.025], ['bsp', 0.14], ['holzfaser', 0.20], ['osb', 0.015]], 'loesbar', 240),
    C('bo_ref_neubau', 'BO', 'Referenz Neubau: Stahlbeton + 10 cm XPS', 'Reference new build: concrete + 10 cm XPS', [['zementestrich', 0.06], ['eps', 0.03], ['stahlbeton', 0.25], ['xps', 0.10]], 'verklebt', 200),

    // Geschossdecken
    C('de_stb', 'DE', 'Stahlbeton 22 cm + schwimmender Estrich', 'Concrete slab 22 cm + floating screed', [['zementestrich', 0.06], ['eps', 0.03], ['stahlbeton', 0.22]], 'verklebt', 170),
    C('de_stb_flach', 'DE', 'Stahlbeton-Flachdecke 28 cm (Büro/Schule)', 'Flat concrete slab 28 cm (office/school)', [['zementestrich', 0.06], ['eps', 0.03], ['stahlbeton', 0.28]], 'verklebt', 190),
    C('de_cem3', 'DE', 'Zementreduzierter Beton 22 cm + Estrich', 'Low-cement concrete 22 cm + screed', [['zementestrich', 0.06], ['eps', 0.03], ['cem3_beton', 0.22]], 'verklebt', 175),
    C('de_hbv', 'DE', 'Holz-Beton-Verbund (14 BSP + 8 Beton)', 'Timber-concrete composite (14 CLT + 8 concrete)', [['zementestrich', 0.05], ['holzfaser', 0.03], ['stahlbeton', 0.08], ['bsp', 0.14]], 'teilweise', 210),
    C('de_bsp', 'DE', 'Brettsperrholz 20 cm + Trockenestrich', 'CLT 20 cm + dry screed', [['trockenestrich', 0.025], ['holzfaser', 0.03], ['lehmschuettung', 0.06], ['bsp', 0.20]], 'loesbar', 220),
    C('de_holzbalken', 'DE', 'Holzbalkendecke mit Lehmschüttung (Bestand)', 'Timber joist floor with earth fill (existing)', [['kvh', 0.024], ['lehmschuettung', 0.08], ['kvh', 0.06], ['lehmputz', 0.02]], 'loesbar', 180),

    // Innenwände
    C('iw_ks', 'IW', 'Kalksandstein 17,5 cm, verputzt', 'Calcium silicate 17.5 cm, plastered', [['gipsputz', 0.01], ['ks', 0.175], ['gipsputz', 0.01]], 'verklebt', 110),
    C('iw_stb', 'IW', 'Stahlbeton 20 cm', 'Reinforced concrete 20 cm', [['stahlbeton', 0.20]], 'verklebt', 150),
    C('iw_ziegel', 'IW', 'Ziegel 11,5 cm, verputzt', 'Brick 11.5 cm, plastered', [['gipsputz', 0.01], ['vollziegel', 0.115], ['gipsputz', 0.01]], 'verklebt', 95),
    C('iw_gk', 'IW', 'Ständerwand Gipskarton (Metall), 12,5 cm', 'Metal stud wall with gypsum board, 12.5 cm', [['gipskarton', 0.025], ['glaswolle', 0.05], ['stahl', 0.0008], ['gipskarton', 0.025]], 'loesbar', 80),
    C('iw_holz_lehm', 'IW', 'Holzständer + Lehmbauplatten', 'Timber stud + clay boards', [['lehmplatte', 0.025], ['zellulose', 0.06], ['kvh', 0.015], ['lehmplatte', 0.025]], 'loesbar', 95),
    C('iw_lehmstein', 'IW', 'Lehmstein 11,5 cm, Lehmputz', 'Earth block 11.5 cm, clay plaster', [['lehmputz', 0.015], ['lehmstein', 0.115], ['lehmputz', 0.015]], 'loesbar', 100),
  ];

  // ---------- Fenster ----------
  // uw W/m²K · g · gwp kg CO2e/m² · penrt kWh/m² · bio kg/m² · life · circ · cost €/m²
  const W = (id, de, en, uw, g, gwp, penrt, bio, life, circ, cost) => ({ id, de, en, uw, g, gwp, penrt, bio, life, circ, cost });
  const WINDOWS = [
    W('w_einfach', 'Einfachverglasung, Holz (Bestand)', 'Single glazing, timber (existing)', 4.8, 0.85, 40, 120, 15, 30, 40, 0),
    W('w_iso_alt', 'Isolierverglasung 2-fach, alt (1975–95)', 'Double glazing, old (1975–95)', 2.8, 0.75, 60, 200, 0, 30, 35, 0),
    W('w_2wsv', '2-fach Wärmeschutz, Kunststoff', 'Double low-e, PVC', 1.3, 0.60, 70, 260, 0, 30, 30, 450),
    W('w_3_pvc', '3-fach, Kunststoff', 'Triple glazing, PVC', 0.80, 0.50, 95, 330, 0, 30, 30, 550),
    W('w_3_holz', '3-fach, Holz', 'Triple glazing, timber', 0.80, 0.50, 60, 230, 30, 30, 65, 650),
    W('w_3_holzalu', '3-fach, Holz-Alu', 'Triple glazing, timber-aluminium', 0.75, 0.50, 85, 300, 25, 40, 55, 750),
    W('w_3_alu', '3-fach, Aluminium', 'Triple glazing, aluminium', 1.00, 0.50, 160, 600, 0, 40, 60, 800),
    W('w_ph_holz', 'Passivhausfenster, Holz', 'Passive house window, timber', 0.70, 0.50, 70, 260, 32, 30, 65, 750),
  ];

  // ---------- Energieträger (CO2 kg/kWh, PEnrt-Faktor) ----------
  const CARRIERS = {
    gas: { de: 'Erdgas', en: 'Natural gas', co2: 0.240, pe: 1.10 },
    oil: { de: 'Heizöl', en: 'Heating oil', co2: 0.310, pe: 1.10 },
    wood: { de: 'Holzpellets', en: 'Wood pellets', co2: 0.020, pe: 0.20 },
    district: { de: 'Fernwärme', en: 'District heating', co2: 0.180, pe: 0.70 },
    el: { de: 'Strom', en: 'Electricity', co2: null, pe: null }, // je Land
  };

  // ---------- Heizsysteme ----------
  // eff: Aufwandszahl (Endenergie/Nutzwärme); hp: Wärmepumpe mit JAZ; cost: €/kW Heizlast + Grundbetrag
  const HEATING = [
    { id: 'gas_bw', de: 'Gas-Brennwertkessel', en: 'Gas condensing boiler', carrier: 'gas', eff: 1.10, fossil: true, costKW: 350, costBase: 6000 },
    { id: 'gas_alt', de: 'Gaskessel, alt (Niedertemperatur)', en: 'Gas boiler, old', carrier: 'gas', eff: 1.30, fossil: true, costKW: 350, costBase: 6000 },
    { id: 'oil_alt', de: 'Ölkessel, alt', en: 'Oil boiler, old', carrier: 'oil', eff: 1.35, fossil: true, costKW: 400, costBase: 7000 },
    { id: 'oil_bw', de: 'Öl-Brennwertkessel', en: 'Oil condensing boiler', carrier: 'oil', eff: 1.12, fossil: true, costKW: 400, costBase: 7000 },
    { id: 'hp_air', de: 'Luft-Wasser-Wärmepumpe', en: 'Air-to-water heat pump', carrier: 'el', hp: 'air', fossil: false, costKW: 1200, costBase: 5000 },
    { id: 'hp_ground', de: 'Sole-Wasser-Wärmepumpe (Erdsonde)', en: 'Ground-source heat pump', carrier: 'el', hp: 'ground', fossil: false, costKW: 1900, costBase: 8000 },
    { id: 'district', de: 'Fernwärme', en: 'District heating', carrier: 'district', eff: 1.05, fossil: false, costKW: 250, costBase: 8000 },
    { id: 'pellets', de: 'Holzpelletkessel', en: 'Wood pellet boiler', carrier: 'wood', eff: 1.20, fossil: false, costKW: 700, costBase: 10000 },
    { id: 'direct_el', de: 'Strom-Direktheizung', en: 'Direct electric heating', carrier: 'el', eff: 1.0, fossil: false, costKW: 150, costBase: 2000 },
  ];

  // ---------- Gebäudetypen ----------
  // qi W/m² interne Gewinne · ww kWh/m²a Warmwasser · iwFactor m² Innenwand je m² BGF · tga kg CO2e/m² BGF Technik
  // light: Strom Beleuchtung/Hilfsenergie kWh/m²a · coolFactor
  const BUILDING_TYPES = [
    { id: 'wohnen', de: 'Wohnen', en: 'Residential', qi: 5, ww: 15, iw: 0.55, tga: 35, aux: 4, cool: 1.0, riba: 'domestic',
      sub: [['efh', 'Einfamilienhaus', 'Detached house'], ['rh', 'Reihenhaus', 'Terraced house'], ['mfh', 'Mehrfamilienhaus', 'Apartment building'], ['wohnheim', 'Wohnheim', 'Student housing']] },
    { id: 'buero', de: 'Büro & Verwaltung', en: 'Office & administration', qi: 7, ww: 4, iw: 0.35, tga: 60, aux: 18, cool: 1.35, riba: 'office',
      sub: [['buero', 'Bürogebäude', 'Office building'], ['rathaus', 'Rathaus / Verwaltung', 'Town hall / administration'], ['cowork', 'Co-Working', 'Co-working']] },
    { id: 'bildung', de: 'Bildung & Kultur', en: 'Education & culture', qi: 6, ww: 4, iw: 0.40, tga: 50, aux: 12, cool: 1.15, riba: 'school',
      sub: [['schule', 'Schule', 'School'], ['kita', 'Kita', 'Nursery'], ['hochschule', 'Hochschule', 'University'], ['bibliothek', 'Bibliothek', 'Library'], ['museum', 'Museum', 'Museum']] },
    { id: 'gewerbe', de: 'Gewerbe & Sonstiges', en: 'Commercial & other', qi: 7, ww: 8, iw: 0.30, tga: 55, aux: 16, cool: 1.3, riba: 'office',
      sub: [['handel', 'Handel', 'Retail'], ['hotel', 'Hotel', 'Hotel'], ['gastro', 'Gastronomie', 'Restaurant'], ['halle', 'Halle / Werkstatt', 'Hall / workshop'], ['misch', 'Mischnutzung', 'Mixed use']] },
  ];

  // ---------- Länder ----------
  // co2 kg/kWh Strom (EEA, gerundet) · pe PEnrt-Faktor Strom · pel/pgas €/kWh Endkundenpreis · cost Baupreisindex (DE = 100)
  const L = (de, en, co2, pe, pel, pgas, cost) => ({ de, en, co2, pe, pel, pgas, cost });
  const COUNTRIES = {
    AL: L('Albanien', 'Albania', 0.02, 0.1, 0.10, 0.08, 35), AD: L('Andorra', 'Andorra', 0.10, 0.8, 0.15, 0.10, 85),
    BE: L('Belgien', 'Belgium', 0.12, 1.9, 0.36, 0.10, 100), BA: L('Bosnien und Herzegowina', 'Bosnia and Herzegovina', 0.70, 2.4, 0.09, 0.06, 38),
    BG: L('Bulgarien', 'Bulgaria', 0.38, 2.3, 0.12, 0.06, 40), DK: L('Dänemark', 'Denmark', 0.12, 0.6, 0.38, 0.12, 120),
    DE: L('Deutschland', 'Germany', 0.38, 1.8, 0.40, 0.12, 100), EE: L('Estland', 'Estonia', 0.50, 2.0, 0.22, 0.10, 65),
    FI: L('Finnland', 'Finland', 0.07, 1.3, 0.18, 0.10, 105), FR: L('Frankreich', 'France', 0.05, 2.3, 0.25, 0.11, 98),
    GR: L('Griechenland', 'Greece', 0.33, 1.6, 0.22, 0.10, 60), IE: L('Irland', 'Ireland', 0.28, 1.4, 0.40, 0.12, 110),
    IS: L('Island', 'Iceland', 0.01, 0.05, 0.12, 0.10, 130), IT: L('Italien', 'Italy', 0.25, 1.5, 0.33, 0.12, 85),
    XK: L('Kosovo', 'Kosovo', 0.85, 2.8, 0.08, 0.08, 33), HR: L('Kroatien', 'Croatia', 0.15, 1.0, 0.15, 0.05, 55),
    LV: L('Lettland', 'Latvia', 0.10, 0.7, 0.22, 0.09, 55), LI: L('Liechtenstein', 'Liechtenstein', 0.05, 1.0, 0.28, 0.13, 145),
    LT: L('Litauen', 'Lithuania', 0.12, 1.0, 0.22, 0.10, 55), LU: L('Luxemburg', 'Luxembourg', 0.08, 1.0, 0.22, 0.08, 110),
    MT: L('Malta', 'Malta', 0.40, 2.2, 0.13, 0.12, 70), MD: L('Moldau', 'Moldova', 0.45, 2.0, 0.15, 0.07, 30),
    MC: L('Monaco', 'Monaco', 0.05, 2.3, 0.25, 0.11, 120), ME: L('Montenegro', 'Montenegro', 0.40, 1.4, 0.10, 0.08, 42),
    NL: L('Niederlande', 'Netherlands', 0.27, 1.5, 0.30, 0.14, 105), MK: L('Nordmazedonien', 'North Macedonia', 0.55, 2.2, 0.10, 0.07, 35),
    NO: L('Norwegen', 'Norway', 0.02, 0.1, 0.15, 0.12, 130), AT: L('Österreich', 'Austria', 0.10, 0.7, 0.30, 0.12, 102),
    PL: L('Polen', 'Poland', 0.65, 2.6, 0.20, 0.08, 52), PT: L('Portugal', 'Portugal', 0.12, 0.7, 0.23, 0.12, 62),
    RO: L('Rumänien', 'Romania', 0.22, 1.5, 0.20, 0.07, 45), SM: L('San Marino', 'San Marino', 0.25, 1.6, 0.25, 0.10, 85),
    SE: L('Schweden', 'Sweden', 0.03, 0.9, 0.20, 0.15, 115), CH: L('Schweiz', 'Switzerland', 0.04, 1.1, 0.30, 0.13, 145),
    RS: L('Serbien', 'Serbia', 0.65, 2.4, 0.08, 0.05, 40), SK: L('Slowakei', 'Slovakia', 0.10, 1.9, 0.19, 0.07, 55),
    SI: L('Slowenien', 'Slovenia', 0.20, 1.6, 0.19, 0.10, 65), ES: L('Spanien', 'Spain', 0.13, 1.1, 0.25, 0.10, 72),
    CZ: L('Tschechien', 'Czechia', 0.40, 2.4, 0.32, 0.12, 60), TR: L('Türkei', 'Türkiye', 0.42, 1.9, 0.08, 0.03, 38),
    UA: L('Ukraine', 'Ukraine', 0.30, 2.2, 0.06, 0.03, 28), HU: L('Ungarn', 'Hungary', 0.18, 1.8, 0.10, 0.04, 50),
    GB: L('Vereinigtes Königreich', 'United Kingdom', 0.20, 1.3, 0.30, 0.08, 105), CY: L('Zypern', 'Cyprus', 0.60, 2.7, 0.30, 0.12, 75),
  };

  // ---------- Standorte ----------
  // [id, Land, Name DE, Name EN, Heizgradtage, Kühlgradtage, Globalstrahlung horizontal kWh/m²a]
  const LOCATIONS = [
    ['de_hh', 'DE', 'Hamburg (Norden)', 'Hamburg (north)', 3300, 10, 980],
    ['de_ol', 'DE', 'Oldenburg / Bremen (Nordwest)', 'Oldenburg / Bremen (north-west)', 3200, 8, 990],
    ['de_b', 'DE', 'Berlin (Osten)', 'Berlin (east)', 3200, 35, 1050],
    ['de_dd', 'DE', 'Dresden / Leipzig (Sachsen)', 'Dresden / Leipzig (Saxony)', 3300, 35, 1060],
    ['de_k', 'DE', 'Köln / Ruhrgebiet (Westen)', 'Cologne / Ruhr (west)', 2900, 25, 1030],
    ['de_f', 'DE', 'Frankfurt / Rhein-Main (Mitte)', 'Frankfurt / Rhine-Main (centre)', 3000, 40, 1080],
    ['de_m', 'DE', 'München (Süden)', 'Munich (south)', 3400, 30, 1180],
    ['at_w', 'AT', 'Wien (Osten)', 'Vienna (east)', 3000, 60, 1200],
    ['at_g', 'AT', 'Graz (Süden)', 'Graz (south)', 3100, 50, 1250],
    ['at_i', 'AT', 'Innsbruck / Alpen', 'Innsbruck / Alps', 3700, 20, 1250],
    ['ch_z', 'CH', 'Zürich / Mittelland', 'Zurich / Plateau', 3300, 20, 1150],
    ['ch_ge', 'CH', 'Genf (Westschweiz)', 'Geneva (west)', 2900, 40, 1250],
    ['ch_lu', 'CH', 'Lugano (Tessin)', 'Lugano (Ticino)', 2400, 90, 1350],
    ['ch_dv', 'CH', 'Davos / Hochalpen', 'Davos / high Alps', 5300, 0, 1350],
    ['li_v', 'LI', 'Vaduz', 'Vaduz', 3300, 20, 1200],
    ['fr_li', 'FR', 'Lille (Norden)', 'Lille (north)', 2700, 10, 1000],
    ['fr_br', 'FR', 'Brest / Bretagne', 'Brest / Brittany', 2100, 0, 1150],
    ['fr_p', 'FR', 'Paris (Île-de-France)', 'Paris (Île-de-France)', 2500, 40, 1100],
    ['fr_s', 'FR', 'Straßburg (Osten)', 'Strasbourg (east)', 3000, 40, 1100],
    ['fr_ly', 'FR', 'Lyon (Rhône)', 'Lyon (Rhône)', 2500, 80, 1300],
    ['fr_bd', 'FR', 'Bordeaux (Südwesten)', 'Bordeaux (south-west)', 1900, 60, 1350],
    ['fr_ma', 'FR', 'Marseille / Nizza (Mittelmeer)', 'Marseille / Nice (Mediterranean)', 1400, 250, 1600],
    ['be_bx', 'BE', 'Brüssel', 'Brussels', 2800, 15, 1000],
    ['nl_a', 'NL', 'Amsterdam / Randstad', 'Amsterdam / Randstad', 2800, 10, 1000],
    ['lu_l', 'LU', 'Luxemburg', 'Luxembourg', 3100, 20, 1050],
    ['gb_l', 'GB', 'London (Südengland)', 'London (south England)', 2600, 10, 1000],
    ['gb_c', 'GB', 'Cardiff (Wales)', 'Cardiff (Wales)', 2800, 0, 1000],
    ['gb_m', 'GB', 'Manchester (Nordengland)', 'Manchester (north England)', 3000, 0, 920],
    ['gb_e', 'GB', 'Edinburgh (Schottland)', 'Edinburgh (Scotland)', 3300, 0, 880],
    ['ie_d', 'IE', 'Dublin (Osten)', 'Dublin (east)', 2900, 0, 950],
    ['ie_c', 'IE', 'Cork (Süden)', 'Cork (south)', 2600, 0, 1000],
    ['dk_k', 'DK', 'Kopenhagen', 'Copenhagen', 3300, 5, 1000],
    ['dk_a', 'DK', 'Aarhus (Jütland)', 'Aarhus (Jutland)', 3400, 0, 980],
    ['no_o', 'NO', 'Oslo (Süden)', 'Oslo (south)', 4300, 5, 900],
    ['no_b', 'NO', 'Bergen (Westküste)', 'Bergen (west coast)', 3500, 0, 750],
    ['no_t', 'NO', 'Trondheim (Mitte)', 'Trondheim (centre)', 4500, 0, 800],
    ['no_tr', 'NO', 'Tromsø (Norden)', 'Tromsø (north)', 6000, 0, 650],
    ['se_ma', 'SE', 'Malmö (Süden)', 'Malmö (south)', 3300, 10, 1000],
    ['se_g', 'SE', 'Göteborg (Westen)', 'Gothenburg (west)', 3600, 5, 950],
    ['se_s', 'SE', 'Stockholm (Mitte)', 'Stockholm (centre)', 4000, 10, 950],
    ['se_u', 'SE', 'Umeå (Norden)', 'Umeå (north)', 5100, 0, 850],
    ['se_k', 'SE', 'Kiruna (Lappland)', 'Kiruna (Lapland)', 7000, 0, 750],
    ['fi_h', 'FI', 'Helsinki (Süden)', 'Helsinki (south)', 4400, 10, 950],
    ['fi_t', 'FI', 'Tampere (Mitte)', 'Tampere (centre)', 4800, 5, 900],
    ['fi_o', 'FI', 'Oulu (Norden)', 'Oulu (north)', 5500, 0, 850],
    ['fi_r', 'FI', 'Rovaniemi (Lappland)', 'Rovaniemi (Lapland)', 6300, 0, 750],
    ['is_r', 'IS', 'Reykjavík', 'Reykjavík', 5000, 0, 750],
    ['is_a', 'IS', 'Akureyri (Norden)', 'Akureyri (north)', 5800, 0, 650],
    ['ee_t', 'EE', 'Tallinn', 'Tallinn', 4300, 5, 950],
    ['lv_r', 'LV', 'Riga', 'Riga', 4100, 10, 1000],
    ['lt_v', 'LT', 'Vilnius', 'Vilnius', 4100, 15, 1000],
    ['pl_g', 'PL', 'Danzig (Ostsee)', 'Gdańsk (Baltic coast)', 3800, 10, 1000],
    ['pl_w', 'PL', 'Warschau (Mitte)', 'Warsaw (centre)', 3700, 40, 1050],
    ['pl_wr', 'PL', 'Breslau (Südwesten)', 'Wrocław (south-west)', 3400, 40, 1070],
    ['pl_k', 'PL', 'Krakau (Süden)', 'Kraków (south)', 3700, 40, 1100],
    ['cz_p', 'CZ', 'Prag (Böhmen)', 'Prague (Bohemia)', 3500, 30, 1080],
    ['cz_b', 'CZ', 'Brünn (Mähren)', 'Brno (Moravia)', 3300, 50, 1150],
    ['sk_b', 'SK', 'Bratislava (Westen)', 'Bratislava (west)', 3000, 90, 1250],
    ['sk_k', 'SK', 'Košice (Osten)', 'Košice (east)', 3500, 70, 1200],
    ['hu_b', 'HU', 'Budapest', 'Budapest', 2900, 130, 1300],
    ['hu_d', 'HU', 'Debrecen (Osten)', 'Debrecen (east)', 3100, 120, 1300],
    ['si_l', 'SI', 'Ljubljana', 'Ljubljana', 3100, 50, 1250],
    ['hr_z', 'HR', 'Zagreb (Binnenland)', 'Zagreb (inland)', 2800, 100, 1300],
    ['hr_s', 'HR', 'Split (Adriaküste)', 'Split (Adriatic coast)', 1300, 300, 1600],
    ['it_mi', 'IT', 'Mailand / Poebene (Norden)', 'Milan / Po valley (north)', 2500, 180, 1300],
    ['it_bz', 'IT', 'Bozen / Alpen', 'Bolzano / Alps', 3300, 90, 1400],
    ['it_fi', 'IT', 'Florenz (Toskana)', 'Florence (Tuscany)', 1800, 250, 1450],
    ['it_rm', 'IT', 'Rom (Mitte)', 'Rome (centre)', 1400, 250, 1600],
    ['it_na', 'IT', 'Neapel (Süden)', 'Naples (south)', 1100, 300, 1650],
    ['it_pa', 'IT', 'Palermo (Sizilien)', 'Palermo (Sicily)', 700, 420, 1750],
    ['it_ca', 'IT', 'Cagliari (Sardinien)', 'Cagliari (Sardinia)', 900, 350, 1750],
    ['sm_s', 'SM', 'San Marino', 'San Marino', 2200, 150, 1450],
    ['mc_m', 'MC', 'Monaco', 'Monaco', 1100, 200, 1600],
    ['es_bi', 'ES', 'Bilbao (Nordküste)', 'Bilbao (north coast)', 1500, 20, 1250],
    ['es_ma', 'ES', 'Madrid (Zentrum)', 'Madrid (centre)', 1900, 350, 1750],
    ['es_ba', 'ES', 'Barcelona (Katalonien)', 'Barcelona (Catalonia)', 1100, 250, 1600],
    ['es_va', 'ES', 'Valencia (Ostküste)', 'Valencia (east coast)', 900, 350, 1700],
    ['es_se', 'ES', 'Sevilla (Andalusien)', 'Seville (Andalusia)', 700, 650, 1850],
    ['es_lp', 'ES', 'Las Palmas (Kanaren)', 'Las Palmas (Canary Islands)', 20, 200, 1900],
    ['ad_a', 'AD', 'Andorra la Vella', 'Andorra la Vella', 3400, 10, 1500],
    ['pt_po', 'PT', 'Porto (Norden)', 'Porto (north)', 1200, 40, 1600],
    ['pt_li', 'PT', 'Lissabon (Mitte)', 'Lisbon (centre)', 900, 180, 1750],
    ['pt_fa', 'PT', 'Faro (Algarve)', 'Faro (Algarve)', 700, 250, 1900],
    ['gr_th', 'GR', 'Thessaloniki (Norden)', 'Thessaloniki (north)', 1700, 450, 1550],
    ['gr_at', 'GR', 'Athen (Attika)', 'Athens (Attica)', 1100, 900, 1650],
    ['gr_kr', 'GR', 'Heraklion (Kreta)', 'Heraklion (Crete)', 700, 550, 1800],
    ['cy_n', 'CY', 'Nikosia', 'Nicosia', 700, 1100, 1950],
    ['mt_v', 'MT', 'Valletta', 'Valletta', 450, 550, 1900],
    ['ro_cl', 'RO', 'Cluj-Napoca (Siebenbürgen)', 'Cluj-Napoca (Transylvania)', 3500, 60, 1250],
    ['ro_b', 'RO', 'Bukarest (Süden)', 'Bucharest (south)', 3000, 250, 1350],
    ['ro_c', 'RO', 'Constanța (Schwarzmeerküste)', 'Constanța (Black Sea coast)', 2600, 180, 1450],
    ['bg_s', 'BG', 'Sofia (Westen)', 'Sofia (west)', 3000, 80, 1350],
    ['bg_p', 'BG', 'Plowdiw (Thrakien)', 'Plovdiv (Thrace)', 2600, 220, 1450],
    ['bg_v', 'BG', 'Warna (Schwarzmeerküste)', 'Varna (Black Sea coast)', 2500, 180, 1400],
    ['rs_b', 'RS', 'Belgrad', 'Belgrade', 2700, 200, 1350],
    ['ba_s', 'BA', 'Sarajevo', 'Sarajevo', 3300, 60, 1300],
    ['me_p', 'ME', 'Podgorica', 'Podgorica', 1600, 400, 1550],
    ['mk_s', 'MK', 'Skopje', 'Skopje', 2600, 250, 1450],
    ['al_t', 'AL', 'Tirana', 'Tirana', 1500, 350, 1550],
    ['xk_p', 'XK', 'Pristina', 'Pristina', 3100, 120, 1350],
    ['md_c', 'MD', 'Chișinău', 'Chișinău', 3100, 180, 1300],
    ['ua_l', 'UA', 'Lwiw (Westen)', 'Lviv (west)', 3800, 30, 1150],
    ['ua_k', 'UA', 'Kiew (Mitte)', 'Kyiv (centre)', 3900, 80, 1150],
    ['ua_o', 'UA', 'Odessa (Süden)', 'Odesa (south)', 2900, 200, 1350],
    ['tr_i', 'TR', 'Istanbul (Marmara)', 'Istanbul (Marmara)', 1900, 220, 1450],
    ['tr_an', 'TR', 'Ankara (Zentralanatolien)', 'Ankara (central Anatolia)', 2800, 150, 1650],
    ['tr_at', 'TR', 'Antalya (Mittelmeer)', 'Antalya (Mediterranean)', 800, 600, 1850],
    ['tr_e', 'TR', 'Erzurum (Ostanatolien)', 'Erzurum (eastern Anatolia)', 4500, 20, 1600],
  ].map(r => ({ id: r[0], cc: r[1], de: r[2], en: r[3], hdd: r[4], cdd: r[5], gh: r[6] }));

  // Europäisches Mittel zum Vergleich
  const EU_AVG = { hdd: 2900, cdd: 110, gh: 1200 };

  // ---------- Effizienzklassen (Endenergie kWh/m²a, Skala GEG) ----------
  const CLASSES = [
    { c: 'A+', max: 30, col: '#00843d' }, { c: 'A', max: 50, col: '#3aa935' }, { c: 'B', max: 75, col: '#8cc43f' },
    { c: 'C', max: 100, col: '#d1d92b' }, { c: 'D', max: 130, col: '#f4e01a' }, { c: 'E', max: 160, col: '#f6b81c' },
    { c: 'F', max: 200, col: '#ef8a21' }, { c: 'G', max: 250, col: '#e5551f' }, { c: 'H', max: Infinity, col: '#d4211f' },
  ];

  // ---------- Zielwerte ----------
  const TARGETS = {
    passivhaus: { qh: 15 },
    nzeb: { penrtRes: 60, penrtNonRes: 90 }, // EU-Richtwert Betrieb, kWh/m²a PEnrt
    riba: {
      domestic: { op2025: 60, op2030: 35, emb2025: 800, emb2030: 625 },
      office: { op2025: 75, op2030: 55, emb2025: 970, emb2030: 750 },
      school: { op2025: 65, op2030: 60, emb2025: 675, emb2030: 540 },
    },
    // Level(s) 1.2 – keine Grenzwerte; Orientierungsbänder kg CO2e/(m² NRF·a) über 50 Jahre (Literatur)
    levels: [{ max: 15, key: 'veryGood' }, { max: 25, key: 'good' }, { max: 40, key: 'medium' }, { max: Infinity, key: 'high' }],
  };

  const SOURCES = [
    ['Baustoffkennwerte', 'Material data', 'ÖKOBAUDAT (BMWSB) und EPD-Durchschnittswerte, gerundet', 'ÖKOBAUDAT (German LCA database) and EPD averages, rounded'],
    ['Heiz-/Kühlgradtage', 'Heating/cooling degree days', 'Eurostat nrg_chdd (langjähriges Mittel, gerundet)', 'Eurostat nrg_chdd (long-term mean, rounded)'],
    ['Sonneneinstrahlung', 'Solar irradiation', 'PVGIS, Europäische Kommission JRC (gerundet)', 'PVGIS, European Commission JRC (rounded)'],
    ['Strom-CO2 je Land', 'Grid CO2 per country', 'Europäische Umweltagentur (EEA), Stand ca. 2023, gerundet', 'European Environment Agency (EEA), approx. 2023, rounded'],
    ['Energiepreise, Baupreise', 'Energy and construction prices', 'Eurostat (Haushaltspreise, Preisniveauindizes), gerundet', 'Eurostat (household prices, price level indices), rounded'],
    ['Effizienzklassen', 'Efficiency classes', 'GEG Anlage 10 (Endenergie), für alle Länder als gemeinsame Skala', 'German GEG annex 10 (final energy), used as a common scale'],
    ['RIBA 2030', 'RIBA 2030', 'RIBA 2030 Climate Challenge, Version 2 (2021)', 'RIBA 2030 Climate Challenge, version 2 (2021)'],
    ['Passivhaus', 'Passive House', 'Passivhaus Institut: Heizwärmebedarf ≤ 15 kWh/m²a', 'Passive House Institute: heating demand ≤ 15 kWh/m²a'],
    ['EU Level(s)', 'EU Level(s)', 'Level(s) Indikator 1.2; Bänder nach Röck et al. (2020), Orientierung', 'Level(s) indicator 1.2; bands after Röck et al. (2020), indicative'],
    ['Lebensphasen', 'Life cycle stages', 'EN 15978: A1–A3, B4, B6, C3–C4', 'EN 15978: A1–A3, B4, B6, C3–C4'],
  ];

  window.OBC_DATA = {
    MATERIALS, MAT: Object.fromEntries(MATERIALS.map(m => [m.id, m])),
    CONSTRUCTIONS, CON: Object.fromEntries(CONSTRUCTIONS.map(c => [c.id, c])),
    WINDOWS, WIN: Object.fromEntries(WINDOWS.map(w => [w.id, w])),
    CARRIERS, HEATING, HEAT: Object.fromEntries(HEATING.map(h => [h.id, h])),
    BUILDING_TYPES, BT: Object.fromEntries(BUILDING_TYPES.map(b => [b.id, b])),
    COUNTRIES, LOCATIONS, LOC: Object.fromEntries(LOCATIONS.map(l => [l.id, l])), EU_AVG,
    CLASSES, TARGETS, SOURCES,
    YEARS: 50,
  };
})();
