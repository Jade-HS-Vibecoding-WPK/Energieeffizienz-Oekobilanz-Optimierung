/* Greenprint – KI über OpenRouter (eigener API-Key)
   Bildet dieselbe Schnittstelle nach wie claude.use("sample"): sample(input, opts), sample.json(...), sample.limits().
   Der Key liegt nur im Browser (localStorage) und wird nur an openrouter.ai gesendet.
*/
(function () {
  'use strict';
  const API = 'https://openrouter.ai/api/v1';
  // Gruppen-Zugang: Adresse des KI-Vermittlers (Cloudflare Worker, siehe Ordner ki-vermittler/).
  // Ist sie eingetragen, können alle Besucher die KI ohne eigenen Key nutzen (nur kostenlose Modelle).
  // Ein eigener Key in den KI-Einstellungen hat immer Vorrang.
  const GROUP_PROXY = 'https://greenprint-ki.carolin-willenborg.workers.dev';
  const useGroup = () => !cfg.key && !!GROUP_PROXY;
  const KEYS = { key: 'obc_or_key', strong: 'obc_or_model', fast: 'obc_or_model_fast', provider: 'obc_ai_provider' };
  const DEFAULTS = { strong: 'anthropic/claude-opus-5.5', fast: 'anthropic/claude-sonnet-5.5' };
  // Kostenlose Modelle mit Bild-Eingabe (Stand 11/2026)
  const FREE = { strong: 'google/gemma-4-31b-it:free', fast: 'google/gemma-4-26b-a4b-it:free' };
  const MAX_IMAGES = 12, MAX_IMAGES_FREE = 6;
  const isFree = id => /:free$/.test(String(id));
  // Ausweichmodelle, falls ein Gratis-Modell überlastet ist (alle mit Bild-Eingabe)
  const FREE_VISION = ['google/gemma-4-31b-it:free', 'nvidia/nemotron-3.5-super-vl:free', 'google/gemma-4-26b-a4b-it:free'];
  const RETRY_WAIT = [10000, 25000];
  function sleep(ms, signal) {
    return new Promise((res, rej) => {
      const tm = setTimeout(res, ms);
      if (signal) signal.addEventListener('abort', () => { clearTimeout(tm); rej(err('cancelled')); }, { once: true });
    });
  }

  const store = {
    get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
    set(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { /* privat/gesperrt */ } },
  };
  const cfg = {
    get key() { return store.get(KEYS.key); }, set key(v) { store.set(KEYS.key, String(v || '').trim()); },
    get strong() { return store.get(KEYS.strong) || DEFAULTS.strong; }, set strong(v) { store.set(KEYS.strong, v); },
    get fast() { return store.get(KEYS.fast) || DEFAULTS.fast; }, set fast(v) { store.set(KEYS.fast, v); },
    get provider() { return store.get(KEYS.provider) || 'auto'; }, set provider(v) { store.set(KEYS.provider, v); },
  };

  const err = (code, message, text) => Object.assign({ code, message: message || code }, text ? { text } : {});

  // Bild verkleinern und als data-URL (JPEG) einbetten
  async function toDataUrl(blob) {
    let bmp;
    try { bmp = await createImageBitmap(blob); } catch (e) { throw err('image_rejected', 'decode'); }
    const s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  }

  function httpError(status, body) {
    const msg = (body && body.error && body.error.message) || ('HTTP ' + status);
    if (status === 401 || status === 403) return err('invalid_key', msg);
    if (status === 402) return err('no_credits', msg);
    // Gratis-Modelle: Datenschutz-Einstellung bei OpenRouter verhindert die Nutzung
    if (status === 404 && /data policy|privacy|endpoints found/i.test(msg)) return err('data_policy', msg);
    if (status === 429) return err(/per.?day|daily|free-models-per/i.test(msg) ? 'free_limit' : 'rate_limited', msg);
    if (status === 502 || status === 503) return err('rate_limited', msg);
    if (status === 400 && /image|vision|modalit/i.test(msg)) return err('image_rejected', msg);
    return err('upstream_error', msg);
  }

  async function sample(input, opts) {
    opts = opts || {};
    const key = cfg.key, group = useGroup();
    if (!key && !group) throw err('no_key');
    // Gruppen-Zugang: immer die kostenlosen Modelle
    const model = group ? (opts.modelTier === 'complex' ? FREE.strong : FREE.fast) : (opts.modelTier === 'complex' ? cfg.strong : cfg.fast);
    let messages = typeof input === 'string' ? [{ role: 'user', content: input }] : input.map(m => ({ role: m.role, content: m.content }));
    const imgs = opts.images ? Array.from(opts.images).slice(0, isFree(model) ? MAX_IMAGES_FREE : MAX_IMAGES) : [];
    if (imgs.length) {
      const last = messages[messages.length - 1];
      const parts = [{ type: 'text', text: String(last.content) }];
      for (const b of imgs) parts.push({ type: 'image_url', image_url: { url: await toDataUrl(b) } });
      messages = messages.slice(0, -1).concat([{ role: 'user', content: parts }]);
    }
    if (opts.jsonMode) messages.unshift({ role: 'system', content: 'Antworte ausschließlich mit gültigem JSON, ohne Erklärtext und ohne Markdown-Codeblock. / Reply with valid JSON only.' });
    // OpenRouter prüft vorab, ob die maximal mögliche Antwort bezahlbar ist (sonst HTTP 402).
    let maxTokens = opts.jsonMode ? 8000 : 2000;
    // Gratis-Modelle: OpenRouter weicht bei Überlastung automatisch auf die nächsten Modelle der Liste aus
    const fallbacks = isFree(model) ? [model].concat(FREE_VISION.filter(m => m !== model)).slice(0, 3) : null;
    let res, afforded = false, retries = 0;
    for (;;) {
      try {
        const body = { model, messages, stream: true, temperature: opts.jsonMode ? 0.1 : 0.4, max_tokens: maxTokens };
        if (fallbacks) body.models = fallbacks;
        const headers = { 'Content-Type': 'application/json', 'X-Title': 'Greenprint' };
        if (!group) headers.Authorization = 'Bearer ' + key; // beim Gruppen-Zugang hängt der Vermittler den Key an
        res = await fetch((group ? GROUP_PROXY.replace(/\/+$/, '') : API) + '/chat/completions', {
          method: 'POST', signal: opts.signal, headers,
          body: JSON.stringify(body),
        });
      } catch (e) {
        if (e && e.name === 'AbortError') throw err('cancelled');
        throw err('network', String(e && e.message || e));
      }
      if (res.ok) break;
      let b = null; try { b = await res.json(); } catch (e) { /* */ }
      const msg = (b && b.error && b.error.message) || '';
      const afford = /afford\D{0,20}(\d{3,6})/i.exec(msg);
      // Einmal mit der noch bezahlbaren Antwortlänge wiederholen
      if (res.status === 402 && !afforded && afford && +afford[1] >= (opts.jsonMode ? 2500 : 600)) { maxTokens = +afford[1] - 50; afforded = true; continue; }
      // Überlastung (429) oder Anbieterfehler (502/503): kurz warten, dann erneut
      if ([429, 502, 503].includes(res.status) && retries < RETRY_WAIT.length && !/per.?day|daily/i.test(msg)) {
        const wait = RETRY_WAIT[retries++];
        if (opts.onRetry) { try { opts.onRetry({ attempt: retries, waitMs: wait }); } catch (e) { /* */ } }
        await sleep(wait, opts.signal);
        continue;
      }
      throw httpError(res.status, b);
    }
    // Antwort als Stream lesen (Server-Sent Events)
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '', text = '', finish = null;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (!line.startsWith('data:')) continue; // Kommentarzeilen wie ": OPENROUTER PROCESSING"
          const data = line.slice(5).trim();
          if (data === '[DONE]') continue;
          let j; try { j = JSON.parse(data); } catch (e) { continue; }
          if (j.error) throw httpError(j.error.code || 500, j);
          const ch = j.choices && j.choices[0];
          const delta = ch && ch.delta && ch.delta.content;
          if (delta) { text += delta; if (opts.onText) { try { opts.onText({ text, delta }); } catch (e) { /* */ } } }
          if (ch && ch.finish_reason) finish = ch.finish_reason;
        }
      }
    } catch (e) {
      if (e && e.name === 'AbortError') throw err('cancelled', 'cancelled', text);
      if (e && e.code) throw e;
      throw err('upstream_error', String(e && e.message || e), text);
    }
    if (!text.trim()) throw err('empty_completion');
    return { text, truncated: finish === 'length', modelApplied: model };
  }

  function parseJson(text) {
    const t = String(text).trim();
    try { return JSON.parse(t); } catch (e) { /* weiter */ }
    const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
    if (fence) { try { return JSON.parse(fence[1]); } catch (e) { /* weiter */ } }
    const a = Math.min(...['{', '['].map(c => t.indexOf(c)).filter(i => i >= 0));
    const b = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
    if (Number.isFinite(a) && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { /* weiter */ } }
    throw err('invalid_json', 'no JSON', text);
  }
  sample.json = async (input, opts) => {
    const r = await sample(input, Object.assign({}, opts, { jsonMode: true }));
    if (r.truncated) throw err('invalid_json', 'truncated', r.text);
    return parseJson(r.text);
  };
  sample.limits = async () => ({ maxPromptBytes: 262144, images: { maxCount: MAX_IMAGES, maxInputBytes: 20e6, mediaTypes: ['image/jpeg', 'image/png', 'image/webp'] } });

  // Key prüfen: Guthaben / Limit abfragen
  async function checkKey(key) {
    let res;
    try { res = await fetch(API + '/key', { headers: { 'Authorization': 'Bearer ' + (key || cfg.key) } }); }
    catch (e) { throw err('network', String(e && e.message || e)); }
    let b = null; try { b = await res.json(); } catch (e) { /* */ }
    if (!res.ok) throw httpError(res.status, b);
    const d = (b && b.data) || {};
    return { label: d.label || '', usage: d.usage, limit: d.limit, remaining: d.limit_remaining, freeTier: d.is_free_tier };
  }

  // Modelle mit Bild-Eingabe laden (öffentlich, ohne Key)
  async function visionModels() {
    const res = await fetch(API + '/models');
    const b = await res.json();
    return (b.data || []).filter(m => ((m.architecture && m.architecture.input_modalities) || []).includes('image') && !/:batch$/.test(m.id))
      .map(m => ({ id: m.id, name: m.name || m.id, inUsd: +((m.pricing || {}).prompt || 0) * 1e6, outUsd: +((m.pricing || {}).completion || 0) * 1e6 }))
      .map(m => Object.assign(m, { free: isFree(m.id) || (m.inUsd === 0 && m.outUsd === 0) }))
      .filter(m => !/lyria|image-preview$|-image$/i.test(m.id)) // Bild-/Musik-Generatoren ausblenden
      .sort((a, b) => (b.free - a.free) || a.id.localeCompare(b.id));
  }

  // claude.ai blockiert Verbindungen zu fremden Servern
  const inArtifact = () => /claude\.ai$|claudeusercontent|claude\.site/i.test(location.hostname) || !!window.claude;

  window.OBC_OPENROUTER = { sample, cfg, DEFAULTS, FREE, isFree, checkKey, visionModels, inArtifact, get hasKey() { return !!cfg.key || !!GROUP_PROXY; }, get usingGroup() { return useGroup(); }, groupProxy: GROUP_PROXY };
})();
