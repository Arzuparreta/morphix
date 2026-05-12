(function () {
  const ext = globalThis.RestyleBrowserApi || globalThis.browser || globalThis.chrome;
  const promptEl = document.getElementById("prompt");
  const promptLabelEl = document.getElementById("prompt-label");
  const applyEl = document.getElementById("apply");
  const statusEl = document.getElementById("status");
  const previewEl = document.getElementById("preview");
  const descriptionEl = document.getElementById("description");
  const sentContextEl = document.getElementById("sent-context");
  const warningsEl = document.getElementById("warnings");
  const siteStatusEl = document.getElementById("site-status");
  const optionsEl = document.getElementById("options");
  const themeToggleEl = document.getElementById("theme-toggle");
  const themeIconEl = document.getElementById("theme-icon");
  const activeStyleEl = document.getElementById("active-style");
  const activeNameEl = document.getElementById("active-name");
  const activeDescriptionEl = document.getElementById("active-description");
  const activeStateEl = document.getElementById("active-state");
  const toggleStyleEl = document.getElementById("toggle-style");
  const deleteStyleEl = document.getElementById("delete-style");
  const showVersionsEl = document.getElementById("show-versions");
  const versionsEl = document.getElementById("versions");
  const scopePickerEl = document.getElementById("scope-picker");
  const composeHintEl = document.getElementById("compose-hint");
  const acceptDraftEl = document.getElementById("accept-draft");
  const discardDraftEl = document.getElementById("discard-draft");
  const exportStyleEl = document.getElementById("export-style");
  const shareGalleryEl = document.getElementById("share-gallery");

  let activeTab = null;
  let currentDraft = null;
  let activeProjects = [];
  let pageProjects = [];
  let currentProject = null;

  document.addEventListener("DOMContentLoaded", init);
  applyEl.addEventListener("click", createPreview);
  acceptDraftEl.addEventListener("click", acceptDraft);
  discardDraftEl.addEventListener("click", discardDraft);
  toggleStyleEl.addEventListener("click", toggleActiveStyle);
  deleteStyleEl.addEventListener("click", deleteActiveStyle);
  exportStyleEl.addEventListener("click", exportActiveStyle);
  shareGalleryEl.addEventListener("click", shareToGallery);
  showVersionsEl.addEventListener("click", toggleVersions);
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => applyPromptChip(chip.dataset.prompt || chip.textContent));
  });
  optionsEl.addEventListener("click", (event) => {
    event.preventDefault();
    ext.runtime.openOptionsPage();
  });
  themeToggleEl.addEventListener("click", toggleTheme);

  // Set initial theme icon
  function updateThemeIcon() {
    const isDark = !document.documentElement.hasAttribute("data-theme") ||
      document.documentElement.getAttribute("data-theme") !== "light";
    themeIconEl.dataset.mode = isDark ? "dark" : "light";
    themeToggleEl.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
  }
  updateThemeIcon();

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

  async function init() {
    promptEl.focus();
    const tabs = await ext.tabs.query({ active: true, currentWindow: true });
    activeTab = tabs[0];
    if (!activeTab || !activeTab.url) {
      setSiteStatus("No page selected");
      applyEl.disabled = true;
      return;
    }
    await loadPageState();
  }

  async function loadPageState() {
    const response = await send({ type: "RESTYLE_GET_PAGE_STATE", tabId: activeTab.id, url: activeTab.url });
    if (!response.ok) {
      showStatus(response.error || "Could not read page state", true);
      return;
    }

    activeProjects = response.activeProjects || [];
    pageProjects = response.pageProjects || activeProjects;
    currentProject = activeProjects[0] || pageProjects[0] || null;
    currentDraft = response.draft || null;
    render();
  }

  function render() {
    const activeCount = activeProjects.length;
    setSiteStatus(activeCount
      ? `${activeCount} style${activeCount === 1 ? "" : "s"} active on this page`
      : "No active style on this page");

    renderActiveProject();
    renderDraft();

    const isRefining = Boolean(currentProject);
    promptLabelEl.textContent = isRefining ? "Refine this style" : "What should change?";
    applyEl.querySelector(".button-label").textContent = isRefining ? "Preview update" : "Preview";
    composeHintEl.textContent = isRefining
      ? "Your prompt edits the active style and keeps version history."
      : "Preview the style first. Keep it only if it works.";
    scopePickerEl.classList.toggle("hidden", isRefining);
  }

  function renderActiveProject() {
    activeStyleEl.classList.toggle("hidden", !currentProject);
    if (!currentProject) {
      versionsEl.classList.add("hidden");
      return;
    }

    const activeVersion = currentProject.activeVersion || firstVersion(currentProject);
    activeNameEl.textContent = currentProject.name || activeVersion.description || "Untitled style";
    activeDescriptionEl.textContent = activeVersion.description || "This page has a saved Morphix style.";
    activeStateEl.textContent = currentProject.enabled === false ? "Paused" : "Active";
    activeStateEl.classList.toggle("paused", currentProject.enabled === false);
    toggleStyleEl.textContent = currentProject.enabled === false ? "Resume" : "Pause";
    renderVersions();
  }

  function renderVersions() {
    versionsEl.textContent = "";
    if (!currentProject || !Array.isArray(currentProject.versions)) return;
    currentProject.versions.forEach((version, index) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = version.id === currentProject.active_version_id ? "version-row active" : "version-row";
      row.textContent = `${index === 0 ? "Latest" : "Version " + (currentProject.versions.length - index)} - ${version.description || version.prompt || "Style update"}`;
      row.addEventListener("click", () => restoreVersion(version.id));
      versionsEl.append(row);
    });
  }

  function renderDraft() {
    previewEl.classList.toggle("hidden", !currentDraft);
    if (!currentDraft) return;
    descriptionEl.textContent = currentDraft.description || "Preview generated.";
    sentContextEl.textContent = JSON.stringify(currentDraft.pageContext, null, 2);
    acceptDraftEl.textContent = currentDraft.projectId ? "Apply update" : "Keep style";
    renderWarnings(currentDraft.validation);
  }

  function renderWarnings(validation) {
    const findings = validation && Array.isArray(validation.findings) ? validation.findings : [];
    const summary = validation && validation.summary ? validation.summary : {};
    const critical = findings.filter((item) => item.severity === "critical");
    const info = findings.filter((item) => item.severity !== "critical");
    const warnings = [];

    if (summary.autoRepaired) {
      warnings.push({ text: "Morphix auto-repaired critical selector issues before showing this preview.", severity: "info" });
    }
    if (summary.siteCoverage && summary.siteCoverage.routeSampleCount > 1) {
      warnings.push({
        text: `Site coverage: sampled ${summary.siteCoverage.routeSampleCount} route views${summary.siteCoverage.partial ? " with partial coverage" : ""}.`,
        severity: "info"
      });
    }
    critical.forEach((item) => warnings.push({ text: item.message, severity: "critical" }));
    info.forEach((item) => warnings.push({ text: item.message, severity: "info" }));

    warningsEl.textContent = "";
    warningsEl.classList.toggle("hidden", !warnings.length);
    warningsEl.dataset.level = critical.length ? "critical" : "info";
    warnings.forEach((warning) => {
      const item = document.createElement("li");
      item.textContent = warning.text;
      item.className = warning.severity === "critical" ? "warning-critical" : "warning-info";
      warningsEl.append(item);
    });
  }

  async function createPreview() {
    const prompt = promptEl.value.trim();
    if (!prompt) {
      showStatus(currentProject ? "Describe how to refine this style first" : "Enter a restyle prompt first", true);
      return;
    }
    if (!activeTab || !activeTab.id) {
      showStatus("Open a page before restyling.", true);
      return;
    }

    setBusy(true, currentProject ? "Refining the active style..." : "Reading this page and building a preview...");
    previewEl.classList.add("hidden");

    const response = await send({
      type: "RESTYLE_CREATE_DRAFT",
      tabId: activeTab.id,
      projectId: currentProject && currentProject.id,
      prompt,
      scope: previewScope()
    });

    setBusy(false);
    if (!response.ok) {
      showStatus(response.error || "Could not create preview", true);
      return;
    }

    currentDraft = response.draft;
    statusEl.classList.add("hidden");
    render();
  }

  async function acceptDraft() {
    if (!currentDraft) return;
    setBusy(true, currentDraft.projectId ? "Applying update..." : "Saving style...");
    const response = await send({
      type: "RESTYLE_ACCEPT_DRAFT",
      tabId: activeTab.id,
      draft: currentDraft,
      scope: selectedScope()
    });
    setBusy(false);
    if (!response.ok) {
      showStatus(response.error || "Could not apply style", true);
      return;
    }

    promptEl.value = "";
    currentDraft = null;
    showStatus(response.project && response.project.enabled === false
      ? "Style saved to the library."
      : "Style applied.");
    await loadPageState();
  }

  async function discardDraft() {
    if (!currentDraft) return;
    setBusy(true, "Discarding preview...");
    const response = await send({
      type: "RESTYLE_DISCARD_DRAFT",
      tabId: activeTab.id,
      draftId: currentDraft.id
    });
    setBusy(false);
    if (!response.ok) {
      showStatus(response.error || "Could not discard preview", true);
      return;
    }
    currentDraft = null;
    showStatus("Preview discarded.");
    await loadPageState();
  }

  async function exportActiveStyle() {
    if (!currentProject) return;
    const morphix = RestyleStorage.exportToMorphix(currentProject);
    if (!morphix) {
      showStatus("Could not export this style.", true);
      return;
    }
    const filename = sanitizeFilename(currentProject.name || "style") + ".morphix";
    downloadJson(morphix, filename);
    showStatus("Style exported as " + filename);
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

  async function shareToGallery() {
    if (!currentProject) return;

    // Check auth
    const authed = await MorphixGallery.isAuthenticated();
    if (!authed) {
      showStatus("Sign in to the gallery first. Open options to create an account or sign in.", true);
      return;
    }

    const tags = prompt("Add tags (comma separated, optional):");
    const tagList = tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [];

    setBusy(true, "Capturing screenshot and uploading...");
    try {
      const response = await send({
        type: "GALLERY_CAPTURE_AND_UPLOAD",
        tabId: activeTab.id,
        project: currentProject,
        tags: tagList,
      });
      setBusy(false);
      if (response.ok) {
        showStatus("Shared on gallery!");
      } else {
        showStatus(response.error || "Upload failed", true);
      }
    } catch (e) {
      setBusy(false);
      showStatus(e.message || "Upload failed", true);
    }
  }

  async function toggleActiveStyle() {
    if (!currentProject) return;
    const nextEnabled = currentProject.enabled === false;
    setBusy(true, nextEnabled ? "Resuming style..." : "Pausing style...");
    const response = await send({
      type: "RESTYLE_SET_PROJECT_ENABLED",
      tabId: activeTab.id,
      id: currentProject.id,
      enabled: nextEnabled
    });
    setBusy(false);
    if (!response.ok) {
      showStatus(response.error || "Could not update style", true);
      return;
    }
    showStatus(nextEnabled ? "Style resumed." : "Style paused.");
    await loadPageState();
  }

  async function deleteActiveStyle() {
    if (!currentProject) return;
    setBusy(true, "Deleting style...");
    const response = await send({
      type: "RESTYLE_DELETE_PROJECT",
      tabId: activeTab.id,
      id: currentProject.id
    });
    setBusy(false);
    if (!response.ok) {
      showStatus(response.error || "Could not delete style", true);
      return;
    }
    currentProject = null;
    showStatus("Style deleted.");
    await loadPageState();
  }

  async function restoreVersion(versionId) {
    if (!currentProject) return;
    setBusy(true, "Restoring version...");
    const response = await send({
      type: "RESTYLE_SET_ACTIVE_VERSION",
      tabId: activeTab.id,
      id: currentProject.id,
      versionId
    });
    setBusy(false);
    if (!response.ok) {
      showStatus(response.error || "Could not restore version", true);
      return;
    }
    showStatus("Version restored.");
    await loadPageState();
  }

  function toggleVersions() {
    versionsEl.classList.toggle("hidden");
  }

  function setBusy(isBusy, message) {
    document.body.classList.toggle("is-busy", isBusy);
    document.querySelectorAll("button, input, textarea").forEach((element) => {
      element.disabled = isBusy;
    });
    if (message) showStatus(message);
  }

  function showStatus(message, isError) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", Boolean(isError));
    statusEl.classList.remove("hidden");
  }

  function setSiteStatus(message) {
    siteStatusEl.textContent = message;
  }

  function selectedScope() {
    const checked = document.querySelector('input[name="scope"]:checked');
    return checked ? checked.value : "exact";
  }

  function previewScope() {
    if (!currentProject || !currentProject.url_pattern) return selectedScope();
    if (currentProject.url_pattern.type === "domain") return "domain";
    if (currentProject.url_pattern.type === "library") return "library";
    return "exact";
  }

  function firstVersion(project) {
    return project && Array.isArray(project.versions) && project.versions[0] ? project.versions[0] : {};
  }

  function applyPromptChip(text) {
    const next = String(text || "").trim();
    if (!next) return;
    const current = promptEl.value.trim();
    promptEl.value = current ? `${current}\n${next}` : next;
    promptEl.focus();
  }

  function send(message) {
    return ext.runtime.sendMessage(message);
  }
})();
