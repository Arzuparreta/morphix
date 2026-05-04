(function () {
  const SYNC_KEY = "saved_styles";
  const SESSION_KEY = "session_styles";

  function nowIso() {
    return new Date().toISOString();
  }

  function uuid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return "style_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);
  }

  function getDomainPattern(rawUrl) {
    const url = new URL(rawUrl);
    return {
      type: "domain",
      value: url.hostname.replace(/^www\./, "")
    };
  }

  function getExactPattern(rawUrl) {
    const url = new URL(rawUrl);
    url.search = "";
    url.hash = "";
    return {
      type: "exact",
      value: url.toString()
    };
  }

  function matchPattern(pattern, rawUrl) {
    if (!pattern || !rawUrl) return false;
    let url;
    try {
      url = new URL(rawUrl);
    } catch (_error) {
      return false;
    }

    if (pattern.type === "exact") {
      const normalized = new URL(rawUrl);
      normalized.search = "";
      normalized.hash = "";
      const stored = new URL(pattern.value);
      stored.search = "";
      stored.hash = "";
      return normalized.toString() === stored.toString();
    }

    if (pattern.type === "domain") {
      const host = url.hostname.replace(/^www\./, "");
      return host === pattern.value || host.endsWith("." + pattern.value);
    }

    if (pattern.type === "regex") {
      try {
        return new RegExp(pattern.value).test(rawUrl);
      } catch (_error) {
        return false;
      }
    }

    return false;
  }

  async function getSavedStyles() {
    const result = await chrome.storage.sync.get({ [SYNC_KEY]: [] });
    return Array.isArray(result[SYNC_KEY]) ? result[SYNC_KEY] : [];
  }

  async function setSavedStyles(styles) {
    await chrome.storage.sync.set({ [SYNC_KEY]: styles });
  }

  async function saveStyle(style) {
    const styles = await getSavedStyles();
    const next = {
      id: style.id || uuid(),
      name: style.name || "Untitled restyle",
      url_pattern: style.url_pattern,
      css: style.css || "",
      js: style.js || "",
      created_at: style.created_at || nowIso(),
      hits: style.hits || 0,
      prompt: style.prompt || "",
      description: style.description || "",
      enabled: style.enabled !== false
    };
    styles.unshift(next);
    await setSavedStyles(styles);
    return next;
  }

  async function deleteStyle(id) {
    const styles = await getSavedStyles();
    await setSavedStyles(styles.filter((style) => style.id !== id));
  }

  async function updateStyle(id, patch) {
    const styles = await getSavedStyles();
    let updated = null;
    const next = styles.map((style) => {
      if (style.id !== id) return style;
      updated = {
        ...style,
        ...patch,
        id: style.id
      };
      return updated;
    });
    await setSavedStyles(next);
    return updated;
  }

  async function findMatchingSavedStyles(rawUrl) {
    const styles = await getSavedStyles();
    return styles.filter((style) => style.enabled !== false && matchPattern(style.url_pattern, rawUrl));
  }

  async function getSessionStyles() {
    const result = await chrome.storage.local.get({ [SESSION_KEY]: [] });
    return Array.isArray(result[SESSION_KEY]) ? result[SESSION_KEY] : [];
  }

  async function saveSessionStyle(style) {
    const styles = await getSessionStyles();
    const next = {
      id: style.id || uuid(),
      name: style.name || "Session restyle",
      url_pattern: style.url_pattern,
      css: style.css || "",
      js: style.js || "",
      created_at: style.created_at || nowIso(),
      hits: style.hits || 0,
      prompt: style.prompt || "",
      description: style.description || ""
    };
    styles.unshift(next);
    await chrome.storage.local.set({ [SESSION_KEY]: styles });
    return next;
  }

  async function findMatchingSessionStyles(rawUrl) {
    const styles = await getSessionStyles();
    return styles.filter((style) => matchPattern(style.url_pattern, rawUrl));
  }

  self.RestyleStorage = {
    deleteStyle,
    findMatchingSavedStyles,
    findMatchingSessionStyles,
    getDomainPattern,
    getExactPattern,
    getSavedStyles,
    matchPattern,
    saveSessionStyle,
    saveStyle,
    setSavedStyles,
    updateStyle,
    uuid
  };
})();
