/* ==========================================================================
   PromptoBox — app.js
   Vanilla JS. No frameworks, no build step.
   ========================================================================== */
'use strict';

/* ============================== Constants ============================== */
const STORAGE_KEYS = {
  PROMPTS: 'promptobox_prompts_v1',
  API_KEY: 'promptobox_api_key_v1',
  MODEL: 'promptobox_model_v1',
  CUSTOM_MODEL: 'promptobox_custom_model_v1',
  GEN_PARAMS: 'promptobox_gen_params_v1',
  THEME: 'promptobox_theme_v1',
  INSTALL_DISMISSED: 'promptobox_install_dismissed_v1',
};

const DEFAULT_MODEL = 'openrouter/free';

const DEFAULT_GEN_PARAMS = {
  temperature: 0.8,
  max_tokens: 1200,
  top_p: 1.0,
  frequency_penalty: 0.0,
  presence_penalty: 0.0,
};

const CATEGORIES = ['general', 'coding', 'image', 'marketing', 'writing', 'business'];

/* ============================== Utilities =============================== */

function uid() {
  return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}

function nowISO() {
  return new Date().toISOString();
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) {
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  } catch (e) {
    return '';
  }
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function makePreview(text, len = 140) {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  return clean.length > len ? clean.slice(0, len).trim() + '…' : clean;
}

function safeSetText(el, text) {
  if (el) el.textContent = text;
}

function setSelectValue(selectEl, value) {
  selectEl.value = value;
  if (selectEl._cselSync) selectEl._cselSync();
}

/* ============================== Storage layer ============================ */

const Store = {
  getPrompts() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PROMPTS);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Failed to read prompts', e);
      return [];
    }
  },
  savePrompts(list) {
    try {
      localStorage.setItem(STORAGE_KEYS.PROMPTS, JSON.stringify(list));
      return true;
    } catch (e) {
      console.error('Failed to save prompts', e);
      if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
        Toast.show('Storage is full. Delete some prompts or export and clear old ones.', 'error', 4200);
      }
      return false;
    }
  },
  addPrompt(prompt) {
    const list = Store.getPrompts();
    list.unshift(prompt);
    return Store.savePrompts(list);
  },
  updatePrompt(id, patch) {
    const list = Store.getPrompts();
    const idx = list.findIndex(p => p.id === id);
    if (idx === -1) return false;
    list[idx] = { ...list[idx], ...patch };
    return Store.savePrompts(list);
  },
  deletePrompt(id) {
    const list = Store.getPrompts().filter(p => p.id !== id);
    return Store.savePrompts(list);
  },
  getById(id) {
    return Store.getPrompts().find(p => p.id === id) || null;
  },

  getApiKey() {
    try { return localStorage.getItem(STORAGE_KEYS.API_KEY) || ''; } catch (e) { return ''; }
  },
  setApiKey(key) {
    try { localStorage.setItem(STORAGE_KEYS.API_KEY, key); return true; } catch (e) { return false; }
  },
  clearApiKey() {
    try { localStorage.removeItem(STORAGE_KEYS.API_KEY); return true; } catch (e) { return false; }
  },

  getModel() {
    try { return localStorage.getItem(STORAGE_KEYS.MODEL) || DEFAULT_MODEL; } catch (e) { return DEFAULT_MODEL; }
  },
  setModel(model) {
    try { localStorage.setItem(STORAGE_KEYS.MODEL, model); } catch (e) {}
  },
  getCustomModel() {
    try { return localStorage.getItem(STORAGE_KEYS.CUSTOM_MODEL) || ''; } catch (e) { return ''; }
  },
  setCustomModel(model) {
    try { localStorage.setItem(STORAGE_KEYS.CUSTOM_MODEL, model); } catch (e) {}
  },

  getGenParams() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.GEN_PARAMS);
      if (!raw) return { ...DEFAULT_GEN_PARAMS };
      return { ...DEFAULT_GEN_PARAMS, ...JSON.parse(raw) };
    } catch (e) {
      return { ...DEFAULT_GEN_PARAMS };
    }
  },
  setGenParams(params) {
    try { localStorage.setItem(STORAGE_KEYS.GEN_PARAMS, JSON.stringify(params)); } catch (e) {}
  },

  getTheme() {
    try { return localStorage.getItem(STORAGE_KEYS.THEME) || 'system'; } catch (e) { return 'system'; }
  },
  setTheme(theme) {
    try { localStorage.setItem(STORAGE_KEYS.THEME, theme); } catch (e) {}
  },

  getStorageUsageKB() {
    try {
      let total = 0;
      for (const key in localStorage) {
        if (Object.prototype.hasOwnProperty.call(localStorage, key) && key.startsWith('promptobox_')) {
          total += (localStorage[key] || '').length;
        }
      }
      return Math.round((total * 2) / 1024 * 10) / 10; // rough UTF-16 byte estimate
    } catch (e) {
      return 0;
    }
  },
};

/* ============================== Toast system ============================= */

const Toast = {
  region: null,
  init() { Toast.region = document.getElementById('toast-region'); },
  show(message, type = 'info', duration = 3200) {
    if (!Toast.region) return;
    const icons = {
      success: 'fa-solid fa-circle-check',
      error: 'fa-solid fa-circle-exclamation',
      info: 'fa-solid fa-circle-info',
    };
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.setAttribute('role', 'status');
    el.innerHTML = `<i class="${icons[type] || icons.info}"></i><span></span>`;
    el.querySelector('span').textContent = message;
    Toast.region.appendChild(el);
    setTimeout(() => {
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 220);
    }, duration);
  },
};

/* ============================== Navigation ================================ */

const Nav = {
  current: 'generate',
  order: ['save', 'generate', 'settings'],
  screens: {},
  navButtons: {},
  init() {
    document.querySelectorAll('.screen').forEach(s => {
      Nav.screens[s.dataset.screen] = s;
    });
    document.querySelectorAll('.bottom-nav__item').forEach(btn => {
      Nav.navButtons[btn.dataset.target] = btn;
      btn.addEventListener('click', () => Nav.go(btn.dataset.target));
    });
    Nav.go('generate', true);
  },
  go(target, silent) {
    if (!Nav.screens[target]) return;
    if (!silent && target !== Nav.current) {
      const fromIdx = Nav.order.indexOf(Nav.current);
      const toIdx = Nav.order.indexOf(target);
      document.body.dataset.navDir = toIdx > fromIdx ? 'right' : 'left';
    }
    Object.entries(Nav.screens).forEach(([key, el]) => {
      el.hidden = key !== target;
    });
    Object.entries(Nav.navButtons).forEach(([key, el]) => {
      const active = key === target;
      el.classList.toggle('is-active', active);
      el.setAttribute('aria-current', active ? 'page' : 'false');
    });
    Nav.current = target;
    if (!silent) {
      Nav.screens[target].scrollIntoView({ block: 'start', behavior: 'instant' in window ? 'instant' : 'auto' });
      window.scrollTo(0, 0);
    }
    if (target === 'save') SaveScreen.render();
    if (target === 'settings') SettingsScreen.refreshInfo();
  },
};

/* ============================== Theme ====================================== */

