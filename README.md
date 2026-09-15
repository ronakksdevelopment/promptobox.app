# PromptoBox v1.0.0

**A bento box for prompts.**

Your ideas go in one box. Powerful prompts come out.

PromptoBox is a local-first Progressive Web App that turns plain-language ideas into detailed, professional master prompts using the OpenRouter API. It's built entirely with HTML5, CSS3, and vanilla JavaScript — no framework, no build step, no backend.

---

## Project structure

```
promptobox/
├── index.html          # App shell + all three screens (Generate, Save, Settings)
├── manifest.json        # PWA manifest
├── sw.js                 # Service worker (static asset caching, offline fallback)
├── README.md
├── assets/
│   ├── logo.png           # Official PromptoBox brand logo (source asset)
│   ├── icon-192.png        # 192×192 app icon (derived from logo)
│   ├── icon-512.png        # 512×512 app icon (derived from logo)
│   └── favicon.png          # 64×64 favicon (derived from logo)
├── css/
│   └── styles.css          # All styling: tokens, layout, components, themes
└── js/
    └── app.js              # All application logic, organized by module
```

`js/app.js` is organized into clearly separated modules (each a plain object or set of functions): `Store` (LocalStorage layer), `Toast`, `Nav`, `ThemeManager`, `NetStatus`, `InstallManager`, `OpenRouterAPI`, `GenerateScreen`, `SaveScreen`, `PromptViewer`, `ManualSave`, `EditPrompt`, `ImportExport`, `ImportChoice`, `SettingsScreen`, and `ConfirmDialog`. There is no bundler — everything runs directly as loaded.

---

## Deploying to GitHub Pages

1. Push this folder to a GitHub repository (the contents of `promptobox/`, not a wrapping folder, should be at the repo root or in `/docs`).
2. In the repo, go to **Settings → Pages**, and set the source to the branch/folder containing `index.html`.
3. GitHub Pages serves everything over HTTPS automatically — this is required for the service worker, Clipboard API, and Web Share API to function.
4. No build step is required. The site is ready to serve as static files.

### HTTPS requirement

PWA install prompts, service worker registration, and the Clipboard API only work in a **secure context** (HTTPS or `localhost`). GitHub Pages satisfies this automatically. If you host elsewhere, ensure HTTPS is enabled.

---

## OpenRouter API configuration

PromptoBox uses the OpenRouter chat completions API (`https://openrouter.ai/api/v1/chat/completions`) directly from the browser.

1. Create an account at [openrouter.ai](https://openrouter.ai) and generate an API key.
2. Open PromptoBox → **Settings → OpenRouter API**, paste your key, and tap **Save Key**.
3. Optionally tap **Test connection** to verify the key works.
4. The default model is `openrouter/free`. You can switch to **Custom model…** and enter any OpenRouter model ID (e.g. `anthropic/claude-3.5-sonnet`).

### ⚠️ Client-side API key limitations

Because PromptoBox is a fully static, backend-free app, your API key is stored **only in this browser's LocalStorage** and is sent **directly from your browser to OpenRouter** with each generation request. It is never sent anywhere else.

This means:
- Anyone with access to this browser/device can inspect the key (e.g. via DevTools).
- The key is **not secret** in the way a server-side key would be.
- **Recommended:** create a dedicated OpenRouter key for PromptoBox with a **spending limit** and, if possible, model restrictions, so exposure risk is bounded.

PromptoBox never transmits your key or your LocalStorage data anywhere except the OpenRouter request needed to generate a prompt.

---

## LocalStorage behavior

All data lives in the browser's LocalStorage under keys prefixed `promptobox_`:

| Key | Contents |
|---|---|
| `promptobox_prompts_v1` | Array of saved prompt objects (see schema below) |
| `promptobox_api_key_v1` | OpenRouter API key (plain string) |
| `promptobox_model_v1` | Selected model (`openrouter/free` or `custom`) |
| `promptobox_custom_model_v1` | Custom model ID string |
| `promptobox_gen_params_v1` | Generation parameters (temperature, max_tokens, top_p, etc.) |
| `promptobox_theme_v1` | Theme preference (`light` / `dark` / `system`) |

Nothing is sent to any server except the explicit OpenRouter generation/test-connection requests. There is no analytics, no telemetry, no account system.

**Settings → Clear all local data** permanently removes everything above from this browser. This cannot be undone.

---

## Saved prompt JSON schema

Each saved prompt is an object:

```json
{
  "id": "p_m1a2b3c4_xyz789",
  "title": "Modern coffee shop landing page",
  "prompt": "ROLE\nYou are a senior frontend designer...\n\nOBJECTIVE\n...",
  "preview": "ROLE You are a senior frontend designer...",
  "category": "coding",
  "favorite": false,
  "createdAt": "2026-09-15T10:22:00.000Z",
  "updatedAt": "2026-09-15T10:22:00.000Z",
  "source": "generated"
}
```

- `category` is one of: `general`, `coding`, `image`, `marketing`, `writing`, `business`.
- `source` is `"generated"` or `"manual"`.

### Export

**Save → Export** (or **Settings → Export all**) downloads a JSON file:

```json
{
  "app": "PromptoBox",
  "version": "1.0",
  "exportedAt": "2026-09-15T10:22:00.000Z",
  "prompts": [ /* array of prompt objects */ ]
}
```

### Import

**Save → Import** (or **Settings → Import**) accepts either the export format above, or a bare array of prompt objects. Each entry is validated — a valid entry needs at minimum a non-empty `title` and `prompt` string; anything else is filled in with sensible defaults or rejected. Invalid files show a friendly error and never touch existing data. Imported content is only ever treated as text — nothing is executed or rendered as HTML.

After a valid file is selected, you choose:
- **Merge** — adds new prompts (skipping any with an ID that already exists) alongside your current collection.
- **Replace** — deletes existing prompts and replaces them with the imported set (requires confirmation).

---

## Offline capabilities

- The service worker (`sw.js`) precaches the app shell (HTML, CSS, JS, icons) on first load.
- Once cached, PromptoBox loads and is fully navigable offline: Save and Settings screens, search/filter, manual save, editing, deleting, import, and export all work without a network connection.
- **AI generation requires network access** (it calls OpenRouter directly) — when offline, the Generate button is disabled and a note explains why.
- OpenRouter API responses are **never** cached by the service worker; only static assets are cached.

## Installation behavior

- On supporting browsers, PromptoBox listens for `beforeinstallprompt` and shows a custom **"Install PromptoBox"** banner (never the browser's default install UI as part of the app chrome).
- Dismissing the banner hides it for the session (remembered via LocalStorage).
- Once installed, `display-mode: standalone` is detected and reflected in **Settings → App information → PWA status**.

## Model configuration

- Default: `openrouter/free`, shown as **Current model: openrouter/free** in Settings.
- Switch to **Custom model…** to type any valid OpenRouter model ID.
- Generation parameters (Temperature, Max Tokens, Top P, Frequency Penalty, Presence Penalty) live under **Advanced Generation Settings** and persist locally.

## Basic usage

1. **Generate** — describe what you need in plain language, optionally set type/tone/format/detail, tap **Generate Prompt**.
2. Copy, share, save, or regenerate the result.
3. **Save** — browse your saved prompts as bento cards; search, filter by category, sort, or favorite. Tap **+** to write a prompt manually without using AI.
4. **Settings** — configure your OpenRouter key and model, tune generation parameters, choose a theme, and manage your local data.

---

*PromptoBox is a local-first AI prompt workspace. v1.0 · No account required · No backend · Data stored locally.*
