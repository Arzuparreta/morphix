importScripts("/shared/prompts.js", "/shared/styles.js", "/shared/providers.js");

const DNR_RULE_BASE = 9000;
const injectedCssByTab = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((response) => sendResponse(response))
    .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
  return true;
});

async function handleMessage(message, sender) {
  if (!message || !message.type) return { ok: false, error: "Missing message type" };

  if (message.type === "RESTYLE_APPLY_REQUEST") {
    return createDraftRestyle(message.tabId, message.prompt);
  }

  if (message.type === "RESTYLE_DISCARD_DRAFT") {
    await removeInjectedStyle(message.tabId, message.draftId);
    return { ok: true };
  }

  if (message.type === "RESTYLE_KEEP_SAVED") {
    return keepSaved(message);
  }

  if (message.type === "RESTYLE_KEEP_SESSION") {
    return keepSession(message);
  }

  if (message.type === "RESTYLE_GET_PAGE_STATE") {
    const matches = await getMatchingStylesForUrl(message.url);
    return { ok: true, count: matches.length };
  }

  if (message.type === "RESTYLE_PAGE_READY" || message.type === "RESTYLE_ROUTE_CHANGED") {
    const tabId = sender.tab && sender.tab.id;
    if (tabId && message.url) await injectMatchingStyles(tabId, message.url);
    return { ok: true };
  }

  if (message.type === "RESTYLE_GET_OPTIONS") {
    const providerConfig = await RestyleProviders.getProviderConfig();
    const styles = await RestyleStorage.getSavedStyles();
    return {
      ok: true,
      providers: RestyleProviders.PROVIDERS,
      providerConfig,
      hasKey: Boolean(providerConfig.apiKey),
      styles
    };
  }

  if (message.type === "RESTYLE_SAVE_PROVIDER") {
    RestyleProviders.validateProviderConfig(message.providerConfig);
    const providerConfig = await RestyleProviders.saveProviderConfig(message.providerConfig);
    return { ok: true, providerConfig };
  }

  if (message.type === "RESTYLE_TEST_PROVIDER") {
    RestyleProviders.validateProviderConfig(message.providerConfig);
    await RestyleProviders.testProviderConfig(message.providerConfig);
    return { ok: true };
  }

  if (message.type === "RESTYLE_SAVE_API_KEY") {
    const providerConfig = await RestyleProviders.getProviderConfig();
    providerConfig.provider = "anthropic";
    providerConfig.apiKey = message.apiKey;
    await RestyleProviders.testProviderConfig(providerConfig);
    await RestyleProviders.saveProviderConfig(providerConfig);
    return { ok: true, providerConfig };
  }

  if (message.type === "RESTYLE_DELETE_STYLE") {
    await RestyleStorage.deleteStyle(message.id);
    return { ok: true, styles: await RestyleStorage.getSavedStyles() };
  }

  if (message.type === "RESTYLE_UPDATE_STYLE") {
    await RestyleStorage.updateStyle(message.id, message.patch || {});
    return { ok: true, styles: await RestyleStorage.getSavedStyles() };
  }

  return { ok: false, error: "Unknown message type" };
}

async function createDraftRestyle(tabId, prompt) {
  if (!tabId) throw new Error("No active tab found");
  if (!prompt || !prompt.trim()) throw new Error("Enter a restyle prompt first");

  await enableCspBypassForTab(tabId);
  await ensureContentScript(tabId, "/content/extract.js");
  await ensureContentScript(tabId, "/content/inject.js");

  const contextResult = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.RestyleExtract.extractPageContext()
  });
  const pageContext = contextResult[0] && contextResult[0].result;
  if (!pageContext) throw new Error("Could not extract page context");

  const aiResult = await callAiProvider(prompt.trim(), pageContext);
  const draftId = RestyleStorage.uuid();
  const draft = {
    id: draftId,
    css: aiResult.css || "",
    js: aiResult.js || "",
    description: aiResult.description || "Generated a page restyle.",
    prompt: prompt.trim(),
    pageContext
  };

  await injectPayload(tabId, draft);
  return { ok: true, draft };
}

async function callAiProvider(prompt, pageContext) {
  const providerConfig = await RestyleProviders.getProviderConfig();
  const text = await RestyleProviders.callProvider(
    providerConfig,
    RestylePrompts.RESTYLE_SYSTEM_PROMPT,
    RestylePrompts.buildRestyleUserPrompt(prompt, pageContext),
    12000,
    { structured: true }
  );
  try {
    return parseAiJson(text);
  } catch (error) {
    const repairedText = await repairAiJson(providerConfig, text, error);
    return parseAiJson(repairedText);
  }
}

function parseAiJson(text) {
  const jsonText = extractJsonObject(text);
  if (!jsonText) throw new Error("AI response was not JSON");
  const parsed = JSON.parse(jsonText);
  return {
    css: typeof parsed.css === "string" ? parsed.css : "",
    js: typeof parsed.js === "string" ? parsed.js : "",
    description: typeof parsed.description === "string" ? parsed.description : ""
  };
}

