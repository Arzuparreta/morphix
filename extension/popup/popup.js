(function () {
  const promptEl = document.getElementById("prompt");
  const applyEl = document.getElementById("apply");
  const statusEl = document.getElementById("status");
  const reviewEl = document.getElementById("review");
  const descriptionEl = document.getElementById("description");
  const sentContextEl = document.getElementById("sent-context");
  const siteStatusEl = document.getElementById("site-status");
  const libraryNameEl = document.getElementById("library-name");
  const optionsEl = document.getElementById("options");

  let activeTab = null;
  let currentDraft = null;

  document.addEventListener("DOMContentLoaded", init);
  applyEl.addEventListener("click", applyPrompt);
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => applyPromptChip(chip.dataset.prompt || chip.textContent));
  });
  document.getElementById("keep-url").addEventListener("click", () => keepSaved("url"));
  document.getElementById("keep-domain").addEventListener("click", () => keepSaved("domain"));
  document.getElementById("keep-session").addEventListener("click", keepSession);
  document.getElementById("save-library").addEventListener("click", () => keepSaved("url", libraryNameEl.value.trim(), true));
  document.getElementById("retry").addEventListener("click", retryPrompt);
  document.getElementById("different").addEventListener("click", tryDifferentPrompt);
  optionsEl.addEventListener("click", (event) => {
    event.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  async function init() {
    promptEl.focus();
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tabs[0];
    if (!activeTab || !activeTab.url) {
      setSiteStatus("No page selected");
      applyEl.disabled = true;
      return;
    }
    const response = await send({ type: "RESTYLE_GET_PAGE_STATE", url: activeTab.url });
    if (response.ok && response.count > 0) {
      setSiteStatus(`${response.count} saved restyle${response.count === 1 ? "" : "s"} active for this page`);
    } else {
      setSiteStatus("No saved restyles for this page");
    }
  }

  async function applyPrompt() {
    const prompt = promptEl.value.trim();
    if (!prompt) {
      showStatus("Enter a restyle prompt first", true);
      return;
    }
    if (!activeTab || !activeTab.id) {
      showStatus("Open a page before restyling.", true);
      return;
    }

    setBusy(true, "Reading this page and building a preview...");
    reviewEl.classList.add("hidden");

    const response = await send({
      type: "RESTYLE_APPLY_REQUEST",
      tabId: activeTab.id,
      prompt
    });

    setBusy(false);
    if (!response.ok) {
      showStatus(response.error || "Could not apply restyle", true);
      return;
    }

    currentDraft = response.draft;
    descriptionEl.textContent = currentDraft.description;
    sentContextEl.textContent = JSON.stringify(currentDraft.pageContext, null, 2);
    libraryNameEl.value = defaultName(currentDraft);
    statusEl.classList.add("hidden");
    reviewEl.classList.remove("hidden");
  }

  async function keepSaved(scope, name, libraryOnly) {
    if (!currentDraft) return;
    setBusy(true, "Saving restyle...");
    const response = await send({
      type: "RESTYLE_KEEP_SAVED",
      tabId: activeTab.id,
      scope,
      name: name || currentDraft.description,
      libraryOnly: Boolean(libraryOnly),
      draft: currentDraft
    });
    setBusy(false);
    if (!response.ok) {
      showStatus(response.error || "Could not save restyle", true);
      return;
    }
    currentDraft = null;
    reviewEl.classList.add("hidden");
    showStatus(libraryOnly ? "Restyle saved to the library." : "Restyle saved and applied.");
    if (!libraryOnly) setSiteStatus("Saved restyle active for this page");
  }

  async function keepSession() {
    if (!currentDraft) return;
    setBusy(true, "Keeping for this session...");
    const response = await send({
      type: "RESTYLE_KEEP_SESSION",
      tabId: activeTab.id,
      draft: currentDraft
    });
    setBusy(false);
    if (!response.ok) {
      showStatus(response.error || "Could not keep session restyle", true);
      return;
    }
    currentDraft = null;
    reviewEl.classList.add("hidden");
    showStatus("Restyle will stay for this session.");
  }

  async function retryPrompt() {
    if (!currentDraft) return;
    await discardDraft(false);
    applyPrompt();
  }

  async function tryDifferentPrompt() {
    await discardDraft(true);
    promptEl.value = "";
    promptEl.focus();
  }

  async function discardDraft(clearReview) {
    if (!currentDraft) return;
    await send({
      type: "RESTYLE_DISCARD_DRAFT",
      tabId: activeTab.id,
      draftId: currentDraft.id
    });
    currentDraft = null;
    if (clearReview) {
      reviewEl.classList.add("hidden");
      showStatus("Draft discarded.");
    }
  }

  function setBusy(isBusy, message) {
    document.body.classList.toggle("is-busy", isBusy);
    applyEl.disabled = isBusy;
    document.querySelectorAll(".row").forEach((button) => {
      button.disabled = isBusy;
    });
    document.querySelectorAll(".chip").forEach((button) => {
      button.disabled = isBusy;
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

  function defaultName(draft) {
    return (draft.description || draft.prompt || "Saved restyle").slice(0, 70);
  }

  function applyPromptChip(text) {
    const next = String(text || "").trim();
    if (!next) return;
    const current = promptEl.value.trim();
    promptEl.value = current ? `${current}\n${next}` : next;
    promptEl.focus();
  }

  function send(message) {
    return chrome.runtime.sendMessage(message);
  }
})();
