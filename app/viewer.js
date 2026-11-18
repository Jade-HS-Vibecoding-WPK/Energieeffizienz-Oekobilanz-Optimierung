/* Greenprint – 3D-/BIM-Import und Ansicht (three.js, web-ifc) */
(function () {
  'use strict';
  const LIBS = {
    three: 'https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js',
    orbit: 'https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/controls/OrbitControls.js',
    gltf: 'https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/loaders/GLTFLoader.js',
    obj: 'https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/loaders/OBJLoader.js',
    ifc: 'https://cdn.jsdelivr.net/npm/web-ifc@0.0.66/web-ifc-api-iife.js',
  };
  const loaded = {};
  function loadScript(url) {
    if (loaded[url]) return loaded[url];
    loaded[url] = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = url; s.async = true; s.crossOrigin = 'anonymous';
      s.onload = () => res(); s.onerror = () => { delete loaded[url]; rej(new Error('load ' + url)); };
      document.head.appendChild(s);
    });
    return loaded[url];
  }
  async function ensureThree() {
    await loadScript(LIBS.three);
    await loadScript(LIBS.orbit);
  }

  // ---------- Materialnamen → Katalog ----------
  const MAT_RULES = [
    [/recycl|rc-?beton/i, 'rc_beton'], [/cem ?iii|zementreduz|low.?carbon conc/i, 'cem3_beton'],
    [/poren|aerated|ytong|gasbeton/i, 'porenbeton'], [/bims|leichtbeton|lightweight conc|pumice/i, 'leichtbeton'],
    [/estrich|screed/i, 'zementestrich'],
    [/stahlbeton|reinforced|concrete|beton|c\d\d\/\d\d/i, 'stahlbeton'],
    [/kalksand|calcium sil|ks[- ]?stein|\bks\b|sand.?lime/i, 'ks'],
    [/vollziegel|klinker|solid brick|facing brick/i, 'vollziegel'], [/ziegel|brick|clay block|backstein|mauerwerk|masonry/i, 'hlz_alt'],
    [/stampflehm|rammed/i, 'stampflehm'], [/lehmputz|clay plaster/i, 'lehmputz'], [/lehm|earth|adobe/i, 'lehmstein'],
    [/brettsperr|clt|x-?lam|cross.?lam/i, 'bsp'], [/brettschicht|glulam|bsh/i, 'bsh'], [/osb/i, 'osb'],
    [/lärche|larch|schalung|cladding.*wood|holzfassade/i, 'laerche'],
    [/holzfaser|wood.?fib/i, 'holzfaser'], [/zellulose|cellulose/i, 'zellulose'], [/stroh|straw/i, 'stroh'], [/kork|cork/i, 'kork'], [/hanf|hemp/i, 'hanf'],
    [/glaswolle|glass.?wool/i, 'glaswolle'], [/steinwolle|stone.?wool|rock.?wool|mineralwolle|mineral.?wool/i, 'steinwolle'],
    [/schaumglas|foam.?glass|cellular glass/i, 'schaumglas'], [/xps/i, 'xps'], [/eps|polystyr|styropor/i, 'eps'], [/pur|pir|polyur/i, 'pir'],
    [/gipskarton|gypsum.?board|plasterboard|drywall|gk-?platte/i, 'gipskarton'], [/gipsputz|gypsum plaster/i, 'gipsputz'],
    [/putz|render|plaster|stucco/i, 'kalkzementputz'], [/estrich|screed/i, 'zementestrich'],
    [/dachziegel|roof(ing)?\W*tile|tile\W*roof|ziegeleindeck/i, 'dachziegel'],
    [/rigid.?insul|hartschaum|dämmplatte|daemmplatte/i, 'eps'], [/insulation|dämmung|daemmung|dämmstoff|isolierung/i, 'glaswolle'],
    [/spanplatte|sperrholz|plywood|mdf|wood.?sheet|holzwerkstoff|chipboard|particle.?board/i, 'osb'],
    [/holz|timber|wood|kvh|bauholz|lumber|sash/i, 'kvh'],
    [/default roof|generic.*roof|dachkonstruktion|roof.?structure/i, 'kvh'],
    [/stahl|steel/i, 'stahl'], [/alu/i, 'alu'], [/bitumen|asphalt/i, 'bitumen'], [/epdm|fpo|pvc.?bahn|membrane|folie/i, 'epdm'],
    [/dachziegel|roof tile|dachstein/i, 'dachziegel'], [/faserzement|fibre cement|fiber cement|eternit/i, 'faserzement'],
    [/substrat|substrate|gründach|green roof/i, 'substrat'], [/kies|gravel|schotter/i, 'kies'],
  ];
  function matchMaterial(name) {
    if (!name) return null;
    for (const [re, id] of MAT_RULES) if (re.test(name)) return id;
    return null;
  }

  // ---------- Geometrie-Hilfen ----------
  const bearing = (nx, nz) => ((Math.atan2(nx, -nz) * 180) / Math.PI + 360) % 360;

  function triStats(positions, index) {
    // positions: Float32Array (xyz, Weltkoordinaten), index: array|null
    const tri = [];
    const n = index ? index.length / 3 : positions.length / 9;
    for (let i = 0; i < n; i++) {
      const ia = index ? index[i * 3] : i * 3, ib = index ? index[i * 3 + 1] : i * 3 + 1, ic = index ? index[i * 3 + 2] : i * 3 + 2;
      const ax = positions[ia * 3], ay = positions[ia * 3 + 1], az = positions[ia * 3 + 2];
      const bx = positions[ib * 3], by = positions[ib * 3 + 1], bz = positions[ib * 3 + 2];
      const cx = positions[ic * 3], cy = positions[ic * 3 + 1], cz = positions[ic * 3 + 2];
      const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz);
      if (len < 1e-12) continue;
      const area = len / 2; nx /= len; ny /= len; nz /= len;
      tri.push({ i, area, nx, ny, nz, cx: (ax + bx + cx) / 3, cy: (ay + by + cy) / 3, cz: (az + bz + cz) / 3 });
    }
    return tri;
  }
  // Hauptfläche eines Bauteils: größte Gruppe ähnlich ausgerichteter Dreiecke
  function mainFace(tris, mode) {
    const buckets = new Map();
    for (const t of tris) {
      let key;
      if (mode === 'vertical') { if (Math.abs(t.ny) > 0.35) continue; key = Math.round(bearing(t.nx, t.nz) / 15) % 24; }
      else { if (t.ny < 0.7) continue; key = 'up'; }
      const b = buckets.get(key) || { area: 0, nx: 0, ny: 0, nz: 0, cx: 0, cy: 0, cz: 0 };
      b.area += t.area; b.nx += t.nx * t.area; b.ny += t.ny * t.area; b.nz += t.nz * t.area; b.cx += t.cx * t.area; b.cy += t.cy * t.area; b.cz += t.cz * t.area;
      buckets.set(key, b);
    }
    let best = null;
    buckets.forEach(b => { if (!best || b.area > best.area) best = b; });
    if (!best) return null;
    return { area: best.area, nx: best.nx / best.area, ny: best.ny / best.area, nz: best.nz / best.area, cx: best.cx / best.area, cy: best.cy / best.area, cz: best.cz / best.area };
  }

  // ---------- Szene ----------
  const V = {
    THREE: null, renderer: null, scene: null, camera: null, controls: null, root: null, container: null,
    parts: [], // {mesh, elementId, kind, guid, name, baseColor, area}
    hasModel: false, onPick: null, info: null, ro: null, edges: null,
  };

  function initScene() {
    const THREE = window.THREE; V.THREE = THREE;
    if (V.renderer) return;
    V.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    V.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    V.renderer.setClearColor(0x000000, 0);
    V.scene = new THREE.Scene();
    V.camera = new THREE.PerspectiveCamera(40, 1.6, 0.1, 5000);
    V.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9a90, 0.85));
    const dl = new THREE.DirectionalLight(0xffffff, 0.75); dl.position.set(-60, 120, 80); V.scene.add(dl);
    V.controls = new THREE.OrbitControls(V.camera, V.renderer.domElement);
    V.controls.enableDamping = true;
    V.root = new THREE.Group(); V.scene.add(V.root);
    const loop = () => { requestAnimationFrame(loop); if (V.container && V.container.isConnected) { V.controls.update(); V.renderer.render(V.scene, V.camera); } };
    loop();
    // Klick-Auswahl
    let down = null;
    const el = V.renderer.domElement;
    el.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
    el.addEventListener('pointerup', e => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
      const r = el.getBoundingClientRect();
      const m = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const rc = new THREE.Raycaster(); rc.setFromCamera(m, V.camera);
      const hits = rc.intersectObjects(V.parts.filter(p => p.elementId).map(p => p.mesh), false);
      const hit = hits[0];
      const part = hit ? V.parts.find(p => p.mesh === hit.object) : null;
      if (V.onPick) V.onPick(part ? { elementId: part.elementId, guid: part.guid, name: part.name, kind: part.kind } : null);
    });
  }

  function mount(container) {
    if (!V.renderer || !container) return;
    V.container = container;
    if (V.renderer.domElement.parentElement !== container) container.appendChild(V.renderer.domElement);
    const resize = () => {
      const w = container.clientWidth || 600, h = container.clientHeight || 420;
      V.renderer.setSize(w, h, false);
      V.renderer.domElement.style.width = '100%'; V.renderer.domElement.style.height = '100%';
      V.camera.aspect = w / h; V.camera.updateProjectionMatrix();
    };
    if (V.ro) V.ro.disconnect();
    V.ro = new ResizeObserver(resize); V.ro.observe(container); resize();
  }

  function clearModel() {
    V.parts.forEach(p => { p.mesh.geometry.dispose(); });
    if (V.root) { while (V.root.children.length) V.root.remove(V.root.children[0]); }
    V.parts = []; V.hasModel = false; V.info = null;
  }

  function frame() {
    const THREE = V.THREE;
    const box = new THREE.Box3().setFromObject(V.root);
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    const d = Math.max(s.x, s.y, s.z) * 1.6 + 2;
    V.camera.position.set(c.x - d * 0.75, c.y + d * 0.65, c.z + d * 0.9);
    V.camera.near = d / 200; V.camera.far = d * 20; V.camera.updateProjectionMatrix();
    V.controls.target.copy(c); V.controls.update();
  }
  function view(dir) {
    const THREE = V.THREE;
    const box = new THREE.Box3().setFromObject(V.root);
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    const d = Math.max(s.x, s.y, s.z) * 1.8 + 2;
    const rot = ((V.info && V.info.north) || 0) * Math.PI / 180;
    // Himmelsrichtungen in Modellkoordinaten (Nord = −Z, gedreht um north)
    const dirVec = b => { const a = (b - (V.info ? V.info.north : 0)) * Math.PI / 180; return new THREE.Vector3(Math.sin(a), 0, -Math.cos(a)); };
    void rot;
    if (dir === 'top') V.camera.position.set(c.x, c.y + d, c.z + 0.001);
    else { const b = { S: 180, N: 0, E: 90, W: 270 }[dir]; const v = dirVec(b != null ? b : 180); V.camera.position.set(c.x + v.x * d, c.y + s.y * 0.3, c.z + v.z * d); }
    V.controls.target.copy(c); V.controls.update();
  }

  const KIND_COLOR = { AW: 0xd9d4c7, DA: 0xb9573f, BO: 0x8f9a93, DE: 0xc9ccc4, IW: 0xe6e2d8, FE: 0x8fc1d9, CTX: 0xcfd3cf };

  function addPart(geom, kind, elementKey, meta) {
    const THREE = V.THREE;
    const color = KIND_COLOR[kind] || KIND_COLOR.CTX;
    const mat = new THREE.MeshLambertMaterial({ color, transparent: kind === 'FE' || kind === 'CTX', opacity: kind === 'FE' ? 0.75 : kind === 'CTX' ? 0.35 : 1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const mesh = new THREE.Mesh(geom, mat);
    V.root.add(mesh);
    if (geom.attributes.position.count < 60000) {
      const eg = new THREE.EdgesGeometry(geom, 25);
      const ln = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 0x1d2620, transparent: true, opacity: 0.35 }));
      mesh.add(ln);
    }
    const part = Object.assign({ mesh, kind, elementKey, elementId: null, baseColor: color }, meta || {});
    V.parts.push(part);
    return part;
  }

  // ---------- IFC ----------
  async function readIfc(buffer, opts, progress) {
    progress && progress('libs');
    await ensureThree();
    await loadScript(LIBS.ifc);
    initScene(); clearModel();
    const W = window.WebIFC;
    const api = new W.IfcAPI();
    // Baustein web-ifc.wasm: zuerst aus dem App-Ordner, sonst (z. B. Seite per Doppelklick als Datei geöffnet
    // oder lokaler Server beendet) vom CDN laden.
    const local = new URL('.', document.baseURI).href;
    const cdn = LIBS.ifc.replace(/[^/]+$/, '');
    let base = local;
    try { const r = await fetch(local + 'web-ifc.wasm', { method: 'HEAD', cache: 'no-store' }); if (!r.ok) base = cdn; } catch (e) { base = cdn; }
    api.SetWasmPath(base, true);
    try { await api.Init(undefined, true); }
    catch (e) { if (base === cdn) throw e; api.SetWasmPath(cdn, true); await api.Init(undefined, true); }
    try { if (W.LogLevel) api.SetLogLevel(W.LogLevel.LOG_LEVEL_OFF); } catch (e) { /* ältere Version */ }
    progress && progress('parse');
    const modelID = api.OpenModel(new Uint8Array(buffer), { COORDINATE_TO_ORIGIN: true });
    const T = W;
    const catOf = new Map();
    const reg = (type, cat) => { const ids = api.GetLineIDsWithType(modelID, type); for (let i = 0; i < ids.size(); i++) catOf.set(ids.get(i), cat); };
    reg(T.IFCWALL, 'wall'); reg(T.IFCWALLSTANDARDCASE, 'wall'); reg(T.IFCSLAB, 'slab'); reg(T.IFCROOF, 'roof');
    reg(T.IFCWINDOW, 'window'); reg(T.IFCCURTAINWALL, 'window'); reg(T.IFCPLATE, 'plate');
    const skip = new Set();
    [T.IFCSPACE, T.IFCOPENINGELEMENT].forEach(tp => { if (tp == null) return; const ids = api.GetLineIDsWithType(modelID, tp); for (let i = 0; i < ids.size(); i++) skip.add(ids.get(i)); });

    // True North
    let north = 0;
    try {
      const ctx = api.GetLineIDsWithType(modelID, T.IFCGEOMETRICREPRESENTATIONCONTEXT);
      for (let i = 0; i < ctx.size(); i++) {
        const l = api.GetLine(modelID, ctx.get(i));
        if (l && l.TrueNorth && l.TrueNorth.value) {
          const dirL = api.GetLine(modelID, l.TrueNorth.value);
          const r = (dirL.DirectionRatios || []).map(v => v.value);
          if (r.length >= 2) { north = (Math.atan2(-r[0], r[1]) * 180) / Math.PI; break; }
        }
      }
    } catch (e) { /* optional */ }

    // Materialschichten
    const matOf = new Map();
    try {
      const rels = api.GetLineIDsWithType(modelID, T.IFCRELASSOCIATESMATERIAL);
      for (let i = 0; i < rels.size(); i++) {
        const rel = api.GetLine(modelID, rels.get(i));
        const rm = rel.RelatingMaterial && api.GetLine(modelID, rel.RelatingMaterial.value);
        const layers = resolveMaterial(api, modelID, rm);
        (rel.RelatedObjects || []).forEach(o => { if (o && o.value != null) matOf.set(o.value, layers); });
      }
    } catch (e) { /* optional */ }

    // Geometrie
    const raw = [];
    api.StreamAllMeshes(modelID, mesh => {
      const id = mesh.expressID;
      if (skip.has(id)) return;
      const pos = [], idx = [];
      const geoms = mesh.geometries;
      for (let g = 0; g < geoms.size(); g++) {
        const pg = geoms.get(g);
        const geom = api.GetGeometry(modelID, pg.geometryExpressID);
        const v = api.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize());
        const ix = api.GetIndexArray(geom.GetIndexData(), geom.GetIndexDataSize());
        const m = pg.flatTransformation;
        const off = pos.length / 3;
        for (let k = 0; k < v.length; k += 6) {
          const x = v[k], y = v[k + 1], z = v[k + 2];
          pos.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
        }
        for (let k = 0; k < ix.length; k++) idx.push(ix[k] + off);
        geom.delete();
      }
      if (pos.length) raw.push({ id, pos: new Float32Array(pos), idx });
    });

    // Maßstab prüfen
    let minY = Infinity, maxY = -Infinity, ext = 0;
    raw.forEach(r => { for (let k = 0; k < r.pos.length; k += 3) { const y = r.pos[k + 1]; if (y < minY) minY = y; if (y > maxY) maxY = y; ext = Math.max(ext, Math.abs(r.pos[k]), Math.abs(r.pos[k + 2])); } });
    const scale = ext > 3000 ? 0.001 : 1;
    if (scale !== 1) { raw.forEach(r => { for (let k = 0; k < r.pos.length; k++) r.pos[k] *= scale; }); minY *= scale; maxY *= scale; }

    // Gebäudemittelpunkt und konvexe Hülle aus den Wänden (Gelände und Dachüberstand bleiben außen vor)
    let sx = 0, sz = 0, sn = 0;
    const pts = [];
    raw.forEach(r => {
      const cat = catOf.get(r.id);
      if (cat !== 'wall' && cat !== 'window') return;
      for (let k = 0; k < r.pos.length; k += 9) { sx += r.pos[k]; sz += r.pos[k + 2]; sn++; if (pts.length < 60000) pts.push([r.pos[k], r.pos[k + 2]]); }
    });
    if (!sn) raw.forEach(r => { for (let k = 0; k < r.pos.length; k += 9) { sx += r.pos[k]; sz += r.pos[k + 2]; sn++; if (pts.length < 60000) pts.push([r.pos[k], r.pos[k + 2]]); } });
    const cx = sx / Math.max(1, sn), cz = sz / Math.max(1, sn);
    const hull = convexHull(pts);

    // Eigenschaften (IsExternal, ThermalTransmittance) über IfcRelDefinesByProperties
    const props = new Map();
    try {
      const rels = api.GetLineIDsWithType(modelID, T.IFCRELDEFINESBYPROPERTIES);
      for (let i = 0; i < rels.size(); i++) {
        const rel = api.GetLine(modelID, rels.get(i));
        const objs = (rel.RelatedObjects || []).map(o => o && o.value).filter(v => catOf.has(v));
        if (!objs.length || !rel.RelatingPropertyDefinition) continue;
        const pd = api.GetLine(modelID, rel.RelatingPropertyDefinition.value);
        for (const h of (pd && pd.HasProperties) || []) {
          const p = api.GetLine(modelID, h.value);
          const pn = p && p.Name && p.Name.value;
          const pv = p && p.NominalValue ? p.NominalValue.value : undefined;
          if (pv == null || (pn !== 'IsExternal' && pn !== 'ThermalTransmittance')) continue;
          for (const o of objs) {
            const cur = props.get(o) || {};
            if (pn === 'IsExternal') cur.isExt = pv === true || pv === 'T' || pv === '.T.' || pv === 1 || pv === 'true';
            else cur.uval = +pv;
            props.set(o, cur);
          }
        }
      }
    } catch (e) { /* optional */ }

    const items = [];
    for (const r of raw) {
      const cat = catOf.get(r.id) || 'ctx';
      let line = null;
      try { line = api.GetLine(modelID, r.id); } catch (e) { /* */ }
      const name = line && line.Name && line.Name.value ? String(line.Name.value) : '';
      const guid = line && line.GlobalId && line.GlobalId.value ? String(line.GlobalId.value) : '';
      const pdt = line && line.PredefinedType && line.PredefinedType.value ? String(line.PredefinedType.value) : '';
      const pr = props.get(r.id) || {};
      const isExt = pr.isExt != null ? pr.isExt : null, uval = pr.uval != null && pr.uval > 0 ? pr.uval : null;
      const tris = triStats(r.pos, r.idx);
      items.push({ r, cat, name, guid, pdt, isExt, uval, tris, layers: matOf.get(r.id) || null });
    }
    api.CloseModel(modelID);

    // Klassifizieren
    const slabYs = [];
    items.forEach(it => { if (it.cat === 'slab') { const f = mainFace(it.tris, 'up'); if (f) { it.face = f; slabYs.push(f.cy); } } });
    const topY = Math.max(...slabYs, minY), botY = Math.min(...slabYs, maxY);
    const out = [];
    items.forEach(it => {
      let kind = null, face = null;
      if (it.cat === 'wall') {
        face = mainFace(it.tris, 'vertical');
        let ext2 = it.isExt;
        if (ext2 == null && face) ext2 = distToHull(hull, face.cx, face.cz) < 1.2;
        kind = ext2 ? 'AW' : 'IW';
      } else if (it.cat === 'roof') { kind = 'DA'; face = mainFace(it.tris, 'up'); }
      else if (it.cat === 'slab') {
        face = it.face || mainFace(it.tris, 'up');
        if (/ROOF/.test(it.pdt)) kind = 'DA';
        else if (/BASESLAB/.test(it.pdt)) kind = 'BO';
        else if (face && Math.abs(face.cy - botY) < 0.6) kind = 'BO';
        else if (face && Math.abs(face.cy - topY) < 0.6 && it.isExt !== false) kind = 'DA';
        else kind = 'DE';
      } else if (it.cat === 'window' || it.cat === 'plate') { kind = 'FE'; face = mainFace(it.tris, 'vertical'); }
      if (kind && face && face.area > 0.05) {
        let az = null;
        if (kind === 'AW' || kind === 'FE') {
          let nx = face.nx, nz = face.nz;
          if ((face.cx - cx) * nx + (face.cz - cz) * nz < 0) { nx = -nx; nz = -nz; }
          az = bearing(nx, nz);
        }
        out.push({ kind, area: face.area, az, guid: it.guid, name: it.name, layers: it.layers, uval: it.uval, cy: face.cy, r: it.r, flat: kind === 'DA' ? face.ny > 0.97 : undefined, face, isWall: it.cat === 'wall' });
      } else {
        out.push({ kind: 'CTX', r: it.r, name: it.name, guid: it.guid });
      }
    });
    stackWallLayers(out, cx, cz);

    // Szene
    const THREE = V.THREE;
    out.forEach(o => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(o.r.pos, 3));
      if (o.r.idx && o.r.idx.length) g.setIndex(o.r.idx);
      g.computeVertexNormals();
      o.part = addPart(g, o.kind, null, { guid: o.guid, name: o.name, area: o.area });
    });
    V.hasModel = true;
    frame();

    const geo = geometryFrom(out.filter(o => o.kind !== 'CTX'), minY, maxY);
    const info = { format: 'IFC', north: num(opts.north, north), ifcNorth: north, count: out.length, parts: out.filter(o => o.kind !== 'CTX'), geo, matNames: collectMatNames(out) };
    V.info = info;
    return info;
  }

  // Schichtweise modellierte Wände zusammenfassen: Liegen mehrere Wände parallel direkt aneinander
  // (z. B. 8 cm Holz + 12 cm Dämmung + 2,2 cm Platte als drei einzelne Wände) und ist eine davon eine
  // Außenwand, wird daraus eine Außenwand mit allen Schichten (von außen nach innen).
  // Die inneren Teile bleiben im 3D-Modell sichtbar (hostOf), zählen aber nicht doppelt als Fläche.
  function stackWallLayers(out, cx, cz) {
    const walls = out.filter(o => o.isWall && o.face && (o.kind === 'AW' || o.kind === 'IW'));
    if (walls.length < 2) return;
    walls.forEach(w => {
      const l = Math.hypot(w.face.nx, w.face.nz) || 1;
      w._n = [w.face.nx / l, w.face.nz / l];
    });
    // Ausdehnung einer Wand in einem Achsensystem (n = Normale, t = Tangente)
    const range = (w, n) => {
      const p = w.r.pos; let s0 = Infinity, s1 = -Infinity, t0 = Infinity, t1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let k = 0; k < p.length; k += 3) {
        const s = p[k] * n[0] + p[k + 2] * n[1], t = -p[k] * n[1] + p[k + 2] * n[0], y = p[k + 1];
        if (s < s0) s0 = s; if (s > s1) s1 = s; if (t < t0) t0 = t; if (t > t1) t1 = t; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      return { s0, s1, t0, t1, y0, y1 };
    };
    const ov = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);
    // Union-Find
    const par = walls.map((_, i) => i);
    const find = i => (par[i] === i ? i : (par[i] = find(par[i])));
    for (let i = 0; i < walls.length; i++) {
      const a = walls[i], ra = range(a, a._n);
      for (let j = i + 1; j < walls.length; j++) {
        const b = walls[j];
        if (Math.abs(a._n[0] * b._n[0] + a._n[1] * b._n[1]) < 0.97) continue; // nicht parallel
        const rb = range(b, a._n);
        if (ov(ra.s0, ra.s1, rb.s0, rb.s1) < -0.03) continue; // nicht aneinander (Fuge > 3 cm)
        if (ov(ra.t0, ra.t1, rb.t0, rb.t1) < 0.3 || ov(ra.y0, ra.y1, rb.y0, rb.y1) < 0.3) continue; // überlappen nicht
        par[find(i)] = find(j);
      }
    }
    const clusters = new Map();
    walls.forEach((w, i) => { const r = find(i); (clusters.get(r) || clusters.set(r, []).get(r)).push(w); });
    clusters.forEach(cl => {
      if (cl.length < 2 || !cl.some(w => w.kind === 'AW')) return;
      // Außenrichtung: zu den als Außenwand erkannten Teilen hin (sonst von der Gebäudemitte weg)
      const ref = cl.find(w => w.kind === 'AW');
      let n = ref._n.slice();
      cl.forEach(w => { const r = range(w, n); w._s = (r.s0 + r.s1) / 2; w._th = r.s1 - r.s0; });
      const mean = arr => arr.reduce((a, w) => a + w._s, 0) / arr.length;
      const ext = cl.filter(w => w.kind === 'AW'), inn = cl.filter(w => w.kind !== 'AW');
      let flip;
      if (inn.length) flip = mean(ext) < mean(inn);
      else flip = (ref.face.cx - cx) * n[0] + (ref.face.cz - cz) * n[1] < 0;
      if (flip) { n = [-n[0], -n[1]]; cl.forEach(w => { w._s = -w._s; }); }
      // Bänder: Wände, die in derselben Ebene liegen (gleiche Lage in der Wandtiefe)
      const sorted = cl.slice().sort((a, b) => b._s - a._s); // außen zuerst
      const bands = [];
      sorted.forEach(w => {
        const b = bands.find(b => Math.abs(b.s - w._s) < Math.max(0.02, Math.min(b.th, w._th) / 2));
        if (b) b.items.push(w); else bands.push({ s: w._s, th: w._th, items: [w] });
      });
      if (bands.length < 2) return;
      const layers = [];
      bands.forEach(b => {
        const src = b.items.find(w => w.layers && w.layers.length);
        if (src) src.layers.forEach(l => layers.push({ name: l.name, d: l.d > 0 ? l.d : Math.round(b.th * 1000) / 1000 }));
        else layers.push({ name: b.items[0].name || '', d: Math.round(b.th * 1000) / 1000 });
      });
      const hosts = bands[0].items;
      hosts.forEach(h => { if (h.az == null) h.az = bearing(n[0], n[1]); h.kind = 'AW'; h.layers = layers; h.stacked = bands.length; h.uval = null; });
      bands.slice(1).forEach(b => b.items.forEach(w => { w.kind = 'AW'; w.hostOf = hosts[0]; }));
    });
    walls.forEach(w => { delete w._n; delete w._s; delete w._th; });
  }

  function resolveMaterial(api, modelID, rm) {
    if (!rm) return null;
    const get = id => api.GetLine(modelID, id);
    const nameOf = m => (m && m.Name && m.Name.value) ? String(m.Name.value) : '';
    const layersFrom = set => (set.MaterialLayers || []).map(ref => {
      const L = get(ref.value);
      const mat = L && L.Material ? get(L.Material.value) : null;
      let d = L && L.LayerThickness ? +L.LayerThickness.value : 0;
      if (d > 5) d = d / 1000; // mm → m
      return { name: nameOf(mat) || nameOf(L), d };
    });
    try {
      if (rm.ForLayerSet) return layersFrom(get(rm.ForLayerSet.value));
      if (rm.MaterialLayers) return layersFrom(rm);
      if (rm.Materials) return rm.Materials.map(r => ({ name: nameOf(get(r.value)), d: 0 }));
      if (rm.MaterialConstituents) return rm.MaterialConstituents.map(r => { const c = get(r.value); return { name: nameOf(c && c.Material ? get(c.Material.value) : c), d: 0 }; });
      if (rm.Name) return [{ name: nameOf(rm), d: 0 }];
    } catch (e) { /* */ }
    return null;
  }

  function collectMatNames(out) {
    const set = new Set();
    // Fenster nutzen keine Schichten (Uw-Wert), ihre Materialnamen sind für die Berechnung egal
    out.forEach(o => o.kind !== 'FE' && !o.hostOf && (o.layers || []).forEach(l => { if (l.name && !matchMaterial(l.name)) set.add(l.name); }));
    return [...set];
  }

  // ---------- OBJ / glTF ----------
  async function readMesh(file, buffer, opts, progress) {
    progress && progress('libs');
    await ensureThree();
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'obj') await loadScript(LIBS.obj); else await loadScript(LIBS.gltf);
    initScene(); clearModel();
    progress && progress('parse');
    const THREE = window.THREE;
    let obj;
    if (ext === 'obj') obj = new THREE.OBJLoader().parse(new TextDecoder().decode(buffer));
    else obj = await new Promise((res, rej) => new THREE.GLTFLoader().parse(buffer, '', g => res(g.scene), rej));
    const unit = { m: 1, cm: 0.01, mm: 0.001 }[opts.unit || 'm'] || 1;
    const holder = new THREE.Group(); holder.add(obj);
    holder.scale.setScalar(unit);
    if (opts.upAxis === 'z') holder.rotation.x = -Math.PI / 2;
    holder.updateMatrixWorld(true);
    // Dreiecke in Weltkoordinaten sammeln
    const meshes = [];
    holder.traverse(o => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const mname = mats.map(m => (m && m.name) || '').join(' ');
      const transparent = mats.some(m => m && (m.transparent && m.opacity < 0.8 || m.transmission > 0.3));
      meshes.push({ name: (o.name || '') + ' ' + mname, pos: g.attributes.position.array, transparent });
    });
    let minY = Infinity, maxY = -Infinity, sx = 0, sz = 0, sn = 0;
    meshes.forEach(m => { for (let k = 0; k < m.pos.length; k += 3) { const y = m.pos[k + 1]; if (y < minY) minY = y; if (y > maxY) maxY = y; sx += m.pos[k]; sz += m.pos[k + 2]; sn++; } });
    const cx = sx / Math.max(1, sn), cz = sz / Math.max(1, sn);
    const WIN = /(glas|glass|window|fenster|vitr|pane|glazing)/i;
    const KW = [[/roof|dach/i, 'DA'], [/floor|boden|slab|platte|decke|ground/i, 'BO'], [/wall|wand|fassade|facade/i, 'AW']];
    const groups = new Map(); // key → {kind, az, tris:[], positions:[]}
    meshes.forEach(m => {
      const isWin = m.transparent || WIN.test(m.name);
      const forced = KW.find(k => k[0].test(m.name));
      const tris = triStats(m.pos, null);
      tris.forEach(t => {
        let kind, az = null;
        if (isWin) { if (Math.abs(t.ny) > 0.35) return; kind = 'FE'; }
        else if (Math.abs(t.ny) < 0.3) kind = forced && forced[1] !== 'AW' ? forced[1] : 'AW';
        else if (t.ny >= 0.3) kind = t.cy > minY + 0.8 ? 'DA' : 'BO_TOP';
        else kind = 'BO';
        if (kind === 'BO_TOP') return; // Oberseite der Bodenplatte (innen)
        if (kind === 'AW' || kind === 'FE') {
          let nx = t.nx, nz = t.nz;
          if ((t.cx - cx) * nx + (t.cz - cz) * nz < 0 && !isWin) { nx = -nx; nz = -nz; }
          az = bearing(nx, nz);
        }
        const key = kind + (az != null ? '_' + (Math.round(az / 45) % 8) : '');
        const gr = groups.get(key) || { kind, azSum: 0, area: 0, pos: [], nyA: 0 };
        gr.area += t.area; gr.nyA += t.ny * t.area; if (az != null) gr.azSum += az * t.area;
        const k = t.i * 9; for (let q = 0; q < 9; q++) gr.pos.push(m.pos[k + q]);
        groups.set(key, gr);
      });
    });
    const out = [];
    groups.forEach((gr, key) => {
      const THREE2 = window.THREE;
      const g = new THREE2.BufferGeometry();
      g.setAttribute('position', new THREE2.BufferAttribute(new Float32Array(gr.pos), 3));
      g.computeVertexNormals();
      const az = gr.kind === 'AW' || gr.kind === 'FE' ? meanBearing(gr) : null;
      const o = { kind: gr.kind, area: gr.area, az, name: key, guid: '', layers: null, flat: gr.kind === 'DA' ? gr.nyA / Math.max(1e-9, gr.area) > 0.97 : undefined };
      o.part = addPart(g, gr.kind, null, { name: key, area: gr.area });
      out.push(o);
    });
    // Fensterflächen von den Wandflächen abziehen (Fenster auf Wandflächen modelliert)
    out.filter(o => o.kind === 'FE').forEach(w => {
      const wall = out.filter(o => o.kind === 'AW').sort((a, b) => angDiff(a.az, w.az) - angDiff(b.az, w.az))[0];
      if (wall && angDiff(wall.az, w.az) < 30) wall.area = Math.max(0, wall.area - w.area);
    });
    V.hasModel = true;
    frame();
    const geo = geometryFrom(out, minY, maxY);
    const info = { format: ext.toUpperCase(), north: num(opts.north, 0), ifcNorth: 0, count: out.length, parts: out, geo, matNames: [] };
    V.info = info;
    return info;
  }
  function meanBearing(gr) { return gr.area ? (gr.azSum / gr.area) % 360 : 0; }
  function angDiff(a, b) { const d = Math.abs(((a - b) % 360 + 540) % 360 - 180); return d; }

  function geometryFrom(parts, minY, maxY) {
    const sum = k => parts.filter(p => p.kind === k).reduce((s, p) => s + (p.area || 0), 0);
    const bo = sum('BO'), da = sum('DA'), de = sum('DE');
    const height = Math.max(2.5, maxY - minY);
    const levels = [];
    parts.filter(p => (p.kind === 'DE' || p.kind === 'BO') && p.cy != null).forEach(p => { if (!levels.some(l => Math.abs(l - p.cy) < 0.8)) levels.push(p.cy); });
    let floors = Math.max(1, levels.length || Math.round(height / 3));
    const footprint = bo || da || 0;
    const bgf = (bo + de) > footprint ? bo + de : footprint * floors;
    if (!levels.length && footprint) floors = Math.max(1, Math.round(height / 3.1));
    return { footprint, bgf, nrf: bgf * 0.8, floors, height, hStorey: height / floors, volume: footprint * height };
  }

  function convexHull(points) {
    if (points.length < 3) return points;
    const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    up.pop(); lo.pop();
    return lo.concat(up);
  }
  function distToHull(h, x, z) {
    if (!h || h.length < 3) return 0;
    let best = Infinity;
    for (let i = 0; i < h.length; i++) {
      const a = h[i], b = h[(i + 1) % h.length];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
      best = Math.min(best, Math.hypot(x - (a[0] + t * dx), z - (a[1] + t * dz)));
    }
    return best;
  }
  function num(v, d) { return Number.isFinite(+v) && v !== '' && v != null ? +v : d; }

  // ---------- Darstellung ----------
  function setColors(fn) {
    V.parts.forEach(p => {
      const c = p.elementId ? fn(p.elementId, p) : null;
      p.mesh.material.color.setHex(c == null ? p.baseColor : c);
      p.mesh.material.opacity = p.kind === 'FE' ? 0.8 : p.kind === 'CTX' ? 0.25 : 1;
    });
  }
  function highlight(ids) {
    const set = new Set(ids || []);
    V.parts.forEach(p => {
      const on = set.size === 0 || set.has(p.elementId);
      p.mesh.material.transparent = true;
      p.mesh.material.opacity = on ? (p.kind === 'FE' ? 0.85 : 1) : 0.12;
      if (p.mesh.material.emissive) p.mesh.material.emissive.setHex(set.size && on ? 0x1f5a3d : 0x000000);
      if (p.mesh.material.emissive) p.mesh.material.emissiveIntensity = set.size && on ? 0.35 : 0;
    });
  }
  function snapshot() {
    return new Promise(res => { if (!V.renderer) return res(null); V.renderer.render(V.scene, V.camera); V.renderer.domElement.toBlob(b => res(b), 'image/png'); });
  }
  // Ansicht mit weißem Hintergrund als JPEG (für den PDF-Bericht)
  function snapshotDataUrl() {
    if (!V.renderer) return null;
    V.renderer.render(V.scene, V.camera);
    try {
      const src = V.renderer.domElement;
      const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
      const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(src, 0, 0);
      return { data: c.toDataURL('image/jpeg', 0.9), ratio: c.height / Math.max(1, c.width) };
    } catch (e) { return null; }
  }

  async function load(file, opts, progress) {
    const buf = await file.arrayBuffer();
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'ifc') return readIfc(buf, opts || {}, progress);
    if (['obj', 'gltf', 'glb'].includes(ext)) return readMesh(file, buf, opts || {}, progress);
    throw new Error('format');
  }

  window.OBC_VIEWER = {
    load, mount, setColors, highlight, snapshot, snapshotDataUrl, frame, view, matchMaterial, clearModel, loadScript,
    get hasModel() { return V.hasModel; }, get parts() { return V.parts; }, get info() { return V.info; },
    set onPick(fn) { V.onPick = fn; },
  };
})();