const ThemeManager = {
  mql: window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null,
  init() {
    const saved = Store.getTheme();
    ThemeManager.apply(saved);
    ThemeManager.updateSegmentedUI(saved);
    document.querySelectorAll('.segmented__btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.dataset.theme;
        Store.setTheme(theme);
        ThemeManager.apply(theme);
        ThemeManager.updateSegmentedUI(theme);
      });
    });
    if (ThemeManager.mql) {
      ThemeManager.mql.addEventListener('change', () => {
        if (Store.getTheme() === 'system') ThemeManager.apply('system');
      });
    }
  },
  apply(theme) {
    let resolved = theme;
    if (theme === 'system') {
      resolved = ThemeManager.mql && ThemeManager.mql.matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', resolved);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', resolved === 'dark' ? '#0F172A' : '#3B82F6');
  },
  updateSegmentedUI(theme) {
    document.querySelectorAll('.segmented__btn').forEach(btn => {
      const active = btn.dataset.theme === theme;
      btn.setAttribute('aria-checked', active ? 'true' : 'false');
    });
  },
};

/* ============================== Network status ============================= */

const NetStatus = {
  pill: null, icon: null,
  init() {
    NetStatus.pill = document.getElementById('netStatusPill');
    NetStatus.icon = document.getElementById('netStatusIcon');
    window.addEventListener('online', NetStatus.update);
    window.addEventListener('offline', NetStatus.update);
    NetStatus.update();
  },
  update() {
    const online = navigator.onLine;
    if (NetStatus.pill) {
      NetStatus.pill.classList.toggle('is-offline', !online);
      NetStatus.pill.setAttribute('aria-label', online ? 'Online' : 'Offline');
    }
    if (NetStatus.icon) {
      NetStatus.icon.className = online ? 'fa-solid fa-wifi' : 'fa-solid fa-wifi-slash';
    }
    const offlineNote = document.getElementById('generateOfflineNote');
    if (offlineNote) offlineNote.hidden = online;
    const genBtn = document.getElementById('generateBtn');
    if (genBtn) {
      genBtn.disabled = !online;
    }
  },
};

/* ============================== Install (PWA) =============================== */

const InstallManager = {
  deferredPrompt: null,
  banner: null,
  init() {
    InstallManager.banner = document.getElementById('installBanner');
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      InstallManager.deferredPrompt = e;
      if (!InstallManager.isStandalone() && localStorage.getItem(STORAGE_KEYS.INSTALL_DISMISSED) !== '1') {
        InstallManager.banner.hidden = false;
      }
    });
    window.addEventListener('appinstalled', () => {
      InstallManager.banner.hidden = true;
      InstallManager.deferredPrompt = null;
      Toast.show('PromptoBox installed. Enjoy!', 'success');
      SettingsScreen.refreshInfo();
    });
    document.getElementById('installBtn').addEventListener('click', async () => {
      if (!InstallManager.deferredPrompt) return;
      InstallManager.deferredPrompt.prompt();
      const { outcome } = await InstallManager.deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        InstallManager.banner.hidden = true;
      }
      InstallManager.deferredPrompt = null;
    });
    document.getElementById('installDismissBtn').addEventListener('click', () => {
      InstallManager.banner.hidden = true;
      localStorage.setItem(STORAGE_KEYS.INSTALL_DISMISSED, '1');
    });
  },
  isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  },
};

/* ============================== OpenRouter API layer ========================= */

const OpenRouterAPI = {
  ENDPOINT: 'https://openrouter.ai/api/v1/chat/completions',

  getActiveModel() {
    const model = Store.getModel();
    if (model === 'custom') {
      return Store.getCustomModel().trim() || DEFAULT_MODEL;
    }
    return model || DEFAULT_MODEL;
  },

  buildSystemPrompt(options) {
    const { category, tone, format, detail } = options;

    let base = `You are PromptoBox's Master Prompt Engine. Transform the user's simple, plain-language idea into a single, highly detailed, professional, directly usable master prompt for an AI system.

Output rules (strict):
- Output ONLY the finished prompt as plain text.
- Do NOT begin with phrases like "Here is your prompt", "Sure,", or any conversational lead-in.
- Do NOT add explanations, commentary, or meta-notes about the prompt.
- Do NOT wrap the output in markdown code fences, quotes, or decorative characters.
- Do NOT ask the user questions; make reasonable, sensible assumptions instead.
- Write in clear, specific, actionable language. Avoid vague filler.
- Use plain text section headers in capital letters (e.g. "ROLE", "OBJECTIVE") only where genuinely useful for this specific request — never force irrelevant sections.
- Keep formatting clean: no excessive blank lines, no decorative separators.`;

    const categoryGuides = {
      coding: 'This is a CODING request. Emphasize: role/persona of the engineer, tech stack, architecture, file/module structure, functional requirements, behavior, edge cases, error handling, testing expectations, and exact output/deliverable format.',
      image: 'This is an IMAGE GENERATION request. Emphasize: subject, composition, environment/setting, lighting, camera angle and lens, artistic style, color palette, mood, aspect ratio, and negative constraints (what to avoid).',
      marketing: 'This is a MARKETING request. Emphasize: target audience, positioning, tone of voice, objective, key messaging, call to action, constraints, and concrete deliverables.',
      writing: 'This is a WRITING request. Emphasize: role/voice, audience, structure, tone, length, key points to cover, and desired output format.',
      business: 'This is a BUSINESS/STRATEGY request. Emphasize: context, objective, stakeholders, constraints, required analysis or deliverable structure, and success criteria.',
      general: 'Adapt the structure intelligently to whatever this request actually needs — do not force a template that does not fit.',
    };

    const toneGuides = {
      professional: 'Written in a polished, professional register.',
      friendly: 'Written in a warm, approachable, friendly register.',
      playful: 'Written in a lively, playful, energetic register.',
      formal: 'Written in a formal, precise register.',
      bold: 'Written in a bold, confident, high-impact register.',
    };

    const formatGuides = {
      structured: 'Structure the output with clear section headers where useful.',
      narrative: 'Write the output as flowing narrative paragraphs rather than heavy section headers.',
      bulleted: 'Favor concise bullet points over long paragraphs wherever it improves clarity.',
    };

    const detailGuides = {
      standard: 'Aim for a balanced, complete level of detail — thorough but not bloated.',
      concise: 'Keep the prompt as tight and concise as possible while remaining complete and usable.',
      thorough: 'Be exhaustive and thorough, covering edge cases, constraints, and quality criteria in depth.',
    };

    base += `\n\n${categoryGuides[category] || categoryGuides.general}`;
    base += `\n${toneGuides[tone] || toneGuides.professional}`;
    base += `\n${formatGuides[format] || formatGuides.structured}`;
    base += `\n${detailGuides[detail] || detailGuides.standard}`;

    return base;
  },

  async generate({ idea, category, tone, format, detail, signal }) {
    const apiKey = Store.getApiKey();
    if (!apiKey) {
      const err = new Error('MISSING_KEY');
      err.code = 'MISSING_KEY';
      throw err;
    }
    if (!navigator.onLine) {
      const err = new Error('OFFLINE');
      err.code = 'OFFLINE';
      throw err;
    }

    const systemPrompt = OpenRouterAPI.buildSystemPrompt({ category, tone, format, detail });
    const params = Store.getGenParams();
    const model = OpenRouterAPI.getActiveModel();

    const body = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: idea },
      ],
      temperature: params.temperature,
      max_tokens: params.max_tokens,
      top_p: params.top_p,
      frequency_penalty: params.frequency_penalty,
      presence_penalty: params.presence_penalty,
    };

    let response;
    try {
      response = await fetch(OpenRouterAPI.ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.href,
          'X-Title': 'PromptoBox',
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (networkErr) {
      const err = new Error('NETWORK_ERROR');
      err.code = 'NETWORK_ERROR';
      throw err;
    }

    if (!response.ok) {
      let code = 'API_ERROR';
      if (response.status === 401 || response.status === 403) code = 'INVALID_KEY';
      else if (response.status === 429) code = 'RATE_LIMIT';
      else if (response.status === 404) code = 'MODEL_UNAVAILABLE';
      else if (response.status >= 500) code = 'SERVER_ERROR';
      const err = new Error(code);
      err.code = code;
      err.status = response.status;
      throw err;
    }

    let data;
    try {
      data = await response.json();
    } catch (parseErr) {
      const err = new Error('MALFORMED_RESPONSE');
      err.code = 'MALFORMED_RESPONSE';
      throw err;
    }

    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content || !content.trim()) {
      const err = new Error('EMPTY_RESPONSE');
      err.code = 'EMPTY_RESPONSE';
      throw err;
    }

    return content.trim();
  },

  async testConnection(apiKey) {
    if (!navigator.onLine) {
      const err = new Error('OFFLINE');
      err.code = 'OFFLINE';
      throw err;
    }
    let response;
    try {
      response = await fetch('https://openrouter.ai/api/v1/key', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
    } catch (e) {
      const err = new Error('NETWORK_ERROR');
      err.code = 'NETWORK_ERROR';
      throw err;
    }
    if (!response.ok) {
      let code = 'API_ERROR';
      if (response.status === 401 || response.status === 403) code = 'INVALID_KEY';
      else if (response.status === 429) code = 'RATE_LIMIT';
      const err = new Error(code);
      err.code = code;
      throw err;
    }
    return true;
  },
};

