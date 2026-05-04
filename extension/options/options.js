(function () {
  const providerEl = document.getElementById("provider");
  const modelEl = document.getElementById("model");
  const keyEl = document.getElementById("api-key");
  const baseUrlEl = document.getElementById("base-url");
  const headersEl = document.getElementById("custom-headers");
  const testProviderEl = document.getElementById("test-provider");
  const saveProviderEl = document.getElementById("save-provider");
  const statusEl = document.getElementById("provider-status");
  const libraryEl = document.getElementById("library");

  let providers = {};
  let savedConfig = null;

  document.addEventListener("DOMContentLoaded", loadOptions);
  providerEl.addEventListener("change", applyProviderDefaults);
  testProviderEl.addEventListener("click", testProvider);
  saveProviderEl.addEventListener("click", saveProvider);

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
    renderLibrary(response.styles || []);
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
      customHeaders: headersEl.value.trim()
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

  function renderLibrary(styles) {
    libraryEl.textContent = "";
    if (!styles.length) {
      libraryEl.textContent = "No saved styles yet.";
      libraryEl.classList.add("muted");
      return;
    }
    libraryEl.classList.remove("muted");

    for (const style of styles) {
      const item = document.createElement("article");
      item.className = "style-item";

      const top = document.createElement("div");
      top.className = "style-top";

      const copy = document.createElement("div");
      const name = document.createElement("p");
      name.className = "style-name";
      name.textContent = style.name;
      const meta = document.createElement("p");
      meta.className = "style-meta";
      meta.textContent = style.enabled === false ? "library only" : "auto apply";
      copy.append(name, meta);

      const deleteButton = document.createElement("button");
      deleteButton.className = "delete";
      deleteButton.type = "button";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", async () => {
        const response = await send({ type: "RESTYLE_DELETE_STYLE", id: style.id });
        if (response.ok) renderLibrary(response.styles || []);
      });

      top.append(copy, deleteButton);
      item.append(top);
      item.append(createScopeEditor(style));

      if (style.description) {
        const description = document.createElement("p");
        description.className = "style-meta";
        description.textContent = style.description;
        item.append(description);
      }

      if (style.css) {
        const css = document.createElement("pre");
        css.textContent = style.css;
        item.append(css);
      }

      libraryEl.append(item);
    }
  }

  function createScopeEditor(style) {
    const scope = document.createElement("div");
    scope.className = "scope-editor";

    const label = document.createElement("span");
    label.className = "scope-label";
    label.textContent = "Apply on";

    const type = document.createElement("select");
    type.className = "scope-type";
    type.setAttribute("aria-label", `Scope type for ${style.name}`);
    type.append(
      createOption("exact", "This page"),
      createOption("domain", "Whole domain"),
      createOption("regex", "Regex")
    );
    type.value = style.url_pattern.type;

    const value = document.createElement("input");
    value.className = "scope-value";
    value.type = "text";
    value.value = style.url_pattern.value;
    value.setAttribute("aria-label", `Scope value for ${style.name}`);

    const save = document.createElement("button");
    save.className = "scope-save";
    save.type = "button";
    save.textContent = "Save";

    const status = document.createElement("span");
    status.className = "scope-status";

    type.addEventListener("change", () => {
      value.value = suggestScopeValue(type.value, style.url_pattern.value);
    });

    save.addEventListener("click", async () => {
      const patch = {
        url_pattern: {
          type: type.value,
          value: value.value.trim()
        }
      };
      if (!patch.url_pattern.value) {
        status.textContent = "Enter a value";
        return;
      }
      status.textContent = "Saving...";
      save.disabled = true;
      const response = await send({ type: "RESTYLE_UPDATE_STYLE", id: style.id, patch });
      save.disabled = false;
      if (!response.ok) {
        status.textContent = response.error || "Could not save";
        return;
      }
      status.textContent = "Saved";
      renderLibrary(response.styles || []);
    });

    scope.append(label, type, value, save, status);
    return scope;
  }

  function createOption(value, label) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    return option;
  }

  function suggestScopeValue(nextType, currentValue) {
    if (nextType !== "domain") return currentValue;
    try {
      return new URL(currentValue).hostname.replace(/^www\./, "");
    } catch (_error) {
      return currentValue.replace(/^www\./, "");
    }
  }

  function send(message) {
    return chrome.runtime.sendMessage(message);
  }
})();
