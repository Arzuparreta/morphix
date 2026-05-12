importScripts("/shared/browser-api.js", "/shared/prompts.js", "/shared/styles.js", "/shared/providers.js");

const ext = self.RestyleBrowserApi;

const DNR_RULE_BASE = 9000;
const DRAFTS_KEY = "style_drafts_by_tab_v1";
const injectedCssByTab = new Map();
const injectedPayloadsByTab = new Map();

ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((response) => sendResponse(response))
    .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
  return true;
});

ext.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  handleExternalMessage(message, sender)
    .then((response) => sendResponse(response))
    .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
  return true;
});

ext.tabs.onRemoved.addListener((tabId) => {
  clearInjectedCaches(tabId);
});

async function handleMessage(message, sender) {
  if (!message || !message.type) return { ok: false, error: "Missing message type" };

  if (message.type === "RESTYLE_CREATE_DRAFT" || message.type === "RESTYLE_APPLY_REQUEST") {
    return createDraftRestyle(message.tabId, message.prompt, message.projectId || null);
  }

  if (message.type === "RESTYLE_DISCARD_DRAFT") {
    return discardDraft(message.tabId, message.draftId);
  }

  if (message.type === "RESTYLE_ACCEPT_DRAFT") {
    return acceptDraft(message);
  }

  if (message.type === "RESTYLE_GET_PAGE_STATE") {
    const tabId = message.tabId || (sender.tab && sender.tab.id);
    const pageProjects = await getProjectsForUrl(message.url);
    const matches = pageProjects.filter((project) => project.enabled !== false);
    const draft = tabId ? await getDraftForTab(tabId) : null;
    return { ok: true, count: matches.length, activeProjects: matches, pageProjects, draft };
  }

  if (message.type === "RESTYLE_PAGE_READY" || message.type === "RESTYLE_ROUTE_CHANGED") {
    const tabId = sender.tab && sender.tab.id;
    if (tabId && message.type === "RESTYLE_PAGE_READY") clearInjectedCaches(tabId);
    if (tabId && message.url) await injectMatchingStyles(tabId, message.url);
    return { ok: true };
  }

  if (message.type === "RESTYLE_GET_OPTIONS") {
    const providerConfig = await RestyleProviders.getProviderConfig();
    const projects = await RestyleStorage.getSavedProjects();
    return {
      ok: true,
      providers: RestyleProviders.PROVIDERS,
      providerConfig,
      hasKey: Boolean(providerConfig.apiKey),
      projects
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

  if (message.type === "RESTYLE_DELETE_PROJECT" || message.type === "RESTYLE_DELETE_STYLE") {
    await RestyleStorage.deleteProject(message.id);
    if (message.tabId) await removeInjectedStyle(message.tabId, message.id);
    return { ok: true, projects: await RestyleStorage.getSavedProjects() };
  }

  if (message.type === "RESTYLE_UPDATE_PROJECT" || message.type === "RESTYLE_UPDATE_STYLE") {
    const project = await RestyleStorage.updateProject(message.id, message.patch || {});
    return { ok: true, project, projects: await RestyleStorage.getSavedProjects() };
  }

  if (message.type === "RESTYLE_SET_PROJECT_ENABLED") {
    const project = await RestyleStorage.setProjectEnabled(message.id, message.enabled);
    if (message.tabId) {
      if (message.enabled) await injectPayload(message.tabId, RestyleStorage.projectToPayload(project));
      else await removeInjectedStyle(message.tabId, message.id);
    }
    return { ok: true, project, projects: await RestyleStorage.getSavedProjects() };
  }

  if (message.type === "RESTYLE_SET_ACTIVE_VERSION") {
    const project = await RestyleStorage.setActiveVersion(message.id, message.versionId);
    if (message.tabId && project.enabled !== false) {
      await removeInjectedStyle(message.tabId, project.id);
      await injectPayload(message.tabId, RestyleStorage.projectToPayload(project));
    }
    return { ok: true, project, projects: await RestyleStorage.getSavedProjects() };
  }

  // Gallery messages
  if (message.type === "GALLERY_GET_STYLES_FOR_SITE") {
    const url = message.url;
    if (!url) return { ok: false, error: "No URL provided" };
    try {
      const domain = new URL(url).hostname.replace(/^www\./, "");
      const styles = await MorphixGallery.getStylesForSite(domain);
      return { ok: true, styles };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  if (message.type === "GALLERY_GET_AUTH_STATUS") {
    try {
      const authenticated = await MorphixGallery.isAuthenticated();
      const user = authenticated ? await MorphixGallery.getCurrentUser() : null;
      return { ok: true, authenticated, user };
    } catch (e) {
      return { ok: true, authenticated: false, user: null };
    }
  }

  if (message.type === "GALLERY_UPLOAD") {
    try {
      const result = await MorphixGallery.uploadStyle(
        RestyleStorage.exportToMorphix(message.project),
        message.tags || []
      );
      return { ok: true, result };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  if (message.type === "GALLERY_CAPTURE_AND_UPLOAD") {
    try {
      const tabId = message.tabId;
      if (!tabId) return { ok: false, error: "No tab provided" };

      // Capture screenshot of the styled page
      let screenshotDataUrl = null;
      try {
        screenshotDataUrl = await ext.tabs.captureVisibleTab(null, { format: "png" });
      } catch (e) {
        // Screenshot failed, continue without it
      }

      const morphix = RestyleStorage.exportToMorphix(message.project);
      if (screenshotDataUrl) {
        morphix.screenshots = [screenshotDataUrl];
      }

      const result = await MorphixGallery.uploadStyle(morphix, message.tags || []);
      return { ok: true, result };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  return { ok: false, error: "Unknown message type" };
}

async function handleExternalMessage(message, sender) {
  if (message.type === "MORPHIX_INSTALL_STYLE" && message.slug) {
    try {
      // Download the .morphix from the gallery API using hardcoded Supabase config
      const supabaseUrl = MorphixGallery.getSupabaseUrl();
      const supabaseAnonKey = MorphixGallery.getSupabaseAnonKey();

      const res = await fetch(`${supabaseUrl}/rest/v1/styles?select=morphix_file,id&slug=eq.${encodeURIComponent(message.slug)}&is_published=eq.true&limit=1`, {
        headers: {
          "apikey": supabaseAnonKey,
          "Authorization": `Bearer ${supabaseAnonKey}`,
        },
      });

      if (!res.ok) return { ok: false, error: "Style not found" };
      const data = await res.json();
      if (!data?.[0]?.morphix_file) return { ok: false, error: "Style has no data" };

      const morphixFile = data[0].morphix_file;

      // Import into extension storage
      const project = await RestyleStorage.importFromMorphix(morphixFile, "sync");

      // Record the install
      try {
        await fetch(`${supabaseUrl}/rest/v1/installs`, {
          method: "POST",
          headers: {
            "apikey": supabaseAnonKey,
            "Authorization": `Bearer ${supabaseAnonKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            style_id: data[0].id,
            source: "gallery_web",
          }),
        });
      } catch (_) { /* non-critical */ }

      return { ok: true, project: { name: project.name, id: project.id } };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  return { ok: false, error: "Unknown external message type" };
}

async function createDraftRestyle(tabId, prompt, projectId) {
  if (!tabId) throw new Error("No active tab found");
  if (!prompt || !prompt.trim()) throw new Error("Enter a restyle prompt first");

  const oldDraft = await getDraftForTab(tabId);
  if (oldDraft) await removeDraftInjection(tabId, oldDraft);

  await enableCspBypassForTab(tabId);
  await ensureContentScript(tabId, "/content/extract.js");
  await ensureContentScript(tabId, "/content/inject.js");

  if (projectId) await removeInjectedStyle(tabId, projectId).catch(() => {});

  const contextResult = await ext.scripting.executeScript({
    target: { tabId },
    func: () => window.RestyleExtract.extractPageContext()
  });
  const pageContext = contextResult[0] && contextResult[0].result;
  if (!pageContext) throw new Error("Could not extract page context");

  const styleContext = projectId ? await buildStyleContext(projectId) : null;
  const aiResult = await callAiProvider(prompt.trim(), pageContext, styleContext);
  const draftId = RestyleStorage.uuid("draft");
  const draft = {
    id: draftId,
    tabId,
    projectId: projectId || null,
    css: aiResult.css || "",
    js: aiResult.js || "",
    description: aiResult.description || "Generated a page restyle.",
    prompt: prompt.trim(),
    pageContext,
    validation: null,
    created_at: new Date().toISOString()
  };
  draft.validation = await validateDraft(tabId, draft);

  await injectPayload(tabId, draft);
  await setDraftForTab(tabId, draft);
  return { ok: true, draft };
}

async function buildStyleContext(projectId) {
  const found = await RestyleStorage.findProject(projectId);
  if (!found) throw new Error("Style project not found");
  const version = RestyleStorage.activeVersion(found.project);
  return {
    currentStyle: {
      id: found.project.id,
      name: found.project.name,
      versionId: version && version.id,
      css: version && version.css,
      js: version && version.js,
      description: version && version.description
    },
    conversation: RestyleStorage.latestConversation(found.project, 8)
  };
}

async function callAiProvider(prompt, pageContext, styleContext) {
  const providerConfig = await RestyleProviders.getProviderConfig();
  const text = await RestyleProviders.callProvider(
    providerConfig,
    RestylePrompts.RESTYLE_SYSTEM_PROMPT,
    RestylePrompts.buildRestyleUserPrompt(prompt, pageContext, styleContext),
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

async function validateDraft(tabId, draft) {
  await ensureContentScript(tabId, "/content/inject.js");
  const result = await ext.scripting.executeScript({
    target: { tabId },
    func: (payload) => window.RestyleInject.validateStylePayload(payload),
    args: [
      {
        css: draft.css,
        js: draft.js
      }
    ]
  }).catch((error) => [{ result: { ok: false, warnings: [error.message || String(error)] } }]);
  return result[0] && result[0].result;
}

async function acceptDraft(message) {
  const tab = await ext.tabs.get(message.tabId);
  const draft = message.draft || await getDraftForTab(message.tabId);
  if (!draft) throw new Error("No draft to accept");

  let project;
  if (draft.projectId) {
    project = await RestyleStorage.addVersionFromDraft(draft.projectId, draft);
  } else {
    project = await RestyleStorage.createProjectFromDraft(draft, {
      url: tab.url,
      scope: message.scope || "exact",
      name: message.name || draft.description
    });
  }

  await removeDraftInjection(message.tabId, draft);
  if (project.enabled !== false) await injectPayload(message.tabId, RestyleStorage.projectToPayload(project));
  await clearDraftForTab(message.tabId);
  return { ok: true, project, projects: await RestyleStorage.getSavedProjects() };
}

async function discardDraft(tabId, draftId) {
  const draft = await getDraftForTab(tabId);
  if (!draft || (draftId && draft.id !== draftId)) return { ok: true };
  await removeDraftInjection(tabId, draft);
  await clearDraftForTab(tabId);

  if (draft.projectId) {
    const found = await RestyleStorage.findProject(draft.projectId);
    if (found && found.project.enabled !== false) {
      await injectPayload(tabId, RestyleStorage.projectToPayload(found.project));
    }
  }

  return { ok: true };
}

async function removeDraftInjection(tabId, draft) {
  if (!draft) return;
  await removeInjectedStyle(tabId, draft.id).catch(() => {});
}

async function getDraftsByTab() {
  const result = await ext.storage.local.get({ [DRAFTS_KEY]: {} });
  return result[DRAFTS_KEY] && typeof result[DRAFTS_KEY] === "object" ? result[DRAFTS_KEY] : {};
}

async function getDraftForTab(tabId) {
  const drafts = await getDraftsByTab();
  return drafts[String(tabId)] || null;
}

async function setDraftForTab(tabId, draft) {
  const drafts = await getDraftsByTab();
  drafts[String(tabId)] = draft;
  await ext.storage.local.set({ [DRAFTS_KEY]: drafts });
}

async function clearDraftForTab(tabId) {
  const drafts = await getDraftsByTab();
  delete drafts[String(tabId)];
  await ext.storage.local.set({ [DRAFTS_KEY]: drafts });
}

async function injectPayload(tabId, payload) {
  if (!payload) return;
  const signature = payloadSignature(payload);
  const tabPayloads = injectedPayloadsByTab.get(tabId) || new Map();
  if (tabPayloads.get(payload.id) === signature) return;

  await ensureContentScript(tabId, "/content/inject.js");
  if (payload.css) await insertExtensionCss(tabId, payload.id, payload.css);
  await ext.scripting.executeScript({
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
  tabPayloads.set(payload.id, signature);
  injectedPayloadsByTab.set(tabId, tabPayloads);
}

async function removeInjectedStyle(tabId, id) {
  if (!tabId || !id) return;
  const tabPayloads = injectedPayloadsByTab.get(tabId);
  if (tabPayloads) {
    tabPayloads.delete(id);
    if (!tabPayloads.size) injectedPayloadsByTab.delete(tabId);
  }
  await removeExtensionCss(tabId, id);
  await ensureContentScript(tabId, "/content/inject.js");
  await ext.scripting.executeScript({
    target: { tabId },
    func: (styleId) => window.RestyleInject.removeStylePayload(styleId),
    args: [id]
  });
}

async function insertExtensionCss(tabId, id, css) {
  const tabCss = injectedCssByTab.get(tabId) || new Map();
  const previousCss = tabCss.get(id);
  if (previousCss === css) return;

  if (previousCss) {
    await ext.scripting.removeCSS({
      target: { tabId },
      css: previousCss,
      origin: "USER"
    }).catch(() => {});
  }
  await ext.scripting.insertCSS({
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
  await ext.scripting.removeCSS({
    target: { tabId },
    css,
    origin: "USER"
  }).catch(() => {});
  tabCss.delete(id);
  if (!tabCss.size) injectedCssByTab.delete(tabId);
}

function payloadSignature(payload) {
  return JSON.stringify({
    id: payload.id,
    css: payload.css || "",
    js: payload.js || ""
  });
}

function clearInjectedCaches(tabId) {
  injectedCssByTab.delete(tabId);
  injectedPayloadsByTab.delete(tabId);
}

async function getMatchingStylesForUrl(url) {
  const projects = await RestyleStorage.findMatchingProjects(url);
  return projects.map((project) => ({
    ...project,
    activeVersion: RestyleStorage.activeVersion(project)
  }));
}

async function getProjectsForUrl(url) {
  const projects = await RestyleStorage.getAllProjects();
  return projects
    .filter((project) => RestyleStorage.matchPattern(project.url_pattern, url))
    .map((project) => ({
      ...project,
      activeVersion: RestyleStorage.activeVersion(project)
    }));
}

async function injectMatchingStyles(tabId, url) {
  const projects = await RestyleStorage.findMatchingProjects(url);
  const allProjects = await RestyleStorage.getAllProjects();
  const allProjectIds = new Set(allProjects.map((project) => project.id));
  const matchingIds = new Set(projects.map((project) => project.id));
  const appliedIds = await getAppliedIds(tabId);

  for (const id of appliedIds) {
    if (allProjectIds.has(id) && !matchingIds.has(id)) {
      await removeInjectedStyle(tabId, id).catch(() => {});
    }
  }

  for (const project of projects) {
    await injectPayload(tabId, RestyleStorage.projectToPayload(project)).catch(() => {});
  }
}

async function getAppliedIds(tabId) {
  await ensureContentScript(tabId, "/content/inject.js");
  const result = await ext.scripting.executeScript({
    target: { tabId },
    func: () => window.RestyleInject.getAppliedIds()
  }).catch(() => [{ result: [] }]);
  return Array.isArray(result[0] && result[0].result) ? result[0].result : [];
}

async function ensureContentScript(tabId, file) {
  await ext.scripting.executeScript({
    target: { tabId },
    files: [file.replace(/^\//, "")]
  }).catch(() => {});
}

async function enableCspBypassForTab(tabId) {
  const ruleId = DNR_RULE_BASE + tabId;
  await ext.declarativeNetRequest.updateSessionRules({
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