function friendlyErrorMessage(err) {
  const code = (err && err.code) || 'UNKNOWN';
  const messages = {
    MISSING_KEY: "Generation couldn't start. Add your OpenRouter API key in Settings and try again.",
    OFFLINE: "Generation needs an internet connection. Reconnect and try again.",
    NETWORK_ERROR: "Generation couldn't start. Check your connection and try again.",
    INVALID_KEY: "Generation couldn't start. Check your OpenRouter API key and try again.",
    RATE_LIMIT: "OpenRouter is rate-limiting this key right now. Wait a moment and try again.",
    MODEL_UNAVAILABLE: "That model isn't available right now. Try a different model in Settings.",
    SERVER_ERROR: "OpenRouter is having trouble right now. Please try again shortly.",
    MALFORMED_RESPONSE: "We received an unexpected response. Please try again.",
    EMPTY_RESPONSE: "The model returned an empty response. Please try again.",
    ABORTED: "Generation was cancelled.",
    API_ERROR: "Generation couldn't start. Please try again.",
    UNKNOWN: "Something went wrong while generating. Please try again.",
  };
  return messages[code] || messages.UNKNOWN;
}

/* ============================== Clipboard / Share helpers ==================== */

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    throw new Error('no-clipboard-api');
  } catch (e) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e2) {
      return false;
    }
  }
}

async function sharePrompt(title, text) {
  if (navigator.share) {
    try {
      await navigator.share({ title: title || 'PromptoBox prompt', text });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
      return 'failed';
    }
  }
  const ok = await copyToClipboard(text);
  return ok ? 'copied-fallback' : 'failed';
}

/* ============================== Generate screen ============================== */

const GenerateScreen = {
  lastIdea: null,
  lastOptions: null,
  lastResult: null,
  typingTimer: null,
  abortController: null,

  els: {},

  init() {
    GenerateScreen.els = {
      form: document.getElementById('generateForm'),
      idea: document.getElementById('ideaInput'),
      category: document.getElementById('optCategory'),
      tone: document.getElementById('optTone'),
      format: document.getElementById('optFormat'),
      detail: document.getElementById('optDetail'),
      generateBtn: document.getElementById('generateBtn'),
      generatingBox: document.getElementById('generatingBox'),
      skipBtn: document.getElementById('skipGenAnim'),
      resultBox: document.getElementById('resultBox'),
      resultCodebox: document.getElementById('resultCodebox'),
      errorBox: document.getElementById('generateErrorBox'),
      errorText: document.getElementById('generateErrorText'),
      copyBtn: document.getElementById('copyResultBtn'),
      shareBtn: document.getElementById('shareResultBtn'),
      saveBtn: document.getElementById('saveResultBtn'),
      regenBtn: document.getElementById('regenResultBtn'),
    };

    GenerateScreen.els.form.addEventListener('submit', (e) => {
      e.preventDefault();
      GenerateScreen.runGeneration();
    });
    GenerateScreen.els.skipBtn.addEventListener('click', GenerateScreen.skipAnimation);
    GenerateScreen.els.copyBtn.addEventListener('click', GenerateScreen.handleCopy);
    GenerateScreen.els.shareBtn.addEventListener('click', GenerateScreen.handleShare);
    GenerateScreen.els.saveBtn.addEventListener('click', GenerateScreen.handleSave);
    GenerateScreen.els.regenBtn.addEventListener('click', () => GenerateScreen.runGeneration(true));
  },

  showError(err) {
    GenerateScreen.els.errorText.textContent = friendlyErrorMessage(err);
    GenerateScreen.els.errorBox.hidden = false;
    Toast.show(friendlyErrorMessage(err), 'error');
  },
  hideError() {
    GenerateScreen.els.errorBox.hidden = true;
  },

  async runGeneration(isRegen) {
    const { idea, category, tone, format, detail, generateBtn, generatingBox, resultBox, errorBox } = GenerateScreen.els;

    const ideaText = isRegen && GenerateScreen.lastIdea ? GenerateScreen.lastIdea : idea.value.trim();
    if (!ideaText) {
      idea.focus();
      Toast.show('Tell PromptoBox what you need first.', 'info');
      return;
    }

    const options = isRegen && GenerateScreen.lastOptions ? GenerateScreen.lastOptions : {
      category: category.value,
      tone: tone.value,
      format: format.value,
      detail: detail.value,
    };

    GenerateScreen.hideError();
    resultBox.hidden = true;
    errorBox.hidden = true;
    generatingBox.hidden = false;
    generateBtn.disabled = true;

    if (GenerateScreen.abortController) GenerateScreen.abortController.abort();
    GenerateScreen.abortController = new AbortController();

    try {
      const result = await OpenRouterAPI.generate({
        idea: ideaText,
        ...options,
        signal: GenerateScreen.abortController.signal,
      });
      GenerateScreen.lastIdea = ideaText;
      GenerateScreen.lastOptions = options;
      GenerateScreen.lastResult = result;
      generatingBox.hidden = true;
      GenerateScreen.presentResult(result);
      Toast.show('Master prompt ready.', 'success');
    } catch (err) {
      generatingBox.hidden = true;
      if (err && err.name === 'AbortError') {
        // silent — user triggered a new generation
      } else {
        GenerateScreen.showError(err);
      }
    } finally {
      generateBtn.disabled = !navigator.onLine ? true : false;
    }
  },

  presentResult(text) {
    const { resultBox, resultCodebox } = GenerateScreen.els;
    resultBox.hidden = false;
    resultCodebox.textContent = '';

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      resultCodebox.textContent = text;
      resultBox.scrollIntoView({ behavior: 'auto', block: 'nearest' });
      return;
    }

    clearTimeout(GenerateScreen.typingTimer);
    let i = 0;
    const chunkSize = 3;
    const speedMs = 8;

    function typeChunk() {
      if (i >= text.length) return;
      i = Math.min(i + chunkSize, text.length);
      resultCodebox.textContent = text.slice(0, i);
      GenerateScreen.typingTimer = setTimeout(typeChunk, speedMs);
    }
    typeChunk();
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  skipAnimation() {
    clearTimeout(GenerateScreen.typingTimer);
    if (GenerateScreen.lastResult) {
      GenerateScreen.els.resultCodebox.textContent = GenerateScreen.lastResult;
    }
  },

  getCurrentResultText() {
    return GenerateScreen.els.resultCodebox.textContent || GenerateScreen.lastResult || '';
  },

  async handleCopy() {
    const text = GenerateScreen.getCurrentResultText();
    if (!text) return;
    const ok = await copyToClipboard(text);
    Toast.show(ok ? 'Copied to clipboard.' : 'Could not copy — try selecting the text manually.', ok ? 'success' : 'error');
  },

  async handleShare() {
    const text = GenerateScreen.getCurrentResultText();
    if (!text) return;
    const result = await sharePrompt('PromptoBox prompt', text);
    if (result === 'shared') Toast.show('Shared.', 'success');
    else if (result === 'copied-fallback') Toast.show('Sharing isn\'t supported here — copied instead.', 'info');
    else if (result === 'failed') Toast.show('Could not share this prompt.', 'error');
  },

  handleSave() {
    const text = GenerateScreen.getCurrentResultText();
    if (!text) return;
    const idea = GenerateScreen.lastIdea || '';
    const category = (GenerateScreen.lastOptions && GenerateScreen.lastOptions.category) || 'general';
    const title = idea.length > 60 ? idea.slice(0, 60).trim() + '…' : (idea || 'Generated prompt');

    const prompt = {
      id: uid(),
      title,
      prompt: text,
      preview: makePreview(text),
      category,
      favorite: false,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      source: 'generated',
    };
    const ok = Store.addPrompt(prompt);
    Toast.show(ok ? 'Saved to your prompt box.' : 'Could not save — storage may be full.', ok ? 'success' : 'error');
  },
};

