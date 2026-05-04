(function () {
  const STYLE_ATTR = "data-restyle-id";
  const SCRIPT_ATTR = "data-restyle-id";
  const OBSERVER_FLAG = "__restyleObserverInstalled";
  const SHEETS_KEY = "__restyleConstructedSheets";
  let lastUrl = location.href;
  let mutationCount = 0;
  let timer = null;

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
      script.textContent = payload.js;
      (document.documentElement || document.body).appendChild(script);
    }

    return getAppliedIds();
  }

  function removeStylePayload(id) {
    document.querySelectorAll(`[${STYLE_ATTR}="${CSS.escape(id)}"], [${SCRIPT_ATTR}="${CSS.escape(id)}"]`).forEach((node) => {
      node.remove();
    });
    removeConstructedStylesheet(id);
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
    safeSendMessage({
      type: "RESTYLE_ROUTE_CHANGED",
      url: location.href,
      reason
    });
  }

  function checkNavigation(reason) {
    const changed = location.href !== lastUrl;
    const largeSwap = mutationCount > 35;
    mutationCount = 0;

    if (changed) {
      lastUrl = location.href;
      notifyRouteChange("url");
      return;
    }

    if (largeSwap) notifyRouteChange(reason || "dom");
  }

  function installObserver() {
    if (window[OBSERVER_FLAG]) return;
    window[OBSERVER_FLAG] = true;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutationCount += mutation.addedNodes.length + mutation.removedNodes.length;
      }
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
        setTimeout(() => checkNavigation("pushState"), 0);
        return result;
      };
      history.replaceState = function () {
        const result = originalReplaceState.apply(this, arguments);
        setTimeout(() => checkNavigation("replaceState"), 0);
        return result;
      };
    } catch (_error) {
      // Some pages lock down history methods. Mutation and popstate detection still work.
    }
    window.addEventListener("popstate", () => setTimeout(() => checkNavigation("popstate"), 0));
  }

  function safeSendMessage(message) {
    try {
      const response = chrome.runtime.sendMessage(message);
      if (response && typeof response.catch === "function") response.catch(() => {});
    } catch (_error) {
      // The extension context can disappear during reloads or extension updates.
    }
  }

  window.RestyleInject = {
    applyStylePayload,
    getAppliedIds,
    installObserver,
    removeStylePayload
  };

  installObserver();
  safeSendMessage({
    type: "RESTYLE_PAGE_READY",
    url: location.href
  });
})();
