# KI-Vermittler einrichten (Cloudflare Worker)

Damit alle Besucher der Live-Demo die KI nutzen können, ohne einen eigenen Key einzutragen. Der OpenRouter-Key liegt geheim bei Cloudflare und steht nie im Code.

## 1. Cloudflare-Konto anlegen
1. https://dash.cloudflare.com/sign-up öffnen und ein kostenloses Konto anlegen (E-Mail bestätigen).

## 2. Worker anlegen
1. Im Cloudflare-Dashboard links auf **Compute (Workers)** → **Workers & Pages** klicken.
2. **Create** → **Start with Hello World!** → Name: `greenprint-ki` → **Deploy**.
3. **Edit code** klicken, den gesamten Inhalt links löschen und den Inhalt von `worker.js` (dieser Ordner) einfügen.
4. Oben rechts **Deploy** klicken.

## 3. Key als Geheimnis hinterlegen
1. Zurück zum Worker → **Settings** → **Variables and Secrets** → **Add**.
2. Typ: **Secret**, Name: `OPENROUTER_KEY`, Wert: dein OpenRouter-Key → **Deploy**.

## 4. Adresse an die App geben
1. Die Adresse des Workers steht oben, z. B. `https://greenprint-ki.DEINNAME.workers.dev`.
2. Diese Adresse wird in `app/ai-openrouter.js` bei `GROUP_PROXY` eingetragen und hochgeladen.

## Prüfen
Die Worker-Adresse im Browser öffnen. Dort sollte stehen: `{"ok":true, … "key":true}`.

## Schutz
- Nur die Live-Demo (`jade-hs-vibecoding-wpk.github.io`) und `localhost:8765` dürfen den Vermittler nutzen.
- Nur kostenlose Modelle → es entstehen keine Kosten.
- Höchstens 12 Anfragen pro Minute und Besucher. Alle teilen sich das Tageslimit des Keys für kostenlose Modelle.
- Andere Seiten erlauben: unter Variables eine Text-Variable `ALLOWED_ORIGINS` anlegen (Adressen mit Komma getrennt).
