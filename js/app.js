/* =========================================================
   PromptoBox — app.js
   Vanilla JS. No frameworks, no backend.
   ========================================================= */
(function () {
  "use strict";

  /* ---------------- Constants ---------------- */
  const LS_KEYS = {
    PROMPTS: "promptobox_prompts_v1",
    API_KEY: "promptobox_api_key_v1",
    MODEL: "promptobox_model_v1",
    THEME: "promptobox_theme_v1",
    GEN_SETTINGS: "promptobox_gen_settings_v1",
    INSTALL_DISMISSED: "promptobox_install_dismissed_v1",
  };

  const DEFAULT_GEN_SETTINGS = {
    temperature: 0.7,
    maxTokens: 2048,
    topP: 1.0,
    freqPenalty: 0.0,
    presPenalty: 0.0,
  };

  const CATEGORY_LABELS = {
    coding: "Coding",
    copy: "Copy",
    creative: "Creative",
    analysis: "Analysis",
    general: "General",
    custom: "Custom",
  };

  /* ---------------- State ---------------- */
  const state = {
    category: "coding",
    format: "markdown",
    currentResult: null, // { full, category, wordCount, charCount }
    deferredInstallPrompt: null,
    savedSort: "newest",
    savedCategoryFilter: "all",
    searchQuery: "",
    typingAbort: false,
  };

  /* ---------------- Utilities ---------------- */
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $all = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function safeText(node, text) {
    node.textContent = text;
  }

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      showToast("Storage is full or unavailable. Free up space and try again.", "error");
      return false;
    }
  }

  function uid() {
    return "p_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function wordCount(str) {
    const t = (str || "").trim();
    if (!t) return 0;
    return t.split(/\s+/).length;
  }

  function bytesOf(str) {
    return new Blob([str]).size;
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

  function debounce(fn, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  /* ---------------- Toasts ---------------- */
  function showToast(message, type) {
    const region = $("#toastRegion");
    if (!region) return;
    const toast = document.createElement("div");
    toast.className = "toast" + (type === "error" ? " toast-error" : type === "success" ? " toast-success" : "");
    const icon = document.createElement("i");
    icon.className =
      type === "error" ? "fa-solid fa-circle-exclamation" :
      type === "success" ? "fa-solid fa-circle-check" :
      "fa-solid fa-circle-info";
    icon.setAttribute("aria-hidden", "true");
    const span = document.createElement("span");
    span.textContent = message;
    toast.appendChild(icon);
    toast.appendChild(span);
    region.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("leaving");
      setTimeout(() => toast.remove(), 200);
    }, 3200);
  }

  /* ---------------- Navigation ---------------- */
  function switchView(target) {
    $all(".view").forEach((v) => {
      v.hidden = v.dataset.view !== target;
    });
    $all(".nav-item").forEach((btn) => {
      const active = btn.dataset.target === target;
      btn.classList.toggle("is-active", active);
      if (active) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
    if (target === "save") {
      renderSavedPrompts();
    }
    if (target === "settings") {
      refreshSettingsStats();
    }
  }

  function initNav() {
    $all(".nav-item").forEach((btn) => {
      btn.addEventListener("click", () => switchView(btn.dataset.target));
    });
    const emptyGenBtn = $("#emptyGenerateBtn");
    if (emptyGenBtn) emptyGenBtn.addEventListener("click", () => switchView("generate"));
  }

  /* ---------------- Theme ---------------- */
  function applyTheme(theme) {
    let resolved = theme;
    if (theme === "system") {
      resolved = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }
    if (resolved === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    $all(".theme-btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.theme === theme);
    });
    const label = $("#currentThemeLabel");
    if (label) {
      const displayMap = { light: "Light", dark: "Dark", system: "System (" + (resolved === "light" ? "Light" : "Dark") + ")" };
      label.textContent = displayMap[theme] || "Dark";
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute("content", resolved === "light" ? "#F4F6FB" : "#0F172A");
  }

  function initTheme() {
    const saved = localStorage.getItem(LS_KEYS.THEME) || "dark";
    applyTheme(saved);
    $all(".theme-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        localStorage.setItem(LS_KEYS.THEME, btn.dataset.theme);
        applyTheme(btn.dataset.theme);
      });
    });
    const headerToggle = $("#themeToggleBtn");
    if (headerToggle) {
      headerToggle.addEventListener("click", () => {
        const current = localStorage.getItem(LS_KEYS.THEME) || "dark";
        const isLight = document.documentElement.getAttribute("data-theme") === "light";
        const next = isLight ? "dark" : "light";
        localStorage.setItem(LS_KEYS.THEME, next);
        applyTheme(next);
      });
    }
    if (window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
        if ((localStorage.getItem(LS_KEYS.THEME) || "dark") === "system") applyTheme("system");
      });
    }
  }

  /* ---------------- API Key / Settings persistence ---------------- */
  function getApiKey() {
    return localStorage.getItem(LS_KEYS.API_KEY) || "";
  }

  function getModel() {
    return localStorage.getItem(LS_KEYS.MODEL) || "openrouter/free";
  }

  function getGenSettings() {
    return Object.assign({}, DEFAULT_GEN_SETTINGS, readJSON(LS_KEYS.GEN_SETTINGS, {}));
  }

  function updateApiStatusUI() {
    const hasKey = !!getApiKey();
    const dot = $("#apiStatusDot");
    const label = $("#apiStatusLabel");
    const keyStatusBadge = $("#keyStatusBadge");
    if (dot) dot.classList.toggle("is-ready", hasKey);
    if (label) label.textContent = hasKey ? "Key Set" : "No Key";
    if (keyStatusBadge) {
      keyStatusBadge.textContent = hasKey ? "KEY CONFIGURED" : "NO KEY CONFIGURED";
      keyStatusBadge.classList.toggle("badge-mint", hasKey);
    }
  }

  function initSettings() {
    // API key field
    const apiKeyInput = $("#apiKeyInput");
    apiKeyInput.value = getApiKey();

    $("#toggleKeyVisibilityBtn").addEventListener("click", () => {
      const icon = $("#toggleKeyVisibilityBtn i");
      if (apiKeyInput.type === "password") {
        apiKeyInput.type = "text";
        icon.className = "fa-solid fa-eye-slash";
      } else {
        apiKeyInput.type = "password";
        icon.className = "fa-solid fa-eye";
      }
    });

    $("#saveKeyBtn").addEventListener("click", () => {
      const val = apiKeyInput.value.trim();
      if (!val) {
        showToast("Enter an API key before saving.", "error");
        return;
      }
      localStorage.setItem(LS_KEYS.API_KEY, val);
      updateApiStatusUI();
      showToast("API key saved locally.", "success");
    });

    $("#clearKeyBtn").addEventListener("click", () => {
      localStorage.removeItem(LS_KEYS.API_KEY);
      apiKeyInput.value = "";
      updateApiStatusUI();
      const diag = $("#diagnosticsBox");
      diag.textContent = "Click Test Connection to check latency and model availability.";
      diag.className = "diagnostics-box";
      showToast("API key cleared.");
    });

    // Model select
    const modelSelect = $("#modelSelect");
    const customModelInput = $("#customModelInput");
    const savedModel = getModel();
    const knownValues = Array.from(modelSelect.options).map((o) => o.value);
    if (knownValues.includes(savedModel)) {
      modelSelect.value = savedModel;
    } else {
      modelSelect.value = "custom";
      customModelInput.hidden = false;
      customModelInput.value = savedModel;
    }
    modelSelect.addEventListener("change", () => {
      if (modelSelect.value === "custom") {
        customModelInput.hidden = false;
        customModelInput.focus();
      } else {
        customModelInput.hidden = true;
        localStorage.setItem(LS_KEYS.MODEL, modelSelect.value);
        showToast("Default model updated.");
      }
    });
    customModelInput.addEventListener(
      "input",
      debounce(() => {
        const v = customModelInput.value.trim();
        if (v) localStorage.setItem(LS_KEYS.MODEL, v);
      }, 400)
    );

    // Test connection
    $("#testConnectionBtn").addEventListener("click", testConnection);

    // Advanced settings
    initAdvancedSettings();

    updateApiStatusUI();
  }

  function initAdvancedSettings() {
    const toggle = $("#advancedToggle");
    const panel = $("#advancedPanel");
    const chevron = $("#advancedChevron");
    toggle.addEventListener("click", () => {
      const isOpen = !panel.hidden;
      panel.hidden = isOpen;
      toggle.setAttribute("aria-expanded", String(!isOpen));
      chevron.classList.toggle("is-open", !isOpen);
    });

    const settings = getGenSettings();
    const sliderMap = [
      ["temperatureInput", "temperatureValue", "temperature", (v) => v.toFixed(1)],
      ["maxTokensInput", "maxTokensValue", "maxTokens", (v) => String(v)],
      ["topPInput", "topPValue", "topP", (v) => v.toFixed(2)],
      ["freqPenaltyInput", "freqPenaltyValue", "freqPenalty", (v) => v.toFixed(1)],
      ["presPenaltyInput", "presPenaltyValue", "presPenalty", (v) => v.toFixed(1)],
    ];

    sliderMap.forEach(([inputId, valueId, key, fmt]) => {
      const input = $("#" + inputId);
      const valueEl = $("#" + valueId);
      input.value = settings[key];
      valueEl.textContent = fmt(parseFloat(settings[key]));
      input.addEventListener("input", () => {
        valueEl.textContent = fmt(parseFloat(input.value));
        const current = getGenSettings();
        current[key] = parseFloat(input.value);
        writeJSON(LS_KEYS.GEN_SETTINGS, current);
      });
    });

    $("#resetAdvancedBtn").addEventListener("click", () => {
      writeJSON(LS_KEYS.GEN_SETTINGS, DEFAULT_GEN_SETTINGS);
      sliderMap.forEach(([inputId, valueId, key, fmt]) => {
        $("#" + inputId).value = DEFAULT_GEN_SETTINGS[key];
        $("#" + valueId).textContent = fmt(DEFAULT_GEN_SETTINGS[key]);
      });
      showToast("Advanced settings reset to defaults.");
    });
  }

  async function testConnection() {
    const diag = $("#diagnosticsBox");
    const apiKey = getApiKey();
    if (!apiKey) {
      diag.textContent = "No API key configured. Add one above first.";
      diag.className = "diagnostics-box is-error";
      return;
    }
    diag.textContent = "Testing connection…";
    diag.className = "diagnostics-box";
    const start = performance.now();
    try {
      const res = await fetch("https://openrouter.ai/api/v1/key", {
        method: "GET",
        headers: { Authorization: "Bearer " + apiKey },
      });
      const elapsed = Math.round(performance.now() - start);
      if (res.ok) {
        diag.textContent = "Connected · " + elapsed + "ms latency · Key is valid.";
        diag.className = "diagnostics-box is-success";
      } else if (res.status === 401) {
        diag.textContent = "Invalid API key (401 Unauthorized).";
        diag.className = "diagnostics-box is-error";
      } else {
        diag.textContent = "Connection responded with status " + res.status + ".";
        diag.className = "diagnostics-box is-error";
      }
    } catch (e) {
      diag.textContent = navigator.onLine
        ? "Could not reach OpenRouter. Check the key and try again."
        : "You appear to be offline.";
      diag.className = "diagnostics-box is-error";
    }
  }

  /* ---------------- Generate view: input handling ---------------- */
  function initGenerateInputs() {
    const promptInput = $("#promptInput");
    const charCount = $("#inputCharCount");

    promptInput.addEventListener("input", () => {
      charCount.textContent = promptInput.value.length + " chars";
    });

    $("#clearInputBtn").addEventListener("click", () => {
      promptInput.value = "";
      charCount.textContent = "0 chars";
      promptInput.focus();
    });

    $all(".starter-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        promptInput.value = chip.dataset.prompt;
        charCount.textContent = promptInput.value.length + " chars";
        promptInput.focus();
      });
    });

    $all("#categoryChips .option-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $all("#categoryChips .option-chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        state.category = chip.dataset.value;
      });
    });

    $all("#formatChips .option-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $all("#formatChips .option-chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        state.format = chip.dataset.value;
      });
    });

    $("#generateBtn").addEventListener("click", handleGenerateClick);
    $("#errorRetryBtn").addEventListener("click", handleGenerateClick);
    $("#regenerateBtn").addEventListener("click", handleGenerateClick);
    $("#skipTypingBtn").addEventListener("click", () => {
      state.typingAbort = true;
    });
  }

  /* ---------------- System prompt builder ---------------- */
  function buildSystemPrompt(category, format, tone, detail) {
    return [
      "You are PromptoBox's Master Prompt Engine. Transform the user's simple, plain-language explanation into a single, highly detailed, professional, directly usable master prompt for an AI model.",
      "",
      "Hard rules:",
      "- Output ONLY the final master prompt itself. No preamble, no \"Here is your prompt\", no meta-commentary, no closing remarks.",
      "- Do not wrap the output in markdown code fences unless the user's request is specifically for a code file that needs fencing.",
      "- Write in plain, cleanly formatted text using clear section headers only where they genuinely help (e.g. short ALL-CAPS or Title Case headers followed by content). Do not force every section below into every prompt — adapt intelligently to the actual request.",
      "- Avoid unnecessary blank lines, avoid excess paragraph spacing, avoid filler language.",
      "- Be specific, actionable, structured, complete, and immediately usable by another AI model or a human executing the task.",
      "",
      "Adaptive structure guidance (use only what applies):",
      "- General/software/product requests: ROLE, OBJECTIVE, CONTEXT, REQUIREMENTS, TARGET AUDIENCE, FUNCTIONAL REQUIREMENTS, VISUAL REQUIREMENTS, TECHNICAL REQUIREMENTS, CONSTRAINTS, INPUTS, OUTPUT FORMAT, QUALITY CRITERIA, EDGE CASES, VALIDATION, DELIVERABLES.",
      "- Image/visual generation requests: emphasize subject, composition, environment, lighting, camera/lens, style/medium, color palette, aspect ratio, and negative constraints (what to avoid).",
      "- Coding/engineering requests: emphasize role/persona, tech stack, architecture, functional requirements, file/module structure, expected behavior, edge cases, testing expectations, and output/deliverable requirements.",
      "- Marketing/copywriting requests: emphasize target audience, positioning, tone of voice, objective, key messaging, call-to-action, constraints, and deliverables.",
      "",
      "User-selected preferences to honor:",
      "- Category: " + (CATEGORY_LABELS[category] || category),
      "- Preferred output format for the FINAL deliverable described by the prompt: " + format,
      "- Tone of the master prompt's instructions: " + tone,
      "- Detail level: " + detail + " (concise = tight and minimal, deep = thorough and well-structured, exhaustive = maximally comprehensive covering edge cases and validation).",
      "",
      "Remember: the user is not a prompt engineer. They gave you a simple idea. Your entire job is to produce the polished, professional master prompt — not to talk about it.",
    ].join("\n");
  }

  const TONE_LABELS = {
    expert: "Expert & Precise",
    friendly: "Friendly & Clear",
    formal: "Formal & Corporate",
    playful: "Playful & Bold",
  };
  const DETAIL_LABELS = {
    concise: "Concise & Direct",
    deep: "Deep & Comprehensive",
    exhaustive: "Exhaustive",
  };

  /* ---------------- Generation flow ---------------- */
  async function handleGenerateClick() {
    const promptInput = $("#promptInput");
    const rawText = promptInput.value.trim();

    hideAll(["errorCard", "resultCard"]);

    if (!rawText) {
      showToast("Describe what you need before generating.", "error");
      promptInput.focus();
      return;
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      showGenerationError("No API key found. Add your OpenRouter API key in Settings, then try again.");
      return;
    }

    if (!navigator.onLine) {
      showGenerationError("You're offline. Connect to the internet to generate a prompt.");
      return;
    }

    const tone = $("#toneSelect").value;
    const detail = $("#detailSelect").value;
    const category = state.category;
    const format = state.format;

    setGeneratingUI(true);

    const model = resolveModel();
    const genSettings = getGenSettings();
    const systemPrompt = buildSystemPrompt(category, format, TONE_LABELS[tone], DETAIL_LABELS[detail]);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + apiKey,
          "HTTP-Referer": window.location.href,
          "X-Title": "PromptoBox",
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: rawText },
          ],
          temperature: genSettings.temperature,
          max_tokens: genSettings.maxTokens,
          top_p: genSettings.topP,
          frequency_penalty: genSettings.freqPenalty,
          presence_penalty: genSettings.presPenalty,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      let finalRes = res;
      if (res.status === 429) {
        $("#generatingSub").textContent = "Rate limited — retrying…";
        await new Promise((r) => setTimeout(r, 1500));
        try {
          finalRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + apiKey,
              "HTTP-Referer": window.location.href,
              "X-Title": "PromptoBox",
            },
            body: JSON.stringify({
              model: model,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: rawText },
              ],
              temperature: genSettings.temperature,
              max_tokens: genSettings.maxTokens,
              top_p: genSettings.topP,
              frequency_penalty: genSettings.freqPenalty,
              presence_penalty: genSettings.presPenalty,
            }),
          });
        } catch (e) {
          finalRes = res;
        }
      }

      if (!finalRes.ok) {
        let msg = "Generation couldn't start. Check your OpenRouter API key and try again.";
        if (finalRes.status === 401) msg = "Your API key was rejected. Double-check it in Settings.";
        else if (finalRes.status === 402) msg = "OpenRouter reports insufficient credits for this key.";
        else if (finalRes.status === 429) msg = "Rate limit reached. Wait a moment and try again.";
        else if (finalRes.status === 404) msg = "The selected model isn't available. Choose a different model in Settings.";
        else if (finalRes.status >= 500) msg = "OpenRouter is having issues right now. Please try again shortly.";
        setGeneratingUI(false);
        showGenerationError(msg);
        return;
      }

      const data = await finalRes.json();
      const content =
        data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;

      if (!content || !content.trim()) {
        setGeneratingUI(false);
        showGenerationError("The model returned an empty response. Try again or choose a different model.");
        return;
      }

      const cleaned = cleanGeneratedText(content);
      setGeneratingUI(false);
      await revealResult(cleaned, category);
    } catch (err) {
      setGeneratingUI(false);
      if (err && err.name === "AbortError") {
        showGenerationError("The request timed out. Try again, or reduce Max Tokens in Settings.");
      } else {
        showGenerationError("Generation couldn't start. Check your OpenRouter API key and try again.");
      }
    }
  }

  function resolveModel() {
    const modelSelect = $("#modelSelect");
    if (modelSelect.value === "custom") {
      const custom = $("#customModelInput").value.trim();
      return custom || "openrouter/free";
    }
    return modelSelect.value;
  }

  function cleanGeneratedText(text) {
    let t = text.trim();
    // Strip a single leading/trailing markdown fence if the whole thing is wrapped
    const fenceMatch = t.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/);
    if (fenceMatch) t = fenceMatch[1].trim();
    // Collapse 3+ blank lines into 1 blank line
    t = t.replace(/\n{3,}/g, "\n\n");
    return t;
  }

  function setGeneratingUI(isGenerating) {
    const card = $("#generatingCard");
    const btn = $("#generateBtn");
    card.hidden = !isGenerating;
    btn.disabled = isGenerating;
    btn.style.opacity = isGenerating ? "0.7" : "1";
    if (isGenerating) {
      $("#generatingSub").textContent = "Talking to the model…";
      card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function showGenerationError(message) {
    const card = $("#errorCard");
    card.hidden = false;
    $("#errorMessage").textContent = message;
    card.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function hideAll(ids) {
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    });
  }

  /* ---------------- Typing animation + result reveal ---------------- */
  async function revealResult(fullText, category) {
    const resultCard = $("#resultCard");
    const output = $("#masterPromptOutput");
    const badge = $("#resultCategoryBadge");
    const skipBtn = $("#skipTypingBtn");

    resultCard.hidden = false;
    badge.textContent = (CATEGORY_LABELS[category] || category).toUpperCase();
    output.textContent = "";
    output.classList.add("typing-cursor");
    resultCard.scrollIntoView({ behavior: "smooth", block: "start" });

    state.currentResult = {
      full: fullText,
      category: category,
      wordCount: wordCount(fullText),
      charCount: fullText.length,
    };

    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      output.textContent = fullText;
      output.classList.remove("typing-cursor");
      updateResultMeta(fullText);
      return;
    }

    state.typingAbort = false;
    skipBtn.hidden = false;

    const chunkSize = 3;
    let i = 0;
    await new Promise((resolve) => {
      function step() {
        if (state.typingAbort) {
          output.textContent = fullText;
          finish();
          return;
        }
        i += chunkSize;
        output.textContent = fullText.slice(0, i);
        if (i < fullText.length) {
          requestAnimationFrame(() => setTimeout(step, 8));
        } else {
          finish();
        }
      }
      function finish() {
        output.classList.remove("typing-cursor");
        skipBtn.hidden = true;
        updateResultMeta(fullText);
        resolve();
      }
      step();
    });
  }

  function updateResultMeta(text) {
    $("#resultWordCount").textContent = wordCount(text) + " words";
    $("#resultCharCount").textContent = text.length + " characters";
  }

  /* ---------------- Result actions: copy / save / share ---------------- */
  function initResultActions() {
    $("#copyBtn").addEventListener("click", async () => {
      if (!state.currentResult) return;
      await copyToClipboard(state.currentResult.full);
    });

    $("#saveResultBtn").addEventListener("click", () => {
      if (!state.currentResult) return;
      savePromptToStorage(state.currentResult.full, state.currentResult.category);
    });

    $("#shareBtn").addEventListener("click", async () => {
      if (!state.currentResult) return;
      await sharePrompt(state.currentResult.full);
    });
  }

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      showToast("Copied to clipboard!", "success");
      return true;
    } catch (e) {
      showToast("Couldn't copy automatically. Select and copy the text manually.", "error");
      return false;
    }
  }

  async function sharePrompt(text) {
    if (navigator.share) {
      try {
        await navigator.share({ title: "PromptoBox Master Prompt", text: text });
        showToast("Shared successfully!", "success");
      } catch (e) {
        if (e && e.name !== "AbortError") {
          const ok = await copyToClipboard(text);
          if (ok) showToast("Share unavailable — copied instead.", "success");
        }
      }
    } else {
      const ok = await copyToClipboard(text);
      if (ok) showToast("Sharing isn't supported here — copied instead.", "success");
    }
  }

  /* ---------------- Saved prompts storage ---------------- */
  function getSavedPrompts() {
    return readJSON(LS_KEYS.PROMPTS, []);
  }

  function setSavedPrompts(list) {
    return writeJSON(LS_KEYS.PROMPTS, list);
  }

  function titleFromText(text) {
    const firstLine = text.split("\n").find((l) => l.trim().length > 0) || "Untitled Prompt";
    const cleaned = firstLine.replace(/^#+\s*/, "").replace(/[*_`]/g, "").trim();
    return cleaned.length > 60 ? cleaned.slice(0, 60) + "…" : cleaned || "Untitled Prompt";
  }

  function savePromptToStorage(fullText, category) {
    const list = getSavedPrompts();
    const item = {
      id: uid(),
      title: titleFromText(fullText),
      full: fullText,
      preview: fullText.replace(/\n+/g, " ").slice(0, 140),
      category: category || "general",
      favorite: false,
      createdAt: Date.now(),
    };
    list.unshift(item);
    if (setSavedPrompts(list)) {
      showToast("Saved to your Bento Box!", "success");
      renderRecentSaved();
      if ($("#view-save") && !$("#view-save").hidden) renderSavedPrompts();
    }
  }

  function deletePrompt(id) {
    const list = getSavedPrompts().filter((p) => p.id !== id);
    setSavedPrompts(list);
    renderSavedPrompts();
    renderRecentSaved();
    showToast("Prompt deleted.");
  }

  function toggleFavorite(id) {
    const list = getSavedPrompts();
    const item = list.find((p) => p.id === id);
    if (item) {
      item.favorite = !item.favorite;
      setSavedPrompts(list);
      renderSavedPrompts();
    }
  }

  /* ---------------- Recently saved (on Generate page) ---------------- */
  function renderRecentSaved() {
    const list = getSavedPrompts().slice(0, 3);
    const container = $("#recentSavedList");
    const badge = $("#recentCountBadge");
    const total = getSavedPrompts().length;
    badge.textContent = total + " saved";
    container.innerHTML = "";
    if (list.length === 0) {
      const empty = document.createElement("p");
      empty.className = "recent-empty";
      empty.textContent = "No prompts saved yet. Generate one above and tap Save.";
      container.appendChild(empty);
      return;
    }
    list.forEach((item) => {
      const row = document.createElement("div");
      row.className = "recent-item";
      const left = document.createElement("div");
      const title = document.createElement("div");
      title.className = "recent-item-title";
      title.textContent = item.title;
      const meta = document.createElement("div");
      meta.className = "recent-item-meta";
      meta.textContent = (CATEGORY_LABELS[item.category] || item.category) + " · " + timeAgo(item.createdAt);
      left.appendChild(title);
      left.appendChild(meta);
      const openBtn = document.createElement("button");
      openBtn.className = "icon-action";
      openBtn.setAttribute("aria-label", "View prompt");
      openBtn.innerHTML = '<i class="fa-solid fa-arrow-up-right-from-square"></i>';
      openBtn.addEventListener("click", () => openPromptModal(item.id));
      row.appendChild(left);
      row.appendChild(openBtn);
      container.appendChild(row);
    });
  }

  function timeAgo(ts) {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + "m ago";
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + "h ago";
    const days = Math.floor(hrs / 24);
    if (days === 1) return "Yesterday";
    if (days < 7) return days + "d ago";
    return new Date(ts).toLocaleDateString();
  }

  /* ---------------- Saved Prompts view ---------------- */
  function renderCategoryFilterChips() {
    const container = $("#categoryFilterChips");
    const list = getSavedPrompts();
    const counts = {};
    list.forEach((p) => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    const cats = ["all", ...Object.keys(CATEGORY_LABELS)];
    container.innerHTML = "";
    cats.forEach((cat) => {
      if (cat !== "all" && !counts[cat]) return;
      const btn = document.createElement("button");
      btn.className = "option-chip" + (state.savedCategoryFilter === cat ? " is-active" : "");
      btn.type = "button";
      const label = cat === "all" ? "All Prompts" : CATEGORY_LABELS[cat];
      const count = cat === "all" ? list.length : counts[cat] || 0;
      btn.textContent = label + " (" + count + ")";
      btn.addEventListener("click", () => {
        state.savedCategoryFilter = cat;
        state.savedRenderLimit = null;
        renderSavedPrompts();
      });
      container.appendChild(btn);
    });
  }

  function renderSavedPrompts() {
    renderCategoryFilterChips();
    let list = getSavedPrompts();

    // Filter by category
    if (state.savedCategoryFilter !== "all") {
      list = list.filter((p) => p.category === state.savedCategoryFilter);
    }
    // Filter by favorites via sort mode
    if (state.savedSort === "favs") {
      list = list.filter((p) => p.favorite);
    }
    // Search
    const q = state.searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.full.toLowerCase().includes(q) ||
          (CATEGORY_LABELS[p.category] || "").toLowerCase().includes(q)
      );
    }
    // Sort
    if (state.savedSort === "oldest") {
      list = list.slice().sort((a, b) => a.createdAt - b.createdAt);
    } else {
      list = list.slice().sort((a, b) => b.createdAt - a.createdAt);
    }

    const container = $("#savedPromptsList");
    const emptyState = $("#emptyState");
    container.innerHTML = "";

    const totalSaved = getSavedPrompts().length;
    emptyState.hidden = totalSaved !== 0;
    container.hidden = totalSaved === 0;

    if (totalSaved === 0) {
      updateStatsUI();
      return;
    }

    if (list.length === 0) {
      const noMatch = document.createElement("p");
      noMatch.className = "recent-empty";
      noMatch.textContent = "No prompts match your filters.";
      container.appendChild(noMatch);
    }

    const RENDER_LIMIT = 60;
    const visible = list.slice(0, state.savedRenderLimit || RENDER_LIMIT);
    visible.forEach((item) => {
      container.appendChild(buildSavedCard(item));
    });

    if (list.length > visible.length) {
      const moreBtn = document.createElement("button");
      moreBtn.className = "btn btn-secondary";
      moreBtn.type = "button";
      moreBtn.style.width = "100%";
      moreBtn.textContent = "Load more (" + (list.length - visible.length) + " remaining)";
      moreBtn.addEventListener("click", () => {
        state.savedRenderLimit = (state.savedRenderLimit || RENDER_LIMIT) + RENDER_LIMIT;
        renderSavedPrompts();
      });
      container.appendChild(moreBtn);
    }

    updateStatsUI();
  }

  function buildSavedCard(item) {
    const card = document.createElement("article");
    card.className = "saved-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", "Open " + item.title);

    const top = document.createElement("div");
    top.className = "saved-card-top";

    const badges = document.createElement("div");
    badges.className = "saved-card-badges";
    const catBadge = document.createElement("span");
    catBadge.className = "cat-badge cat-" + (item.category || "general");
    catBadge.textContent = (CATEGORY_LABELS[item.category] || item.category || "General").toUpperCase();
    const favBtn = document.createElement("button");
    favBtn.className = "fav-star" + (item.favorite ? " is-fav" : "");
    favBtn.type = "button";
    favBtn.setAttribute("aria-label", item.favorite ? "Remove from favorites" : "Add to favorites");
    favBtn.innerHTML = item.favorite ? '<i class="fa-solid fa-star"></i>' : '<i class="fa-regular fa-star"></i>';
    favBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavorite(item.id);
    });
    badges.appendChild(catBadge);
    badges.appendChild(favBtn);

    const actions = document.createElement("div");
    actions.className = "saved-card-actions";
    actions.appendChild(makeIconAction("fa-copy", "Copy prompt", (e) => {
      e.stopPropagation();
      copyToClipboard(item.full);
    }));
    actions.appendChild(makeIconAction("fa-share-nodes", "Share prompt", (e) => {
      e.stopPropagation();
      sharePrompt(item.full);
    }));
    actions.appendChild(makeIconAction("fa-trash", "Delete prompt", (e) => {
      e.stopPropagation();
      deletePrompt(item.id);
    }, true));

    top.appendChild(badges);
    top.appendChild(actions);

    const title = document.createElement("h3");
    title.className = "saved-card-title";
    title.textContent = item.title;

    const preview = document.createElement("div");
    preview.className = "saved-card-preview";
    preview.textContent = item.preview;

    const date = document.createElement("div");
    date.className = "saved-card-date";
    date.textContent = timeAgo(item.createdAt) + " · " + wordCount(item.full) + " words";

    card.appendChild(top);
    card.appendChild(title);
    card.appendChild(preview);
    card.appendChild(date);

    card.addEventListener("click", () => openPromptModal(item.id));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openPromptModal(item.id);
      }
    });

    return card;
  }

  function makeIconAction(iconClass, label, handler, danger) {
    const btn = document.createElement("button");
    btn.className = "icon-action" + (danger ? " icon-action-danger" : "");
    btn.type = "button";
    btn.setAttribute("aria-label", label);
    btn.innerHTML = '<i class="fa-solid ' + iconClass + '"></i>';
    btn.addEventListener("click", handler);
    return btn;
  }

  function updateStatsUI() {
    const list = getSavedPrompts();
    const raw = localStorage.getItem(LS_KEYS.PROMPTS) || "[]";
    const size = bytesOf(raw);
    $("#statCount").textContent = String(list.length);
    $("#statSize").textContent = formatBytes(size);
  }

  function refreshSettingsStats() {
    const list = getSavedPrompts();
    let totalUsed = 0;
    try {
      for (const key in localStorage) {
        if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
          totalUsed += bytesOf(localStorage.getItem(key) || "");
        }
      }
    } catch (e) {}
    $("#settingsStatCount").textContent = String(list.length);
    $("#settingsStatSize").textContent = formatBytes(totalUsed) + " / 5.0 MB";
  }

  /* ---------------- Prompt detail modal ---------------- */
  let modalCurrentId = null;

  function openPromptModal(id) {
    const item = getSavedPrompts().find((p) => p.id === id);
    if (!item) return;
    modalCurrentId = id;
    $("#promptModalTitle").textContent = item.title;
    $("#promptModalBody").textContent = item.full;
    const favBtn = $("#modalFavBtn");
    favBtn.innerHTML = item.favorite ? '<i class="fa-solid fa-star"></i>' : '<i class="fa-regular fa-star"></i>';
    favBtn.classList.toggle("is-favorited", !!item.favorite);
    $("#promptModalOverlay").hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closePromptModal() {
    $("#promptModalOverlay").hidden = true;
    modalCurrentId = null;
    document.body.style.overflow = "";
  }

  function initModal() {
    $("#promptModalCloseBtn").addEventListener("click", closePromptModal);
    $("#promptModalOverlay").addEventListener("click", (e) => {
      if (e.target === $("#promptModalOverlay")) closePromptModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !$("#promptModalOverlay").hidden) closePromptModal();
    });
    $("#modalCopyBtn").addEventListener("click", () => {
      const item = getSavedPrompts().find((p) => p.id === modalCurrentId);
      if (item) copyToClipboard(item.full);
    });
    $("#modalShareBtn").addEventListener("click", () => {
      const item = getSavedPrompts().find((p) => p.id === modalCurrentId);
      if (item) sharePrompt(item.full);
    });
    $("#modalFavBtn").addEventListener("click", () => {
      if (modalCurrentId) {
        toggleFavorite(modalCurrentId);
        const item = getSavedPrompts().find((p) => p.id === modalCurrentId);
        if (item) {
          const favBtn = $("#modalFavBtn");
          favBtn.innerHTML = item.favorite ? '<i class="fa-solid fa-star"></i>' : '<i class="fa-regular fa-star"></i>';
        }
      }
    });
    $("#modalDeleteBtn").addEventListener("click", () => {
      if (modalCurrentId) {
        deletePrompt(modalCurrentId);
        closePromptModal();
      }
    });
  }

  /* ---------------- Search & sort ---------------- */
  function initSavedControls() {
    $("#searchInput").addEventListener(
      "input",
      debounce((e) => {
        state.searchQuery = e.target.value;
        state.savedRenderLimit = null;
        renderSavedPrompts();
      }, 200)
    );

    $all(".sort-row .option-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        $all(".sort-row .option-chip").forEach((c) => c.classList.remove("is-active"));
        btn.classList.add("is-active");
        state.savedSort = btn.dataset.sort;
        state.savedRenderLimit = null;
        renderSavedPrompts();
      });
    });
  }

  /* ---------------- Import / Export ---------------- */
  function exportPrompts() {
    const list = getSavedPrompts();
    const payload = {
      app: "PromptoBox",
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      prompts: list,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "promptobox-export-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Exported " + list.length + " prompts.", "success");
  }

  function validateImportedPayload(data) {
    let prompts = null;
    if (Array.isArray(data)) {
      prompts = data;
    } else if (data && Array.isArray(data.prompts)) {
      prompts = data.prompts;
    }
    if (!prompts) return null;

    const cleaned = [];
    for (const raw of prompts) {
      if (!raw || typeof raw !== "object") continue;
      const full = typeof raw.full === "string" ? raw.full : typeof raw.text === "string" ? raw.text : null;
      if (!full) continue;
      cleaned.push({
        id: typeof raw.id === "string" ? raw.id : uid(),
        title: typeof raw.title === "string" && raw.title.trim() ? raw.title : titleFromText(full),
        full: full,
        preview: typeof raw.preview === "string" ? raw.preview : full.replace(/\n+/g, " ").slice(0, 140),
        category: typeof raw.category === "string" && CATEGORY_LABELS[raw.category] ? raw.category : "general",
        favorite: !!raw.favorite,
        createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
      });
    }
    return cleaned;
  }

  function handleImportFile(file) {
    if (!file) return;
    if (file.type && file.type !== "application/json" && !file.name.endsWith(".json")) {
      showToast("Please choose a .json file exported from PromptoBox.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try {
        data = JSON.parse(reader.result);
      } catch (e) {
        showToast("That file isn't valid JSON.", "error");
        return;
      }
      const cleaned = validateImportedPayload(data);
      if (!cleaned) {
        showToast("This file doesn't look like a PromptoBox export.", "error");
        return;
      }
      if (cleaned.length === 0) {
        showToast("No valid prompts found in that file.", "error");
        return;
      }
      const existing = getSavedPrompts();
      const existingIds = new Set(existing.map((p) => p.id));
      const merged = existing.slice();
      let added = 0;
      cleaned.forEach((p) => {
        if (!existingIds.has(p.id)) {
          merged.push(p);
          existingIds.add(p.id);
          added++;
        }
      });
      merged.sort((a, b) => b.createdAt - a.createdAt);
      if (setSavedPrompts(merged)) {
        showToast("Imported " + added + " new prompt" + (added === 1 ? "" : "s") + ".", "success");
        renderSavedPrompts();
        renderRecentSaved();
        refreshSettingsStats();
      }
    };
    reader.onerror = () => showToast("Couldn't read that file.", "error");
    reader.readAsText(file);
  }

  function initImportExport() {
    $("#exportBtn").addEventListener("click", exportPrompts);
    $("#settingsExportBtn").addEventListener("click", exportPrompts);

    $("#importBtn").addEventListener("click", () => $("#importFileInput").click());
    $("#importFileInput").addEventListener("change", (e) => {
      handleImportFile(e.target.files[0]);
      e.target.value = "";
    });

    $("#settingsImportBtn").addEventListener("click", () => $("#settingsImportFileInput").click());
    $("#settingsImportFileInput").addEventListener("change", (e) => {
      handleImportFile(e.target.files[0]);
      e.target.value = "";
    });

    $("#clearAllDataBtn").addEventListener("click", () => {
      if (!confirm("This will permanently delete all saved prompts and reset settings on this device. Continue?")) return;
      try {
        Object.values(LS_KEYS).forEach((k) => localStorage.removeItem(k));
        showToast("All local data cleared.", "success");
        renderSavedPrompts();
        renderRecentSaved();
        refreshSettingsStats();
        updateApiStatusUI();
        $("#apiKeyInput").value = "";
        applyTheme("dark");
      } catch (e) {
        showToast("Couldn't clear all data.", "error");
      }
    });
  }

  /* ---------------- PWA: install + offline + service worker ---------------- */
  function initPWA() {
    const banner = $("#installBanner");
    const dismissed = localStorage.getItem(LS_KEYS.INSTALL_DISMISSED) === "1";
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      state.deferredInstallPrompt = e;
      if (!dismissed && !isStandalone) banner.hidden = false;
    });

    $("#installBtn").addEventListener("click", async () => {
      if (!state.deferredInstallPrompt) {
        showToast("Install isn't available in this browser yet.");
        return;
      }
      state.deferredInstallPrompt.prompt();
      const choice = await state.deferredInstallPrompt.userChoice;
      if (choice.outcome === "accepted") {
        showToast("PromptoBox installed!", "success");
      }
      state.deferredInstallPrompt = null;
      banner.hidden = true;
    });

    $("#installDismissBtn").addEventListener("click", () => {
      banner.hidden = true;
      localStorage.setItem(LS_KEYS.INSTALL_DISMISSED, "1");
    });

    window.addEventListener("appinstalled", () => {
      banner.hidden = true;
      showToast("PromptoBox installed! You can now launch it from your home screen.", "success");
    });

    // Offline detection
    function updateOfflineState() {
      const offlineBanner = $("#offlineBanner");
      const statusText = $("#engineStatusText");
      const statusDotEls = $all(".status-dot", $("#engineStatusPill"));
      if (!navigator.onLine) {
        offlineBanner.hidden = false;
        if (statusText) statusText.textContent = "Offline — saved prompts only";
        statusDotEls.forEach((d) => (d.style.background = "var(--coral)"));
      } else {
        offlineBanner.hidden = true;
        if (statusText) statusText.textContent = "Bento Engine Ready";
        statusDotEls.forEach((d) => (d.style.background = "var(--mint)"));
      }
    }
    window.addEventListener("online", updateOfflineState);
    window.addEventListener("offline", updateOfflineState);
    updateOfflineState();

    // Service worker registration
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js").catch(() => {
          /* offline-first still works via cache; registration failure is non-fatal */
        });
      });
    }
  }

  /* ---------------- Init ---------------- */
  function init() {
    initNav();
    initTheme();
    initSettings();
    initGenerateInputs();
    initResultActions();
    initModal();
    initSavedControls();
    initImportExport();
    initPWA();
    renderRecentSaved();
    renderSavedPrompts();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