/* ============================== Confirm dialog helper ========================= */

const ConfirmDialog = {
  overlay: null, titleEl: null, bodyEl: null, okBtn: null, cancelBtn: null,
  resolver: null,
  init() {
    ConfirmDialog.overlay = document.getElementById('confirmOverlay');
    ConfirmDialog.titleEl = document.getElementById('confirmTitle');
    ConfirmDialog.bodyEl = document.getElementById('confirmBody');
    ConfirmDialog.okBtn = document.getElementById('confirmOkBtn');
    ConfirmDialog.cancelBtn = document.getElementById('confirmCancelBtn');
    ConfirmDialog.okBtn.addEventListener('click', () => ConfirmDialog.close(true));
    ConfirmDialog.cancelBtn.addEventListener('click', () => ConfirmDialog.close(false));
    ConfirmDialog.overlay.addEventListener('click', (e) => {
      if (e.target === ConfirmDialog.overlay) ConfirmDialog.close(false);
    });
  },
  open(title, body, okLabel) {
    ConfirmDialog.titleEl.textContent = title;
    ConfirmDialog.bodyEl.textContent = body;
    ConfirmDialog.okBtn.textContent = okLabel || 'Confirm';
    ConfirmDialog.overlay.hidden = false;
    ConfirmDialog.okBtn.focus();
    return new Promise((resolve) => { ConfirmDialog.resolver = resolve; });
  },
  close(result) {
    ConfirmDialog.overlay.hidden = true;
    if (ConfirmDialog.resolver) {
      ConfirmDialog.resolver(result);
      ConfirmDialog.resolver = null;
    }
  },
};

/* ============================== Sheet helper (generic open/close) ============= */

function openSheet(overlayEl) {
  overlayEl.hidden = false;
  overlayEl._lastFocused = document.activeElement;
  const focusables = overlayEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (first) first.focus();
  document.addEventListener('keydown', overlayEl._escHandler = (e) => {
    if (e.key === 'Escape') { closeSheet(overlayEl); return; }
    if (e.key === 'Tab' && focusables.length) {
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}
function closeSheet(overlayEl) {
  overlayEl.hidden = true;
  if (overlayEl._escHandler) {
    document.removeEventListener('keydown', overlayEl._escHandler);
    overlayEl._escHandler = null;
  }
  if (overlayEl._lastFocused && overlayEl._lastFocused.focus) overlayEl._lastFocused.focus();
}

/* ============================== Save screen =================================== */

const SaveScreen = {
  els: {},
  activePromptId: null,
  favOnly: false,

  init() {
    SaveScreen.els = {
      grid: document.getElementById('savedGrid'),
      emptyState: document.getElementById('emptyState'),
      noResultsState: document.getElementById('noResultsState'),
      search: document.getElementById('searchInput'),
      filterCategory: document.getElementById('filterCategory'),
      sortOrder: document.getElementById('sortOrder'),
      favOnlyBtn: document.getElementById('favOnlyBtn'),
      addManualBtn: document.getElementById('addManualBtn'),
      exportBtn: document.getElementById('exportBtn'),
      importBtn: document.getElementById('importBtn'),
      importFileInput: document.getElementById('importFileInput'),
    };

    SaveScreen.els.search.addEventListener('input', debounce(() => SaveScreen.render(), 180));
    SaveScreen.els.filterCategory.addEventListener('change', () => SaveScreen.render());
    SaveScreen.els.sortOrder.addEventListener('change', () => SaveScreen.render());
    SaveScreen.els.favOnlyBtn.addEventListener('click', () => {
      SaveScreen.favOnly = !SaveScreen.favOnly;
      SaveScreen.els.favOnlyBtn.setAttribute('aria-pressed', String(SaveScreen.favOnly));
      SaveScreen.render();
    });
    SaveScreen.els.addManualBtn.addEventListener('click', () => ManualSave.open());
    SaveScreen.els.exportBtn.addEventListener('click', ImportExport.exportPrompts);
    SaveScreen.els.importBtn.addEventListener('click', () => SaveScreen.els.importFileInput.click());
    SaveScreen.els.importFileInput.addEventListener('change', ImportExport.handleFileSelect);

    PromptViewer.init();
    ManualSave.init();
    EditPrompt.init();
  },

  getFilteredSorted() {
    let list = Store.getPrompts();
    const q = SaveScreen.els.search.value.trim().toLowerCase();
    const cat = SaveScreen.els.filterCategory.value;
    const sort = SaveScreen.els.sortOrder.value;

    if (q) {
      list = list.filter(p =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.preview || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.prompt || '').toLowerCase().includes(q)
      );
    }
    if (cat !== 'all') {
      list = list.filter(p => p.category === cat);
    }
    if (SaveScreen.favOnly) {
      list = list.filter(p => p.favorite);
    }
    list = [...list].sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return sort === 'oldest' ? ta - tb : tb - ta;
    });
    return list;
  },

  render() {
    const all = Store.getPrompts();
    const filtered = SaveScreen.getFilteredSorted();
    const { grid, emptyState, noResultsState } = SaveScreen.els;

    grid.innerHTML = '';

    if (all.length === 0) {
      emptyState.hidden = false;
      noResultsState.hidden = true;
      grid.hidden = true;
      SettingsScreen.refreshInfo();
      return;
    }
    emptyState.hidden = true;
    grid.hidden = false;

    if (filtered.length === 0) {
      noResultsState.hidden = false;
      SettingsScreen.refreshInfo();
      return;
    }
    noResultsState.hidden = true;

    const frag = document.createDocumentFragment();
    filtered.forEach(p => frag.appendChild(SaveScreen.buildCard(p)));
    grid.appendChild(frag);
    SettingsScreen.refreshInfo();
  },

  buildCard(p) {
    const card = document.createElement('div');
    card.className = 'prompt-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Open prompt: ${p.title}`);

    const top = document.createElement('div');
    top.className = 'prompt-card__top';
    const title = document.createElement('h3');
    title.className = 'prompt-card__title';
    title.textContent = p.title || 'Untitled prompt';
    const favBtn = document.createElement('button');
    favBtn.className = 'prompt-card__fav' + (p.favorite ? ' is-fav' : '');
    favBtn.type = 'button';
    favBtn.setAttribute('aria-label', p.favorite ? 'Remove from favorites' : 'Add to favorites');
    favBtn.innerHTML = `<i class="fa-${p.favorite ? 'solid' : 'regular'} fa-star"></i>`;
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      Store.updatePrompt(p.id, { favorite: !p.favorite });
      SaveScreen.render();
    });
    top.appendChild(title);
    top.appendChild(favBtn);

    const preview = document.createElement('p');
    preview.className = 'prompt-card__preview';
    preview.textContent = p.preview || makePreview(p.prompt);

    const meta = document.createElement('div');
    meta.className = 'prompt-card__meta';
    const catBadge = document.createElement('span');
    catBadge.className = 'category-badge';
    catBadge.textContent = p.category || 'general';
    const date = document.createElement('span');
    date.className = 'prompt-card__date';
    date.textContent = formatDate(p.createdAt);
    meta.appendChild(catBadge);
    meta.appendChild(date);

    const actions = document.createElement('div');
    actions.className = 'prompt-card__actions';
    actions.innerHTML = `
      <button class="icon-btn" type="button" data-action="copy" aria-label="Copy" data-tooltip="Copy"><i class="fa-solid fa-copy"></i></button>
      <button class="icon-btn" type="button" data-action="share" aria-label="Share" data-tooltip="Share"><i class="fa-solid fa-share-nodes"></i></button>
      <button class="icon-btn icon-btn--danger" type="button" data-action="delete" aria-label="Delete" data-tooltip="Delete"><i class="fa-solid fa-trash"></i></button>
    `;
    actions.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      e.stopPropagation();
      const action = btn.dataset.action;
      if (action === 'copy') {
        const ok = await copyToClipboard(p.prompt);
        Toast.show(ok ? 'Copied to clipboard.' : 'Could not copy.', ok ? 'success' : 'error');
      } else if (action === 'share') {
        const result = await sharePrompt(p.title, p.prompt);
        if (result === 'shared') Toast.show('Shared.', 'success');
        else if (result === 'copied-fallback') Toast.show('Sharing isn\'t supported here — copied instead.', 'info');
        else if (result === 'failed') Toast.show('Could not share this prompt.', 'error');
      } else if (action === 'delete') {
        const confirmed = await ConfirmDialog.open('Delete this prompt?', `"${p.title}" will be permanently removed from your prompt box.`, 'Delete');
        if (confirmed) {
          Store.deletePrompt(p.id);
          SaveScreen.render();
          Toast.show('Prompt deleted.', 'success');
        }
      }
    });

    card.appendChild(top);
    card.appendChild(preview);
    card.appendChild(meta);
    card.appendChild(actions);

    const openHandler = () => PromptViewer.open(p.id);
    card.addEventListener('click', openHandler);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openHandler(); }
    });

    return card;
  },
};

