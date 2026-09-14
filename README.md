# PromptoBox

**Simple ideas. Powerful prompts.**
*A bento box for prompts.*

PromptoBox is a local-first, static, installable Progressive Web App. Describe what you want in plain language and it turns that into a detailed, professional master prompt using the OpenRouter API. There is no backend, no database, and no account system — your ideas go in one box, powerful prompts come out.

---

## ✨ Features

- **Generate** — natural-language input, quick starters, category/tone/format/detail controls, animated "building your prompt" reveal, and a clean monospace result box with Copy / Save / Share / Regenerate.
- **Save** — a personal, searchable, filterable, sortable library of your generated prompts, stored entirely in `localStorage`, with favorites, JSON export, and JSON import.
- **Settings** — OpenRouter API key management (local only), model selection, advanced generation parameters (temperature, max tokens, top‑p, frequency/presence penalty), Light/Dark/System theme, storage tools, and about info.
- **PWA** — installable on desktop and mobile, offline-capable app shell via a service worker, install banner, and offline detection.

---

## 🚀 Deploying to GitHub Pages

1. Create a new GitHub repository (or use an existing one) and push the contents of this folder to the repository root (or to a `/docs` folder if you prefer).
2. In your repository, go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, pick the branch (e.g. `main`) and the folder (`/root` or `/docs`).
4. Save. GitHub will publish the site at `https://<your-username>.github.io/<repo-name>/`.
5. Open the published URL. Because PromptoBox is 100% static files (`index.html`, `manifest.json`, `sw.js`, CSS, JS, and images), no build step or server is required.

> **Note:** The service worker (`sw.js`) uses relative paths (`./`) so it works correctly whether the app is hosted at a domain root or in a sub-path like `/promptobox/`.

---

## 🔑 OpenRouter API Configuration

PromptoBox talks directly to OpenRouter's `chat/completions` endpoint from the browser.

1. Create a free account at [openrouter.ai](https://openrouter.ai) and generate an API key.
2. Open PromptoBox → **Settings** → paste your key into **API Key** → **Save Key**.
3. Optionally tap **Test Connection** to confirm the key works.
4. Choose a **Default Model** (defaults to `openrouter/auto`, which lets OpenRouter route to a suitable free/low-cost model). You can also type any OpenRouter model ID manually.
5. Adjust **Advanced Generation Settings** (temperature, max tokens, top‑p, penalties) if desired.

### ⚠️ Client-side API key limitations

Because PromptoBox is a static, backend-less app, your API key is stored in your browser's `localStorage` and sent **only** to OpenRouter when you generate a prompt. It is **never** sent anywhere else.

However: **a key embedded in client-side JavaScript or stored in browser storage can, in principle, be inspected by anyone with access to that browser** (via devtools, extensions, or the network tab). For this reason:

- Use a key with a **spending/usage limit** configured in your OpenRouter dashboard.
- Don't reuse a key that has access to sensitive organization billing.
- Treat the key as semi-public if you share your device or browser profile.

---

## 💾 LocalStorage behavior

PromptoBox stores everything under a handful of `localStorage` keys, all namespaced with `promptobox_`:

| Key | Purpose |
|---|---|
| `promptobox_prompts_v1` | Your saved prompt library (array of prompt objects) |
| `promptobox_api_key_v1` | Your OpenRouter API key |
| `promptobox_model_v1` | Your selected default model |
| `promptobox_theme_v1` | `light` / `dark` / `system` |
| `promptobox_gen_settings_v1` | Temperature, max tokens, top‑p, penalties |
| `promptobox_install_dismissed_v1` | Whether you dismissed the install banner |

Nothing is ever sent to a remote server except the OpenRouter generation request itself. Clearing your browser data, using a different browser, or using private/incognito mode will not carry your data over — use **Export** first if you want a backup.

---

## 📤 Import / Export format

**Export** (Save page → Export Box, or Settings → Export All Prompts) downloads a JSON file shaped like:

```json
{
  "app": "PromptoBox",
  "version": "1.0.0",
  "exportedAt": "2026-09-15T12:00:00.000Z",
  "prompts": [
    {
      "id": "p_abc123",
      "title": "Cold-Brew Coffee Shop Landing Page Copy",
      "full": "ROLE\nYou are ...",
      "preview": "ROLE You are ...",
      "category": "copy",
      "favorite": false,
      "createdAt": 1737000000000
    }
  ]
}
```

**Import** accepts either that exact shape, or a bare array of prompt objects with at least a `full` (or `text`) field. Invalid JSON, missing fields, or malformed entries are skipped gracefully — valid entries are merged into your existing library without overwriting anything, and duplicate IDs are ignored.

---

## 📴 Offline behavior

- The service worker caches the app shell (HTML, CSS, JS, icons) on first load, so PromptoBox opens and your **Saved Prompts** remain fully browsable offline.
- **Generating new prompts requires an internet connection**, since it calls the live OpenRouter API. If you're offline, the Generate button will show a friendly message instead of failing silently.
- An offline banner appears automatically when your connection drops, and disappears when it's restored.

---

## 🧭 Basic usage

1. **Generate:** Type what you want in plain language (or tap a Quick Starter), optionally tune category/format/tone/detail, then tap **Generate Master Prompt**.
2. **Review:** Watch the prompt build in the monospace result box, then **Copy**, **Save**, **Share**, or **Regenerate**.
3. **Save tab:** Browse, search, filter by category, sort, favorite, view full-screen, or delete any saved prompt. Export or import your whole box as JSON any time.
4. **Settings tab:** Manage your API key, model, generation parameters, theme, and local data.

---

## 🛠 Tech stack

HTML5 · CSS3 (custom properties, no framework) · Vanilla JavaScript (ES2017+, no build step) · PWA (Web App Manifest + Service Worker) · `localStorage` · Clipboard API · Web Share API · File API · [OpenRouter](https://openrouter.ai) Chat Completions API · [Font Awesome](https://fontawesome.com) icons (via CDN).

No Node.js, no Express, no PHP/Python backend, no Firebase/Supabase, no database, no authentication server. 100% static files, deployable anywhere that serves HTML.

---

## 📁 Project structure

```
promptobox/
├── index.html
├── manifest.json
├── sw.js
├── README.md
├── assets/
│   ├── logo.png
│   ├── icon-192.png
│   ├── icon-192-maskable.png
│   ├── icon-512.png
│   ├── icon-512-maskable.png
│   ├── apple-touch-icon.png
│   └── favicon.png
├── css/
│   └── styles.css
└── js/
    └── app.js
```

---

*PromptoBox v1.0 — Your ideas go in one box. Powerful prompts come out.*
