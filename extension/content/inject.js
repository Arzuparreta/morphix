(function () {
  const STYLE_ATTR = "data-restyle-id";
  const SCRIPT_ATTR = "data-restyle-id";
  const SCRIPT_RUNTIME_KEY = "__restyleScriptRuntime";
  const OBSERVER_FLAG = "__restyleObserverInstalled";
  const READY_FLAG = "__restylePageReadySent";
  const SHEETS_KEY = "__restyleConstructedSheets";
  const PAYLOAD_SIGNATURES_KEY = "__restylePayloadSignatures";
  let lastUrl = location.href;
  let timer = null;
  let observer = null;
  let isActive = true;
  let popstateHandler = null;

  function ensureHead() {
    if (!document.head) {
      const head = document.createElement("head");
      document.documentElement.prepend(head);
    }
    return document.head;
  }

  function applyStylePayload(payload) {
    const id = payload.id;
    if (!id) throw new Error("Missing restyle id");

    const signature = payloadSignature(payload);
    const signatures = getPayloadSignatures();
    if (signatures[id] === signature) return getAppliedIds();

    removeStylePayload(id);

    if (payload.css) {
      if (!canUseConstructedStylesheets() || !applyConstructedStylesheet(id, payload.css)) {
        const style = document.createElement("style");
        style.setAttribute(STYLE_ATTR, id);
        style.textContent = payload.css;
        ensureHead().appendChild(style);
      }
    }

    if (payload.js) {
      const script = document.createElement("script");
      script.setAttribute(SCRIPT_ATTR, id);
      script.textContent = wrapStyleScript(id, payload.js);
      (document.documentElement || document.body).appendChild(script);
    }

    signatures[id] = signature;
    return getAppliedIds();
  }

  function removeStylePayload(id) {
    disposeStyleScript(id);
    document.querySelectorAll(`[${STYLE_ATTR}="${CSS.escape(id)}"], [${SCRIPT_ATTR}="${CSS.escape(id)}"]`).forEach((node) => {
      node.remove();
    });
    removeConstructedStylesheet(id);
    delete getPayloadSignatures()[id];
  }

  function validateStylePayload(payload) {
    const css = String(payload && payload.css ? payload.css : "");
    const js = String(payload && payload.js ? payload.js : "");
    const warnings = [];
    const selectorHits = [];

    if (css.trim()) {
      try {
        if (typeof CSSStyleSheet === "function") {
          const sheet = new CSSStyleSheet();
          sheet.replaceSync(css);
        }
      } catch (error) {
        warnings.push("CSS syntax may be invalid: " + (error.message || String(error)));
      }

      const selectors = extractSelectors(css).slice(0, 30);
      for (const selector of selectors) {
        try {
          const count = document.querySelectorAll(selector).length;
          selectorHits.push({ selector, count });
          if (count === 0) warnings.push(`Selector did not match anything: ${selector}`);
        } catch (_error) {
          selectorHits.push({ selector, count: null });
        }
      }

      if (selectors.length && selectorHits.every((item) => item.count === 0 || item.count === null)) {
        warnings.push("None of the checked selectors matched visible page elements.");
      }
    }

    if (js.trim()) {
      warnings.push("This style includes JavaScript. Keep it only if the behavior is expected.");
    }

    warnings.push(...findPerformanceWarnings(css, js));

    return {
      ok: !warnings.length,
      warnings: Array.from(new Set(warnings)).slice(0, 8),
      selectorHits
    };
  }

  function findPerformanceWarnings(css, js) {
    const warnings = [];
    const broadSelectorBlock = /(?:^|[{},])\s*(?:\*|html\s+\*|body\s+\*|:root\s+\*)\s*\{[^}]*\b(?:animation|transition|filter|backdrop-filter|transform|box-shadow)\b/is;
    const mediaSelectorBlock = /(?:video|canvas|iframe|\.html5-main-video)[^{]*\{[^}]*\b(?:animation|transition|filter|backdrop-filter|transform|box-shadow)\b/is;

    if (broadSelectorBlock.test(css)) {
      warnings.push("Performance risk: broad selectors apply expensive visual effects to many elements.");
    }

    if (mediaSelectorBlock.test(css)) {
      warnings.push("Performance risk: media elements are receiving effects that can cause playback lag.");
    }

    if (/\b(?:setInterval|setTimeout|requestAnimationFrame|MutationObserver)\b/.test(js)) {
      warnings.push("Performance risk: generated JavaScript schedules repeated work.");
    }

    return warnings;
  }

  function extractSelectors(css) {
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const selectors = [];
    const pattern = /([^{}]+)\{/g;
    let match;
    while ((match = pattern.exec(withoutComments))) {
      const raw = match[1].trim();
      if (!raw || raw.startsWith("@") || raw.includes("%")) continue;
      raw.split(",").map((selector) => selector.trim()).filter(Boolean).forEach((selector) => {
        if (!selector.startsWith("@")) selectors.push(selector);
      });
    }
    return Array.from(new Set(selectors));
  }

  function getAppliedIds() {
    const styleIds = Array.from(document.querySelectorAll(`[${STYLE_ATTR}]`)).map((node) => node.getAttribute(STYLE_ATTR));
    return Array.from(new Set(styleIds.concat(Object.keys(getConstructedStylesheets()))));
  }

  function canUseConstructedStylesheets() {
    return "adoptedStyleSheets" in document && typeof CSSStyleSheet === "function";
  }

  function getConstructedStylesheets() {
    if (!window[SHEETS_KEY]) window[SHEETS_KEY] = {};
    return window[SHEETS_KEY];
  }

  function getPayloadSignatures() {
    if (!window[PAYLOAD_SIGNATURES_KEY]) window[PAYLOAD_SIGNATURES_KEY] = {};
    return window[PAYLOAD_SIGNATURES_KEY];
  }

  function payloadSignature(payload) {
    return JSON.stringify({
      id: payload.id,
      css: payload.css || "",
      js: payload.js || ""
    });
  }

  function wrapStyleScript(id, source) {
    return [
      "(function () {",
      "  const styleId = " + JSON.stringify(id) + ";",
      "  const runtimeKey = " + JSON.stringify(SCRIPT_RUNTIME_KEY) + ";",
      "  window[runtimeKey] = window[runtimeKey] || {};",
      "  if (typeof window[runtimeKey][styleId] === 'function') {",
      "    try { window[runtimeKey][styleId](); } catch (_error) {}",
      "  }",
      "  const cleanup = [];",
      "  const originalSetInterval = window.setInterval;",
      "  const originalClearInterval = window.clearInterval;",
      "  const originalSetTimeout = window.setTimeout;",
      "  const originalClearTimeout = window.clearTimeout;",
      "  const originalRequestAnimationFrame = window.requestAnimationFrame;",
      "  const originalCancelAnimationFrame = window.cancelAnimationFrame;",
      "  const OriginalMutationObserver = window.MutationObserver;",
      "  window.setInterval = function () {",
      "    const handle = originalSetInterval.apply(window, arguments);",
      "    cleanup.push(function () { originalClearInterval.call(window, handle); });",
      "    return handle;",
      "  };",
      "  window.setTimeout = function () {",
      "    const handle = originalSetTimeout.apply(window, arguments);",
      "    cleanup.push(function () { originalClearTimeout.call(window, handle); });",
      "    return handle;",
      "  };",
      "  if (originalRequestAnimationFrame && originalCancelAnimationFrame) {",
      "    window.requestAnimationFrame = function () {",
      "      const handle = originalRequestAnimationFrame.apply(window, arguments);",
      "      cleanup.push(function () { originalCancelAnimationFrame.call(window, handle); });",
      "      return handle;",
      "    };",
      "  }",
      "  if (OriginalMutationObserver) {",
      "    window.MutationObserver = function (callback) {",
      "      const observer = new OriginalMutationObserver(callback);",
      "      cleanup.push(function () { observer.disconnect(); });",
      "      return observer;",
      "    };",
      "    window.MutationObserver.prototype = OriginalMutationObserver.prototype;",
      "  }",
      "  function restoreGlobals() {",
      "    window.setInterval = originalSetInterval;",
      "    window.clearInterval = originalClearInterval;",
      "    window.setTimeout = originalSetTimeout;",
      "    window.clearTimeout = originalClearTimeout;",
      "    if (originalRequestAnimationFrame) window.requestAnimationFrame = originalRequestAnimationFrame;",
      "    if (originalCancelAnimationFrame) window.cancelAnimationFrame = originalCancelAnimationFrame;",
      "    if (OriginalMutationObserver) window.MutationObserver = OriginalMutationObserver;",
      "  }",
      "  try {",
      source,
      "  } catch (error) {",
      "    console.warn('Morphix style script failed', error);",
      "  } finally {",
      "    restoreGlobals();",
      "  }",
      "  window[runtimeKey][styleId] = function () {",
      "    while (cleanup.length) {",
      "      try { cleanup.pop()(); } catch (_error) {}",
      "    }",
      "    delete window[runtimeKey][styleId];",
      "  };",
      "})();"
    ].join("\n");
  }

  function disposeStyleScript(id) {
    const script = document.createElement("script");
    script.textContent = [
      "(function () {",
      "  const runtime = window[" + JSON.stringify(SCRIPT_RUNTIME_KEY) + "];",
      "  const dispose = runtime && runtime[" + JSON.stringify(id) + "];",
      "  if (typeof dispose === 'function') {",
      "    try { dispose(); } catch (_error) {}",
      "  }",
      "})();"
    ].join("\n");
    (document.documentElement || document.body).appendChild(script);
    script.remove();
  }

  function applyConstructedStylesheet(id, css) {
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      const sheets = getConstructedStylesheets();
      sheets[id] = sheet;
      document.adoptedStyleSheets = Array.from(document.adoptedStyleSheets || []).concat(sheet);
      return true;
    } catch (_error) {
      return false;
    }
  }

  function removeConstructedStylesheet(id) {
    const sheets = getConstructedStylesheets();
    const sheet = sheets[id];
    if (!sheet) return;
    try {
      document.adoptedStyleSheets = Array.from(document.adoptedStyleSheets || []).filter((existing) => existing !== sheet);
    } catch (_error) {
      // Removal can fail on pages that expose adoptedStyleSheets but reject assignment.
    }
    delete sheets[id];
  }

  function notifyRouteChange(reason) {
    if (!isActive) return;
    safeSendMessage({
      type: "RESTYLE_ROUTE_CHANGED",
      url: location.href,
      reason
    });
  }

  function checkNavigation(reason) {
    if (!isActive) return;
    const changed = location.href !== lastUrl;

    if (changed) {
      lastUrl = location.href;
      notifyRouteChange("url");
      return;
    }
  }

  function installObserver() {
    if (window[OBSERVER_FLAG]) return;
    window[OBSERVER_FLAG] = true;

    observer = new MutationObserver(() => {
      if (!isActive) return;
      clearTimeout(timer);
      timer = setTimeout(() => checkNavigation("mutation"), 300);
    });

    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    try {
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      history.pushState = function () {
        const result = originalPushState.apply(this, arguments);
        if (isActive) setTimeout(() => checkNavigation("pushState"), 0);
        return result;
      };
      history.replaceState = function () {
        const result = originalReplaceState.apply(this, arguments);
        if (isActive) setTimeout(() => checkNavigation("replaceState"), 0);
        return result;
      };
    } catch (_error) {
      // Some pages lock down history methods. Mutation and popstate detection still work.
    }
    popstateHandler = () => {
      if (isActive) setTimeout(() => checkNavigation("popstate"), 0);
    };
    window.addEventListener("popstate", popstateHandler);
  }

  function safeSendMessage(message) {
    if (!isActive) return;
    try {
      if (!chrome || !chrome.runtime || !chrome.runtime.id) {
        deactivate();
        return;
      }
      const response = chrome.runtime.sendMessage(message);
      if (response && typeof response.catch === "function") response.catch((error) => {
        if (isExtensionContextError(error)) deactivate();
      });
    } catch (error) {
      if (isExtensionContextError(error)) deactivate();
      // The extension context can disappear during reloads or extension updates.
    }
  }

  function isExtensionContextError(error) {
    return /extension context invalidated|context invalidated|extension context/i.test(String(error && error.message ? error.message : error));
  }

  function deactivate() {
    if (!isActive) return;
    isActive = false;
    clearTimeout(timer);
    timer = null;
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (popstateHandler) {
      window.removeEventListener("popstate", popstateHandler);
      popstateHandler = null;
    }
  }

  window.RestyleInject = {
    applyStylePayload,
    getAppliedIds,
    installObserver,
    removeStylePayload,
    validateStylePayload
  };

  installObserver();
  if (!window[READY_FLAG]) {
    window[READY_FLAG] = true;
    safeSendMessage({
      type: "RESTYLE_PAGE_READY",
      url: location.href
    });
  }
})();
