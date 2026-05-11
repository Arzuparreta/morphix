(function () {
  const ext = globalThis.RestyleBrowserApi || globalThis.browser || globalThis.chrome;
  const LEGACY_SYNC_KEY = "saved_styles";
  const LEGACY_SESSION_KEY = "session_styles";
  const SYNC_PROJECTS_KEY = "style_projects_v1";
  const SESSION_PROJECTS_KEY = "session_style_projects_v1";

  function nowIso() {
    return new Date().toISOString();
  }

  function uuid(prefix) {
    if (crypto && crypto.randomUUID) return (prefix || "id") + "_" + crypto.randomUUID();
    return (prefix || "id") + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);
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

  function getLibraryPattern() {
    return {
      type: "library",
      value: "library"
    };
  }

  function patternForScope(scope, rawUrl) {
    if (scope === "domain") return getDomainPattern(rawUrl);
    if (scope === "library") return getLibraryPattern();
    return getExactPattern(rawUrl);
  }

  function matchPattern(pattern, rawUrl) {
    if (!pattern || !rawUrl || pattern.type === "library") return false;
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

  function activeVersion(project) {
    if (!project || !Array.isArray(project.versions)) return null;
    return project.versions.find((version) => version.id === project.active_version_id) || project.versions[0] || null;
  }

  function latestConversation(project, limit) {
    const items = Array.isArray(project && project.conversation) ? project.conversation : [];
    return items.slice(Math.max(0, items.length - (limit || 8)));
  }

  function makeVersion(input) {
    return {
      id: input.id || uuid("version"),
      css: input.css || "",
      js: input.js || "",
      prompt: input.prompt || "",
      description: input.description || "",
      validation: input.validation || null,
      parent_version_id: input.parent_version_id || null,
      created_at: input.created_at || nowIso()
    };
  }

  function makeProject(input) {
    const version = makeVersion({
      id: input.version_id,
      css: input.css,
      js: input.js,
      prompt: input.prompt,
      description: input.description,
      validation: input.validation,
      parent_version_id: input.parent_version_id,
      created_at: input.created_at
    });
    const createdAt = input.created_at || nowIso();
    const project = {
      id: input.id || uuid("style"),
      name: input.name || input.description || input.prompt || "Untitled style",
      url_pattern: input.url_pattern,
      enabled: input.enabled !== false,
      active_version_id: version.id,
      versions: [version],
      conversation: [],
      created_at: createdAt,
      updated_at: input.updated_at || createdAt,
      hits: input.hits || 0
    };

    if (version.prompt) {
      project.conversation.push({
        role: "user",
        content: version.prompt,
        version_id: version.id,
        created_at: version.created_at
      });
    }
    if (version.description) {
      project.conversation.push({
        role: "assistant",
        content: version.description,
        version_id: version.id,
        created_at: version.created_at
      });
    }

    return project;
  }

  function legacyStyleToProject(style) {
    return makeProject({
      id: style.id || uuid("style"),
      name: style.name || style.description || "Saved style",
      url_pattern: style.url_pattern,
      css: style.css || "",
      js: style.js || "",
      prompt: style.prompt || "",
      description: style.description || "",
      enabled: style.enabled !== false,
      created_at: style.created_at,
      hits: style.hits || 0
    });
  }

  function normalizeProject(project) {
    const versions = Array.isArray(project.versions) && project.versions.length
      ? project.versions.map((version) => makeVersion(version))
      : [makeVersion(project)];
    const active = versions.find((version) => version.id === project.active_version_id) || versions[0];
    return {
      id: project.id || uuid("style"),
      name: project.name || project.description || "Untitled style",
      url_pattern: project.url_pattern || getLibraryPattern(),
      enabled: project.enabled !== false,
      active_version_id: active.id,
      versions,
      conversation: Array.isArray(project.conversation) ? project.conversation : [],
      created_at: project.created_at || versions[0].created_at || nowIso(),
      updated_at: project.updated_at || versions[versions.length - 1].created_at || nowIso(),
      hits: project.hits || 0
    };
  }

  async function getStoredProjects(storageArea, key, legacyKey) {
    const result = await storageArea.get({ [key]: null, [legacyKey]: [] });
    const stored = Array.isArray(result[key]) ? result[key].map(normalizeProject) : null;
    if (stored) return stored;

    const legacy = Array.isArray(result[legacyKey]) ? result[legacyKey] : [];
    const migrated = legacy.map(legacyStyleToProject);
    await storageArea.set({ [key]: migrated });
    return migrated;
  }

  async function getSavedProjects() {
    return getStoredProjects(ext.storage.sync, SYNC_PROJECTS_KEY, LEGACY_SYNC_KEY);
  }

  async function setSavedProjects(projects) {
    await ext.storage.sync.set({ [SYNC_PROJECTS_KEY]: projects.map(normalizeProject) });
  }

  async function getSessionProjects() {
    return getStoredProjects(ext.storage.local, SESSION_PROJECTS_KEY, LEGACY_SESSION_KEY);
  }

  async function setSessionProjects(projects) {
    await ext.storage.local.set({ [SESSION_PROJECTS_KEY]: projects.map(normalizeProject) });
  }

  async function getAllProjects() {
    const saved = await getSavedProjects();
    const session = await getSessionProjects();
    return saved.map((project) => ({ ...project, storage: "sync" }))
      .concat(session.map((project) => ({ ...project, storage: "session" })));
  }

  async function findProject(id) {
    const saved = await getSavedProjects();
    const savedProject = saved.find((project) => project.id === id);
    if (savedProject) return { project: savedProject, storage: "sync", projects: saved };

    const session = await getSessionProjects();
    const sessionProject = session.find((project) => project.id === id);
    if (sessionProject) return { project: sessionProject, storage: "session", projects: session };

    return null;
  }

  async function saveProjectList(storage, projects) {
    if (storage === "session") return setSessionProjects(projects);
    return setSavedProjects(projects);
  }

  async function createProjectFromDraft(draft, options) {
    const scope = options.scope || "exact";
    const storage = scope === "session" ? "session" : "sync";
    const pattern = patternForScope(scope, options.url);
    const project = makeProject({
      name: options.name || draft.description || draft.prompt || "Untitled style",
      url_pattern: pattern,
      css: draft.css,
      js: draft.js,
      prompt: draft.prompt,
      description: draft.description,
      validation: draft.validation,
      enabled: scope !== "library"
    });

    const projects = storage === "session" ? await getSessionProjects() : await getSavedProjects();
    projects.unshift(project);
    await saveProjectList(storage, projects);
    return { ...project, storage };
  }

  async function addVersionFromDraft(projectId, draft) {
    const found = await findProject(projectId);
    if (!found) throw new Error("Style project not found");

    const parent = activeVersion(found.project);
    const nextVersion = makeVersion({
      css: draft.css,
      js: draft.js,
      prompt: draft.prompt,
      description: draft.description,
      validation: draft.validation,
      parent_version_id: parent && parent.id
    });
    const updated = {
      ...found.project,
      name: found.project.name || draft.description || "Untitled style",
      active_version_id: nextVersion.id,
      versions: [nextVersion].concat(found.project.versions || []),
      conversation: (found.project.conversation || []).concat([
        {
          role: "user",
          content: draft.prompt || "",
          version_id: nextVersion.id,
          created_at: nextVersion.created_at
        },
        {
          role: "assistant",
          content: draft.description || "Updated style.",
          version_id: nextVersion.id,
          created_at: nextVersion.created_at
        }
      ]),
      updated_at: nextVersion.created_at
    };

    const projects = found.projects.map((project) => project.id === projectId ? updated : project);
    await saveProjectList(found.storage, projects);
    return { ...updated, storage: found.storage };
  }

  async function updateProject(id, patch) {
    const found = await findProject(id);
    if (!found) return null;
    const updated = normalizeProject({
      ...found.project,
      ...patch,
      id: found.project.id,
      updated_at: nowIso()
    });
    const projects = found.projects.map((project) => project.id === id ? updated : project);
    await saveProjectList(found.storage, projects);
    return { ...updated, storage: found.storage };
  }

  async function setProjectEnabled(id, enabled) {
    return updateProject(id, { enabled: Boolean(enabled) });
  }

  async function setActiveVersion(id, versionId) {
    const found = await findProject(id);
    if (!found) return null;
    if (!found.project.versions.some((version) => version.id === versionId)) {
      throw new Error("Version not found");
    }
    return updateProject(id, { active_version_id: versionId });
  }

  async function deleteProject(id) {
    const found = await findProject(id);
    if (!found) return;
    await saveProjectList(found.storage, found.projects.filter((project) => project.id !== id));
  }

  async function findMatchingProjects(rawUrl) {
    const projects = await getAllProjects();
    return projects.filter((project) => project.enabled !== false && matchPattern(project.url_pattern, rawUrl));
  }

  function projectToPayload(project) {
    const version = activeVersion(project);
    if (!version) return null;
    return {
      id: project.id,
      css: version.css || "",
      js: version.js || "",
      prompt: version.prompt || "",
      description: version.description || project.name || "Saved style",
      projectId: project.id,
      versionId: version.id
    };
  }

  async function updateProjectScope(id, urlPattern) {
    return updateProject(id, { url_pattern: urlPattern });
  }

  function exportToMorphix(project, authorInfo) {
    const version = activeVersion(project);
    if (!version) return null;

    return {
      format_version: 1,
      type: "morphix_style",
      style: {
        name: project.name || "Untitled style",
        description: version.description || project.name || "",
        url_pattern: project.url_pattern || getLibraryPattern(),
        active_version: {
          css: version.css || "",
          js: version.js || "",
          prompt: version.prompt || "",
          description: version.description || "",
          validation: version.validation || null,
          parent_version_id: version.parent_version_id,
          created_at: version.created_at
        },
        versions: Array.isArray(project.versions)
          ? project.versions.map((v) => ({
              id: v.id,
              css: v.css || "",
              js: v.js || "",
              prompt: v.prompt || "",
              description: v.description || "",
              validation: v.validation || null,
              parent_version_id: v.parent_version_id || null,
              created_at: v.created_at
            }))
          : [],
        conversation: Array.isArray(project.conversation)
          ? project.conversation.map((c) => ({
              role: c.role,
              content: c.content,
              version_id: c.version_id,
              created_at: c.created_at
            }))
          : []
      },
      author: authorInfo || { name: "" },
      exported_at: nowIso()
    };
  }

  function isMorphixValid(morphixJson) {
    if (!morphixJson || typeof morphixJson !== "object") {
      return { ok: false, error: "Invalid file: not a valid JSON object" };
    }
    if (morphixJson.format_version !== 1) {
      return { ok: false, error: "Unsupported format version: " + (morphixJson.format_version || "missing") };
    }
    if (morphixJson.type !== "morphix_style") {
      return { ok: false, error: "Invalid file: not a Morphix style" };
    }
    if (!morphixJson.style || typeof morphixJson.style !== "object") {
      return { ok: false, error: "Invalid file: missing style data" };
    }
    return { ok: true };
  }

  function findSimilarProject(project, projects) {
    const active = activeVersion(project);
    const css = active?.css || "";
    const js = active?.js || "";
    for (const existing of projects) {
      const existingActive = activeVersion(existing);
      if (
        existing.name === project.name &&
        JSON.stringify(existing.url_pattern) === JSON.stringify(project.url_pattern) &&
        existingActive?.css === css &&
        existingActive?.js === js
      ) {
        return existing;
      }
    }
    return null;
  }

  async function importFromMorphix(morphixJson, storage) {
    const validation = isMorphixValid(morphixJson);
    if (!validation.ok) throw new Error(validation.error);

    const style = morphixJson.style;
    const versionIdMap = new Map();
    const newVersions = [];

    // Pass 1: build ID mapping
    if (Array.isArray(style.versions) && style.versions.length > 0) {
      for (const v of style.versions) {
        versionIdMap.set(v.id, uuid("version"));
      }
    }

    // Pass 2: create versions with remapped IDs and parent links
    if (Array.isArray(style.versions) && style.versions.length > 0) {
      for (const v of style.versions) {
        const newId = versionIdMap.get(v.id);
        newVersions.push(
          makeVersion({
            id: newId,
            css: v.css,
            js: v.js,
            prompt: v.prompt,
            description: v.description,
            validation: v.validation,
            parent_version_id: v.parent_version_id ? versionIdMap.get(v.parent_version_id) || null : null,
            created_at: v.created_at
          })
        );
      }
    } else {
      const av = style.active_version || {};
      newVersions.push(
        makeVersion({
          css: av.css,
          js: av.js,
          prompt: av.prompt,
          description: av.description,
          validation: av.validation
        })
      );
    }

    const activeVersionObj = newVersions[0];

    const newConversation = [];
    if (Array.isArray(style.conversation)) {
      for (const c of style.conversation) {
        newConversation.push({
          role: c.role,
          content: c.content,
          version_id: versionIdMap.get(c.version_id) || activeVersionObj.id,
          created_at: c.created_at || nowIso()
        });
      }
    }

    if (newConversation.length === 0 && activeVersionObj.prompt) {
      newConversation.push({
        role: "user",
        content: activeVersionObj.prompt,
        version_id: activeVersionObj.id,
        created_at: activeVersionObj.created_at
      });
    }
    if (newConversation.length <= 1 && activeVersionObj.description) {
      newConversation.push({
        role: "assistant",
        content: activeVersionObj.description,
        version_id: activeVersionObj.id,
        created_at: activeVersionObj.created_at
      });
    }

    const newProjectId = uuid("style");
    const project = {
      id: newProjectId,
      name: style.name || "Imported style",
      url_pattern: style.url_pattern || getLibraryPattern(),
      enabled: style.url_pattern?.type === "library" ? false : true,
      active_version_id: activeVersionObj.id,
      versions: newVersions,
      conversation: newConversation,
      created_at: nowIso(),
      updated_at: nowIso(),
      hits: 0
    };

    const targetStorage = storage || "sync";
    const projects = targetStorage === "session" ? await getSessionProjects() : await getSavedProjects();

    const similar = findSimilarProject(project, projects);
    if (similar) {
      throw new Error(
        "A style with this name, target, and CSS already exists: \"" +
          similar.name +
          "\". Delete it first, or import as a copy."
      );
    }

    projects.unshift(project);
    await saveProjectList(targetStorage, projects);
    return { ...project, storage: targetStorage };
  }

  self.RestyleStorage = {
    activeVersion,
    addVersionFromDraft,
    createProjectFromDraft,
    deleteProject,
    exportToMorphix,
    findMatchingProjects,
    findProject,
    getAllProjects,
    getDomainPattern,
    getExactPattern,
    getLibraryPattern,
    getSavedProjects,
    getSessionProjects,
    importFromMorphix,
    isMorphixValid,
    latestConversation,
    matchPattern,
    patternForScope,
    projectToPayload,
    setActiveVersion,
    setProjectEnabled,
    setSavedProjects,
    setSessionProjects,
    updateProject,
    updateProjectScope,
    uuid
  };
})();
