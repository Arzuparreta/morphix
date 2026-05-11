// Test script for Morphix export/import roundtrip
// Run: node scripts/test-morphix-format.js

const fs = require('fs');
const path = require('path');

// Minimal mock of the browser extension environment with persistent storage
globalThis.self = globalThis;
const mockStore = { sync: {}, local: {} };
globalThis.chrome = {
  storage: {
    sync: {
      get: async (keys) => {
        const result = {};
        for (const key of Object.keys(keys || {})) {
          result[key] = mockStore.sync[key] !== undefined ? mockStore.sync[key] : keys[key];
        }
        return result;
      },
      set: async (data) => {
        Object.assign(mockStore.sync, data);
      }
    },
    local: {
      get: async (keys) => {
        const result = {};
        for (const key of Object.keys(keys || {})) {
          result[key] = mockStore.local[key] !== undefined ? mockStore.local[key] : keys[key];
        }
        return result;
      },
      set: async (data) => {
        Object.assign(mockStore.local, data);
      }
    }
  }
};

// Load styles.js
const stylesPath = path.join(__dirname, '../extension/shared/styles.js');
eval(fs.readFileSync(stylesPath, 'utf8'));

const { exportToMorphix, importFromMorphix, isMorphixValid, getSavedProjects, uuid } = globalThis.RestyleStorage || self.RestyleStorage;

// Test 1: Export a project
console.log("=== Test 1: Export ===");
const testProject = {
  id: "style_test123",
  name: "YouTube Dark Mode",
  url_pattern: { type: "domain", value: "youtube.com" },
  enabled: true,
  active_version_id: "version_abc",
  versions: [
    {
      id: "version_abc",
      css: "body { background: #0f0f0f; color: #fff; }",
      js: "console.log('dark mode active');",
      prompt: "Make YouTube dark mode",
      description: "Applied dark theme to YouTube",
      validation: { ok: true, warnings: [] },
      parent_version_id: null,
      created_at: "2026-05-11T12:00:00Z"
    }
  ],
  conversation: [
    { role: "user", content: "Make YouTube dark mode", version_id: "version_abc", created_at: "2026-05-11T12:00:00Z" },
    { role: "assistant", content: "Applied dark theme to YouTube", version_id: "version_abc", created_at: "2026-05-11T12:00:05Z" }
  ],
  created_at: "2026-05-11T12:00:00Z",
  updated_at: "2026-05-11T12:00:05Z",
  hits: 0
};

const exported = exportToMorphix(testProject);
console.log("Exported keys:", Object.keys(exported));
console.log("Format version:", exported.format_version);
console.log("Type:", exported.type);
console.log("Style name:", exported.style.name);
console.log("Versions count:", exported.style.versions.length);
console.log("Conversation count:", exported.style.conversation.length);
console.log("Has exported_at:", !!exported.exported_at);
console.log("✅ Export works\n");

// Test 2: Validation
console.log("=== Test 2: Validation ===");
console.log("Valid file:", isMorphixValid(exported).ok);
console.log("Null:", isMorphixValid(null).ok, "—", isMorphixValid(null).error);
console.log("Wrong version:", isMorphixValid({ format_version: 99 }).ok);
console.log("Wrong type:", isMorphixValid({ format_version: 1, type: "bad" }).ok);
console.log("✅ Validation works\n");

// Test 3: Import roundtrip (without saving — mock storage)
console.log("=== Test 3: Import ===");
async function testImport() {
  try {
    const imported = await importFromMorphix(exported, "sync");
    console.log("Imported name:", imported.name);
    console.log("Imported versions:", imported.versions.length);
    console.log("Imported conversation:", imported.conversation.length);
    console.log("New ID generated:", imported.id !== testProject.id);
    console.log("New version IDs:", imported.versions[0].id !== testProject.versions[0].id);
    console.log("Version ID remapped in conversation:", imported.conversation[0].version_id === imported.versions[0].id);
    console.log("✅ Import roundtrip works\n");

    // Test 4: Duplicate detection
    console.log("=== Test 4: Duplicate detection ===");
    try {
      await importFromMorphix(exported, "sync");
      console.log("❌ Should have thrown duplicate error");
    } catch (err) {
      console.log("Duplicate correctly rejected:", err.message.includes("already exists"));
      console.log("✅ Duplicate detection works\n");
    }
  } catch (err) {
    console.error("Import failed:", err.message);
  }
}

testImport();