/* ============================== Prompt viewer sheet ============================ */

const PromptViewer = {
  els: {},
  currentId: null,
  init() {
    PromptViewer.els = {
      overlay: document.getElementById('promptViewOverlay'),
      title: document.getElementById('promptViewTitle'),
      meta: document.getElementById('promptViewMeta'),
      codebox: document.getElementById('promptViewCodebox'),
      closeBtn: document.getElementById('promptViewCloseBtn'),
      copyBtn: document.getElementById('promptViewCopyBtn'),
      shareBtn: document.getElementById('promptViewShareBtn'),
      favBtn: document.getElementById('promptViewFavBtn'),
      editBtn: document.getElementById('promptViewEditBtn'),
      deleteBtn: document.getElementById('promptViewDeleteBtn'),
    };
    PromptViewer.els.closeBtn.addEventListener('click', () => closeSheet(PromptViewer.els.overlay));
    PromptViewer.els.overlay.addEventListener('click', (e) => {
      if (e.target === PromptViewer.els.overlay) closeSheet(PromptViewer.els.overlay);
    });
    PromptViewer.els.copyBtn.addEventListener('click', async () => {
      const p = Store.getById(PromptViewer.currentId);
      if (!p) return;
      const ok = await copyToClipboard(p.prompt);
      Toast.show(ok ? 'Copied to clipboard.' : 'Could not copy.', ok ? 'success' : 'error');
    });
    PromptViewer.els.shareBtn.addEventListener('click', async () => {
      const p = Store.getById(PromptViewer.currentId);
      if (!p) return;
      const result = await sharePrompt(p.title, p.prompt);
      if (result === 'shared') Toast.show('Shared.', 'success');
      else if (result === 'copied-fallback') Toast.show('Sharing isn\'t supported here — copied instead.', 'info');
      else if (result === 'failed') Toast.show('Could not share this prompt.', 'error');
    });
    PromptViewer.els.favBtn.addEventListener('click', () => {
      const p = Store.getById(PromptViewer.currentId);
      if (!p) return;
      Store.updatePrompt(p.id, { favorite: !p.favorite });
      PromptViewer.refreshFavIcon();
      SaveScreen.render();
    });
    PromptViewer.els.editBtn.addEventListener('click', () => {
      const p = Store.getById(PromptViewer.currentId);
      if (!p) return;
      closeSheet(PromptViewer.els.overlay);
      EditPrompt.open(p.id);
    });
    PromptViewer.els.deleteBtn.addEventListener('click', async () => {
      const p = Store.getById(PromptViewer.currentId);
      if (!p) return;
      const confirmed = await ConfirmDialog.open('Delete this prompt?', `"${p.title}" will be permanently removed from your prompt box.`, 'Delete');
      if (confirmed) {
        Store.deletePrompt(p.id);
        closeSheet(PromptViewer.els.overlay);
        SaveScreen.render();
        Toast.show('Prompt deleted.', 'success');
      }
    });
  },
  refreshFavIcon() {
    const p = Store.getById(PromptViewer.currentId);
    if (!p) return;
    PromptViewer.els.favBtn.innerHTML = `<i class="fa-${p.favorite ? 'solid' : 'regular'} fa-star"></i>`;
    PromptViewer.els.favBtn.classList.toggle('is-active', !!p.favorite);
  },
  open(id) {
    const p = Store.getById(id);
    if (!p) return;
    PromptViewer.currentId = id;
    PromptViewer.els.title.textContent = p.title || 'Untitled prompt';
    PromptViewer.els.codebox.textContent = p.prompt || '';
    PromptViewer.els.meta.innerHTML = `
      <span class="category-badge">${escapeHTML(p.category || 'general')}</span>
      <span class="prompt-card__date">${escapeHTML(formatDate(p.createdAt))}</span>
    `;
    PromptViewer.refreshFavIcon();
    openSheet(PromptViewer.els.overlay);
  },
};

/* ============================== Manual save sheet =============================== */

