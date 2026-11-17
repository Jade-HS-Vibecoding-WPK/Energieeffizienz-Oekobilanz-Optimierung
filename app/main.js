/* Greenprint – Oberfläche */
(function () {
  'use strict';
  const D = window.OBC_DATA, I = window.OBC_I18N, K = window.OBC_CALC, CH = window.OBC_CHARTS, AI = window.OBC_AI, VW = window.OBC_VIEWER, EX = window.OBC_EXPORT;
  const t = (k, v) => I.t(k, v), nm = o => I.nm(o), fmt = (v, d) => I.fmt(v, d), esc = CH.esc, icon = CH.icon;
  const $ = (s, r) => (r || document).querySelector(s);
  const PDFJS = ['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'];
  const GL = { u: 0, grey: 1, co2e: 2, penrt: 3, end: 4, heat: 5, area: 6, hdd: 7, cdd: 8, av: 9, jaz: 10, phases: 11, bio: 12, circ: 13, wb: 14, payback: 15 };
  const KINDS = ['AW', 'DA', 'BO', 'DE', 'IW'];

  const ex = K.example();
  const App = {
    variants: [ex], active: 0, meta: { project: '', author: '', school: '' }, step: 1,
    plans: [], modelFile: null, modelOpts: { unit: 'm', upAxis: 'y', north: '' }, modelInfo: null,
    progress: null, ctl: null, ai: {}, chat: [], chatBusy: false, colorMode: 'heat', ba: false, selected: null, applyMode: 'type',
    sort: 'impact', sample: null, downloads: null, limits: null, open: {}, busy: '', toastTimer: null,
  };
  const cur = () => App.variants[App.active];
  const OR = window.OBC_OPENROUTER;
  delete App.sample; delete App.limits;
  App.claudeSample = null; App.claudeLimits = null;
  // Aktiver KI-Weg: claude.ai (eingebaut) oder OpenRouter (eigener Key)
  function aiProvider() {
    const p = OR.cfg.provider;
    if (p === 'openrouter') return OR.hasKey ? 'openrouter' : null;
    if (p === 'claude') return App.claudeSample ? 'claude' : null;
    return App.claudeSample ? 'claude' : OR.hasKey ? 'openrouter' : null;
  }
  Object.defineProperty(App, 'sample', { get() { const p = aiProvider(); return p === 'claude' ? App.claudeSample : p === 'openrouter' ? OR.sample : null; } });
  Object.defineProperty(App, 'limits', { get() { const p = aiProvider(); return p === 'claude' ? App.claudeLimits : p === 'openrouter' ? { images: { maxCount: OR.isFree(OR.cfg.strong) ? 6 : 12 } } : null; } });

  // ---------- Fähigkeiten ----------
  (async () => {
    if (!window.claude || typeof window.claude.use !== 'function') return;
    try { App.claudeSample = await window.claude.use('sample'); } catch (e) { App.claudeSample = null; }
    try { App.downloads = await window.claude.use('downloads'); } catch (e) { App.downloads = null; }
    if (App.claudeSample) { try { App.claudeLimits = await App.claudeSample.limits(); } catch (e) { App.claudeLimits = null; } }
    render();
  })();

  // ---------- Hilfen ----------
  function toast(msg) {
    let el = $('#toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = msg; el.hidden = false;
    clearTimeout(App.toastTimer); App.toastTimer = setTimeout(() => { el.hidden = true; }, 3800);
  }
  function modal(title, html) {
    closeModal();
    const m = document.createElement('div'); m.className = 'modal'; m.id = 'modal';
    m.innerHTML = `<div class="box" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="row" style="justify-content:space-between"><h3>${esc(title)}</h3><button class="iconbtn" data-act="closeModal" aria-label="${t('close')}">${icon('x')}</button></div>${html}</div>`;
    m.addEventListener('click', e => { if (e.target === m) closeModal(); });
    document.body.appendChild(m);
  }
  function closeModal() { const m = $('#modal'); if (m) m.remove(); }
  const help = i => `<button class="help" data-act="help" data-i="${i}" aria-label="${t('help')}">?</button>`;
  const errText = e => {
    const base = t('err_' + (e && e.code)) !== 'err_' + (e && e.code) ? t('err_' + e.code) : t('errorGeneric');
    // Originalmeldung von OpenRouter zur Fehlersuche mit anzeigen
    const detail = e && e.message && e.message !== e.code && ['no_credits', 'invalid_key', 'upstream_error', 'network', 'rate_limited', 'image_rejected', 'data_policy', 'free_limit'].includes(e.code) ? String(e.message).slice(0, 240) : '';
    return detail ? `${base} (OpenRouter: ${detail})` : base;
  };
  const orientLabel = az => t('or_' + K.orientKey(az));
  const conLabel = e => e.con === 'custom' ? t('customLayers') : nm(D.CON[e.con]);
  const kindLabel = k => t('kind_' + k);
  function badge(conf, src) {
    if (!conf && !src) return '';
    return `<span class="badge ${esc(conf || '')}" title="${esc(t('src_' + (src || 'manual')))}">${esc(t('conf_' + (conf || 'hoch')))} · ${esc(t('src_' + (src || 'manual')))}</span>`;
  }
  function setPath(obj, path, val) {
    const p = path.split('.'); let o = obj;
    for (let i = 0; i < p.length - 1; i++) { if (o[p[i]] == null || typeof o[p[i]] !== 'object') o[p[i]] = {}; o = o[p[i]]; }
    o[p[p.length - 1]] = val;
  }
  function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }
  function readVal(el) {
    if (el.type === 'checkbox') return el.checked;
    if (el.type === 'number' || el.dataset.num) { if (el.value === '') return ''; const v = parseFloat(String(el.value).replace(',', '.')); return Number.isFinite(v) ? v : ''; }
    return el.value;
  }
  function loadScript(u) { return VW.loadScript(u); }

  // ---------- KI-Einstellungen (OpenRouter) ----------
  function aiStatusText() {
    const p = aiProvider();
    if (p === 'claude') return t('aiViaClaude');
    if (p === 'openrouter') return t('aiViaOr') + ' · ' + OR.cfg.strong + ' / ' + OR.cfg.fast;
    return t('aiNone');
  }
  function maskKey(k) { return k ? k.slice(0, 8) + '…' + k.slice(-4) : ''; }
  function modelOptions(sel) {
    const list = App.orModels && App.orModels.length ? App.orModels
      : [OR.FREE.strong, OR.FREE.fast, OR.DEFAULTS.strong, OR.DEFAULTS.fast].map(id => ({ id, name: id, free: OR.isFree(id) }));
    const ids = list.map(m => m.id);
    const extra = ids.includes(sel) ? [] : [{ id: sel, name: sel, free: OR.isFree(sel) }];
    const free = I.lang === 'en' ? 'free' : 'kostenlos';
    const opt = m => `<option value="${esc(m.id)}" ${m.id === sel ? 'selected' : ''}>${esc(m.id)}${m.free ? ` · ${free}` : m.inUsd != null ? ` · ${fmt(m.inUsd, 2)} / ${fmt(m.outUsd, 2)} $` : ''}</option>`;
    const all = extra.concat(list);
    return `<optgroup label="${I.lang === 'en' ? 'Free' : 'Kostenlos'}">${all.filter(m => m.free).map(opt).join('')}</optgroup><optgroup label="${I.lang === 'en' ? 'Paid' : 'Kostenpflichtig'}">${all.filter(m => !m.free).map(opt).join('')}</optgroup>`;
  }
  function openAiSettings() {
    const L = I.lang === 'en';
    const prov = OR.cfg.provider;
    const blocked = OR.inArtifact();
    modal(t('aiSettings'), `
      <p class="small">${esc(aiStatusText())}</p>
      ${blocked ? `<div class="banner"><span class="small">${icon('info', 14)} ${t('orBlocked')}</span></div>` : ''}
      <label class="f">${t('aiProvider')}<select id="aiProv">
        <option value="auto" ${prov === 'auto' ? 'selected' : ''}>${t('provAuto')}</option>
        <option value="openrouter" ${prov === 'openrouter' ? 'selected' : ''}>OpenRouter</option>
        <option value="claude" ${prov === 'claude' ? 'selected' : ''}>claude.ai</option></select></label>
      <h4>OpenRouter</h4>
      <ol class="small" style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:3px">
        <li>${t('orStep1')} <a href="https://openrouter.ai/keys" target="_blank" rel="noopener">openrouter.ai/keys</a></li>
        <li>${t('orStep2')}</li><li>${t('orStep3')}</li></ol>
      <label class="f">${t('orKey')} ${OR.hasKey ? `<span class="badge hoch">${t('orKeySaved')}: ${esc(maskKey(OR.cfg.key))}</span>` : ''}
        <input type="password" id="orKey" autocomplete="off" spellcheck="false" placeholder="sk-or-v1-…"></label>
      <div class="grid g2">
        <label class="f">${t('orModelStrong')}<select id="orStrong">${modelOptions(OR.cfg.strong)}</select></label>
        <label class="f">${t('orModelFast')}<select id="orFast">${modelOptions(OR.cfg.fast)}</select></label>
      </div>
      <div class="row"><button class="btn small" data-act="orFree">${t('orUseFree')}</button><button class="btn small ghost" data-act="orPaid">${t('orUsePaid')}</button></div>
      <p class="xs muted">${t('orFreeNote')}</p>
      <p class="xs muted">${L ? 'Prices in US$ per 1 million tokens (input / output).' : 'Preise in US$ je 1 Million Tokens (Eingabe / Ausgabe).'} ${App.orModels ? '' : (L ? 'Loading model list …' : 'Modellliste wird geladen …')}</p>
      <p class="xs muted">${t('orPrivacy')}</p>
      <div id="orStatus" class="small" role="status"></div>
      <div class="row end">${OR.hasKey ? `<button class="btn ghost" data-act="orRemove">${t('orRemove')}</button>` : ''}<button class="btn" data-act="orTest">${t('orTest')}</button><button class="btn primary" data-act="orSave">${t('orSave')}</button></div>`);
    if (!App.orModels && !App.orModelsLoading) {
      App.orModelsLoading = true;
      OR.visionModels().then(list => { App.orModels = list; App.orModelsLoading = false; if ($('#modal') && $('#orStrong')) { const k = $('#orKey').value; openAiSettings(); $('#orKey').value = k; } })
        .catch(() => { App.orModelsLoading = false; });
    }
  }
  // Modellauswahl im offenen Fenster setzen (gespeichert wird erst mit „Speichern“)
  function setModelSelects(m) {
    [['#orStrong', m.strong], ['#orFast', m.fast]].forEach(([sel, id]) => {
      const s = $(sel); if (!s) return;
      if (![...s.options].some(o => o.value === id)) { const o = document.createElement('option'); o.value = id; o.textContent = id; s.prepend(o); }
      s.value = id;
    });
    const box = $('#orStatus'); if (box) box.textContent = (I.lang === 'en' ? 'Selected: ' : 'Ausgewählt: ') + m.strong + ' / ' + m.fast + (I.lang === 'en' ? ' – click “Save”.' : ' – bitte „Speichern“ klicken.');
  }
  function orFormValues() {
    return { key: ($('#orKey') && $('#orKey').value.trim()) || '', strong: $('#orStrong') && $('#orStrong').value, fast: $('#orFast') && $('#orFast').value, prov: $('#aiProv') && $('#aiProv').value };
  }

  // ---------- Rendern ----------
  function render() {
    renderHeader(); renderSteps(); renderMain(); renderFooter(); renderChat();
    afterRender();
  }
  function renderHeader() {
    const h = $('header.titleblock');
    const st = cur();
    // Aufbau: Logo links; rechts oben der Titel, darunter in einer Zeile Unterzeile, Projekt und Knöpfe
    h.innerHTML = `
      <div class="brand-mark">${icon('leaf', 30)}</div>
      <div class="hb-main"><h1 class="hb-title">${t('appName')}</h1>
      <div class="hb-row">
      <div class="sub">${t('tagline')}</div>
      <div class="tb-project"><span class="label">${t('project')} · ${t('variant')} ${esc(st.name)}</span><span class="v">${esc(App.meta.project || (st.example ? t('loadExample') : '–'))}</span></div>
      <div class="tb-actions">
        <div class="lang" role="group" aria-label="Sprache / Language"><button data-act="lang" data-v="de" aria-pressed="${I.lang === 'de'}">DE</button><button data-act="lang" data-v="en" aria-pressed="${I.lang === 'en'}">EN</button></div>
        <button class="btn small" data-act="openProject">${icon('file', 14)}${t('openProject')}</button>
        <button class="btn small" data-act="saveProject">${icon('download', 14)}${t('saveProject')}</button>
        <button class="btn primary newproj" data-act="newProject">${icon('plus', 16)}${t('newProject')}</button>
        <input type="file" id="projFile" accept=".json,application/json" hidden>
      </div></div></div>`;
  }
  function hasElements() { return cur().elements.length > 0; }
  function renderSteps() {
    const n = $('nav.steps');
    const can = [true, !!(App.plans.length || App.modelFile || App.progress), true, hasElements(), hasElements(), hasElements()];
    n.innerHTML = [1, 2, 3, 4, 5, 6].map(i => `<button data-act="step" data-v="${i}" ${App.step === i ? 'aria-current="step"' : ''} class="${i < App.step ? 'done' : ''}" ${can[i - 1] ? '' : 'disabled'}><span class="n">${i}</span><span class="t">${t('step' + i)}</span></button>`).join('');
  }
  function renderFooter() {
    // Fußzeile: Hinweis, KI-Status (klickbar → KI-Einstellungen), Glossar und Quellen
    $('#footer').innerHTML = `<div class="row" style="justify-content:space-between"><span>${t('disclaimer')}</span><span class="row"><button class="btn small ghost" data-act="glossary">${t('glossary')}</button><button class="btn small ghost" data-act="sources">${t('assumptions')}</button></span></div>
      <button class="ai-status" data-act="aiSettings" title="${esc(t('aiSettings'))}"><span class="dot" style="background:${aiProvider() ? 'var(--good)' : 'var(--grey)'}"></span>${esc(aiStatusText())}</button>`;
  }
  function renderMain() {
    const m = $('#main');
    m.innerHTML = [null, step1, step2, step3, step4, step5, step6][App.step]();
  }


  // ---------- Mauszeiger: Fußabdruck oder normaler Zeiger (Wahl wird im Browser gemerkt) ----------
  App.plainCursor = (() => { try { return localStorage.getItem('gp_plain_cursor') === '1'; } catch (e) { return false; } })();
  document.documentElement.classList.toggle('plain-cursor', App.plainCursor);
  function cursorTabHtml() {
    const en = I.lang === 'en';
    const label = App.plainCursor ? (en ? 'Footprint cursor' : 'Fußabdruck-Zeiger') : (en ? 'Normal cursor' : 'Normaler Zeiger');
    const ico = App.plainCursor
      ? `<svg width="16" height="16" viewBox="0 0 32 32" aria-hidden="true"><g fill="currentColor"><path d="M15.2 12.4c-3 .4-4.6 2.9-4.3 6 .2 2.1 1.3 3.5 1.2 5.6-.1 3.2.7 6 3.8 6.1 3.2.1 4.6-2.6 4.4-5.9-.1-1.9-.9-3.2-.4-5.1.6-2.3 1.4-3.6.9-5.2-.6-1.8-2.9-1.8-5.6-1.5z"/><ellipse cx="12.5" cy="7.4" rx="2.95" ry="3.35"/><circle cx="17.2" cy="5.7" r="2.25"/><circle cx="20.7" cy="6.8" r="1.95"/><circle cx="23.2" cy="9.1" r="1.65"/><circle cx="24.5" cy="12.1" r="1.4"/></g></svg>`
      : `<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3l14 7.5-6 1.6L10 18z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
    return `<button class="cursor-tab" data-act="cursorToggle" aria-pressed="${App.plainCursor}" aria-label="${label}" title="${label}">${ico}</button>`;
  }

  // Zeiger-Reiter immer 10 px unter den Chat-Reiter setzen (Höhe hängt von der Sprache ab)
  function placeCursorTab() {
    const ct = document.querySelector('.chat-tab'), cu = document.querySelector('.cursor-tab');
    if (!ct || !cu) return;
    const r = ct.getBoundingClientRect();
    if (r.height) { App.cursorTabTop = r.bottom + 10; }
    if (App.cursorTabTop) cu.style.top = App.cursorTabTop + 'px';
  }
  window.addEventListener('resize', () => { App.cursorTabTop = 0; placeCursorTab(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => placeCursorTab());

  // ---------- Projekt-Chat: Reiter am rechten Rand + aufklappbares Fenster (auf jeder Seite) ----------
  function renderChat() {
    let dock = $('#chatDock');
    if (!dock) { dock = document.createElement('div'); dock.id = 'chatDock'; document.body.appendChild(dock); }
    const msgs = App.chat.map(m => `<div class="msg ${m.role === 'user' ? 'user' : ''}">${esc(m.content)}</div>`).join('');
    const quick = `<div class="chat-quick">${['chatQ1', 'chatQ2', 'chatQ3'].map(q => `<button class="btn small" data-act="chatQ" data-q="${q}">${t(q)}</button>`).join('')}</div>`;
    const body = App.sample
      ? `<div class="chat-msgs" id="chatMsgs">${msgs || `<p class="small muted">${I.lang === 'en' ? 'Ask anything about your project – the AI knows the current values.' : 'Frag alles zu deinem Projekt – die KI kennt die aktuellen Werte.'}</p>`}</div>
         ${quick}
         <form class="chatform" data-form="chat"><input type="text" id="chatIn" placeholder="${esc(t('chatPh'))}" aria-label="${t('chatTitle')}" value="${esc(App.chatDraft || '')}" ${App.chatBusy ? 'disabled' : ''}><button class="btn primary" type="submit" ${App.chatBusy ? 'disabled' : ''}>${App.chatBusy ? '<span class="spinner"></span>' : t('send')}</button></form>`
      : `<div class="banner"><span class="small">${t('aiUnavailable')}</span><button class="btn small primary" data-act="aiSettings">${t('aiSetup')}</button></div>`;
    dock.innerHTML = `
      <button class="chat-tab" data-act="chatToggle" aria-expanded="${!!App.chatOpen}" aria-controls="chatPanel" ${App.chatOpen ? 'hidden' : ''}>${icon('chat', 18)}<span>${t('chatTitle')}</span>${App.chat.length ? `<span class="chat-count">${Math.ceil(App.chat.length / 2)}</span>` : ''}</button>
      <aside class="chat-panel" id="chatPanel" role="dialog" aria-label="${esc(t('chatTitle'))}" ${App.chatOpen ? '' : 'hidden'}>
        <div class="chat-head"><h3>${icon('chat')} ${t('chatTitle')}</h3><button class="iconbtn" data-act="chatToggle" aria-label="${t('close')}">${icon('x', 18)}</button></div>
        ${body}
      </aside>
      ${cursorTabHtml()}`;
    const box = $('#chatMsgs'); if (box) box.scrollTop = box.scrollHeight;
    placeCursorTab();
  }

  // ---------- Schritt 1 ----------
  function countryOptions(sel) {
    return Object.entries(D.COUNTRIES).sort((a, b) => nm(a[1]).localeCompare(nm(b[1]), I.lang)).map(([cc, c]) => `<option value="${cc}" ${cc === sel ? 'selected' : ''}>${esc(nm(c))}</option>`).join('');
  }
  function step1() {
    const st = cur();
    const loc = D.LOC[st.loc] || D.LOC.de_ol;
    const bt = D.BT[st.type] || D.BT.wohnen;
    const plans = App.plans.map(p => `<div class="fileitem">${p.thumb ? `<img src="${p.thumb}" alt="">` : `<span class="ph">${p.status === 'busy' ? '<span class="spinner"></span>' : icon('plan')}</span>`}
        <div class="nm" title="${esc(p.name)}">${esc(p.name)}<div class="xs muted">${p.images.length ? p.images.length + (p.images.length > 1 ? ' Seiten/pages' : ' Bild/image') : ''}</div></div>
        <select data-plan="${p.id}" aria-label="${t('planType')}">${['grundriss', 'schnitt', 'ansicht', 'lageplan', 'detail'].map(k => `<option value="${k}" ${p.type === k ? 'selected' : ''}>${t('pt_' + k)}</option>`).join('')}</select>
        <button class="iconbtn" data-act="removePlan" data-id="${p.id}" aria-label="${t('remove')}">${icon('x', 16)}</button></div>`).join('');
    const mf = App.modelFile;
    const ext = mf ? mf.name.split('.').pop().toLowerCase() : '';
    const modelBox = mf ? `<div class="fileitem"><span class="ph">${icon('cube')}</span><div class="nm">${esc(mf.name)}<div class="xs muted">${fmt(mf.size / 1048576, 1)} MB${App.modelInfo ? ' · ' + t('modelDone') : ''}</div></div><span></span><button class="iconbtn" data-act="removeModel" aria-label="${t('remove')}">${icon('x', 16)}</button></div>
      <div class="grid g3">${ext !== 'ifc' ? `<label class="f">${t('unit')}<select data-model="unit">${['m', 'cm', 'mm'].map(u => `<option ${App.modelOpts.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
      <label class="f">${t('upAxis')}<select data-model="upAxis"><option value="y" ${App.modelOpts.upAxis === 'y' ? 'selected' : ''}>Y (glTF, OBJ)</option><option value="z" ${App.modelOpts.upAxis === 'z' ? 'selected' : ''}>Z (Rhino, CAD)</option></select></label>` : ''}
      <label class="f">${t('northDeg')}<input type="number" step="1" data-model="north" value="${esc(App.modelOpts.north)}" placeholder="${ext === 'ifc' ? 'IFC' : '0'}"></label></div>` : '';
    const aiOk = !!App.sample;
    return `
    <section class="section"><div class="section-head"><h2>${t('s1Title')}</h2><span class="muted small">${t('s1Intro')}</span></div>
      <div class="grid g2">
        <div class="card stack"><h3>${icon('plan')} ${t('plansTitle')}</h3><p class="small muted">${t('plansHint')}</p>
          <div class="drop" data-drop="plans" tabindex="0" role="button" aria-label="${t('plansTitle')}">${icon('upload', 26)}<span>${t('dropHere')} <u>${t('choose')}</u></span></div>
          <input type="file" id="planFiles" accept="image/png,image/jpeg,image/webp,application/pdf,.pdf" multiple hidden>
          <div class="filelist">${plans}</div></div>
        <div class="card stack"><h3>${icon('cube')} ${t('modelTitle')}</h3><p class="small muted">${t('modelHint')}</p>
          <div class="drop" data-drop="model" tabindex="0" role="button" aria-label="${t('modelTitle')}">${icon('upload', 26)}<span>${t('dropHere')} <u>${t('choose')}</u></span></div>
          <input type="file" id="modelFile" accept=".ifc,.obj,.gltf,.glb" hidden>
          <div class="filelist">${modelBox}</div></div>
      </div>
    </section>
    <section class="section"><div class="section-head"><h3>${t('projectData')}</h3></div>
      <div class="card stack">
        <div class="grid g3">
          <label class="f">${t('projectName')}<input type="text" data-meta="project" value="${esc(App.meta.project)}"></label>
          <label class="f">${t('author')}<input type="text" data-meta="author" value="${esc(App.meta.author)}"></label>
          <label class="f">${t('school')}<input type="text" data-meta="school" value="${esc(App.meta.school)}"></label>
        </div>
        <div class="grid g3">
          <div class="f"><span class="small muted">${t('mode')}</span><div class="seg" role="group"><button data-act="mode" data-v="new" aria-pressed="${st.mode === 'new'}">${t('modeNew')}</button><button data-act="mode" data-v="existing" aria-pressed="${st.mode === 'existing'}">${t('modeExisting')}</button></div>
            ${st.mode === 'existing' ? `<label class="check" style="margin-top:6px"><input type="checkbox" data-path="retrofit" ${st.retrofit ? 'checked' : ''}>${t('retrofit')}</label>` : ''}</div>
          <label class="f">${t('btype')}<select data-act-change="type">${D.BUILDING_TYPES.map(b => `<option value="${b.id}" ${b.id === st.type ? 'selected' : ''}>${esc(nm(b))}</option>`).join('')}</select></label>
          <label class="f">${t('subtype')}<select data-path="sub">${bt.sub.map(s => `<option value="${s[0]}" ${s[0] === st.sub ? 'selected' : ''}>${esc(I.lang === 'en' ? s[2] : s[1])}</option>`).join('')}</select></label>
        </div>
        <div class="grid g4">
          <label class="f"><span class="flbl">${icon('globe', 14)}${t('country')}</span><select data-act-change="country">${countryOptions(loc.cc)}</select></label>
          <label class="f">${t('region')}<select data-path="loc">${D.LOCATIONS.filter(l => l.cc === loc.cc).map(l => `<option value="${l.id}" ${l.id === st.loc ? 'selected' : ''}>${esc(nm(l))}</option>`).join('')}</select></label>
          <label class="f">${t('year')}<input type="number" data-path="year" value="${esc(st.year || '')}" step="1"></label>
          <label class="f">${t('heating')}<select data-path="tech.heat">${D.HEATING.map(h => `<option value="${h.id}" ${h.id === st.tech.heat ? 'selected' : ''}>${esc(nm(h))}</option>`).join('')}</select></label>
        </div>
        <label class="f">${t('description')}<textarea data-path="meta.desc" placeholder="${esc(t('descPh'))}">${esc((st.meta && st.meta.desc) || '')}</textarea></label>
      </div>
    </section>
    ${!aiOk ? `<div class="banner" style="margin-bottom:12px"><span class="small">${icon('info', 14)} ${t('aiUnavailable')}</span><button class="btn small primary" data-act="aiSettings">${t('aiSetup')}</button></div>` : ''}
    <div class="row end">
      <button class="btn" data-act="skip">${t('skipToForm')}</button>
      ${App.modelFile ? `<button class="btn ${App.plans.length && aiOk ? '' : 'primary'}" data-act="readModel">${icon('cube', 16)} ${t('readModel')}</button>` : ''}
      <button class="btn primary" data-act="analyze" ${App.plans.length && aiOk && !App.plans.some(p => p.status === 'busy') ? '' : 'disabled'}>${icon('plan', 16)} ${t('analyzePlans')}</button>
    </div>`;
  }

  // ---------- Schritt 2 ----------
  function step2() {
    const p = App.progress;
    if (!p) return `<section class="section"><div class="section-head"><h2>${t('s2Title')}</h2></div><div class="empty">${t('noElements')}</div><div class="row end"><button class="btn" data-act="step" data-v="1">${t('back')}</button></div></section>`;
    const lines = p.lines.map(l => `<div class="line">${l.state === 'run' ? '<span class="spinner"></span>' : l.state === 'err' ? `<span class="st-fail">${icon('x', 14)}</span>` : `<span class="st-ok">✓</span>`}<span>${esc(l.text)}</span></div>`).join('');
    const counts = p.counts ? `<div class="row">${Object.entries(p.counts).map(([k, v]) => `<span class="chip">${icon(CH.KIND_ICON[k] || 'cube', 14)}&nbsp;${kindLabel(k)}: ${v}</span>`).join('')}</div>` : '';
    return `<section class="section"><div class="section-head"><h2>${t('s2Title')}</h2>${p.running ? `<button class="btn" data-act="stopAI">${icon('stop', 14)} ${t('stop')}</button>` : ''}</div>
      <div class="card progress">${lines}${p.running && p.chars ? `<div class="xs muted">${t('aiWriting')} ${fmt(p.chars)} Zeichen</div>` : ''}${p.running ? '<div class="bar"><i style="width:35%"></i></div>' : ''}</div>
      ${counts}
      ${p.summary ? `<div class="card stack"><h4>${t('aiSummary')}</h4><p>${esc(p.summary)}</p>${p.uncertainties && p.uncertainties.length ? `<h4>${t('uncertainties')}</h4><ul class="small">${p.uncertainties.map(u => `<li>${esc(u)}</li>`).join('')}</ul>` : ''}</div>` : ''}
      ${p.matNames && p.matNames.length && App.sample ? `<div class="card row" style="justify-content:space-between"><span class="small">${p.matNames.length} Materialnamen ohne Zuordnung: ${esc(p.matNames.slice(0, 6).join(', '))}${p.matNames.length > 6 ? ' …' : ''}</span><button class="btn small" data-act="mapMaterials">${t('mapMaterials')}</button></div>` : ''}
      ${p.error ? `<div class="card" style="border-color:var(--bad)"><p class="st-fail">${esc(p.error)}</p></div>` : ''}
      <div class="row end"><button class="btn" data-act="step" data-v="1">${t('back')}</button>${p.error && !p.running ? `<button class="btn" data-act="analyze">${t('retry')}</button>` : ''}<button class="btn primary" data-act="step" data-v="3" ${p.running ? 'disabled' : ''}>${t('toCheck')}</button></div>
    </section>`;
  }

  // ---------- Schritt 3 ----------
  function conOptions(kind, sel) {
    return D.CONSTRUCTIONS.filter(c => c.kind === kind).map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(nm(c))}</option>`).join('') + `<option value="custom" ${sel === 'custom' ? 'selected' : ''}>${t('customLayers')} …</option>`;
  }
  function layerEditor(e) {
    const L = K.layersOf(e);
    const U = ['AW', 'DA', 'BO'].includes(e.kind) ? K.uValue(e.kind, L) : null;
    const p = K.elementPerM2(e);
    return `<tr class="layers"><td colspan="8"><div class="stack">
      <div class="row" style="justify-content:space-between"><strong class="small">${icon('layers', 14)} ${t('layers')} – ${esc(e.name || kindLabel(e.kind))}</strong><span class="small num">${U != null ? 'U = ' + fmt(U, 2) + ' W/m²K · ' : ''}${fmt(p.a13, 0)} kg CO₂e/m² (A1–A3) · ${t('grade')} ${K.circGrade(p.circ)}</span></div>
      <div class="tablewrap"><table class="layertable"><thead><tr><th>#</th><th>${t('material')}</th><th class="n">${t('thickness')} (cm)</th><th>${t('thermal')}</th><th class="n" style="text-transform:none">λ W/mK</th><th></th></tr></thead><tbody>
      ${L.map((l, i) => { const m = D.MAT[l.mat] || {}; return `<tr><td class="muted">${i + 1}</td><td><select data-layer="${e.id}" data-i="${i}" data-f="mat">${D.MATERIALS.map(mm => `<option value="${mm.id}" ${mm.id === l.mat ? 'selected' : ''}>${esc(nm(mm))}</option>`).join('')}</select></td>
        <td class="n"><input type="number" step="0.5" min="0" data-layer="${e.id}" data-i="${i}" data-f="d" value="${fmt(l.d * 100, 1).replace(',', '.')}"></td><td><input type="checkbox" data-layer="${e.id}" data-i="${i}" data-f="th" ${l.th !== false ? 'checked' : ''} aria-label="${t('thermal')}"></td><td class="n muted">${m.lambda != null ? m.lambda : ''}</td>
        <td><button class="iconbtn" data-act="delLayer" data-id="${e.id}" data-i="${i}" aria-label="${t('delete')}">${icon('x', 14)}</button></td></tr>`; }).join('')}
      </tbody></table></div>
      <div class="row"><button class="btn small" data-act="addLayer" data-id="${e.id}">${icon('plus', 12)} ${t('addLayer')}</button>
        <label class="f" style="flex-direction:row;align-items:center;gap:8px">${t('connection')} <select data-elf="${e.id}" data-f="conn" style="width:auto">${['loesbar', 'teilweise', 'verklebt'].map(c => `<option value="${c}" ${K.connOf(e) === c ? 'selected' : ''}>${t('c_' + c)}</option>`).join('')}</select></label>
        <span class="xs muted">${I.lang === 'en' ? 'Order: outside → inside' : 'Reihenfolge: außen → innen'}</span></div>
    </div></td></tr>`;
  }
  function geoField(key, label, unit, step) {
    const st = cur();
    return `<label class="f">${label}<div class="row" style="flex-wrap:nowrap"><input type="number" step="${step || 1}" data-path="geo.${key}" value="${esc(st.geo[key] != null ? st.geo[key] : '')}"><span class="xs muted" style="white-space:nowrap">${unit}</span></div></label>`;
  }
  function step3() {
    const st = cur();
    const cl = K.calc(st).cl;
    const sel = App.selected && App.selected.elementId;
    const rows = st.elements.map(e => {
      const U = ['AW', 'DA', 'BO'].includes(e.kind) ? K.uValue(e.kind, K.layersOf(e)) : null;
      return `<tr class="${sel === e.id ? 'sel' : ''}" data-row="${e.id}">
        <td><select data-elf="${e.id}" data-f="kind" aria-label="${t('kind')}">${KINDS.map(k => `<option value="${k}" ${k === e.kind ? 'selected' : ''}>${kindLabel(k)}</option>`).join('')}</select></td>
        <td><input type="text" data-elf="${e.id}" data-f="name" value="${esc(e.name || '')}" aria-label="${t('name')}"></td>
        <td>${e.kind === 'AW' ? `<div class="row" style="flex-wrap:nowrap;gap:4px"><input type="number" step="15" data-elf="${e.id}" data-f="az" value="${esc(e.az != null ? Math.round(e.az) : 180)}" style="width:70px" aria-label="Azimut"><span class="chip">${orientLabel(e.az)}</span></div>` : '<span class="muted">–</span>'}</td>
        <td class="n"><input type="number" step="1" min="0" data-elf="${e.id}" data-f="area" value="${esc(Math.round(e.area * 10) / 10)}" aria-label="${t('area')}"></td>
        <td><select data-elf="${e.id}" data-f="con" aria-label="${t('construction')}">${conOptions(e.kind, e.con)}</select></td>
        <td class="n num">${U != null ? fmt(U, 2) : '–'}</td>
        <td><input type="checkbox" data-elf="${e.id}" data-f="existing" ${e.existing ? 'checked' : ''} aria-label="${t('existing')}"></td>
        <td class="row" style="flex-wrap:nowrap;gap:2px"><button class="iconbtn" data-act="toggleLayers" data-id="${e.id}" title="${t('layers')}" aria-label="${t('layers')}">${icon('layers', 16)}</button><button class="iconbtn" data-act="delElement" data-id="${e.id}" aria-label="${t('delete')}">${icon('x', 16)}</button></td></tr>
        ${App.open['L' + e.id] ? layerEditor(e) : ''}`;
    }).join('');
    const wrows = st.windows.map(w => `<tr class="${sel === w.id ? 'sel' : ''}">
        <td><div class="row" style="flex-wrap:nowrap;gap:4px"><input type="number" step="15" data-winf="${w.id}" data-f="az" value="${esc(Math.round(w.az))}" style="width:70px" aria-label="Azimut"><span class="chip">${orientLabel(w.az)}</span></div></td>
        <td class="n"><input type="number" step="0.5" min="0" data-winf="${w.id}" data-f="area" value="${esc(Math.round(w.area * 10) / 10)}" aria-label="${t('area')}"></td>
        <td><select data-winf="${w.id}" data-f="type" aria-label="${t('windowType')}">${D.WINDOWS.map(x => `<option value="${x.id}" ${x.id === w.type ? 'selected' : ''}>${esc(nm(x))} · Uw ${x.uw}</option>`).join('')}</select></td>
        <td><select data-winf="${w.id}" data-f="shade" aria-label="${t('shading')}">${['none', 'internal', 'external'].map(s => `<option value="${s}" ${s === w.shade ? 'selected' : ''}>${t('sh_' + s)}</option>`).join('')}</select></td>
        <td><input type="checkbox" data-winf="${w.id}" data-f="existing" ${w.existing ? 'checked' : ''} aria-label="${t('existing')}"></td>
        <td><button class="iconbtn" data-act="delWindow" data-id="${w.id}" aria-label="${t('delete')}">${icon('x', 16)}</button></td></tr>`).join('');
    const tch = st.tech;
    const viewer = VW.hasModel ? `<div class="viewer"><div class="canvas" id="viewer3d"></div><div class="vtools"><span></span>${viewButtons()}</div><span class="hint">${t('clickHint')}</span></div>` : '';
    return `<section class="section"><div class="section-head"><h2>${t('s3Title')}</h2><span class="muted small">${t('s3Intro')}</span></div>
      ${viewer}
      <div class="card stack"><h3>${t('geometry')} ${help(GL.area)}</h3>
        <div class="grid g3">${geoField('bgf', t('bgf'), 'm²')}${geoField('nrf', t('nrf'), 'm²')}${geoField('footprint', t('footprint'), 'm²')}${geoField('floors', t('floors'), '', 1)}${geoField('hStorey', t('hStorey'), 'm', 0.1)}${geoField('volume', t('volume'), 'm³')}</div>
        <div class="row"><button class="btn small" data-act="autoGeo">${t('autoFill')}</button><span class="xs muted">A/V = ${fmt(K.calc(st).av, 2)} 1/m ${help(GL.av)}</span></div></div>
      <div class="stack"><div class="row" style="justify-content:space-between"><h3>${t('elements')} ${help(GL.u)}</h3><div class="row">
        <button class="btn small" data-act="estimateElements">${I.lang === 'en' ? 'Estimate from geometry' : 'Aus Geometrie schätzen'}</button>
        <select id="addKind" style="width:auto" aria-label="${t('kind')}">${KINDS.map(k => `<option value="${k}">${kindLabel(k)}</option>`).join('')}</select><button class="btn small" data-act="addElement">${icon('plus', 12)} ${t('addElement')}</button></div></div>
        ${st.elements.length ? `<div class="tablewrap"><table><thead><tr><th>${t('kind')}</th><th>${t('name')}</th><th>${t('orientation')}</th><th class="n">${t('area')} m²</th><th>${t('construction')}</th><th class="n">U</th><th>${t('existing')}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="empty">${t('noElements')}</div>`}
      </div>
      <div class="stack"><div class="row" style="justify-content:space-between"><h3>${icon('window')} ${t('windows')}</h3><button class="btn small" data-act="addWindow">${icon('plus', 12)} ${t('addWindow')}</button></div>
        ${st.windows.length ? `<div class="tablewrap"><table><thead><tr><th>${t('orientation')} (°)</th><th class="n">${t('area')} m²</th><th>${t('windowType')}</th><th>${t('shading')}</th><th>${t('existing')}</th><th></th></tr></thead><tbody>${wrows}</tbody></table></div>` : `<div class="empty">–</div>`}
      </div>
      <div class="grid g2">
        <div class="card stack"><h3>${icon('pump')} ${t('technics')}</h3>
          <div class="grid g2">
            <label class="f">${t('heating')}<select data-path="tech.heat">${D.HEATING.map(h => `<option value="${h.id}" ${h.id === tch.heat ? 'selected' : ''}>${esc(nm(h))}</option>`).join('')}</select></label>
            <label class="f">${t('cooling')}<select data-path="tech.cool">${['auto', 'none', 'split'].map(c => `<option value="${c}" ${c === tch.cool ? 'selected' : ''}>${t('cool_' + c)}</option>`).join('')}</select></label>
            <label class="f">${t('ventilation')}<select data-path="tech.vent">${['window', 'exhaust', 'mvhr'].map(v => `<option value="${v}" ${v === tch.vent ? 'selected' : ''}>${t('vent_' + v)}</option>`).join('')}</select></label>
            <label class="f">${t('pv')}<input type="number" step="0.5" min="0" data-path="tech.pv" value="${esc(tch.pv || 0)}"></label>
            <label class="f"><span class="flbl">${t('thermalBridges')} ${help(GL.wb)}</span><input type="number" step="0.01" min="0" data-path="tech.wb" value="${esc(tch.wb)}"></label>
            <label class="f">${t('airChange')}<input type="number" step="0.05" min="0" data-path="tech.n" value="${esc(tch.n)}"></label>
          </div>
          <div class="row"><label class="check"><input type="checkbox" data-path="tech.night" ${tch.night ? 'checked' : ''}>${t('nightVent')}</label><label class="check"><input type="checkbox" data-path="tech.st" ${tch.st ? 'checked' : ''}>${t('solarThermal')}</label><label class="check"><input type="checkbox" data-path="tech.rain" ${tch.rain ? 'checked' : ''}>${t('rainwater')}</label></div>
        </div>
        <div class="card stack"><h3>${icon('sun')} ${t('climate')}</h3>
          <p class="small muted">${esc(nm(cl.loc))}, ${esc(nm(cl.country))} · ${t('gridCo2')} ${fmt(cl.country.co2, 2)} kg/kWh</p>
          <div class="grid g3">
            <label class="f"><span class="flbl">${t('hdd')} ${help(GL.hdd)}</span><input type="number" data-path="clim.hdd" value="${esc((st.clim || {}).hdd != null ? st.clim.hdd : '')}" placeholder="${cl.loc.hdd}"></label>
            <label class="f"><span class="flbl">${t('cdd')} ${help(GL.cdd)}</span><input type="number" data-path="clim.cdd" value="${esc((st.clim || {}).cdd != null ? st.clim.cdd : '')}" placeholder="${cl.loc.cdd}"></label>
            <label class="f">${t('gh')}<input type="number" data-path="clim.gh" value="${esc((st.clim || {}).gh != null ? st.clim.gh : '')}" placeholder="${cl.loc.gh}"></label>
          </div>
          <h4>${icon('euro', 14)} ${t('energyPrices')}</h4>
          <div class="grid g2">
            <label class="f">${t('priceEl')}<input type="number" step="0.01" data-path="prices.el" value="${esc((st.prices || {}).el != null ? st.prices.el : '')}" placeholder="${cl.country.pel}"></label>
            <label class="f">${t('priceGas')}<input type="number" step="0.01" data-path="prices.gas" value="${esc((st.prices || {}).gas != null ? st.prices.gas : '')}" placeholder="${cl.country.pgas}"></label>
          </div>
        </div>
      </div>
      <div class="row end"><button class="btn" data-act="step" data-v="1">${t('back')}</button><button class="btn primary" data-act="step" data-v="4" ${st.elements.length ? '' : 'disabled'}>${t('toResult')}</button></div>
    </section>`;
  }
  function viewButtons() {
    return `<div class="seg" role="group" aria-label="Ansicht">${['N', 'E', 'S', 'W'].map(d => `<button data-act="view" data-v="${d}">${t('or_' + d).slice(0, 1)}</button>`).join('')}<button data-act="view" data-v="top">⌂</button><button data-act="view" data-v="fit">⤢</button></div>`;
  }

  // ---------- Berechnungs-Kontext ----------
  function compute(st) {
    const res = K.calc(st);
    const ms = K.evaluateMeasures(st, res);
    const valid = (st.measures || []).filter(id => ms.some(m => m.id === id));
    const optSt = K.applyMeasures(st, valid);
    const opt = K.calc(optSt);
    const demo = K.demolitionCompare(st, res);
    const totalCost = ms.filter(m => valid.includes(m.id)).reduce((a, m) => a + (m.cost || 0), 0);
    return { st, res, ms, sel: valid, optSt, opt, demo, totalCost };
  }
  function chartFns(c) {
    const r = c.res;
    const k = 0.024 * r.cl.hdd;
    return {
      losses: C => CH.hbars([
        { label: kindLabel('AW'), value: r.htParts.AW * k, color: C.s[3] }, { label: kindLabel('DA'), value: r.htParts.DA * k, color: C.s[3] },
        { label: kindLabel('BO'), value: r.htParts.BO * k, color: C.s[3] }, { label: t('windows'), value: r.htParts.FE * k, color: C.s[3] },
        { label: t('thermalBridge'), value: r.htParts.WB * k, color: C.s[4] }, { label: t('ventilationLoss'), value: r.lossV, color: C.s[4] },
        { label: t('solarGains'), value: r.Qs, color: C.s[1], note: t('usableGains') + ' ' + fmt(r.eta * 100, 0) + ' %' }, { label: t('internalGains'), value: r.Qi, color: C.s[1] },
        { label: t('heatDemand'), value: r.Qh, color: C.accent },
      ], { unit: 'kWh/a', C }),
      endUse: (C, w) => CH.hbars([
        { label: t('heatUse'), value: r.eHeat, color: C.s[0] }, { label: t('dhwUse'), value: r.eWw, color: C.s[1] }, { label: t('coolUse'), value: r.eCool, color: C.s[5] },
        { label: t('auxUse'), value: r.eAux, color: C.s[4] }, { label: t('pvSelf'), value: r.pvSelf, color: C.s[3], note: '−' },
      ], { unit: 'kWh/a', C, w: w || 640, labelW: w ? 160 : 190 }),
      phases: C => {
        const row = (label, x) => ({ label, parts: [
          { name: t('phaseA'), v: x.a13 / 1000, color: C.s[0] }, { name: t('phaseB4'), v: x.b4 / 1000, color: C.s[2] },
          { name: t('phaseB6'), v: x.b6 / 1000, color: C.s[3] }, { name: t('phaseC'), v: x.c34 / 1000, color: C.s[4] }] });
        const rows = [row(c.sel.length ? t('before') : (I.lang === 'en' ? 'Building' : 'Gebäude'), r)];
        if (c.sel.length) rows.push(row(t('after'), c.opt));
        return CH.stacked(rows, { unit: 't CO₂e', C, dec: 0 });
      },
      byElement: (C, w) => {
        const e = r.embByKind;
        const items = [['AW', e.AW], ['DA', e.DA], ['BO', e.BO], ['DE', e.DE], ['IW', e.IW], ['FE', e.FE]].map(([k2, v], i) => ({ label: kindLabel(k2), value: v / 1000, color: C.s[i % 3] }));
        items.push({ label: t('tga'), value: e.TGA / 1000, color: C.s[4] });
        if (e.PV) items.push({ label: t('pvSystem'), value: e.PV / 1000, color: C.s[5] });
        if (r.exA13 > 0) items.push({ label: I.lang === 'en' ? 'Existing (bound)' : 'Bestand (gebunden)', value: r.exA13 / 1000, color: C.grey, hatch: true });
        return CH.hbars(items, { unit: 't CO₂e', C, dec: 1, w: w || 640, labelW: w ? 150 : 190 });
      },
    };
  }

  // ---------- Schritt 4 ----------
  function statusPill(s, label) { return `<span class="pill st-${s}">${s === 'ok' ? '✓' : s === 'near' ? '≈' : '✗'} ${esc(label || t('st_' + s))}</span>`; }
  function step4() {
    const c = compute(cur());
    App.lastCtx = c;
    const r = c.res, o = c.opt, st = c.st;
    const cf = chartFns(c);
    const S = CH.SCREEN;
    const tg = r.targets;
    const kp = (label, v, u, extra, h) => `<div class="kpi"><span class="label">${label} ${h != null ? help(h) : ''}</span><span class="v">${v}</span><span class="u">${u}${extra ? ' · ' + extra : ''}</span></div>`;
    const L = I.lang === 'en';
    const targetsHtml = [
      ['t_passivhaus', tg.passivhaus.value, tg.passivhaus.limit, null, 'kWh/m²a', tg.passivhaus.status],
      ['t_nzeb', tg.nzeb.value, tg.nzeb.limit, null, 'kWh/m²a PEnrt', tg.nzeb.status],
      ['t_ribaOp', tg.ribaOp.value, tg.ribaOp.limit, tg.ribaOp.limit2025, 'kWh/m²a', tg.ribaOp.status],
      ['t_ribaEmb', tg.ribaEmb.value, tg.ribaEmb.limit, tg.ribaEmb.limit2025, 'kg CO₂e/m²', tg.ribaEmb.status],
    ].map(([k2, v, lim, lim2, u, s]) => `<div class="target-row"><div><strong class="text-sm">${t(k2)}</strong>
      ${CH.targetBar(v, lim, { limit2: lim2, status: s })}
      <span class="xs muted num">${fmt(v, 0)} ${u} · ${L ? 'target' : 'Ziel'} ${fmt(lim, 0)}${lim2 ? ' (2030) · ' + fmt(lim2, 0) + ' (2025)' : ''}</span></div>${statusPill(s)}</div>`).join('')
      + `<div class="target-row"><div><strong class="text-sm">${t('t_levels')}</strong>
      <div class="flex gap-1 my-2">${D.TARGETS.levels.map((b, i) => `<span style="flex:1;height:10px;border-radius:999px;background:${['var(--good)', 'var(--c2)', 'var(--warn)', 'var(--bad)'][i]};opacity:${b.key === tg.levels.band ? 1 : 0.3}"></span>`).join('')}</div>
      <span class="xs muted num">${fmt(tg.levels.value, 1)} kg CO₂e/(m²·a) · &lt;15 / 15–25 / 25–40 / &gt;40</span></div>${statusPill(tg.levels.status, t('lv_' + tg.levels.band))}</div>`;
    // Bento-Raster: 12 Spalten (Desktop), 6 (Tablet), 1 (Handy)
    const span = n => `col-span-1 ${n >= 6 ? 'md:col-span-6' : 'md:col-span-3'} lg:col-span-${n}`;
    const tile = (n, cls, inner) => `<div class="bento ${cls || ''} ${span(n)}">${inner}</div>`;
    const kpiTile = (label, v, unit, cls, h) => `<div class="bento ${cls || ''}"><span class="eyebrow">${label} ${h != null ? help(h) : ''}</span><span class="big">${v}</span><span class="muted text-sm">${unit}</span></div>`;
    const darkCls = ['C', 'D', 'E'].includes(r.cls.c);
    const massTxt = { light: L ? 'light' : 'leicht', medium: L ? 'medium' : 'mittel', heavy: L ? 'heavy' : 'schwer' }[r.massClass];

    const viewer = VW.hasModel ? modelPanel(c) : '';
    const exA = r.exA13 > 0 || st.mode === 'existing';

    return `<section class="section"><div class="section-head"><h2>${t('s4Title')}</h2>
      <div class="row"><button class="btn small" data-act="exportPdf" ${App.busy ? 'disabled' : ''}>${icon('download', 14)} ${App.busy === 'pdf' ? t('generating') : t('exportPdf')}</button><button class="btn small" data-act="exportXlsx" ${App.busy ? 'disabled' : ''}>${icon('download', 14)} ${App.busy === 'xlsx' ? t('generating') : t('exportXlsx')}</button>${VW.hasModel ? `<button class="btn small" data-act="exportGuid" ${App.busy ? 'disabled' : ''}>${icon('download', 14)} ${t('exportGuid')}</button>` : ''}<button class="btn small primary" data-act="newVariant" ${App.variants.length >= 3 ? 'disabled' : ''}>${icon('variants', 14)} ${t('newVariant')}</button></div></div></section>
    <div class="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-4 grid-flow-dense">
      <div class="bento hero col-span-1 md:col-span-6 lg:col-span-5"><div class="hero-ring"></div>
        <div class="flex items-start justify-between gap-3"><span class="eyebrow">${t('endEnergy')} ${help(GL.end)}</span><span class="eyebrow">${esc(nm(r.cl.loc))}</span></div>
        <div class="flex items-end justify-between gap-4 flex-wrap">
          <div><div class="hero-num">${fmt(r.endSpec, 0)}</div><div class="text-lg font-bold" style="opacity:.9">kWh/m²a · NRF</div></div>
          <div class="text-center"><div class="hero-cls" style="background:${r.cls.col};color:${darkCls ? '#1b2420' : '#fff'}">${r.cls.c}</div><div class="eyebrow mt-2">${t('effClass')}</div></div>
        </div>
        <div class="hero-scale" style="margin-top:auto">${D.CLASSES.map(k => `<span class="${k.c === r.cls.c ? 'on' : ''}" style="background:${k.col}" title="${k.c}"></span>`).join('')}</div>
        <div class="grid grid-cols-3 gap-3">
          <div><div class="eyebrow">${t('heatDemand')}</div><div class="text-xl font-extrabold num">${fmt(r.qhSpec, 0)}</div></div>
          <div><div class="eyebrow">PEnrt</div><div class="text-xl font-extrabold num">${fmt(r.peSpec, 0)}</div></div>
          <div><div class="eyebrow">${c.sel.length ? t('after') : t('coolDemand')}</div><div class="text-xl font-extrabold num">${c.sel.length ? fmt(o.endSpec, 0) + ' · ' + o.cls.c : fmt(r.Qc / r.nrf, 0)}</div></div>
        </div>
      </div>
      <div class="col-span-1 md:col-span-6 lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-4">
        ${kpiTile(t('co2Total'), fmt(r.lifeTotal / 1000, 0), 't CO₂e · 50 a', 'sage', GL.co2e)}
        ${kpiTile(t('co2PerBgf'), fmt(r.embPerBgf, 0), 'kg CO₂e/m² BGF · ' + (L ? 'embodied' : 'grau'), 'moss', GL.grey)}
        ${kpiTile(t('co2PerNrfA'), fmt(r.lifeSpec, 1), 'kg CO₂e/(m²·a)', 'mint')}
        ${kpiTile(L ? 'Energy cost' : 'Energiekosten', fmt(r.costOp, 0), '€ / ' + (L ? 'year' : 'Jahr'), 'ochre')}
        <div class="bento fern"><span class="eyebrow">${t('circularity')} ${help(GL.circ)}</span><span class="big"><span class="grade ${r.circGrade}" style="width:52px;height:52px;font-size:1.9rem;border-radius:16px">${r.circGrade}</span></span><span class="muted text-sm">${fmt(r.circScore, 0)} / 100</span></div>
        ${kpiTile(t('storedCarbon'), fmt(r.bio / 1000, 0), 't CO₂ · ' + (L ? 'not offset' : 'nicht verrechnet'), 'sage', GL.bio)}
      </div>
      ${tile(7, '', `<span class="eyebrow">${t('effClass')}</span>${CH.classScale(r.endSpec)}<p class="xs muted">${t('classNote')}</p>`)}
      ${tile(5, 'mint lg:row-span-2', `<h3>${icon('target')} ${t('targetsTitle')}</h3><div>${targetsHtml}</div><p class="xs muted">${tg.nzeb.fossil ? t('fossilNote') + ' ' : ''}${t('ribaNote')} ${t('levelsNote')}</p>`)}
      ${viewer}
      ${tile(7, '', `<h3>${icon('heat')} ${t('energyBalance')} ${help(GL.heat)}</h3><span class="muted text-sm">${t('lossesTitle')}</span>${cf.losses(S)}
        <details><summary>${t('calcWay')}</summary><div class="body"><div class="formula">${esc(calcWayEnergy(r))}</div></div></details>`)}
      ${tile(5, 'sage', `<h3>${t('endByUse')}</h3>${cf.endUse(S, 440)}<p class="xs muted">${esc(nm(r.heat))}${r.jaz ? ' · JAZ ' + fmt(r.jaz, 1) : ''} · ${t('ventilation')}: ${t('vent_' + r.tech.vent)} ${r.jaz ? help(GL.jaz) : ''}</p>
        <div class="grid grid-cols-3 gap-2 text-sm"><div><div class="eyebrow">${t('heatDemand')}</div><b class="num">${fmt(r.qhSpec, 0)}</b></div><div><div class="eyebrow">${t('coolDemand')}</div><b class="num">${fmt(r.Qc / r.nrf, 0)}</b></div><div><div class="eyebrow">${t('dhw')}</div><b class="num">${fmt(r.Qww / r.nrf, 0)}</b></div></div><span class="xs muted">kWh/m²a</span>`)}
      ${tile(7, '', `<h3>${icon('leaf')} ${t('lcaTitle')} ${help(GL.phases)}</h3><span class="muted text-sm">${t('byPhase')}</span>${cf.phases(S)}
        <details><summary>${t('calcWay')}</summary><div class="body"><div class="formula">${esc(calcWayLca(r))}</div></div></details>`)}
      ${tile(5, 'moss', `<h3>${t('byElement')}</h3>${cf.byElement(S, 440)}`)}
      ${exA && c.demo ? tile(12, 'ochre', `<h3>${t('existingTitle')}</h3><div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        <div><div class="eyebrow">${t('boundCo2')}</div><div class="big">${fmt(r.exA13 / 1000, 0)} t</div></div>
        <div class="md:col-span-2">${CH.hbars([{ label: t('keepVariant'), value: c.demo.keep / 1000, color: S.good }, { label: t('newVariant'), value: c.demo.newBuild / 1000, color: S.bad }], { unit: 't CO₂e · 50 a', dec: 0, labelW: 230 })}
        <p class="text-sm">${c.demo.saving >= 0 ? t('keepSaves') : t('keepCosts')} <strong class="num">${fmt(Math.abs(c.demo.saving) / 1000, 0)} t CO₂e</strong>.</p></div></div>`) : ''}
      ${tile(7, '', `<h3>${icon('recycle')} ${t('circTitle')}</h3><div class="tablewrap"><table><thead><tr><th>${t('kind')}</th><th class="n">${t('area')} m²</th><th class="n">kg/m²</th><th>${t('grade')}</th></tr></thead><tbody>
        ${r.els.map(e => `<tr><td>${kindLabel(e.kind)}${e.key ? ' ' + t('or_' + e.key) : ''}<div class="xs muted">${esc(e.src.name || conLabel(e.src))}</div></td><td class="n">${fmt(e.area, 0)}</td><td class="n">${fmt(e.co2m2, 0)}${e.existing ? '<span class="xs muted"> (B)</span>' : ''}</td><td><span class="grade ${e.circGrade}">${e.circGrade}</span></td></tr>`).join('')}</tbody></table></div>`)}
      ${tile(6, 'fern', `<h3>${icon('sun')} ${t('summerTitle')}</h3>
        <div class="flex justify-between items-center gap-2"><span class="text-sm">${t('summerRisk')}</span>${statusPill({ low: 'ok', medium: 'near', high: 'fail' }[r.summerRisk], t('risk_' + r.summerRisk))}</div>
        <div class="flex justify-between items-center gap-2"><span class="text-sm">${icon('light', 14)} ${t('daylight')}</span>${statusPill(r.daylight === 'ok' ? 'ok' : 'near', t('dl_' + r.daylight))}</div>
        <div><div class="eyebrow">${t('wfr')}</div><div class="big">${fmt(r.wfr * 100, 0)} %</div></div>
        <p class="xs muted">${L ? 'Thermal mass' : 'Speichermasse'}: ${massTxt} · ${t('cdd')}: ${fmt(r.cl.cdd)} · ${r.coolActive ? t('cool_split') : t('cool_none')}</p>`)}
      ${tile(6, 'ochre', `<h3>${icon('plant')} ${t('solarGreenTitle')}</h3>
        <div><div class="eyebrow">${t('pvYield')}</div><div class="text-xl font-extrabold num">${r.kwp ? fmt(r.pvYield, 0) + ' kWh/a' : t('noPv')}</div>${r.kwp ? `<span class="xs muted">${fmt(r.kwp, 1)} kWp · ${t('pvSelfUse')} ${fmt(r.pvSelf, 0)}</span>` : ''}</div>
        <div><div class="eyebrow">${icon('drop', 12)} ${t('runoff')}</div><div class="text-xl font-extrabold num">${fmt(r.runoff, 0)} m³/a</div>${r.greenRoof ? `<span class="xs muted">${t('greenRoof')}</span>` : ''}</div>
        <div><div class="eyebrow">${t('rainPotential')}</div><div class="text-xl font-extrabold num">${fmt(r.rainPotential, 0)} m³/a ${r.tech.rain ? '✓' : ''}</div></div>`)}
    </div>
    <div class="row end" style="margin-top:20px"><button class="btn" data-act="step" data-v="3">${t('back')}</button><button class="btn primary" data-act="step" data-v="5">${icon('target', 16)} ${t('step5')}</button></div>`;
  }

  // ---------- Schritt 5: Optimierungsvorschläge + Vorher/Nachher ----------
  function step5() {
    const c = compute(cur());
    App.lastCtx = c;
    const r = c.res, o = c.opt, st = c.st;
    const S = CH.SCREEN;
    const L = I.lang === 'en';
    const sortEff = { low: 0, med: 1, high: 2, design: 3 };
    const ms = c.ms.slice().sort(App.sort === 'impact' ? (a, b) => b.dLife - a.dLife : (a, b) => sortEff[a.effort] - sortEff[b.effort] || b.dLife - a.dLife);
    const ai = App.ai[st.id] || {};
    const mcard = m => {
      const on = c.sel.includes(m.id);
      const T = I.MEASURE_TEXT[m.id][I.lang];
      return `<div class="mcard g-${m.group} ${on ? 'on' : ''}"><input type="checkbox" data-measure="${m.id}" ${on ? 'checked' : ''} aria-label="${esc(T[0])}" style="margin-top:3px">
        <div><div class="row" style="justify-content:space-between"><h4>${esc(T[0])}</h4><span class="row" style="gap:6px"><span class="chip">${t('effort')}: ${t('ef_' + m.effort)}</span>${VW.hasModel && m.affected.length ? `<button class="btn small ghost" data-act="showOnModel" data-id="${m.id}">${icon('cube', 12)} ${t('showOnModel')}</button>` : ''}</span></div>
        <p class="small muted">${esc(T[1])}</p>
        ${ai.texts && ai.texts[m.id] ? `<p class="aitext">${esc(ai.texts[m.id])}</p>` : ''}
        <div class="mfig small">
          <div><span class="xs muted">${t('saving')} · ${t('endEnergy')}</span><span class="v">${fmt(m.dEnd, 0)} kWh/a</span></div>
          <div><span class="xs muted">CO₂ · 50 a</span><span class="v">${fmt(m.dLife / 1000, 1)} t</span></div>
          <div><span class="xs muted">${t('cost')}</span><span class="v">${m.cost == null ? t('designCost') : fmt(m.cost, 0) + ' €'}</span></div>
          <div><span class="xs muted">${t('payback')} ${help(GL.payback)}</span><span class="v">${m.payback != null ? fmt(m.payback, 0) + ' ' + t('years') : t('noPayback')}</span></div>
          <div><span class="xs muted">${t('eurPerT')}</span><span class="v">${m.eurPerT != null ? fmt(m.eurPerT, 0) + ' €' : '–'}</span></div>
          ${m.extra.rain ? `<div><span class="xs muted">${t('rainPotential')}</span><span class="v">${fmt(m.extra.rain, 0)} m³/a</span></div>` : ''}
          ${m.extra.runoff > 1 ? `<div><span class="xs muted">${t('runoff')}</span><span class="v">−${fmt(m.extra.runoff, 0)} m³/a</span></div>` : ''}
          ${m.extra.qc > 50 ? `<div><span class="xs muted">${t('coolDemand')}</span><span class="v">−${fmt(m.extra.qc, 0)} kWh/a</span></div>` : ''}
          ${Math.abs(m.extra.circ) >= 1 ? `<div><span class="xs muted">${t('circularity')}</span><span class="v">${m.extra.circ > 0 ? '+' : ''}${fmt(m.extra.circ, 0)} P.</span></div>` : ''}
        </div>
        ${m.warn.map(w => `<div class="warn">${icon('info', 12)} ${t('warn_' + w)}</div>`).join('')}</div></div>`;
    };
    const groups = App.sort === 'impact'
      ? K.GROUP_ORDER.map(g => { const list = ms.filter(m => m.group === g); return list.length ? `<div class="mgroup"><div class="label">${t('g_' + g)}</div>${list.map(mcard).join('')}</div>` : ''; }).join('')
      : `<div class="mgroup">${ms.map(mcard).join('')}</div>`;

    const span = n => `col-span-1 ${n >= 6 ? 'md:col-span-6' : 'md:col-span-3'} lg:col-span-${n}`;
    const tile = (n, cls, inner) => `<div class="bento ${cls || ''} ${span(n)}">${inner}</div>`;
    const darkCls = ['C', 'D', 'E'].includes(r.cls.c);
    return `<section class="section"><div class="section-head"><h2>${t('s5mTitle')}</h2></div></section>
    <div class="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-4 grid-flow-dense">
      ${tile(4, 'soft', `<h3>${t('beforeAfter')}</h3>
        <div class="flex items-center gap-4 flex-wrap"><div class="hero-cls" style="font-size:2.2rem;background:${r.cls.col};color:${darkCls ? '#1b2420' : '#fff'}">${r.cls.c}</div><span class="big">→</span><div class="hero-cls" style="font-size:2.2rem;background:${o.cls.col};color:${['C', 'D', 'E'].includes(o.cls.c) ? '#1b2420' : '#fff'}">${o.cls.c}</div></div>
        <div class="grid grid-cols-2 gap-3"><div><div class="eyebrow">${t('selectedMeasures')}</div><div class="big">${c.sel.length}</div></div><div><div class="eyebrow">${t('totalCost')}</div><div class="big">${fmt(c.totalCost / 1000, 0)}k €</div></div></div>
        <p class="xs muted">${fmt(r.lifeSpec, 1)} → ${fmt(o.lifeSpec, 1)} kg CO₂e/(m²·a)</p>`)}
      ${tile(8, 'mint', `<h3>${L ? 'Impact of the measures' : 'Wirkung der Maßnahmen'}</h3><span class="muted text-sm">${c.sel.length} ${t('selectedMeasures')} · ${t('totalCost')} ${fmt(c.totalCost, 0)} €</span>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="card">${CH.grouped([t('endEnergy')], [{ name: t('before'), values: [r.endSpec], color: S.grey }, { name: t('after'), values: [o.endSpec], color: S.accent }], { unit: 'kWh/m²a', h: 200, w: 300 })}<p class="xs muted">${t('effClass')}: ${r.cls.c} → ${o.cls.c}</p></div>
          <div class="card">${CH.grouped(['CO₂ ' + (L ? 'operation' : 'Betrieb')], [{ name: t('before'), values: [r.co2Op / 1000], color: S.grey }, { name: t('after'), values: [o.co2Op / 1000], color: S.accent }], { unit: 't CO₂e/a', dec: 1, h: 200, w: 300 })}</div>
          <div class="card">${CH.grouped([t('co2Total')], [{ name: t('before'), values: [r.lifeTotal / 1000], color: S.grey }, { name: t('after'), values: [o.lifeTotal / 1000], color: S.accent }], { unit: 't CO₂e', h: 200, w: 300 })}<p class="xs muted">${fmt(r.lifeSpec, 1)} → ${fmt(o.lifeSpec, 1)} kg CO₂e/(m²·a)</p></div>
        </div>`)}
      ${tile(12, '', `<div class="flex justify-between items-center gap-3 flex-wrap"><h3>${icon('target')} ${t('measuresTitle')}</h3>
        <div class="row"><div class="seg"><button data-act="sort" data-v="impact" aria-pressed="${App.sort === 'impact'}">${t('sortImpact')}</button><button data-act="sort" data-v="effort" aria-pressed="${App.sort === 'effort'}">${t('sortEffort')}</button></div>
        ${App.sample ? `<button class="btn small" data-act="aiExplain" ${App.busy === 'explain' ? 'disabled' : ''}>${App.busy === 'explain' ? '<span class="spinner"></span> ' + t('aiExplaining') : icon('chat', 14) + ' ' + t('aiExplain')}</button>` : ''}</div></div>
        <p class="text-sm muted">${t('measuresIntro')}</p>
        ${ai.fazit ? `<div class="card accent"><p>${esc(ai.fazit)}</p></div>` : ''}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">${ms.length ? groups : `<div class="empty">–</div>`}</div>
        ${ai.extra && ai.extra.length ? `<div class="card accent stack"><h4>${t('aiExtra')}</h4>${ai.extra.map(x => `<div><strong class="small">${esc(x.titel || '')}</strong><p class="small">${esc(x.text || '')}</p></div>`).join('')}</div>` : ''}`)}
    </div>
    <div class="row end" style="margin-top:20px"><button class="btn" data-act="step" data-v="4">${t('back')}</button><button class="btn primary" data-act="step" data-v="6">${t('step6')}</button></div>`;
  }

  function calcWayEnergy(r) {
    const L = I.lang === 'en';
    return [
      `HT = Σ(U·A·Fx) + ΔU_WB·A = ${fmt(r.htParts.AW, 0)} (AW) + ${fmt(r.htParts.DA, 0)} (DA) + ${fmt(r.htParts.BO, 0)} (BO, Fx 0,6) + ${fmt(r.htParts.FE, 0)} (FE) + ${fmt(r.htParts.WB, 0)} (WB) = ${fmt(r.HT, 0)} W/K`,
      `HV = 0,34 · n · V = 0,34 · ${fmt(r.nEff, 2)} · ${fmt(0.8 * r.vol, 0)} m³ = ${fmt(r.HV, 0)} W/K`,
      `${L ? 'Losses' : 'Verluste'} = 0,024 · ${fmt(r.cl.hdd)} Kd · (HT + HV) = ${fmt(r.loss, 0)} kWh`,
      `${L ? 'Heating season' : 'Heizperiode'} ≈ ${fmt(r.days, 0)} d · Qs = Σ(A·g·0,57·I) = ${fmt(r.Qs, 0)} kWh · Qi = ${fmt(r.bt.qi)} W/m² · ${fmt(r.nrf, 0)} m² · t = ${fmt(r.Qi, 0)} kWh`,
      `γ = ${fmt(r.gamma, 2)} · τ = ${fmt(r.tau, 0)} h · a = ${fmt(r.a, 2)} · η = (1−γ^a)/(1−γ^(a+1)) = ${fmt(r.eta, 2)}`,
      `Qh = ${fmt(r.loss, 0)} − ${fmt(r.eta, 2)} · ${fmt(r.gains, 0)} = ${fmt(r.Qh, 0)} kWh/a = ${fmt(r.qhSpec, 1)} kWh/m²a`,
      `${L ? 'Final energy' : 'Endenergie'} = ${L ? 'heating' : 'Heizung'} ${fmt(r.eHeat, 0)} + ${L ? 'DHW' : 'WW'} ${fmt(r.eWw, 0)} + ${L ? 'cooling' : 'Kühlung'} ${fmt(r.eCool, 0)} + ${L ? 'aux' : 'Hilfsenergie'} ${fmt(r.eAux, 0)} − PV ${fmt(r.pvSelf, 0)} = ${fmt(r.endTotal, 0)} kWh/a → ${fmt(r.endSpec, 1)} kWh/m²a → ${r.cls.c}`,
      `CO₂ ${L ? 'operation' : 'Betrieb'} = Σ(${L ? 'final energy' : 'Endenergie'} · ${L ? 'factor' : 'Faktor'}) = ${fmt(r.co2Op, 0)} kg/a (${L ? 'grid' : 'Strom'} ${fmt(r.cl.country.co2, 2)} kg/kWh)`,
    ].join('\n');
  }
  function calcWayLca(r) {
    return [
      `A1–A3 = Σ(${I.lang === 'en' ? 'area' : 'Fläche'} · Σ(d · ρ · GWP)) = ${fmt(r.a13 / 1000, 1)} t`,
      `B4 = Σ ${I.lang === 'en' ? 'replacements' : 'Austausch'} (⌈50/${I.lang === 'en' ? 'life' : 'Nutzungsdauer'}⌉ − 1) · (A1–A3 + C3–C4) = ${fmt(r.b4 / 1000, 1)} t`,
      `C3–C4 = ${fmt(r.c34 / 1000, 1)} t · B6 = ${fmt(r.co2Op / 1000, 2)} t/a · 50 a = ${fmt(r.b6 / 1000, 1)} t`,
      `${I.lang === 'en' ? 'Total' : 'Summe'} = ${fmt(r.lifeTotal / 1000, 1)} t → ${fmt(r.lifeSpec, 1)} kg/(m² NRF · a) · ${fmt(r.lifePerBgf, 0)} kg/m² BGF`,
      `PEnrt ${I.lang === 'en' ? 'embodied' : 'grau'} = ${fmt(r.penrtEmb / 1000, 0)} MWh · ${I.lang === 'en' ? 'operation' : 'Betrieb'} ${fmt(r.peSpec, 0)} kWh/m²a`,
      `${I.lang === 'en' ? 'Stored carbon' : 'Gespeicherter Kohlenstoff'} = ${fmt(r.bio / 1000, 1)} t CO₂ (${I.lang === 'en' ? 'shown separately, not offset' : 'getrennt ausgewiesen, nicht verrechnet'})`,
    ].join('\n');
  }
  function sourcesHtml() {
    return `<div class="tablewrap"><table><tbody>${D.SOURCES.map(s => `<tr><td><strong>${esc(I.lang === 'en' ? s[1] : s[0])}</strong></td><td>${esc(I.lang === 'en' ? s[3] : s[2])}</td></tr>`).join('')}</tbody></table></div><p class="xs muted">${t('disclaimer')}</p>`;
  }

  // ---------- 3D-Panel (Ergebnis) ----------
  function modelPanel(c) {
    const st = c.st, adj = Object.assign({ rot: 0, win: { N: 1, E: 1, S: 1, W: 1 }, shade: {} }, st.adj || {});
    const selEl = App.selected ? (st.elements.find(e => e.id === App.selected.elementId) || st.windows.find(w => w.id === App.selected.elementId)) : null;
    const unitMap = { heat: 'W/m²K', co2: 'kg CO₂e/m² · 50 a', circ: t('grade') + ' A–E', sun: I.lang === 'en' ? 'relative' : 'relativ' };
    let sel = '';
    if (selEl) {
      const isWin = !!selEl.type;
      const re = isWin ? c.res.wins.find(w => w.id === selEl.id) : c.res.els.find(e => e.id === selEl.id);
      const guids = (App.selected.guid ? [App.selected.guid] : []);
      sel = `<div class="selpanel"><div class="row" style="justify-content:space-between"><strong>${t('selected')}: ${esc(isWin ? t('kind_FE') : kindLabel(selEl.kind))} ${esc(selEl.name || '')}</strong><button class="iconbtn" data-act="deselect" aria-label="${t('close')}">${icon('x', 14)}</button></div>
        <div class="grid g4 small"><div><span class="xs muted">${t('area')}</span><div class="num">${fmt(re ? re.area : selEl.area, 1)} m²</div></div>
        <div><span class="xs muted">U</span><div class="num">${re ? fmt(isWin ? re.type.uw : re.U, 2) : '–'} W/m²K</div></div>
        <div><span class="xs muted">CO₂</span><div class="num">${re ? fmt(re.co2m2, 0) : '–'} kg/m²</div></div>
        <div><span class="xs muted">${t('grade')}</span><div>${re && re.circGrade ? `<span class="grade ${re.circGrade}">${re.circGrade}</span>` : '–'}</div></div></div>
        ${guids.length ? `<div class="xs muted">GUID: <code>${esc(guids.join(', '))}</code></div>` : ''}
        <div class="row">${isWin ? `<select id="selCon" style="width:auto;flex:1">${D.WINDOWS.map(x => `<option value="${x.id}" ${x.id === selEl.type ? 'selected' : ''}>${esc(nm(x))}</option>`).join('')}</select>
          <select id="selShade" style="width:auto">${['none', 'internal', 'external'].map(s => `<option value="${s}" ${s === selEl.shade ? 'selected' : ''}>${t('sh_' + s)}</option>`).join('')}</select>`
          : `<select id="selCon" style="width:auto;flex:1">${D.CONSTRUCTIONS.filter(x => x.kind === selEl.kind).map(x => `<option value="${x.id}" ${x.id === selEl.con ? 'selected' : ''}>${esc(nm(x))}</option>`).join('')}</select>`}</div>
        <div class="row"><span class="small muted">${t('selApply')}</span><div class="seg"><button data-act="applyMode" data-v="this" aria-pressed="${App.applyMode === 'this'}">${t('selThis')}</button><button data-act="applyMode" data-v="type" aria-pressed="${App.applyMode === 'type'}">${t('selType')}</button></div><button class="btn small primary" data-act="applySel">OK</button></div></div>`;
    }
    const L = I.lang === 'en';
    const sliders = ['N', 'E', 'S', 'W'].map(k => `<div class="f"><span>${t('or_' + k)} · ${fmt((adj.win[k] || 1) * 100, 0)} %</span><input type="range" min="0.5" max="1.5" step="0.05" data-adj="win.${k}" value="${adj.win[k] || 1}" aria-label="${t('winScale')} ${t('or_' + k)}"><select data-adj="shade.${k}" aria-label="${t('shadeToggle')} ${t('or_' + k)}"><option value="" ${adj.shade[k] == null ? 'selected' : ''}>${L ? 'Shading as planned' : 'Schutz wie geplant'}</option><option value="on" ${adj.shade[k] === true ? 'selected' : ''}>${L ? 'External shading' : 'mit Außenschutz'}</option><option value="off" ${adj.shade[k] === false ? 'selected' : ''}>${L ? 'No shading' : 'ohne Schutz'}</option></select></div>`).join('');
    return `<div class="bento col-span-1 md:col-span-6 lg:col-span-8"><div class="flex justify-between items-center gap-3"><h3>${icon('cube')} ${t('model3d')}</h3><span class="small muted">${esc(App.modelFile ? App.modelFile.name : '')}</span></div>
      <div class="viewer"><div class="canvas" id="viewer3d"></div>
        <div class="vtools"><div class="row" style="gap:6px"><select id="colorMode" style="width:auto" aria-label="${t('colorBy')}">${['heat', 'co2', 'circ', 'sun', 'none'].map(m => `<option value="${m}" ${App.colorMode === m ? 'selected' : ''}>${t('colorBy')}: ${t('cm_' + m)}</option>`).join('')}</select>
          ${c.sel.length ? `<button class="btn small ${App.ba ? 'primary' : ''}" data-act="ba">${t('beforeAfterToggle')}: ${App.ba ? t('after') : t('before')}</button>` : ''}</div>${viewButtons()}</div>
        ${App.colorMode !== 'none' ? `<div class="legend"><span>${t('legendLow')}</span><span class="ramp"></span><span>${t('legendHigh')}</span><span class="muted">${unitMap[App.colorMode]}</span></div>` : ''}<span class="hint">${t('clickHint')}</span></div></div>
      <div class="bento sage col-span-1 md:col-span-6 lg:col-span-4">${sel}
          <h4>${icon('rotate', 14)} ${t('rotate')}: ${fmt(adj.rot || 0, 0)}°</h4><input type="range" min="-180" max="180" step="15" data-adj="rot" value="${adj.rot || 0}" aria-label="${t('rotate')}">
          <h4>${icon('window', 14)} ${t('winScale')} · ${t('shadeToggle')}</h4><div class="sliders">${sliders}</div>
          <p class="xs muted">${t('geomNote')}</p>
          <div class="row"><button class="btn small" data-act="resetAdj">${t('resetAdj')}</button><button class="btn small" data-act="newVariant" ${App.variants.length >= 3 ? 'disabled' : ''}>${icon('variants', 12)} ${t('saveAsVariant')}</button></div></div>`;
  }

  // ---------- Schritt 6: Varianten ----------
  function step6() {
    const ctxs = App.variants.map(v => compute(v));
    const rows = variantRows(ctxs, true);
    const cards = App.variants.map((v, i) => `<div class="vcard ${i === App.active ? 'active' : ''}"><div class="row" style="justify-content:space-between"><strong>${t('variant')}</strong>${i === App.active ? `<span class="chip">${t('active')}</span>` : ''}</div>
      <input type="text" data-vname="${i}" value="${esc(v.name)}" aria-label="${t('rename')}">
      <span class="small muted num">${fmt(ctxs[i].opt.endSpec, 0)} kWh/m²a · ${ctxs[i].opt.cls.c} · ${fmt(ctxs[i].opt.lifeTotal / 1000, 0)} t CO₂e</span>
      <div class="row"><button class="btn small" data-act="activate" data-i="${i}" ${i === App.active ? 'disabled' : ''}>${t('makeActive')}</button><button class="btn small" data-act="dupVariant" data-i="${i}" ${App.variants.length >= 3 ? 'disabled' : ''}>${t('duplicate')}</button><button class="btn small ghost" data-act="delVariant" data-i="${i}" ${App.variants.length <= 1 ? 'disabled' : ''}>${t('delete')}</button></div></div>`).join('');
    const S = CH.SCREEN;
    const best = (vals, low) => { const b = low ? Math.min(...vals) : Math.max(...vals); return vals.map(v => v === b && vals.length > 1); };
    const g = (label, vals, unit, dec, low) => `<div class="card">${CH.grouped(App.variants.map(v => v.name), [{ name: label, values: vals, color: S.accent, mark: best(vals, low) }], { unit, dec, h: 210, w: 320 })}</div>`;
    return `<section class="section"><div class="section-head"><h2>${t('s5Title')}</h2>
      <div class="row"><button class="btn small" data-act="exportPdf" ${App.busy ? 'disabled' : ''}>${icon('download', 14)} ${App.busy === 'pdf' ? t('generating') : t('exportPdf')}</button><button class="btn small" data-act="exportXlsx" ${App.busy ? 'disabled' : ''}>${icon('download', 14)} ${App.busy === 'xlsx' ? t('generating') : t('exportXlsx')}</button>${VW.hasModel ? `<button class="btn small" data-act="exportGuid" ${App.busy ? 'disabled' : ''}>${icon('download', 14)} ${t('exportGuid')}</button>` : ''}</div></div>
      <p class="muted small">${t('s5Intro')}</p>
      <div class="grid g3">${cards}${App.variants.length < 3 ? `<button class="vcard" data-act="dupVariant" data-i="${App.active}" style="cursor:pointer;align-items:center;justify-content:center;color:var(--accent)">${icon('plus', 22)}<span>${t('newVariant')}</span></button>` : ''}</div>
      <p class="xs muted">${I.lang === 'en' ? 'Each variant includes its selected measures.' : 'Jede Variante inklusive ihrer gewählten Maßnahmen.'}</p>
      <div class="tablewrap"><table><thead><tr><th>${t('compare')}</th>${App.variants.map(v => `<th class="n">${esc(v.name)}</th>`).join('')}</tr></thead><tbody>
        ${rows.map(r => `<tr><td>${esc(r.label)}</td>${r.vals.map((v, i) => `<td class="n ${r.best[i] ? 'best' : ''}">${esc(r.fmt[i])}${r.best[i] ? ' ★' : ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <div class="grid g3">${g(t('endEnergy'), ctxs.map(c => c.opt.endSpec), 'kWh/m²a', 0, true)}${g(t('co2PerNrfA'), ctxs.map(c => c.opt.lifeSpec), 'kg/(m²·a)', 1, true)}${g(t('co2PerBgf'), ctxs.map(c => c.opt.embPerBgf), 'kg/m² BGF', 0, true)}</div>
      <div class="row end"><button class="btn" data-act="step" data-v="5">${t('back')}</button></div>
    </section>`;
  }
  function variantRows(ctxs, withBest) {
    const defs = [
      [t('endEnergy') + ' (kWh/m²a)', c => c.opt.endSpec, 0, true], [t('effClass'), c => c.opt.cls.c, null, null], [t('heatDemand') + ' (kWh/m²a)', c => c.opt.qhSpec, 0, true],
      ['CO₂ ' + (I.lang === 'en' ? 'operation' : 'Betrieb') + ' (t/a)', c => c.opt.co2Op / 1000, 1, true], [t('co2PerBgf') + ' (kg)', c => c.opt.embPerBgf, 0, true],
      [t('co2Total') + ' (t)', c => c.opt.lifeTotal / 1000, 0, true], [t('co2PerNrfA') + ' (kg)', c => c.opt.lifeSpec, 1, true], [t('penrt') + ' (kWh/m²a)', c => c.opt.peSpec, 0, true],
      [t('circularity') + ' (0–100)', c => c.opt.circScore, 0, false], [t('storedCarbon') + ' (t)', c => c.opt.bio / 1000, 0, false],
      [(I.lang === 'en' ? 'Energy cost' : 'Energiekosten') + ' (€/a)', c => c.opt.costOp, 0, true], [t('totalCost') + ' (€)', c => c.totalCost, 0, null],
      [t('summerRisk'), c => t('risk_' + c.opt.summerRisk), null, null],
    ];
    return defs.map(([label, f, dec, low]) => {
      const vals = ctxs.map(f);
      let best = vals.map(() => false);
      if (withBest && low != null && vals.length > 1) { const b = low ? Math.min(...vals) : Math.max(...vals); best = vals.map(v => v === b); }
      return { label, vals, best, fmt: vals.map(v => (dec == null ? String(v) : fmt(v, dec))) };
    });
  }

  // ---------- Nach dem Rendern ----------
  function afterRender() {
    const box = $('#viewer3d');
    if (box && VW.hasModel) {
      VW.mount(box);
      syncParts();
      applyModelColors();
    }
    const ci = $('#chatIn'); if (ci && App.chatFocus) { ci.focus(); App.chatFocus = false; }
  }
  function syncParts() {
    const parts = VW.parts;
    parts.forEach(p => { p.elementId = null; });
    const st = cur();
    st.elements.concat(st.windows).forEach(e => (e.parts || []).forEach(i => { if (parts[i]) parts[i].elementId = e.id; }));
  }
  function ramp(v) {
    const a = [0x5f, 0x9a, 0x6e], b = [0xe0, 0xb4, 0x5c], c = [0xb5, 0x60, 0x3d]; // Moos → Ocker → Rost
    v = Math.max(0, Math.min(1, v));
    const [p, q, s] = v < 0.5 ? [a, b, v * 2] : [b, c, (v - 0.5) * 2];
    const m = p.map((x, i) => Math.round(x + (q[i] - x) * s));
    return (m[0] << 16) | (m[1] << 8) | m[2];
  }
  function applyModelColors() {
    if (!VW.hasModel) return;
    const inResults = App.step === 4;
    const mode = inResults ? App.colorMode : 'none';
    const c = inResults ? App.lastCtx || compute(cur()) : null;
    const r = inResults ? (App.ba && c.sel.length ? c.opt : c.res) : null;
    if (mode === 'none' || !r) { VW.setColors(() => null); }
    else {
      const els = new Map(r.els.map(e => [e.id, e])), wins = new Map(r.wins.map(w => [w.id, w]));
      const GREY = 0xb5bab5;
      VW.setColors(id => {
        const e = els.get(id), w = wins.get(id);
        if (mode === 'heat') { if (e) return e.U != null ? ramp((e.U * ({ BO: 0.6 }[e.kind] || 1) - 0.1) / 1.2) : GREY; if (w) return ramp((w.type.uw - 0.6) / 2.4); }
        if (mode === 'co2') { if (e) return e.existing ? GREY : ramp(e.co2m2 / 300); if (w) return w.existing ? GREY : ramp(w.co2m2 / 300); }
        if (mode === 'circ') { const s = e ? e.p.circ : w ? w.type.circ : null; return s == null ? GREY : ramp(1 - s / 100); }
        if (mode === 'sun') { if (w) return ramp(w.type.g * ({ none: 1, internal: 0.65, external: 0.25 }[w.shade]) * K.solarFactor(w.az) * 1.6); return GREY; }
        return null;
      });
    }
    const sel = App.highlight || (App.selected ? [App.selected.elementId] : []);
    VW.highlight(sel);
  }
  VW.onPick = hit => {
    if (!hit) { App.selected = null; App.highlight = null; applyModelColors(); if (App.step === 4) render(); return; }
    App.selected = { elementId: hit.elementId, guid: hit.guid };
    App.highlight = null;
    if (App.step === 3) { App.open['L' + hit.elementId] = true; }
    render();
    const row = document.querySelector(`[data-row="${hit.elementId}"]`); if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  // ---------- Dateien ----------
  async function addPlanFiles(files) {
    for (const f of files) {
      const p = { id: K.newId('p'), name: f.name, type: /lage|site/i.test(f.name) ? 'lageplan' : /schnitt|section/i.test(f.name) ? 'schnitt' : /ansicht|elev/i.test(f.name) ? 'ansicht' : /detail/i.test(f.name) ? 'detail' : 'grundriss', images: [], thumb: null, status: 'busy' };
      App.plans.push(p); render();
      try {
        if (/pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)) {
          for (const u of PDFJS) await loadScript(u);
          const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await f.arrayBuffer()), disableWorker: true }).promise;
          const n = Math.min(pdf.numPages, 4);
          for (let i = 1; i <= n; i++) {
            const page = await pdf.getPage(i);
            const vp0 = page.getViewport({ scale: 1 });
            const scale = Math.min(3, 2000 / Math.max(vp0.width, vp0.height));
            const vp = page.getViewport({ scale });
            const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
            const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
            await page.render({ canvasContext: g, viewport: vp, intent: 'print' }).promise;
            p.images.push(await new Promise(res => cv.toBlob(res, 'image/jpeg', 0.88)));
            if (i === 1) p.thumb = thumbOf(cv);
          }
        } else {
          const img = await blobImage(f);
          const cv = document.createElement('canvas');
          const s = Math.min(1, 2400 / Math.max(img.width, img.height));
          cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
          const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height);
          p.images.push(s < 1 || f.size > 8e6 ? await new Promise(res => cv.toBlob(res, 'image/jpeg', 0.9)) : f);
          p.thumb = thumbOf(cv);
        }
        p.status = 'ok';
      } catch (e) { p.status = 'err'; App.plans = App.plans.filter(x => x !== p); toast(t('errorGeneric') + ' (' + f.name + ')'); }
      render();
    }
  }
  function blobImage(f) { return new Promise((res, rej) => { const u = URL.createObjectURL(f); const im = new Image(); im.onload = () => { URL.revokeObjectURL(u); res(im); }; im.onerror = rej; im.src = u; }); }
  function thumbOf(cv) { const c2 = document.createElement('canvas'); const s = 320 / Math.max(cv.width, cv.height); c2.width = Math.round(cv.width * s); c2.height = Math.round(cv.height * s); c2.getContext('2d').drawImage(cv, 0, 0, c2.width, c2.height); return c2.toDataURL('image/jpeg', 0.8); }

  // Beispielname durch Dateinamen ersetzen, wenn ein eigenes Projekt beginnt
  const EXAMPLE_NAMES = ['Beispiel: Mehrfamilienhaus', 'Example: apartment building'];
  function leaveExample(fileName) {
    if (!App.meta.project || EXAMPLE_NAMES.includes(App.meta.project)) App.meta.project = fileName ? String(fileName).replace(/\.[^.]+$/, '') : '';
  }

  // ---------- Modell → Bauteile ----------
  const DEF = { new: { AW: 'aw_ks_eps', DA: 'da_flach_eps', BO: 'bo_stb_xps', DE: 'de_stb', IW: 'iw_ks' }, existing: { AW: 'aw_ziegel_alt', DA: 'da_flach_alt', BO: 'bo_alt', DE: 'de_stb', IW: 'iw_ziegel' } };
  function modelToState(info, st) {
    const north = Number.isFinite(+App.modelOpts.north) && App.modelOpts.north !== '' ? +App.modelOpts.north : info.north || 0;
    info.north = north;
    const parts = VW.parts;
    const groups = new Map();
    const mode = st.mode === 'existing' ? 'existing' : 'new';
    info.parts.forEach(p => {
      const idx = parts.indexOf(p.part);
      if (idx < 0) return;
      const az = p.az != null ? (p.az + north + 360) % 360 : null;
      const ok = az != null ? K.orientKey(az) : '';
      const sig = p.layers && p.layers.length ? p.layers.map(l => l.name + ':' + l.d).join('|') : p.uval ? 'u' + p.uval : (p.kind === 'FE' ? 'win' : 'none');
      const key = `${p.kind}|${ok}|${sig}`;
      const gr = groups.get(key) || { kind: p.kind, area: 0, ax: 0, az: 0, parts: [], guids: [], names: new Set(), layers: p.layers, uval: p.uval, flatA: 0 };
      if (p.kind === 'DA' && p.flat) gr.flatA += p.area || 0;
      gr.area += p.area || 0; gr.parts.push(idx); if (p.guid) gr.guids.push(p.guid); if (p.name) gr.names.add(p.name);
      if (az != null) { gr.ax += Math.sin(az * Math.PI / 180) * (p.area || 1); gr.az += Math.cos(az * Math.PI / 180) * (p.area || 1); }
      groups.set(key, gr);
    });
    const els = [], wins = [];
    groups.forEach(gr => {
      const az = gr.ax || gr.az ? ((Math.atan2(gr.ax, gr.az) * 180 / Math.PI) + 360) % 360 : null;
      const name = [...gr.names][0] || '';
      if (gr.kind === 'FE') {
        let type = mode === 'existing' ? 'w_iso_alt' : 'w_3_pvc';
        if (gr.uval) type = D.WINDOWS.reduce((b, w) => (Math.abs(w.uw - gr.uval) < Math.abs(D.WIN[b].uw - gr.uval) ? w.id : b), type);
        wins.push({ id: K.newId('w'), az: az != null ? Math.round(az) % 360 : 180, area: Math.round(gr.area * 10) / 10, type, shade: 'none', existing: mode === 'existing', conf: 'hoch', src: 'model', parts: gr.parts, guids: gr.guids, name });
        return;
      }
      const e = { id: K.newId('e'), kind: gr.kind, name: (kindLabel(gr.kind) + (az != null ? ' ' + t('or_' + K.orientKey(az)) : '') + (name ? ' · ' + name : '')).slice(0, 60), area: Math.round(gr.area * 10) / 10,
        az: gr.kind === 'AW' ? Math.round(az) : null, con: DEF[mode][gr.kind], existing: mode === 'existing', conf: 'niedrig', src: 'model', parts: gr.parts, guids: gr.guids };
      if (gr.layers && gr.layers.length) {
        e.ifcLayers = gr.layers;
        const mapped = gr.layers.map(l => ({ mat: VW.matchMaterial(l.name) || (App.matMap || {})[l.name] || null, d: l.d }));
        if (mapped.every(l => l.mat && l.d > 0)) { e.layers = mapped.map(l => ({ mat: l.mat, d: l.d, th: true })); e.con = 'custom'; e.conn = 'teilweise'; e.conf = 'hoch'; }
        else e.conf = 'mittel';
      } else if (gr.uval) {
        const cands = D.CONSTRUCTIONS.filter(c => c.kind === gr.kind);
        e.con = cands.reduce((b, c) => (Math.abs(K.uValue(c.kind, c.layers) - gr.uval) < Math.abs(K.uValue(b.kind, b.layers) - gr.uval) ? c : b), cands[0]).id;
        e.conf = 'mittel';
      }
      if (gr.kind === 'DA') {
        e.flat = gr.flatA > gr.area * 0.5;
        if (!e.flat && e.con !== 'custom' && D.CON[e.con] && D.CON[e.con].flat) e.con = mode === 'existing' ? 'da_steil_alt' : 'da_steil_mw';
      }
      els.push(e);
    });
    st.elements = els.sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || (a.az || 0) - (b.az || 0));
    st.windows = wins.sort((a, b) => a.az - b.az);
    const g = info.geo;
    if (g.bgf > 0) Object.assign(st.geo, { bgf: Math.round(g.bgf), nrf: Math.round(g.nrf), floors: g.floors, hStorey: Math.round(g.hStorey * 100) / 100, volume: Math.round(g.volume), footprint: Math.round(g.footprint) });
    st.fieldConf = { bgf: { conf: 'mittel', src: 'model' }, nrf: { conf: 'niedrig', src: 'geschaetzt' }, floors: { conf: 'mittel', src: 'model' }, volume: { conf: 'mittel', src: 'model' } };
    delete st.example;
    const counts = {};
    els.forEach(e => { counts[e.kind] = (counts[e.kind] || 0) + e.parts.length; });
    if (wins.length) counts.FE = wins.reduce((a, w) => a + w.parts.length, 0);
    return counts;
  }

  async function readModel() {
    if (!App.modelFile) return;
    App.step = 2;
    App.progress = { lines: [{ text: t('loadingLibs'), state: 'run' }], running: true };
    render();
    try {
      const info = await VW.load(App.modelFile, App.modelOpts, phase => {
        if (phase === 'parse') { App.progress.lines[0].state = 'done'; App.progress.lines.push({ text: t('modelParsing'), state: 'run' }); render(); }
      });
      App.modelInfo = info;
      const st = cur();
      if (st.example) { App.variants = [Object.assign(K.emptyState(), { mode: st.mode, type: st.type, sub: st.sub, loc: st.loc })]; App.active = 0; leaveExample(App.modelFile.name); }
      const counts = modelToState(info, cur());
      // andere Varianten übernehmen die Modellzuordnung
      App.progress.lines.forEach(l => { l.state = 'done'; });
      App.progress.lines.push({ text: `${t('modelDone')} (${info.format}) · ${info.parts.length} ${t('elementsFound')}`, state: 'done' });
      App.progress.counts = counts;
      App.progress.matNames = info.matNames;
      App.progress.running = false;
    } catch (e) {
      App.progress.running = false;
      App.progress.lines.forEach(l => { if (l.state === 'run') l.state = 'err'; });
      App.progress.error = t('err_model') + (e && e.message ? ' (' + e.message + ')' : '');
    }
    render();
  }

  // ---------- KI: Pläne lesen ----------
  async function analyze() {
    if (!App.sample || !App.plans.length) return;
    const st0 = cur();
    if (App.modelFile && !App.modelInfo) await readModel();
    const hasModel = !!App.modelInfo;
    if (st0.example && !hasModel) { const fresh = Object.assign(K.emptyState(), { mode: st0.mode, type: st0.type, sub: st0.sub, loc: st0.loc, year: st0.year, tech: st0.tech, meta: st0.meta }); App.variants = [fresh]; App.active = 0; leaveExample(App.plans[0] && App.plans[0].name); }
    const st = cur();
    const maxN = (App.limits && App.limits.images && App.limits.images.maxCount) || 20;
    const imgs = []; const list = [];
    App.plans.forEach(p => p.images.forEach((b, i) => { imgs.push(b); list.push({ label: p.name + (p.images.length > 1 ? ' S.' + (i + 1) : ''), typeLabel: t('pt_' + p.type) }); }));
    App.step = 2;
    App.progress = App.progress && hasModel ? App.progress : { lines: [] };
    App.progress.running = true; App.progress.error = null; App.progress.chars = 0;
    if (imgs.length > maxN) App.progress.lines.push({ text: t('tooManyImages', { n: maxN }), state: 'done' });
    App.progress.lines.push({ text: t('aiThinking'), state: 'run' });
    render();
    if (!(App.limits && App.limits.images)) { failAI({ code: 'images_unavailable' }); return; }
    App.ctl = new AbortController();
    try {
      const prompt = AI.planPrompt(st, list.slice(0, maxN), hasModel);
      const onRetry = ({ waitMs }) => { App.progress.lines.push({ text: t('aiRetry', { s: Math.round(waitMs / 1000) }), state: 'done' }); render(); };
      const res = await App.sample.json(prompt, { images: imgs.slice(0, maxN), modelTier: 'complex', signal: App.ctl.signal, onRetry, onText: ({ text }) => { App.progress.chars = text.length; if (App.step === 2) { const el = document.querySelector('.progress .xs'); if (el) el.textContent = t('aiWriting') + ' ' + fmt(text.length) + ' Zeichen'; else if (text.length < 200) render(); } } });
      const out = AI.applyPlanResult(cur(), res || {}, hasModel);
      App.progress.lines.forEach(l => { if (l.state === 'run') l.state = 'done'; });
      App.progress.lines.push({ text: `${t('done')}: ${cur().elements.length} ${t('elements')}, ${cur().windows.length} ${t('windows')}`, state: 'done' });
      App.progress.summary = out.summary; App.progress.uncertainties = out.uncertainties;
      App.progress.running = false;
      render();
    } catch (e) { failAI(e); }
  }
  function failAI(e) {
    App.progress.running = false;
    App.progress.lines.forEach(l => { if (l.state === 'run') l.state = 'err'; });
    if (e && e.code === 'cancelled') App.progress.error = null;
    else App.progress.error = e && e.code === 'images_unavailable' ? t('aiUnavailable') : errText(e);
    render();
  }

  async function mapMaterials() {
    const names = (App.progress && App.progress.matNames) || [];
    if (!App.sample || !names.length) return;
    App.busy = 'map'; render();
    try {
      const m = await App.sample.json(AI.mapPrompt(names), { modelTier: 'quick' });
      App.matMap = Object.assign(App.matMap || {}, Object.fromEntries(Object.entries(m || {}).filter(([, v]) => v && D.MAT[v])));
      App.variants.forEach(st => st.elements.forEach(e => {
        if (!e.ifcLayers || e.con === 'custom') return;
        const mapped = e.ifcLayers.map(l => ({ mat: VW.matchMaterial(l.name) || App.matMap[l.name] || null, d: l.d }));
        if (mapped.every(l => l.mat && l.d > 0)) { e.layers = mapped.map(l => ({ mat: l.mat, d: l.d, th: true })); e.con = 'custom'; e.conn = 'teilweise'; e.conf = 'mittel'; }
      }));
      App.progress.matNames = names.filter(n => !App.matMap[n]);
      toast(t('mapDone'));
    } catch (e) { toast(errText(e)); }
    App.busy = ''; render();
  }

  // ---------- KI: Erklärungen & Chat ----------
  async function aiExplain() {
    if (!App.sample) return;
    const c = App.lastCtx || compute(cur());
    App.busy = 'explain'; render();
    try {
      const opts = { modelTier: 'default' };
      if (VW.hasModel && App.limits && App.limits.images) { const b = await VW.snapshot(); if (b) opts.images = [b]; }
      const r = await App.sample.json(AI.explainPrompt(c.st, c.res, c.ms), opts);
      const texts = {};
      (r && r.massnahmen || []).forEach(x => { if (x && x.id) texts[x.id] = String(x.text || ''); });
      App.ai[c.st.id] = { texts, extra: Array.isArray(r && r.weitere) ? r.weitere : [], fazit: String((r && r.fazit) || '') };
    } catch (e) { toast(errText(e)); }
    App.busy = ''; render();
  }
  async function chatSend(q) {
    q = String(q || '').trim();
    if (!q || !App.sample || App.chatBusy) return;
    const c = compute(cur()); // immer mit den aktuellen Werten, egal auf welchem Reiter
    App.chat.push({ role: 'user', content: q });
    App.chat.push({ role: 'assistant', content: '…' });
    App.chatBusy = true; render();
    const turns = [{ role: 'user', content: AI.chatRules(c.st, c.res, c.ms) }].concat(App.chat.slice(0, -1).slice(-10));
    try {
      const { text } = await App.sample(turns, { cache: false, modelTier: 'default', onText: ({ text: tx }) => {
        App.chat[App.chat.length - 1].content = tx;
        const bubbles = document.querySelectorAll('.msg'); const last = bubbles[bubbles.length - 1]; if (last) last.textContent = tx;
      } });
      App.chat[App.chat.length - 1].content = text;
    } catch (e) { App.chat[App.chat.length - 1].content = (e && e.text) || errText(e); }
    App.chatBusy = false; App.chatFocus = true; render();
  }

  // ---------- Export ----------
  function exportCtx() {
    const c = App.lastCtx && App.lastCtx.st === cur() ? App.lastCtx : compute(cur());
    const ctxs = App.variants.map(v => compute(v));
    const vr = variantRows(ctxs, false).map(r => [r.label].concat(r.fmt));
    const charts = chartFns(c);
    const p0 = App.plans.find(p => p.thumb);
    const snap = VW.hasModel ? VW.snapshotDataUrl() : null;
    return Object.assign({}, c, { measures: c.ms, selected: c.sel, charts, snapshot: snap && snap.data, snapshotRatio: snap && snap.ratio, planThumb: p0 ? p0.thumb : null, ai: App.ai[c.st.id], variants: App.variants, variantRows: vr, guidRows: guidRows(c) });
  }
  function guidRows(c) {
    if (!VW.hasModel) return null;
    const L = I.lang === 'en';
    const head = ['GUID / ' + (L ? 'object' : 'Objekt'), t('kind'), t('name'), t('orientation'), t('area') + ' m²', L ? 'Old build-up' : 'Alter Aufbau', L ? 'New build-up' : 'Neuer Aufbau', 'U alt', 'U neu', L ? 'Measures' : 'Maßnahmen'];
    const rows = [head];
    const optEls = new Map(c.optSt.elements.map(e => [e.id, e])), optWins = new Map(c.optSt.windows.map(w => [w.id, w]));
    const rEls = new Map(c.res.els.map(e => [e.id, e])), oEls = new Map(c.opt.els.map(e => [e.id, e]));
    const mNamesFor = id => c.ms.filter(m => c.sel.includes(m.id) && m.affected.includes(id)).map(m => I.MEASURE_TEXT[m.id][I.lang][0]).join('; ');
    const desc = e => e.con === 'custom' ? K.layersOf(e).map(l => `${nm(D.MAT[l.mat])} ${fmt(l.d * 100, 0)} cm`).join(' / ') : nm(D.CON[e.con]);
    c.st.elements.forEach(e => {
      const o = optEls.get(e.id); if (!o) return;
      const changed = JSON.stringify(K.layersOf(e)) !== JSON.stringify(K.layersOf(o)) || e.con !== o.con || e.area !== o.area;
      if (!changed) return;
      (e.parts || []).forEach(i => { const p = VW.parts[i]; rows.push([p.guid || p.name || '', kindLabel(e.kind), e.name || '', e.az != null ? orientLabel(e.az) : '', Math.round((p.area || 0) * 10) / 10, desc(e), desc(o), rEls.get(e.id) && rEls.get(e.id).U != null ? +rEls.get(e.id).U.toFixed(3) : '', oEls.get(e.id) && oEls.get(e.id).U != null ? +oEls.get(e.id).U.toFixed(3) : '', mNamesFor(e.id)]); });
    });
    c.st.windows.forEach(w => {
      const o = optWins.get(w.id); if (!o || (o.type === w.type && o.shade === w.shade && o.area === w.area)) return;
      (w.parts || []).forEach(i => { const p = VW.parts[i]; rows.push([p.guid || p.name || '', t('kind_FE'), w.name || '', orientLabel(w.az), Math.round((p.area || 0) * 10) / 10, nm(D.WIN[w.type]) + ' · ' + t('sh_' + w.shade), nm(D.WIN[o.type]) + ' · ' + t('sh_' + o.shade), D.WIN[w.type].uw, D.WIN[o.type].uw, mNamesFor(w.id)]); });
    });
    ['m_hp', 'm_mvhr', 'm_pv', 'm_st', 'm_night', 'm_rain', 'm_wb'].filter(id => c.sel.includes(id)).forEach(id => rows.push(['—', L ? 'Building' : 'Gebäude', I.MEASURE_TEXT[id][I.lang][0], '', '', '', '', '', '', '']));
    return rows;
  }
  async function doExport(kind) {
    if (App.busy) return;
    App.busy = kind; render();
    try {
      const ctx = exportCtx();
      const base = EX.safeName(App.meta.project || 'greenprint') + '_' + cur().name;
      let blob, fn;
      if (kind === 'pdf') { blob = await EX.pdfReport(App, ctx); fn = base + '.pdf'; }
      else if (kind === 'xlsx') { blob = await EX.xlsxReport(App, ctx); fn = base + '.xlsx'; }
      else { blob = await EX.guidList(ctx.guidRows || [[]]); fn = base + '_Massnahmen_GUID.xlsx'; }
      const r = await EX.save(App.downloads, fn, blob);
      toast(r === 'saved' ? t('saved') + ': ' + fn : r === 'declined' ? t('saveDeclined') : t('saveUnavailable'));
    } catch (e) { toast(t('errorGeneric')); console.error(e); }
    App.busy = ''; render();
  }

  // ---------- Bauteile schätzen ----------
  function estimateFromGeo() {
    const st = cur();
    const g = st.geo;
    const floors = Math.max(1, +g.floors || 1), h = +g.hStorey || 3;
    const fp = +g.footprint || (+g.bgf ? +g.bgf / floors : 0);
    if (!fp) { toast(I.lang === 'en' ? 'Please enter footprint or GFA first.' : 'Bitte zuerst Grundfläche oder BGF eintragen.'); return; }
    const a = Math.sqrt(fp * 1.5), b = fp / a, H = floors * h;
    const share = st.type === 'wohnen' ? 0.22 : 0.35;
    const mode = st.mode === 'existing' ? 'existing' : 'new';
    const ex2 = mode === 'existing';
    const mk = (kind, area, az, name) => ({ id: K.newId('e'), kind, name, area: Math.round(area), az, con: DEF[mode][kind], existing: ex2, conf: 'niedrig', src: 'geschaetzt', flat: kind === 'DA' });
    const walls = [[0, a, 0.8], [90, b, 1], [180, a, 1.5], [270, b, 1]];
    const wsum = walls.reduce((s, w) => s + w[1] * w[2], 0);
    const totalWin = 2 * (a + b) * H * share;
    st.elements = walls.map(([az, len, f]) => mk('AW', len * H - totalWin * len * f / wsum, az, kindLabel('AW') + ' ' + orientLabel(az)))
      .concat([mk('DA', fp, null, kindLabel('DA')), mk('BO', fp, null, kindLabel('BO'))])
      .concat(floors > 1 ? [mk('DE', fp * (floors - 1), null, kindLabel('DE'))] : [])
      .concat([mk('IW', (D.BT[st.type] || D.BT.wohnen).iw * fp * floors, null, kindLabel('IW'))]);
    st.windows = walls.map(([az, len, f]) => ({ id: K.newId('w'), az, area: Math.round(totalWin * len * f / wsum * 10) / 10, type: ex2 ? 'w_iso_alt' : 'w_3_pvc', shade: 'internal', existing: ex2, conf: 'niedrig', src: 'geschaetzt' }));
    if (!+g.bgf) g.bgf = Math.round(fp * floors);
    if (!+g.nrf) g.nrf = Math.round(g.bgf * 0.8);
    if (!+g.volume) g.volume = Math.round(fp * H);
    delete st.example;
  }

  // ---------- Aktionen ----------
  const A = {
    step: el => { App.step = +el.dataset.v; App.highlight = null; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
    lang: el => { I.setLang(el.dataset.v); document.documentElement.lang = I.lang; if (EXAMPLE_NAMES.includes(App.meta.project)) App.meta.project = EXAMPLE_NAMES[I.lang === 'en' ? 1 : 0]; render(); },
    help: el => { const g = I.GLOSSARY[I.lang][+el.dataset.i]; if (g) modal(g[0], `<p>${esc(g[1])}</p>`); },
    glossary: () => modal(t('glossary'), `<dl class="gloss">${I.GLOSSARY[I.lang].map(g => `<dt>${esc(g[0])}</dt><dd>${esc(g[1])}</dd>`).join('')}</dl>`),
    sources: () => modal(t('assumptions'), sourcesHtml()),
    closeModal,
    newProject: () => {
      modal(t('newProject'), `<p>${I.lang === 'en' ? 'Start a new, empty project? Unsaved changes will be lost.' : 'Neues, leeres Projekt beginnen? Nicht gespeicherte Änderungen gehen verloren.'}</p><div class="row end"><button class="btn" data-act="closeModal">${t('back')}</button><button class="btn primary" data-act="confirmNew">${t('newProject')}</button></div>`);
    },
    confirmNew: () => { closeModal(); App.variants = [K.emptyState()]; App.active = 0; App.meta = { project: '', author: App.meta.author, school: App.meta.school }; App.plans = []; App.modelFile = null; App.modelInfo = null; VW.clearModel(); App.progress = null; App.ai = {}; App.chat = []; App.selected = null; App.step = 1; render(); },
    openProject: () => $('#projFile').click(),
    saveProject: async () => { const r = await EX.save(App.downloads, EX.safeName(App.meta.project || 'greenprint') + '.json', EX.projectJson(App)); toast(r === 'saved' ? t('saved') : r === 'declined' ? t('saveDeclined') : t('saveUnavailable')); },
    mode: el => { const st = cur(); st.mode = el.dataset.v; st.elements.forEach(e => { e.existing = st.mode === 'existing'; }); st.windows.forEach(w => { w.existing = st.mode === 'existing'; }); render(); },
    removePlan: el => { App.plans = App.plans.filter(p => p.id !== el.dataset.id); render(); },
    removeModel: () => { App.modelFile = null; App.modelInfo = null; VW.clearModel(); App.variants.forEach(v => { v.elements.forEach(e => { delete e.parts; }); v.windows.forEach(w => { delete w.parts; }); }); render(); },
    readModel, analyze, mapMaterials,
    stopAI: () => { if (App.ctl) App.ctl.abort(); },
    skip: () => { App.step = 3; render(); },
    autoGeo: () => { const g = cur().geo; const fl = +g.floors || 1, fp = +g.footprint; if (fp) { g.bgf = Math.round(fp * fl); g.nrf = Math.round(g.bgf * 0.8); g.volume = Math.round(fp * fl * (+g.hStorey || 3)); } render(); },
    estimateElements: () => { estimateFromGeo(); render(); },
    addElement: () => { const kind = $('#addKind').value; const st = cur(); st.elements.push({ id: K.newId('e'), kind, name: kindLabel(kind), area: 0, az: kind === 'AW' ? 180 : null, con: DEF[st.mode === 'existing' ? 'existing' : 'new'][kind], existing: st.mode === 'existing', conf: 'hoch', src: 'manual' }); delete st.example; render(); },
    delElement: el => { const st = cur(); st.elements = st.elements.filter(e => e.id !== el.dataset.id); render(); },
    toggleLayers: el => { const k = 'L' + el.dataset.id; App.open[k] = !App.open[k]; render(); },
    addLayer: el => { const e = cur().elements.find(x => x.id === el.dataset.id); if (!e) return; if (e.con !== 'custom') { e.layers = K.clone(K.layersOf(e)); e.conn = K.connOf(e); e.con = 'custom'; } e.layers.push({ mat: 'holzfaser', d: 0.1, th: true }); App.open['L' + e.id] = true; render(); },
    delLayer: el => { const e = cur().elements.find(x => x.id === el.dataset.id); if (!e) return; if (e.con !== 'custom') { e.layers = K.clone(K.layersOf(e)); e.conn = K.connOf(e); e.con = 'custom'; } e.layers.splice(+el.dataset.i, 1); render(); },
    addWindow: () => { const st = cur(); st.windows.push({ id: K.newId('w'), az: 180, area: 10, type: st.mode === 'existing' ? 'w_iso_alt' : 'w_3_pvc', shade: 'none', existing: st.mode === 'existing', conf: 'hoch', src: 'manual' }); render(); },
    delWindow: el => { const st = cur(); st.windows = st.windows.filter(w => w.id !== el.dataset.id); render(); },
    sort: el => { App.sort = el.dataset.v; render(); },
    aiExplain,
    chatQ: el => { App.chatOpen = true; chatSend(t(el.dataset.q)); },
    showOnModel: el => { const m = (App.lastCtx || compute(cur())).ms.find(x => x.id === el.dataset.id); App.highlight = m ? m.affected : null; if (App.step !== 4) { App.step = 4; render(); App.highlight = m ? m.affected : null; } applyModelColors(); const v = $('#viewer3d'); if (v) v.scrollIntoView({ behavior: 'smooth', block: 'center' }); },
    ba: () => { App.ba = !App.ba; render(); },
    view: el => { if (el.dataset.v === 'fit') VW.frame(); else VW.view(el.dataset.v); },
    deselect: () => { App.selected = null; App.highlight = null; render(); },
    applyMode: el => { App.applyMode = el.dataset.v; render(); },
    applySel: () => {
      const st = cur(); const id = App.selected && App.selected.elementId; if (!id) return;
      const val = $('#selCon') && $('#selCon').value; const shade = $('#selShade') && $('#selShade').value;
      let target = st.elements.find(e => e.id === id) || st.windows.find(w => w.id === id);
      if (!target) return;
      const isWin = !!target.type;
      if (App.applyMode === 'this' && (target.parts || []).length > 1 && App.selected.guid) {
        const idx = VW.parts.findIndex(p => p.guid === App.selected.guid);
        if (idx >= 0) {
          const part = VW.parts[idx];
          const copy = K.clone(target); copy.id = K.newId(isWin ? 'w' : 'e'); copy.parts = [idx]; copy.guids = [part.guid]; copy.area = Math.round((part.area || 0) * 10) / 10; copy.name = (target.name || '') + ' · ' + (part.name || part.guid).slice(0, 20);
          target.parts = target.parts.filter(i => i !== idx); target.guids = (target.guids || []).filter(g => g !== part.guid); target.area = Math.max(0, Math.round((target.area - copy.area) * 10) / 10);
          (isWin ? st.windows : st.elements).push(copy); target = copy; App.selected.elementId = copy.id;
        }
      }
      if (isWin) { target.type = val; if (shade) target.shade = shade; } else { target.con = val; delete target.layers; delete target.conn; }
      target.conf = 'hoch'; target.src = 'manual';
      render();
    },
    resetAdj: () => { cur().adj = { rot: 0, win: { N: 1, E: 1, S: 1, W: 1 }, shade: {} }; render(); },
    newVariant: () => dupVariant(App.active),
    dupVariant: el => dupVariant(+el.dataset.i),
    activate: el => { App.active = +el.dataset.i; App.selected = null; App.chat = []; render(); },
    delVariant: el => { const i = +el.dataset.i; if (App.variants.length <= 1) return; App.variants.splice(i, 1); App.active = Math.min(App.active, App.variants.length - 1); render(); },
    exportPdf: () => doExport('pdf'), exportXlsx: () => doExport('xlsx'), exportGuid: () => doExport('guid'),
    aiSettings: () => openAiSettings(),
    cursorToggle: () => {
      App.plainCursor = !App.plainCursor;
      document.documentElement.classList.toggle('plain-cursor', App.plainCursor);
      try { localStorage.setItem('gp_plain_cursor', App.plainCursor ? '1' : '0'); } catch (e) { /* ohne Speicher nur für diese Sitzung */ }
      document.querySelectorAll('.foot-step').forEach(el => el.remove());
      renderChat();
      const tb = document.querySelector('.cursor-tab'); if (tb) tb.focus();
    },
    chatToggle: () => { App.chatOpen = !App.chatOpen; renderChat(); if (App.chatOpen) { const i = $('#chatIn'); if (i) i.focus(); } else { const tb = document.querySelector('.chat-tab'); if (tb) tb.focus(); } },
    orSave: () => {
      const v = orFormValues();
      if (v.key) OR.cfg.key = v.key;
      if (v.strong) OR.cfg.strong = v.strong;
      if (v.fast) OR.cfg.fast = v.fast;
      if (v.prov) OR.cfg.provider = v.prov;
      closeModal(); toast(t('saved') + ' · ' + aiStatusText()); render();
    },
    orRemove: () => { OR.cfg.key = ''; openAiSettings(); render(); },
    orFree: () => { setModelSelects(OR.FREE); },
    orPaid: () => { setModelSelects(OR.DEFAULTS); },
    orTest: async () => {
      const v = orFormValues(); const box = $('#orStatus');
      const key = v.key || OR.cfg.key;
      if (!key) { box.textContent = t('err_no_key'); return; }
      box.innerHTML = '<span class="spinner"></span>';
      try {
        const r = await OR.checkKey(key);
        const L = I.lang === 'en';
        box.innerHTML = `<span class="st-ok">✓ ${t('orOk')}</span> · ${L ? 'used' : 'verbraucht'} ${fmt(r.usage || 0, 2)} $${r.limit != null ? ` · ${L ? 'limit' : 'Limit'} ${fmt(r.limit, 2)} $ · ${L ? 'remaining' : 'übrig'} ${fmt(r.remaining, 2)} $` : ` · ${L ? 'no spending limit set' : 'kein Ausgabenlimit gesetzt'}`}`;
      } catch (e) { box.innerHTML = `<span class="st-fail">✗ ${esc(errText(e))}</span>`; }
    },
  };
  function dupVariant(i) {
    if (App.variants.length >= 3) { toast(t('maxVariants')); return; }
    const v = K.clone(App.variants[i]);
    v.id = K.newId('v');
    const used = App.variants.map(x => x.name);
    v.name = ['A', 'B', 'C', 'D'].find(n => !used.includes(n)) || String(App.variants.length + 1);
    App.variants.push(v); App.active = App.variants.length - 1;
    toast(t('variant') + ' ' + v.name);
    render();
  }

  // ---------- Ereignisse ----------
  const root = document.body;
  root.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (el && !el.disabled) { const fn = A[el.dataset.act]; if (fn) { e.preventDefault(); fn(el, e); } return; }
    const drop = e.target.closest('[data-drop]');
    if (drop) { $(drop.dataset.drop === 'plans' ? '#planFiles' : '#modelFile').click(); }
  });
  root.addEventListener('keydown', e => {
    const drop = e.target.closest && e.target.closest('[data-drop]');
    if (drop && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); drop.click(); }
    if (e.key === 'Escape') { if ($('#modal')) closeModal(); else if (App.chatOpen) { App.chatOpen = false; renderChat(); } }
  });
  root.addEventListener('dragover', e => { const d = e.target.closest && e.target.closest('[data-drop]'); if (d) { e.preventDefault(); d.classList.add('over'); } });
  root.addEventListener('dragleave', e => { const d = e.target.closest && e.target.closest('[data-drop]'); if (d) d.classList.remove('over'); });
  root.addEventListener('drop', e => {
    const d = e.target.closest && e.target.closest('[data-drop]');
    if (!d) return;
    e.preventDefault(); d.classList.remove('over');
    const files = [...(e.dataTransfer.files || [])];
    if (d.dataset.drop === 'plans') addPlanFiles(files.filter(f => /image|pdf/.test(f.type) || /\.(pdf|png|jpe?g|webp)$/i.test(f.name)));
    else if (files[0]) setModelFile(files[0]);
  });
  function setModelFile(f) {
    if (!/\.(ifc|obj|gltf|glb)$/i.test(f.name)) { toast(t('err_model')); return; }
    App.modelFile = f; App.modelInfo = null; render();
  }
  root.addEventListener('submit', e => {
    if (e.target.dataset.form === 'chat') { e.preventDefault(); const i = $('#chatIn'); const q = i.value; i.value = ''; App.chatDraft = ''; chatSend(q); }
  });
  function onField(e, commit) {
    const el = e.target;
    if (el.id === 'planFiles' && commit) { addPlanFiles([...el.files]); el.value = ''; return; }
    if (el.id === 'modelFile' && commit) { if (el.files[0]) setModelFile(el.files[0]); el.value = ''; return; }
    if (el.id === 'projFile' && commit) { openProjectFile(el.files[0]); el.value = ''; return; }
    if (el.id === 'colorMode' && commit) { App.colorMode = el.value; render(); return; }
    const st = cur();
    let rerender = commit;
    if (el.dataset.path) {
      let v = readVal(el);
      if (el.dataset.path.startsWith('clim.') || el.dataset.path.startsWith('prices.')) { v = v === '' ? null : v; }
      setPath(st, el.dataset.path, v);
      if (el.dataset.path === 'retrofit' || el.dataset.path.startsWith('tech.') || el.dataset.path === 'loc' || el.dataset.path === 'sub') delete st.example;
    } else if (el.dataset.meta) { App.meta[el.dataset.meta] = el.value; if (commit) { renderHeader(); rerender = false; } }
    else if (el.dataset.actChange === 'type' && commit) { st.type = el.value; st.sub = D.BT[el.value].sub[0][0]; }
    else if (el.dataset.actChange === 'country' && commit) { const l = D.LOCATIONS.find(x => x.cc === el.value); if (l) st.loc = l.id; st.clim = null; st.prices = null; }
    else if (el.dataset.plan) { const p = App.plans.find(x => x.id === el.dataset.plan); if (p) p.type = el.value; rerender = false; }
    else if (el.dataset.model) { App.modelOpts[el.dataset.model] = el.value; rerender = false; }
    else if (el.dataset.elf) {
      const ent = st.elements.find(x => x.id === el.dataset.elf); if (!ent) return;
      const f = el.dataset.f, v = readVal(el);
      if (f === 'con') { if (v === 'custom') { ent.layers = K.clone(K.layersOf(ent)); ent.conn = K.connOf(ent); ent.con = 'custom'; App.open['L' + ent.id] = true; } else { ent.con = v; delete ent.layers; delete ent.conn; } }
      else if (f === 'kind') { ent.kind = v; ent.con = DEF[st.mode === 'existing' ? 'existing' : 'new'][v]; delete ent.layers; ent.az = v === 'AW' ? (ent.az != null ? ent.az : 180) : null; }
      else ent[f] = v === '' ? 0 : v;
      if (['area', 'con', 'existing', 'az', 'kind'].includes(f)) { ent.conf = ent.conf === 'niedrig' || ent.conf === 'mittel' ? 'hoch' : ent.conf; ent.src = ent.src === 'example' ? 'example' : 'manual'; }
      if (f === 'name' && !commit) rerender = false;
    } else if (el.dataset.winf) {
      const w = st.windows.find(x => x.id === el.dataset.winf); if (!w) return;
      const v = readVal(el); w[el.dataset.f] = v === '' ? 0 : v;
      if (el.dataset.f !== 'existing') { w.conf = 'hoch'; w.src = w.src === 'example' ? 'example' : 'manual'; }
    } else if (el.dataset.layer) {
      const ent = st.elements.find(x => x.id === el.dataset.layer); if (!ent) return;
      if (ent.con !== 'custom') { ent.layers = K.clone(K.layersOf(ent)); ent.conn = K.connOf(ent); ent.con = 'custom'; }
      const l = ent.layers[+el.dataset.i]; if (!l) return;
      const f = el.dataset.f, v = readVal(el);
      if (f === 'd') l.d = (v === '' ? 0 : v) / 100; else if (f === 'th') l.th = v; else l.mat = v;
    } else if (el.dataset.measure) {
      const id = el.dataset.measure; st.measures = st.measures || [];
      if (el.checked) { if (!st.measures.includes(id)) st.measures.push(id); } else st.measures = st.measures.filter(x => x !== id);
    } else if (el.dataset.adj) {
      st.adj = Object.assign({ rot: 0, win: { N: 1, E: 1, S: 1, W: 1 }, shade: {} }, st.adj || {});
      const k = el.dataset.adj;
      if (k === 'rot') st.adj.rot = +el.value;
      else if (k.startsWith('win.')) st.adj.win[k.slice(4)] = +el.value;
      else if (k.startsWith('shade.')) { const o = k.slice(6); if (el.value === 'on') st.adj.shade[o] = true; else if (el.value === 'off') st.adj.shade[o] = false; else delete st.adj.shade[o]; }
      if (!commit) { rerender = false; }
    } else if (el.dataset.vname != null) { App.variants[+el.dataset.vname].name = el.value || App.variants[+el.dataset.vname].name; if (!commit) rerender = false; else renderHeader(); }
    else return;
    if (rerender) render();
  }
  root.addEventListener('change', e => onField(e, true));
  root.addEventListener('input', e => { if (e.target.id === 'chatIn') { App.chatDraft = e.target.value; return; } if (e.target.type === 'range' || e.target.tagName === 'TEXTAREA' || e.target.type === 'text') onField(e, false); });

  async function openProjectFile(f) {
    if (!f) return;
    try {
      const o = EX.parseProject(await f.text());
      App.variants = o.variants.slice(0, 3); App.active = Math.min(o.active || 0, App.variants.length - 1);
      App.meta = Object.assign({ project: '', author: '', school: '' }, o.meta || {});
      App.plans = []; App.modelFile = null; App.modelInfo = null; VW.clearModel();
      App.variants.forEach(v => { v.elements.forEach(e => { delete e.parts; }); v.windows.forEach(w => { delete w.parts; }); });
      App.progress = null; App.ai = {}; App.chat = []; App.step = 4;
      toast(t('projectLoaded') + ' · ' + t('modelNotSaved'));
      render();
    } catch (e) { toast(t('openFailed')); }
  }


  // ---------- Fußspur: Abdrücke drehen sich in Laufrichtung (der Zeiger selbst bleibt fest), alle 50 Bildpunkte, max. 5, verblassend ----------
  (function footTrail() {
    if (window.matchMedia && !matchMedia('(pointer: fine)').matches) return; // nur mit Maus
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const SHAPE = "<path d='M15.2 12.4c-3 .4-4.6 2.9-4.3 6 .2 2.1 1.3 3.5 1.2 5.6-.1 3.2.7 6 3.8 6.1 3.2.1 4.6-2.6 4.4-5.9-.1-1.9-.9-3.2-.4-5.1.6-2.3 1.4-3.6.9-5.2-.6-1.8-2.9-1.8-5.6-1.5z'/><ellipse cx='12.5' cy='7.4' rx='2.95' ry='3.35'/><circle cx='17.2' cy='5.7' r='2.25'/><circle cx='20.7' cy='6.8' r='1.95'/><circle cx='23.2' cy='9.1' r='1.65'/><circle cx='24.5' cy='12.1' r='1.4'/>";
    const stepImg = 'url("data:image/svg+xml,' + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><g fill='#1f5a3d' stroke='#1f5a3d' stroke-width='0.9' stroke-linejoin='round'>${SHAPE}</g></svg>`) + '")';
    const STEP = 50, MAX = 5;
    const steps = [];
    let last = null, left = false;
    window.addEventListener('pointermove', e => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      if (App.plainCursor) { last = null; return; } // normaler Zeiger: keine Fußspur
      const p = { x: e.clientX, y: e.clientY };
      if (!last) { last = p; return; }
      const dx = p.x - last.x, dy = p.y - last.y;
      if (Math.hypot(dx, dy) < STEP) return;
      const ang = Math.atan2(dy, dx);
      left = !left;
      const off = (left ? -1 : 1) * 7; // leicht seitlich versetzt, wie beim Gehen
      const x = p.x - Math.sin(ang) * off, y = p.y + Math.cos(ang) * off;
      const el = document.createElement('div');
      el.className = 'foot-step';
      el.setAttribute('aria-hidden', 'true');
      el.style.backgroundImage = stepImg;
      el.style.transform = `translate(${x}px, ${y}px) rotate(${ang * 180 / Math.PI + 90}deg) scaleX(${left ? -1 : 1})`;
      document.body.appendChild(el);
      steps.push(el);
      while (steps.length > MAX) steps.shift().remove();
      el.addEventListener('animationend', () => { el.remove(); const i = steps.indexOf(el); if (i >= 0) steps.splice(i, 1); });
      last = p;
    }, { passive: true });
  })();
  document.documentElement.lang = I.lang;
  App.meta.project = EXAMPLE_NAMES[I.lang === 'en' ? 1 : 0];
  render();
  window.OBC_APP = App; // zur Fehlersuche
  App.debug = { exportCtx, compute, modelToState, render, setModelFile, readModel };
})();
