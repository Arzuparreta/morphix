(function () {
  const ext = globalThis.RestyleBrowserApi || globalThis.browser || globalThis.chrome;
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
    const findings = [];
    const selectorHits = [];
    let matchedStableSelector = false;
    let hasOnlyContextualMisses = false;

    if (css.trim()) {
      try {
        if (typeof CSSStyleSheet === "function") {
          const sheet = new CSSStyleSheet();
          sheet.replaceSync(css);
        }
      } catch (error) {
        findings.push(makeFinding("syntax", "critical", "CSS syntax may be invalid: " + (error.message || String(error))));
      }

      const selectors = extractSelectors(css).slice(0, 30);
      for (const selector of selectors) {
        const analysis = analyzeSelector(selector);
        selectorHits.push({
          selector,
          count: analysis.count,
          baseSelector: analysis.baseSelector,
          baseCount: analysis.baseCount,
          category: analysis.category,
          severity: analysis.severity
        });
        if (analysis.baseCount > 0 || analysis.count > 0) matchedStableSelector = true;
        if (analysis.category === "interactive_miss" || analysis.category === "conditional_miss" || analysis.category === "route_specific_miss") {
          hasOnlyContextualMisses = true;
        }
        if (analysis.finding) {
          findings.push(analysis.finding);
        }
      }

      if (selectors.length && !matchedStableSelector && !hasOnlyContextualMisses) {
        findings.push(makeFinding("unknown_selector_miss", "critical", "None of the checked stable selectors matched current page elements."));
      }
    }

    if (js.trim()) {
      findings.push(makeFinding("js_present", "info", "This style includes JavaScript. Keep it only if the behavior is expected."));
    }

    findings.push(...findPerformanceWarnings(css, js));
    const dedupedFindings = dedupeFindings(findings);
    const warnings = dedupedFindings.map((item) => item.message).slice(0, 8);
    const summary = summarizeFindings(dedupedFindings);

    return {
      ok: summary.criticalCount === 0,
      warnings,
      selectorHits,
      findings: dedupedFindings,
      summary
    };
  }

  function findPerformanceWarnings(css, js) {
    const warnings = [];
    const broadSelectorBlock = /(?:^|[{},])\s*(?:\*|html\s+\*|body\s+\*|:root\s+\*)\s*\{[^}]*\b(?:animation|transition|filter|backdrop-filter|transform|box-shadow)\b/is;
    const mediaSelectorBlock = /(?:video|canvas|iframe|\.html5-main-video)[^{]*\{[^}]*\b(?:animation|transition|filter|backdrop-filter|transform|box-shadow)\b/is;

    if (broadSelectorBlock.test(css)) {
      warnings.push(makeFinding("performance", "critical", "Performance risk: broad selectors apply expensive visual effects to many elements."));
    }

    if (mediaSelectorBlock.test(css)) {
      warnings.push(makeFinding("performance", "critical", "Performance risk: media elements are receiving effects that can cause playback lag."));
    }

    if (/\b(?:setInterval|setTimeout|requestAnimationFrame|MutationObserver)\b/.test(js)) {
      warnings.push(makeFinding("performance", "critical", "Performance risk: generated JavaScript schedules repeated work."));
    }

    return warnings;
  }

  function analyzeSelector(selector) {
    const selectorText = String(selector || "").trim();
    const baseSelector = normalizeSelectorForValidation(selectorText);
    const direct = safeCountSelector(selectorText);
    const baseCount = baseSelector && baseSelector !== selectorText ? safeCountSelector(baseSelector) : direct;
    const category = classifySelector(selectorText, direct.count, baseCount.count);
    const severity = category === "unknown_selector_miss" ? "critical" : "info";
    const finding = buildSelectorFinding(selectorText, category, severity, direct.count, baseSelector, baseCount.count, direct.error || baseCount.error);

    return {
      selector: selectorText,
      count: direct.count,
      baseSelector,
      baseCount: baseCount.count,
      category,
      severity,
      finding
    };
  }

  function buildSelectorFinding(selector, category, severity, count, baseSelector, baseCount, error) {
    if (count > 0) return null;
    if (category === "matched") return null;

    if (category === "interactive_miss") {
      return makeFinding(category, severity, `Interactive selector did not match in the current state: ${selector}`, { selector, baseSelector, count, baseCount });
    }
    if (category === "conditional_miss") {
      return makeFinding(category, severity, `Conditional selector is not active right now: ${selector}`, { selector, baseSelector, count, baseCount });
    }
    if (category === "route_specific_miss") {
      return makeFinding(category, severity, `Route-specific selector did not match this page shape: ${selector}`, { selector, baseSelector, count, baseCount });
    }
    const message = error
      ? `Selector may be unsupported or invalid: ${selector}`
      : `Selector did not match anything stable on this page: ${selector}`;
    return makeFinding(category, severity, message, { selector, baseSelector, count, baseCount });
  }

  function safeCountSelector(selector) {
    if (!selector) return { count: 0, error: null };
    try {
      return { count: document.querySelectorAll(selector).length, error: null };
    } catch (error) {
      return { count: null, error: error };
    }
  }

  function normalizeSelectorForValidation(selector) {
    return String(selector || "")
      .replace(/:(?:hover|active|focus|focus-visible|focus-within|visited|target)\b/g, "")
      .replace(/\[(?:aria-expanded|aria-selected|aria-pressed|aria-checked|open|selected|checked|hidden)(?:[~|^$*]?=[^\]]+)?\]/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function classifySelector(selector, count, baseCount) {
    if (count > 0) return "matched";

    const interactivePattern = /:(?:hover|active|focus|focus-visible|focus-within|visited|target)\b/;
    const conditionalPattern = /(?:\[(?:aria-expanded|aria-selected|aria-pressed|aria-checked|open|selected|checked|hidden)(?:[~|^$*]?=[^\]]+)?\])|:(?:has|not)\(|:(?:nth-child|nth-of-type)\(/i;
    const routePattern = /(?:\[(?:page-subtype|tab-identifier|href\^|href\*=|role=|data-testid=)[^\]]*\])|\b(?:ytd-|yt-|tp-yt-|masthead|guide|results|watch|shorts|channel|playlist)\b/i;

    if (interactivePattern.test(selector) && baseCount > 0) return "interactive_miss";
    if (conditionalPattern.test(selector) && baseCount > 0) return "conditional_miss";
    if (routePattern.test(selector)) return "route_specific_miss";
    if (interactivePattern.test(selector) || conditionalPattern.test(selector)) return "conditional_miss";
    return "unknown_selector_miss";
  }

  function makeFinding(type, severity, message, details) {
    return {
      type,
      severity,
      message,
      details: details || null
    };
  }

  function dedupeFindings(findings) {
    const seen = new Set();
    return findings.filter((item) => {
      const key = JSON.stringify([item.type, item.severity, item.message]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function summarizeFindings(findings) {
    const summary = {
      criticalCount: 0,
      infoCount: 0,
      categories: {},
      autoRepaired: false,
      siteCoverage: null
    };
    for (const finding of findings) {
      if (finding.severity === "critical") summary.criticalCount += 1;
      else summary.infoCount += 1;
      summary.categories[finding.type] = (summary.categories[finding.type] || 0) + 1;
    }
    return summary;
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
      if (!ext || !ext.runtime || !ext.runtime.id) {
        deactivate();
        return;
      }
      const response = ext.runtime.sendMessage(message);
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