const ManualSave = {
  els: {},
  favState: false,
  init() {
    ManualSave.els = {
      overlay: document.getElementById('manualSaveOverlay'),
      closeBtn: document.getElementById('manualSaveCloseBtn'),
      cancelBtn: document.getElementById('manualSaveCancelBtn'),
      form: document.getElementById('manualSaveForm'),
      titleInput: document.getElementById('manualTitleInput'),
      promptInput: document.getElementById('manualPromptInput'),
      categorySelect: document.getElementById('manualCategorySelect'),
      favToggle: document.getElementById('manualFavToggle'),
    };
    const close = () => closeSheet(ManualSave.els.overlay);
    ManualSave.els.closeBtn.addEventListener('click', close);
    ManualSave.els.cancelBtn.addEventListener('click', close);
    ManualSave.els.overlay.addEventListener('click', (e) => { if (e.target === ManualSave.els.overlay) close(); });
    ManualSave.els.favToggle.addEventListener('click', () => {
      ManualSave.favState = !ManualSave.favState;
      ManualSave.els.favToggle.setAttribute('aria-checked', String(ManualSave.favState));
    });
    ManualSave.els.form.addEventListener('submit', (e) => {
      e.preventDefault();
      ManualSave.submit();
    });
  },
  open() {
    ManualSave.els.titleInput.value = '';
    ManualSave.els.promptInput.value = '';
    setSelectValue(ManualSave.els.categorySelect, 'general');
    ManualSave.favState = false;
    ManualSave.els.favToggle.setAttribute('aria-checked', 'false');
    openSheet(ManualSave.els.overlay);
    setTimeout(() => ManualSave.els.titleInput.focus(), 60);
  },
  submit() {
    const title = ManualSave.els.titleInput.value.trim();
    const promptText = ManualSave.els.promptInput.value.trim();
    if (!title || !promptText) {
      Toast.show('Add a title and prompt text to save.', 'info');
      return;
    }
    const prompt = {
      id: uid(),
      title,
      prompt: promptText,
      preview: makePreview(promptText),
      category: ManualSave.els.categorySelect.value,
      favorite: ManualSave.favState,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      source: 'manual',
    };
    const ok = Store.addPrompt(prompt);
    closeSheet(ManualSave.els.overlay);
    if (ok) {
      Toast.show('Saved to your prompt box.', 'success');
      SaveScreen.render();
    } else {
      Toast.show('Could not save — storage may be full.', 'error');
    }
  },
};

/* ============================== Edit prompt sheet ================================ */

const EditPrompt = {
  els: {},
  currentId: null,
  favState: false,
  init() {
    EditPrompt.els = {
      overlay: document.getElementById('editPromptOverlay'),
      closeBtn: document.getElementById('editPromptCloseBtn'),
      cancelBtn: document.getElementById('editPromptCancelBtn'),
      form: document.getElementById('editPromptForm'),
      titleInput: document.getElementById('editTitleInput'),
      promptInput: document.getElementById('editPromptInput'),
      categorySelect: document.getElementById('editCategorySelect'),
      favToggle: document.getElementById('editFavToggle'),
    };
    const close = () => closeSheet(EditPrompt.els.overlay);
    EditPrompt.els.closeBtn.addEventListener('click', close);
    EditPrompt.els.cancelBtn.addEventListener('click', close);
    EditPrompt.els.overlay.addEventListener('click', (e) => { if (e.target === EditPrompt.els.overlay) close(); });
    EditPrompt.els.favToggle.addEventListener('click', () => {
      EditPrompt.favState = !EditPrompt.favState;
      EditPrompt.els.favToggle.setAttribute('aria-checked', String(EditPrompt.favState));
    });
    EditPrompt.els.form.addEventListener('submit', (e) => {
      e.preventDefault();
      EditPrompt.submit();
    });
  },
  open(id) {
    const p = Store.getById(id);
    if (!p) return;
    EditPrompt.currentId = id;
    EditPrompt.els.titleInput.value = p.title || '';
    EditPrompt.els.promptInput.value = p.prompt || '';
    setSelectValue(EditPrompt.els.categorySelect, p.category || 'general');
    EditPrompt.favState = !!p.favorite;
    EditPrompt.els.favToggle.setAttribute('aria-checked', String(EditPrompt.favState));
    openSheet(EditPrompt.els.overlay);
  },
  submit() {
    const title = EditPrompt.els.titleInput.value.trim();
    const promptText = EditPrompt.els.promptInput.value.trim();
    if (!title || !promptText) {
      Toast.show('Title and prompt text can\'t be empty.', 'info');
      return;
    }
    const ok = Store.updatePrompt(EditPrompt.currentId, {
      title,
      prompt: promptText,
      preview: makePreview(promptText),
      category: EditPrompt.els.categorySelect.value,
      favorite: EditPrompt.favState,
      updatedAt: nowISO(),
    });
    closeSheet(EditPrompt.els.overlay);
    if (ok) {
      Toast.show('Changes saved.', 'success');
      SaveScreen.render();
    } else {
      Toast.show('Could not save changes.', 'error');
    }
  },
};

/* ============================== Import / Export ================================== */