function extractJsonObject(text) {
  const trimmed = String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  if (!trimmed) return "";
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") {
      if (depth === 0) start = index;
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0 && start !== -1) return trimmed.slice(start, index + 1);
    }
  }

  return "";
}

async function repairAiJson(providerConfig, badText, parseError) {
  const repairPrompt = [
    "Convert the following model output into valid JSON only.",
    "Return exactly this object shape: {\"css\":\"...\",\"js\":\"...\",\"description\":\"...\"}.",
    "Preserve the CSS, JavaScript, and description content. Escape all newlines and quotes correctly.",
    "If a field is missing, use an empty string for css/js and a short sentence for description.",
    "",
    "Parse error:",
    parseError.message || String(parseError),
    "",
    "Model output:",
    String(badText || "").slice(0, 12000)
  ].join("\n");

  return RestyleProviders.callProvider(
    providerConfig,
    "You repair malformed JSON for a browser extension. Reply with valid JSON only.",
    repairPrompt,
    8000,
    { structured: true }
  );
}

async function injectPayload(tabId, payload) {
  await ensureContentScript(tabId, "/content/inject.js");
  if (payload.css) await insertExtensionCss(tabId, payload.id, payload.css);
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (stylePayload) => window.RestyleInject.applyStylePayload(stylePayload),
    args: [
      {
        id: payload.id,
        css: payload.css,
        js: payload.js
      }
    ]
  });
}

async function removeInjectedStyle(tabId, id) {
  if (!tabId || !id) return;
  await removeExtensionCss(tabId, id);
  await ensureContentScript(tabId, "/content/inject.js");
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (styleId) => window.RestyleInject.removeStylePayload(styleId),
    args: [id]
  });
}

async function insertExtensionCss(tabId, id, css) {
  const tabCss = injectedCssByTab.get(tabId) || new Map();
  const previousCss = tabCss.get(id);
  if (previousCss) {
    await chrome.scripting.removeCSS({
      target: { tabId },
      css: previousCss,
      origin: "USER"
    }).catch(() => {});
  }
  await chrome.scripting.insertCSS({
    target: { tabId },
    css,
    origin: "USER"
  }).catch(() => {});
  tabCss.set(id, css);
  injectedCssByTab.set(tabId, tabCss);
}

async function removeExtensionCss(tabId, id) {
  const tabCss = injectedCssByTab.get(tabId);
  const css = tabCss && tabCss.get(id);
  if (!css) return;
  await chrome.scripting.removeCSS({
    target: { tabId },
    css,
    origin: "USER"
  }).catch(() => {});
  tabCss.delete(id);
  if (!tabCss.size) injectedCssByTab.delete(tabId);
}

async function keepSaved(message) {
  const tab = await chrome.tabs.get(message.tabId);
  const pattern = message.scope === "domain"
    ? RestyleStorage.getDomainPattern(tab.url)
    : RestyleStorage.getExactPattern(tab.url);

  const saved = await RestyleStorage.saveStyle({
    name: message.name || message.draft.description || "Saved restyle",
    url_pattern: pattern,
    css: message.draft.css,
    js: message.draft.js,
    prompt: message.draft.prompt,
    description: message.draft.description,
    enabled: !message.libraryOnly
  });

  await removeInjectedStyle(message.tabId, message.draft.id);
  await injectPayload(message.tabId, saved);
  return { ok: true, style: saved };
}

async function keepSession(message) {
  const tab = await chrome.tabs.get(message.tabId);
  const saved = await RestyleStorage.saveSessionStyle({
    name: message.draft.description || "Session restyle",
    url_pattern: RestyleStorage.getExactPattern(tab.url),
    css: message.draft.css,
    js: message.draft.js,
    prompt: message.draft.prompt,
    description: message.draft.description
  });

  await removeInjectedStyle(message.tabId, message.draft.id);
  await injectPayload(message.tabId, saved);
  return { ok: true, style: saved };
}

async function getMatchingStylesForUrl(url) {
  const saved = await RestyleStorage.findMatchingSavedStyles(url);
  const session = await RestyleStorage.findMatchingSessionStyles(url);
  return saved.concat(session);
}

async function injectMatchingStyles(tabId, url) {
  const styles = await getMatchingStylesForUrl(url);
  for (const style of styles) {
    await injectPayload(tabId, style).catch(() => {});
  }
}

async function ensureContentScript(tabId, file) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [file.replace(/^\//, "")]
  }).catch(() => {});
}

async function enableCspBypassForTab(tabId) {
  const ruleId = DNR_RULE_BASE + tabId;
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [ruleId],
    addRules: [
      {
        id: ruleId,
        priority: 1,
        action: {
          type: "modifyHeaders",
          responseHeaders: [
            { header: "content-security-policy", operation: "remove" },
            { header: "content-security-policy-report-only", operation: "remove" }
          ]
        },
        condition: {
          tabIds: [tabId],
          resourceTypes: ["main_frame", "sub_frame"]
        }
      }
    ]
  });
}
