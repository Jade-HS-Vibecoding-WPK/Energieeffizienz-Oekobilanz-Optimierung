/* Greenprint – KI-Vermittler (Cloudflare Worker)
 *
 * Wozu? Die Live-Demo auf GitHub Pages ist öffentlich und hat keinen eigenen Server. Ein OpenRouter-Key
 * im App-Code wäre für alle sichtbar. Dieser kleine Dienst bewahrt den Key geheim auf („Secret“ bei
 * Cloudflare) und leitet KI-Anfragen der App an OpenRouter weiter.
 *
 * Schutz:
 *  - nimmt nur Anfragen von den erlaubten Seiten an (ALLOWED_ORIGINS)
 *  - erlaubt nur kostenlose Modelle (Endung „:free“) → es können keine Kosten entstehen
 *  - begrenzt Antwortlänge und Anfragen pro Minute und Besucher
 *
 * Einstellungen bei Cloudflare (Worker → Settings → Variables and Secrets):
 *  - OPENROUTER_KEY   (Typ „Secret“)  dein OpenRouter-API-Key  – wird nie angezeigt oder weitergegeben
 *  - ALLOWED_ORIGINS  (Typ „Text“, optional) erlaubte Seiten, mit Komma getrennt
 */

const DEFAULT_ORIGINS = 'https://jade-hs-vibecoding-wpk.github.io,http://localhost:8765';
const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_BODY = 8 * 1024 * 1024; // 8 MB (Pläne als Bilder)
const MAX_TOKENS = 8000;
const PER_MINUTE = 12; // Anfragen je Besucher und Minute (grober Schutz)
const hits = new Map();

const isFree = m => typeof m === 'string' && /:free$/.test(m);

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Title',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}
function json(status, obj, origin) {
  return new Response(JSON.stringify(obj), { status, headers: Object.assign({ 'Content-Type': 'application/json' }, origin ? cors(origin) : {}) });
}
const fail = (status, message, origin) => json(status, { error: { code: status, message } }, origin);

export default {
  async fetch(request, env) {
    const allowed = String(env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(',').map(s => s.trim()).filter(Boolean);
    const origin = request.headers.get('Origin') || '';
    const ok = allowed.includes(origin);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { status: ok ? 204 : 403, headers: ok ? cors(origin) : {} });
    if (request.method === 'GET') return json(200, { ok: true, service: 'Greenprint KI-Vermittler', key: !!env.OPENROUTER_KEY }, ok ? origin : null);
    if (!ok) return fail(403, 'Diese Seite darf den Greenprint-KI-Zugang nicht nutzen.', null);
    if (request.method !== 'POST' || !/\/chat\/completions\/?$/.test(url.pathname)) return fail(404, 'Unbekannte Adresse', origin);
    if (!env.OPENROUTER_KEY) return fail(500, 'Im Vermittler ist noch kein OpenRouter-Key hinterlegt.', origin);

    // grobe Begrenzung je Besucher (pro Worker-Instanz)
    const ip = request.headers.get('CF-Connecting-IP') || 'x';
    const now = Date.now(), win = 60000;
    const list = (hits.get(ip) || []).filter(t => now - t < win);
    if (list.length >= PER_MINUTE) return fail(429, 'Zu viele Anfragen – bitte eine Minute warten.', origin);
    list.push(now); hits.set(ip, list);
    if (hits.size > 5000) hits.clear();

    const len = +(request.headers.get('Content-Length') || 0);
    if (len > MAX_BODY) return fail(413, 'Anfrage zu groß (zu viele oder zu große Bilder).', origin);
    let body;
    try { body = await request.json(); } catch (e) { return fail(400, 'Ungültige Anfrage', origin); }

    // nur kostenlose Modelle zulassen
    if (!isFree(body.model)) return fail(400, 'Über den Gruppen-Zugang sind nur kostenlose Modelle erlaubt.', origin);
    if (Array.isArray(body.models)) body.models = body.models.filter(isFree).slice(0, 3);
    body.max_tokens = Math.min(+body.max_tokens || 2000, MAX_TOKENS);

    const up = await fetch(OPENROUTER, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + env.OPENROUTER_KEY,
        'Content-Type': 'application/json',
        'X-Title': 'Greenprint (Gruppen-Zugang)',
        'HTTP-Referer': origin,
      },
      body: JSON.stringify(body),
    });
    // Antwort (auch als Stream) unverändert zurückgeben, nur mit CORS-Kopfzeilen
    const headers = new Headers(cors(origin));
    const ct = up.headers.get('Content-Type'); if (ct) headers.set('Content-Type', ct);
    headers.set('Cache-Control', 'no-store');
    return new Response(up.body, { status: up.status, headers });
  },
};