const ImportExport = {
  pendingImportData: null,

  exportPrompts() {
    const list = Store.getPrompts();
    if (list.length === 0) {
      Toast.show('No prompts to export yet.', 'info');
      return;
    }
    const payload = {
      app: 'PromptoBox',
      version: '1.0',
      exportedAt: nowISO(),
      prompts: list,
    };
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `promptobox-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      Toast.show('Exported prompts as JSON.', 'success');
    } catch (e) {
      Toast.show('Could not export prompts.', 'error');
    }
  },

  handleFileSelect(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const prompts = ImportExport.validateAndNormalize(parsed);
        if (!prompts) {
          Toast.show('That file doesn\'t look like a valid PromptoBox export.', 'error');
          return;
        }
        ImportExport.pendingImportData = prompts;
        ImportChoice.open(prompts.length);
      } catch (err) {
        Toast.show('That file couldn\'t be read as JSON.', 'error');
      }
    };
    reader.onerror = () => Toast.show('Could not read that file.', 'error');
    reader.readAsText(file);
  },

  validateAndNormalize(parsed) {
    let rawList = null;
    if (Array.isArray(parsed)) rawList = parsed;
    else if (parsed && Array.isArray(parsed.prompts)) rawList = parsed.prompts;
    if (!rawList) return null;

    const valid = [];
    for (const item of rawList) {
      if (!item || typeof item !== 'object') continue;
      const title = typeof item.title === 'string' ? item.title.trim() : '';
      const promptText = typeof item.prompt === 'string' ? item.prompt.trim() : '';
      if (!title || !promptText) continue;
      valid.push({
        id: typeof item.id === 'string' ? item.id : uid(),
        title: title.slice(0, 200),
        prompt: promptText,
        preview: typeof item.preview === 'string' ? item.preview : makePreview(promptText),
        category: CATEGORIES.includes(item.category) ? item.category : 'general',
        favorite: !!item.favorite,
        createdAt: item.createdAt && !isNaN(new Date(item.createdAt).getTime()) ? item.createdAt : nowISO(),
        updatedAt: item.updatedAt && !isNaN(new Date(item.updatedAt).getTime()) ? item.updatedAt : nowISO(),
        source: item.source === 'generated' ? 'generated' : 'manual',
      });
    }
    return valid.length > 0 ? valid : null;
  },

  applyImport(mode) {
    const incoming = ImportExport.pendingImportData;
    if (!incoming) return;
    if (mode === 'replace') {
      Store.savePrompts(incoming);
    } else {
      const existing = Store.getPrompts();
      const existingIds = new Set(existing.map(p => p.id));
      const merged = [...incoming.filter(p => !existingIds.has(p.id)), ...existing];
      Store.savePrompts(merged);
    }
    ImportExport.pendingImportData = null;
    SaveScreen.render();
    Toast.show(mode === 'replace' ? 'Prompts replaced.' : 'Prompts merged in.', 'success');
  },
};

const ImportChoice = {
  els: {},
  init() {
    ImportChoice.els = {
      overlay: document.getElementById('importChoiceOverlay'),
      closeBtn: document.getElementById('importChoiceCloseBtn'),
      summary: document.getElementById('importChoiceSummary'),
      mergeBtn: document.getElementById('importMergeBtn'),
      replaceBtn: document.getElementById('importReplaceBtn'),
    };
    const close = () => { ImportExport.pendingImportData = null; closeSheet(ImportChoice.els.overlay); };
    ImportChoice.els.closeBtn.addEventListener('click', close);
    ImportChoice.els.overlay.addEventListener('click', (e) => { if (e.target === ImportChoice.els.overlay) close(); });
    ImportChoice.els.mergeBtn.addEventListener('click', () => {
      ImportExport.applyImport('merge');
      closeSheet(ImportChoice.els.overlay);
    });
    ImportChoice.els.replaceBtn.addEventListener('click', async () => {
      const confirmed = await ConfirmDialog.open('Replace all prompts?', 'This will permanently delete your existing saved prompts and replace them with the imported set.', 'Replace');
      if (confirmed) {
        ImportExport.applyImport('replace');
        closeSheet(ImportChoice.els.overlay);
      }
    });
  },
  open(count) {
    ImportChoice.els.summary.textContent = `Found ${count} valid prompt${count === 1 ? '' : 's'} in this file. How would you like to import them?`;
    openSheet(ImportChoice.els.overlay);
  },
};

/* ============================== Settings screen ==================================== */

const SettingsScreen = {
  els: {},
  keyVisible: false,

  init() {
    SettingsScreen.els = {
      apiKeyInput: document.getElementById('apiKeyInput'),
      toggleKeyVisibility: document.getElementById('toggleKeyVisibility'),
      saveKeyBtn: document.getElementById('saveKeyBtn'),
      clearKeyBtn: document.getElementById('clearKeyBtn'),
      testKeyBtn: document.getElementById('testKeyBtn'),
      keyStatusText: document.getElementById('keyStatusText'),
      apiStatusPill: document.getElementById('apiStatusPill'),
      apiStatusDot: document.getElementById('apiStatusDot'),
      apiStatusLabel: document.getElementById('apiStatusLabel'),

      modelSelect: document.getElementById('modelSelect'),
      customModelGroup: document.getElementById('customModelGroup'),
      customModelInput: document.getElementById('customModelInput'),
      currentModelText: document.getElementById('currentModelText'),

      advancedToggle: document.getElementById('advancedToggle'),
      advancedPanel: document.getElementById('advancedPanel'),
      tempRange: document.getElementById('tempRange'),
      tempVal: document.getElementById('tempVal'),
      maxTokensRange: document.getElementById('maxTokensRange'),
      maxTokensVal: document.getElementById('maxTokensVal'),
      topPRange: document.getElementById('topPRange'),
      topPVal: document.getElementById('topPVal'),
      freqPenaltyRange: document.getElementById('freqPenaltyRange'),
      freqPenaltyVal: document.getElementById('freqPenaltyVal'),
      presPenaltyRange: document.getElementById('presPenaltyRange'),
      presPenaltyVal: document.getElementById('presPenaltyVal'),

      pwaStatusText: document.getElementById('pwaStatusText'),
      storageUsageText: document.getElementById('storageUsageText'),
      savedCountText: document.getElementById('savedCountText'),
      exportAllBtn: document.getElementById('exportAllBtn'),
      importAllBtn: document.getElementById('importAllBtn'),
      clearAllDataBtn: document.getElementById('clearAllDataBtn'),
    };

    SettingsScreen.loadApiKeyState();
    SettingsScreen.loadModelState();
    SettingsScreen.loadGenParamsState();
    SettingsScreen.refreshInfo();
    SettingsScreen.bindEvents();
  },

  bindEvents() {
    const e = SettingsScreen.els;

    e.toggleKeyVisibility.addEventListener('click', () => {
      SettingsScreen.keyVisible = !SettingsScreen.keyVisible;
      e.apiKeyInput.type = SettingsScreen.keyVisible ? 'text' : 'password';
      e.toggleKeyVisibility.innerHTML = `<i class="fa-solid fa-eye${SettingsScreen.keyVisible ? '-slash' : ''}"></i>`;
    });

    e.saveKeyBtn.addEventListener('click', () => {
      const key = e.apiKeyInput.value.trim();
      if (!key) {
        Toast.show('Enter an API key to save.', 'info');
        return;
      }
      Store.setApiKey(key);
      SettingsScreen.loadApiKeyState();
      Toast.show('API key saved locally.', 'success');
    });

    e.clearKeyBtn.addEventListener('click', async () => {
      if (!Store.getApiKey()) { Toast.show('No API key is set.', 'info'); return; }
      const confirmed = await ConfirmDialog.open('Clear API key?', 'You will need to re-enter your OpenRouter API key to generate new prompts.', 'Clear key');
      if (confirmed) {
        Store.clearApiKey();
        e.apiKeyInput.value = '';
        SettingsScreen.loadApiKeyState();
        Toast.show('API key cleared.', 'success');
      }
    });

    e.testKeyBtn.addEventListener('click', async () => {
      const key = (e.apiKeyInput.value.trim()) || Store.getApiKey();
      if (!key) {
        Toast.show('Enter an API key first.', 'info');
        return;
      }
      e.testKeyBtn.disabled = true;
      e.keyStatusText.textContent = 'Testing connection…';
      e.keyStatusText.className = 'key-status';
      try {
        await OpenRouterAPI.testConnection(key);
        e.keyStatusText.textContent = 'Connection successful. Your key is working.';
        e.keyStatusText.className = 'key-status is-ok';
        Toast.show('OpenRouter connection successful.', 'success');
      } catch (err) {
        const msg = friendlyErrorMessage(err);
        e.keyStatusText.textContent = msg;
        e.keyStatusText.className = 'key-status is-error';
        Toast.show(msg, 'error');
      } finally {
        e.testKeyBtn.disabled = false;
      }
    });

    e.modelSelect.addEventListener('change', () => {
      Store.setModel(e.modelSelect.value);
      SettingsScreen.loadModelState();
    });
    e.customModelInput.addEventListener('input', debounce(() => {
      Store.setCustomModel(e.customModelInput.value.trim());
      SettingsScreen.updateCurrentModelText();
    }, 300));

    e.advancedToggle.addEventListener('click', () => {
      const expanded = e.advancedToggle.getAttribute('aria-expanded') === 'true';
      e.advancedToggle.setAttribute('aria-expanded', String(!expanded));
      e.advancedPanel.hidden = expanded;
    });

    const rangeBindings = [
      [e.tempRange, e.tempVal, 'temperature', v => v.toFixed(1)],
      [e.maxTokensRange, e.maxTokensVal, 'max_tokens', v => Math.round(v)],
      [e.topPRange, e.topPVal, 'top_p', v => v.toFixed(2)],
      [e.freqPenaltyRange, e.freqPenaltyVal, 'frequency_penalty', v => v.toFixed(1)],
      [e.presPenaltyRange, e.presPenaltyVal, 'presence_penalty', v => v.toFixed(1)],
    ];
    rangeBindings.forEach(([rangeEl, labelEl, key, fmt]) => {
      rangeEl.addEventListener('input', () => {
        const val = parseFloat(rangeEl.value);
        labelEl.textContent = fmt(val);
        const params = Store.getGenParams();
        params[key] = val;
        Store.setGenParams(params);
      });
    });

    e.exportAllBtn.addEventListener('click', ImportExport.exportPrompts);
    e.importAllBtn.addEventListener('click', () => document.getElementById('importFileInput').click());

    e.clearAllDataBtn.addEventListener('click', async () => {
      const confirmed = await ConfirmDialog.open(
        'Clear all local data?',
        'This permanently deletes all saved prompts, your API key, and your settings from this browser. This cannot be undone.',
        'Clear everything'
      );
      if (confirmed) {
        try {
          Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
          Toast.show('All local data cleared.', 'success');
          SettingsScreen.loadApiKeyState();
          SettingsScreen.loadModelState();
          SettingsScreen.loadGenParamsState();
          SaveScreen.render();
          SettingsScreen.refreshInfo();
        } catch (err) {
          Toast.show('Could not clear all data.', 'error');
        }
      }
    });

    e.apiStatusPill.addEventListener('click', () => Nav.go('settings'));
  },

  loadApiKeyState() {
    const key = Store.getApiKey();
    const e = SettingsScreen.els;
    e.apiKeyInput.value = key;
    if (key) {
      e.keyStatusText.textContent = 'API key configured. Ready to generate.';
      e.keyStatusText.className = 'key-status is-ok';
      e.apiStatusDot.classList.add('is-on');
      e.apiStatusLabel.textContent = 'Ready';
    } else {
      e.keyStatusText.textContent = 'No API key configured.';
      e.keyStatusText.className = 'key-status';
      e.apiStatusDot.classList.remove('is-on');
      e.apiStatusLabel.textContent = 'No key';
    }
  },

  loadModelState() {
    const model = Store.getModel();
    const e = SettingsScreen.els;
    setSelectValue(e.modelSelect, model === 'custom' ? 'custom' : DEFAULT_MODEL);
    e.customModelGroup.hidden = e.modelSelect.value !== 'custom';
    e.customModelInput.value = Store.getCustomModel();
    SettingsScreen.updateCurrentModelText();
  },

  updateCurrentModelText() {
    SettingsScreen.els.currentModelText.textContent = `Current model: ${OpenRouterAPI.getActiveModel()}`;
  },

  loadGenParamsState() {
    const p = Store.getGenParams();
    const e = SettingsScreen.els;
    e.tempRange.value = p.temperature; e.tempVal.textContent = p.temperature.toFixed(1);
    e.maxTokensRange.value = p.max_tokens; e.maxTokensVal.textContent = Math.round(p.max_tokens);
    e.topPRange.value = p.top_p; e.topPVal.textContent = p.top_p.toFixed(2);
    e.freqPenaltyRange.value = p.frequency_penalty; e.freqPenaltyVal.textContent = p.frequency_penalty.toFixed(1);
    e.presPenaltyRange.value = p.presence_penalty; e.presPenaltyVal.textContent = p.presence_penalty.toFixed(1);
  },

  refreshInfo() {
    const e = SettingsScreen.els;
    if (!e.pwaStatusText) return;
    e.pwaStatusText.textContent = InstallManager.isStandalone() ? 'Installed' : 'Not installed';
    e.storageUsageText.textContent = `${Store.getStorageUsageKB()} KB`;
    e.savedCountText.textContent = String(Store.getPrompts().length);
  },
};

/* ============================== Service worker registration ======================== */

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {
        // Fail silently — app still works fully without offline caching.
      });
    });
  }
}

/* ============================== Custom select enhancement ============================ */

const CustomSelect = {
  init() {
    document.querySelectorAll('.select-wrap select').forEach(CustomSelect.enhance);
    document.addEventListener('click', (e) => {
      document.querySelectorAll('.csel.is-open').forEach(csel => {
        if (!csel.contains(e.target)) CustomSelect.close(csel);
      });
    });
  },
  enhance(selectEl) {
    const wrap = selectEl.closest('.select-wrap');
    if (!wrap) return;
    const oldIcon = wrap.querySelector('.select-wrap__icon');
    if (oldIcon) oldIcon.remove();

    const csel = document.createElement('div');
    csel.className = 'csel';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'csel__btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    if (selectEl.id) btn.setAttribute('aria-label', selectEl.getAttribute('aria-label') || '');

    const label = document.createElement('span');
    label.className = 'csel__label';
    const chevron = document.createElement('i');
    chevron.className = 'fa-solid fa-chevron-down';
    btn.appendChild(label);
    btn.appendChild(chevron);

    const panel = document.createElement('div');
    panel.className = 'csel__panel';
    panel.setAttribute('role', 'listbox');
    panel.hidden = true;

    function buildOptions() {
      panel.innerHTML = '';
      Array.from(selectEl.options).forEach(opt => {
        const optBtn = document.createElement('button');
        optBtn.type = 'button';
        optBtn.className = 'csel__opt' + (opt.value === selectEl.value ? ' is-selected' : '');
        optBtn.setAttribute('role', 'option');
        optBtn.dataset.value = opt.value;
        optBtn.innerHTML = `<span>${escapeHTML(opt.textContent)}</span><i class="fa-solid fa-check"></i>`;
        optBtn.addEventListener('click', () => {
          selectEl.value = opt.value;
          selectEl.dispatchEvent(new Event('change', { bubbles: true }));
          syncLabel();
          CustomSelect.close(csel);
          btn.focus();
        });
        panel.appendChild(optBtn);
      });
    }

    function syncLabel() {
      const selected = selectEl.options[selectEl.selectedIndex];
      label.textContent = selected ? selected.textContent : '';
      panel.querySelectorAll('.csel__opt').forEach(o => {
        o.classList.toggle('is-selected', o.dataset.value === selectEl.value);
      });
    }

    btn.addEventListener('click', () => {
      const isOpen = csel.classList.contains('is-open');
      document.querySelectorAll('.csel.is-open').forEach(c => CustomSelect.close(c));
      if (!isOpen) CustomSelect.open(csel);
    });

    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        CustomSelect.open(csel);
        const first = panel.querySelector('.csel__opt');
        if (first) first.focus();
      }
    });

    panel.addEventListener('keydown', (e) => {
      const opts = Array.from(panel.querySelectorAll('.csel__opt'));
      const idx = opts.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); (opts[idx + 1] || opts[0]).focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); (opts[idx - 1] || opts[opts.length - 1]).focus(); }
      else if (e.key === 'Escape') { CustomSelect.close(csel); btn.focus(); }
      else if (e.key === 'Tab') { CustomSelect.close(csel); }
    });

    buildOptions();
    syncLabel();

    csel.appendChild(btn);
    csel.appendChild(panel);
    wrap.appendChild(csel);
    selectEl._cselSync = syncLabel;


  },
  open(csel) {
    csel.classList.add('is-open');
    csel.querySelector('.csel__btn').setAttribute('aria-expanded', 'true');
    csel.querySelector('.csel__panel').hidden = false;
  },
  close(csel) {
    csel.classList.remove('is-open');
    csel.querySelector('.csel__btn').setAttribute('aria-expanded', 'false');
    csel.querySelector('.csel__panel').hidden = true;
  },
};

/* ============================== App bootstrap ======================================= */

function initApp() {
  Toast.init();
  ThemeManager.init();
  NetStatus.init();
  InstallManager.init();
  ConfirmDialog.init();
  ImportChoice.init();
  Nav.init();
  GenerateScreen.init();
  SaveScreen.init();
  SettingsScreen.init();
  CustomSelect.init();
  registerServiceWorker();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
