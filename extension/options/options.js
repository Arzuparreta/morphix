(function () {
  const ext = globalThis.RestyleBrowserApi || globalThis.browser || globalThis.chrome;
  const providerEl = document.getElementById("provider");
  const modelEl = document.getElementById("model");
  const keyEl = document.getElementById("api-key");
  const reasoningModeEl = document.getElementById("reasoning-mode");
  const baseUrlEl = document.getElementById("base-url");
  const headersEl = document.getElementById("custom-headers");
  const testProviderEl = document.getElementById("test-provider");
  const saveProviderEl = document.getElementById("save-provider");
  const statusEl = document.getElementById("provider-status");
  const libraryEl = document.getElementById("library");
  const importBtnEl = document.getElementById("import-style");
  const importFileEl = document.getElementById("import-file");
  const importStatusEl = document.getElementById("import-status");

  const galleryUrlEl = document.getElementById("gallery-url");
  const galleryKeyEl = document.getElementById("gallery-anon-key");
  const galleryEmailEl = document.getElementById("gallery-email");
  const galleryPassEl = document.getElementById("gallery-password");
  const saveGalleryEl = document.getElementById("save-gallery");
  const signoutGalleryEl = document.getElementById("signout-gallery");
  const galleryStatusEl = document.getElementById("gallery-status");

  const themeToggleEl = document.getElementById("theme-toggle");
  const themeIconEl = document.getElementById("theme-icon");

  let providers = {};
  let savedConfig = null;

  document.addEventListener("DOMContentLoaded", loadOptions);
  providerEl.addEventListener("change", applyProviderDefaults);
  testProviderEl.addEventListener("click", testProvider);
  saveProviderEl.addEventListener("click", saveProvider);
  importBtnEl.addEventListener("click", () => importFileEl.click());
  importFileEl.addEventListener("change", handleImportFile);
  saveGalleryEl.addEventListener("click", saveGalleryConfig);
  signoutGalleryEl.addEventListener("click", signOutGallery);
  themeToggleEl.addEventListener("click", toggleTheme);

  updateThemeIcon();

  async function loadOptions() {
    const response = await send({ type: "RESTYLE_GET_OPTIONS" });
    if (!response.ok) {
      statusEl.textContent = response.error || "Could not load options";
      return;
    }

    providers = response.providers || {};
    savedConfig = response.providerConfig || {};
    renderProviderSelect();
    fillProviderForm(savedConfig);
    loadGalleryConfig();
    renderLibrary(response.projects || []);
  }

  function renderProviderSelect() {
    providerEl.textContent = "";
    for (const [id, provider] of Object.entries(providers)) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = provider.name;
      providerEl.append(option);
    }
  }

  function fillProviderForm(config) {
    providerEl.value = config.provider || "openrouter";
    modelEl.value = config.model || "";
    keyEl.value = config.apiKey || "";
    reasoningModeEl.value = config.reasoningMode || "balanced";
    baseUrlEl.value = config.baseUrl || "";
    headersEl.value = config.customHeaders || "";
    updateKeyPlaceholder();
  }

  function applyProviderDefaults() {
    const provider = providers[providerEl.value] || {};
    modelEl.value = provider.defaultModel || "";
    baseUrlEl.value = provider.defaultBaseUrl || "";
    headersEl.value = "";
    keyEl.value = "";
    reasoningModeEl.value = provider.defaultReasoningMode || "balanced";
    updateKeyPlaceholder();
  }

  function updateKeyPlaceholder() {
    const provider = providers[providerEl.value] || {};
    keyEl.placeholder = provider.requiresKey ? "required" : "optional";
  }

  function readProviderForm() {
    return {
      provider: providerEl.value,
      model: modelEl.value.trim(),
      apiKey: keyEl.value.trim(),
      baseUrl: baseUrlEl.value.trim(),
      customHeaders: headersEl.value.trim(),
      reasoningMode: reasoningModeEl.value
    };
  }

  async function testProvider() {
    await submitProvider({ testOnly: true });
  }

  async function saveProvider() {
    await submitProvider({ testOnly: false });
  }

  async function submitProvider(options) {
    const providerConfig = readProviderForm();
    statusEl.textContent = options.testOnly ? "Testing provider..." : "Saving provider...";
    setProviderBusy(true);

    const type = options.testOnly ? "RESTYLE_TEST_PROVIDER" : "RESTYLE_SAVE_PROVIDER";
    const response = await send({ type, providerConfig });
    setProviderBusy(false);

    if (!response.ok) {
      statusEl.textContent = response.error || "Provider request failed";
      return;
    }

    if (!options.testOnly && response.providerConfig) {
      savedConfig = response.providerConfig;
      fillProviderForm(savedConfig);
    }
    statusEl.textContent = options.testOnly ? "Provider test succeeded." : "Provider saved.";
  }

  function setProviderBusy(isBusy) {
    testProviderEl.disabled = isBusy;
    saveProviderEl.disabled = isBusy;
  }

  function renderLibrary(projects) {
    libraryEl.textContent = "";
    libraryEl.classList.toggle("empty", !projects.length);
    if (!projects.length) {
      libraryEl.textContent = "No style workspaces yet. Create or save a preview from the popup and it will appear here.";
      return;
    }

    for (const project of projects) {
      const active = activeVersion(project);
      const item = document.createElement("article");
      item.className = "style-item";

      const top = document.createElement("div");
      top.className = "style-top";

      const copy = document.createElement("div");
      copy.className = "style-copy";
      const name = document.createElement("p");
      name.className = "style-name";
      name.textContent = project.name || "Untitled style";
      const meta = document.createElement("p");
      meta.className = project.enabled === false ? "style-status library-only" : "style-status";
      meta.textContent = project.enabled === false ? "paused or library only" : "auto apply";
      copy.append(name, meta);

      const actions = document.createElement("div");
      actions.className = "style-actions";

      const toggleButton = document.createElement("button");
      toggleButton.type = "button";
      toggleButton.textContent = project.enabled === false ? "Resume" : "Pause";
      toggleButton.addEventListener("click", async () => {
        const response = await send({ type: "RESTYLE_SET_PROJECT_ENABLED", id: project.id, enabled: project.enabled === false });
        if (response.ok) renderLibrary(response.projects || []);
      });

      const exportButton = document.createElement("button");
      exportButton.className = "export";
      exportButton.type = "button";
      exportButton.textContent = "Export";
      exportButton.title = "Export as .morphix file";
      exportButton.addEventListener("click", () => exportProjectFile(project));

      const shareButton = document.createElement("button");
      shareButton.className = "share-gallery";
      shareButton.type = "button";
      shareButton.textContent = "Share";
      shareButton.title = "Share to Morphix Gallery";
      shareButton.addEventListener("click", () => shareStyleToGallery(project));

      const deleteButton = document.createElement("button");
      deleteButton.className = "delete";
      deleteButton.type = "button";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", async () => {
        const response = await send({ type: "RESTYLE_DELETE_PROJECT", id: project.id });
        if (response.ok) renderLibrary(response.projects || []);
      });

      actions.append(toggleButton, exportButton, shareButton, deleteButton);
      top.append(copy, actions);
      item.append(top);
      item.append(createScopeEditor(project));

      if (active && active.description) {
        const description = document.createElement("p");
        description.className = "style-meta";
        description.textContent = active.description;
        item.append(description);
      }

      item.append(createVersionList(project));

      if (active && active.css) {
        const css = document.createElement("pre");
        css.textContent = active.css;
        item.append(css);
      }

      libraryEl.append(item);
    }
  }

  function createScopeEditor(project) {
    const scope = document.createElement("div");
    scope.className = "scope-editor";

    const label = document.createElement("span");
    label.className = "scope-label";
    label.textContent = "Apply on";

    const type = document.createElement("select");
    type.className = "scope-type";
    type.setAttribute("aria-label", `Scope type for ${project.name}`);
    type.append(
      createOption("exact", "This page"),
      createOption("domain", "Whole domain"),
      createOption("regex", "Regex"),
      createOption("library", "Library only")
    );
    type.value = project.url_pattern.type;

    const value = document.createElement("input");
    value.className = "scope-value";
    value.type = "text";
    value.value = project.url_pattern.value;
    value.setAttribute("aria-label", `Scope value for ${project.name}`);
    value.disabled = project.url_pattern.type === "library";

    const save = document.createElement("button");
    save.className = "scope-save";
    save.type = "button";
    save.textContent = "Save";

    const status = document.createElement("span");
    status.className = "scope-status";

    type.addEventListener("change", () => {
      value.value = suggestScopeValue(type.value, project.url_pattern.value);
      value.disabled = type.value === "library";
    });

    save.addEventListener("click", async () => {
      const patch = {
        url_pattern: {
          type: type.value,
          value: value.value.trim() || "library"
        },
        enabled: type.value === "library" ? false : project.enabled
      };
      if (patch.url_pattern.type !== "library" && !patch.url_pattern.value) {
        status.textContent = "Enter a value";
        return;
      }
      status.textContent = "Saving...";
      save.disabled = true;
      const response = await send({ type: "RESTYLE_UPDATE_PROJECT", id: project.id, patch });
      save.disabled = false;
      if (!response.ok) {
        status.textContent = response.error || "Could not save";
        return;
      }
      status.textContent = "Saved";
      renderLibrary(response.projects || []);
    });

    scope.append(label, type, value, save, status);
    return scope;
  }

  function createVersionList(project) {
    const details = document.createElement("details");
    details.className = "version-list";
    const summary = document.createElement("summary");
    const count = Array.isArray(project.versions) ? project.versions.length : 0;
    summary.textContent = `${count} version${count === 1 ? "" : "s"}`;
    details.append(summary);

    (project.versions || []).forEach((version, index) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = version.id === project.active_version_id ? "version-row active" : "version-row";
      row.textContent = `${index === 0 ? "Latest" : "Version " + (project.versions.length - index)} - ${version.description || version.prompt || "Style update"}`;
      row.addEventListener("click", async () => {
        const response = await send({ type: "RESTYLE_SET_ACTIVE_VERSION", id: project.id, versionId: version.id });
        if (response.ok) renderLibrary(response.projects || []);
      });
      details.append(row);
    });

    return details;
  }

  function activeVersion(project) {
    if (!project || !Array.isArray(project.versions)) return null;
    return project.versions.find((version) => version.id === project.active_version_id) || project.versions[0] || null;
  }

  function createOption(value, label) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    return option;
  }

  function suggestScopeValue(nextType, currentValue) {
    if (nextType === "library") return "library";
    if (nextType !== "domain") return currentValue === "library" ? "" : currentValue;
    try {
      return new URL(currentValue).hostname.replace(/^www\./, "");
    } catch (_error) {
      return currentValue.replace(/^www\./, "");
    }
  }

  function exportProjectFile(project) {
    const morphix = RestyleStorage.exportToMorphix(project);
    if (!morphix) {
      setImportStatus("Could not export this style.", true);
      return;
    }
    const filename = sanitizeFilename(project.name || "style") + ".morphix";
    downloadJson(morphix, filename);
    setImportStatus("Exported: " + filename);
  }

  function sanitizeFilename(name) {
    return name.replace(/[^a-zA-Z0-9\-_\s]/g, "").trim().replace(/\s+/g, "-") || "morphix-style";
  }

  function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    setImportStatus("Reading file...");

    let text;
    try {
      text = await readFileAsText(file);
    } catch (error) {
      setImportStatus("Could not read file: " + error.message, true);
      return;
    }

    let morphixJson;
    try {
      morphixJson = JSON.parse(text);
    } catch (error) {
      setImportStatus("Invalid JSON file.", true);
      return;
    }

    const validation = RestyleStorage.isMorphixValid(morphixJson);
    if (!validation.ok) {
      setImportStatus(validation.error, true);
      return;
    }

    setImportStatus("Importing style...");
    try {
      const result = await RestyleStorage.importFromMorphix(morphixJson, "sync");
      setImportStatus("Imported \"" + result.name + "\".");
      const response = await send({ type: "RESTYLE_GET_OPTIONS" });
      if (response.ok) renderLibrary(response.projects || []);
    } catch (error) {
      setImportStatus(error.message || "Import failed.", true);
    } finally {
      importFileEl.value = "";
    }
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error("File read failed"));
      reader.readAsText(file);
    });
  }

  function setImportStatus(message, isError) {
    importStatusEl.textContent = message;
    importStatusEl.classList.toggle("error", Boolean(isError));
  }

  // ── Gallery ────────────────────────────────────────

  async function loadGalleryConfig() {
    const config = await MorphixGallery.getConfig();
    if (config) {
      galleryUrlEl.value = config.supabaseUrl || "";
      galleryKeyEl.value = config.supabaseAnonKey || "";
    }
    const authed = await MorphixGallery.isAuthenticated();
    galleryStatusEl.textContent = authed ? "Connected to gallery" : "Not connected";
  }

  async function saveGalleryConfig() {
    const url = galleryUrlEl.value.trim();
    const key = galleryKeyEl.value.trim();
    const email = galleryEmailEl.value.trim();
    const password = galleryPassEl.value;

    if (!url || !key) {
      galleryStatusEl.textContent = "URL and anon key are required";
      return;
    }

    await MorphixGallery.saveConfig({ supabaseUrl: url, supabaseAnonKey: key });

    if (email && password) {
      galleryStatusEl.textContent = "Connecting...";
      try {
        await MorphixGallery.signIn(email, password);
        galleryStatusEl.textContent = "Connected to gallery";
        galleryPassEl.value = "";
      } catch (e) {
        galleryStatusEl.textContent = "Config saved, but login failed: " + e.message;
      }
    } else {
      galleryStatusEl.textContent = "Gallery config saved.";
    }
  }

  async function signOutGallery() {
    await MorphixGallery.signOut();
    galleryStatusEl.textContent = "Signed out";
  }

  async function shareStyleToGallery(project) {
    const config = await MorphixGallery.getConfig();
    if (!config || !config.supabaseUrl) {
      setImportStatus("Gallery not configured. Set up Supabase above.", true);
      return;
    }
    const authed = await MorphixGallery.isAuthenticated();
    if (!authed) {
      setImportStatus("Sign in to the gallery first (use email/password above).", true);
      return;
    }

    const tags = prompt("Add tags (comma separated, optional):");
    const tagList = tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [];

    setImportStatus("Uploading...");
    try {
      const response = await send({
        type: "GALLERY_UPLOAD",
        project: project,
        tags: tagList,
      });
      if (response.ok) {
        setImportStatus("Shared on gallery!");
      } else {
        setImportStatus(response.error || "Upload failed", true);
      }
    } catch (e) {
      setImportStatus(e.message || "Upload failed", true);
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "light") {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("morphix-theme", "dark");
    } else {
      document.documentElement.setAttribute("data-theme", "light");
      localStorage.setItem("morphix-theme", "light");
    }
    updateThemeIcon();
  }

  function updateThemeIcon() {
    const isDark = !document.documentElement.hasAttribute("data-theme") ||
      document.documentElement.getAttribute("data-theme") !== "light";
    themeIconEl.dataset.mode = isDark ? "dark" : "light";
    themeToggleEl.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
  }

  function send(message) {
    return ext.runtime.sendMessage(message);
  }
})();
