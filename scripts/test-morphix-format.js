// test-morphix-format.js
// Scoped tests for Morphix export/import format
// Run: node scripts/test-morphix-format.js
// Exit code 0 = all pass, 1 = any failure

const fs = require("fs");
const path = require("path");

// ── Mocks ──────────────────────────────────────────────
globalThis.self = globalThis;

let mockSync = {};
let mockLocal = {};
const mkStore = (area) => ({
  get: async (keys) => {
    const src = area === "sync" ? mockSync : mockLocal;
    const out = {};
    for (const k of Object.keys(keys || {}))
      out[k] = src[k] !== undefined ? src[k] : keys[k];
    return out;
  },
  set: async (data) => {
    const trg = area === "sync" ? mockSync : mockLocal;
    Object.assign(trg, data);
  },
});
globalThis.chrome = {
  storage: { sync: mkStore("sync"), local: mkStore("local") },
};

// ── Load the module under test ─────────────────────────
eval(fs.readFileSync(path.join(__dirname, "../extension/shared/styles.js"), "utf8"));
const S = self.RestyleStorage;

// ── Test harness (async sequential) ────────────────────
let passed = 0;
let failed = 0;
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected)
    throw new Error(
      `${msg || "assert"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
}
function assertTrue(v, msg) { if (!v) throw new Error(msg || "expected true"); }
function assertFalse(v, msg) { if (v) throw new Error(msg || "expected false"); }
function assertArrayLength(a, n, msg) {
  if (a.length !== n) throw new Error(`${msg || "len"}: expected ${n}, got ${a.length}`);
}

function resetStore() {
  mockSync = {};
  mockLocal = {};
}

// ── Fixture ────────────────────────────────────────────
function makeTestProject(overrides = {}) {
  return {
    id: "style_orig",
    name: "Test Dark Mode",
    url_pattern: { type: "domain", value: "example.com" },
    enabled: true,
    active_version_id: "version_v2",
    versions: [
      {
        id: "version_v2", css: "body { background: #0a0a0a; }",
        js: "console.log('dark');", prompt: "Darker + JS",
        description: "Darkened background, added JS",
        validation: { ok: true, warnings: ["JS detected"] },
        parent_version_id: "version_v1", created_at: "2026-05-02T11:00:00Z",
      },
      {
        id: "version_v1", css: "body { background: #111; }",
        js: "", prompt: "Make it dark",
        description: "Applied dark mode",
        validation: { ok: true, warnings: [] },
        parent_version_id: null, created_at: "2026-05-01T10:00:00Z",
      },
    ],
    conversation: [
      { role: "user", content: "Darker + JS", version_id: "version_v2", created_at: "2026-05-02T11:00:00Z" },
      { role: "assistant", content: "Darkened + JS", version_id: "version_v2", created_at: "2026-05-02T11:00:05Z" },
      { role: "user", content: "Make it dark", version_id: "version_v1", created_at: "2026-05-01T10:00:00Z" },
      { role: "assistant", content: "Applied dark", version_id: "version_v1", created_at: "2026-05-01T10:00:05Z" },
    ],
    created_at: "2026-05-01T10:00:00Z",
    updated_at: "2026-05-02T11:00:05Z",
    hits: 42,
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────
console.log("Morphix Format Tests\n");

// ── Export ─────────────────────
console.log("Export");
test("exports correct top-level structure", () => {
  const r = S.exportToMorphix(makeTestProject());
  assertEqual(r.format_version, 1);
  assertEqual(r.type, "morphix_style");
  assertTrue(typeof r.style === "object");
  assertTrue(typeof r.author === "object");
  assertTrue(typeof r.exported_at === "string");
});

test("exports all version data", () => {
  const r = S.exportToMorphix(makeTestProject());
  assertArrayLength(r.style.versions, 2);
  assertEqual(r.style.versions[0].css, "body { background: #0a0a0a; }");
  assertEqual(r.style.versions[0].js, "console.log('dark');");
  assertEqual(r.style.versions[0].parent_version_id, "version_v1");
  assertEqual(r.style.versions[1].parent_version_id, null);
});

test("exports all conversation entries", () => {
  const r = S.exportToMorphix(makeTestProject());
  assertArrayLength(r.style.conversation, 4);
  assertEqual(r.style.conversation[0].role, "user");
  assertEqual(r.style.conversation[0].version_id, "version_v2");
});

test("exports active_version snapshot", () => {
  const av = S.exportToMorphix(makeTestProject()).style.active_version;
  assertEqual(av.css, "body { background: #0a0a0a; }");
  assertEqual(av.js, "console.log('dark');");
  assertTrue(av.validation.ok);
});

test("exports with author info", () => {
  const r = S.exportToMorphix(makeTestProject(), { name: "Alice", gallery_id: "u1" });
  assertEqual(r.author.name, "Alice");
  assertEqual(r.author.gallery_id, "u1");
});

test("exports without internal metadata", () => {
  const r = S.exportToMorphix(makeTestProject());
  assertFalse("hits" in r.style);
  assertFalse("enabled" in r.style);
  assertFalse("id" in r.style);
});

// ── Validation ─────────────────
console.log("\nValidation");
test("accepts valid format", () => {
  assertTrue(S.isMorphixValid({ format_version: 1, type: "morphix_style", style: { name: "x" } }).ok);
});
test("rejects null", () => {
  const v = S.isMorphixValid(null);
  assertFalse(v.ok);
  assertTrue(v.error.includes("not a valid JSON object"));
});
test("rejects wrong format_version", () => {
  assertFalse(S.isMorphixValid({ format_version: 99 }).ok);
});
test("rejects wrong type", () => {
  assertFalse(S.isMorphixValid({ format_version: 1, type: "bad" }).ok);
});
test("rejects missing style", () => {
  assertFalse(S.isMorphixValid({ format_version: 1, type: "morphix_style" }).ok);
});

// ── Import (each resets store) ──
console.log("\nImport");

test("roundtrip: import produces valid project", async () => {
  resetStore();
  const im = await S.importFromMorphix(S.exportToMorphix(makeTestProject()), "sync");
  assertEqual(im.name, "Test Dark Mode");
  assertArrayLength(im.versions, 2);
});

test("roundtrip: generates fresh project ID", async () => {
  resetStore();
  const im = await S.importFromMorphix(S.exportToMorphix(makeTestProject()), "sync");
  assertTrue(im.id.startsWith("style_"));
  assertTrue(im.id !== "style_orig");
});

test("roundtrip: version IDs are remapped", async () => {
  resetStore();
  const im = await S.importFromMorphix(S.exportToMorphix(makeTestProject()), "sync");
  const orig = ["version_v1", "version_v2"];
  im.versions.forEach((v) => assertFalse(orig.includes(v.id), `version ${v.id} not remapped`));
});

test("roundtrip: conversation version_ids point to new IDs", async () => {
  resetStore();
  const im = await S.importFromMorphix(S.exportToMorphix(makeTestProject()), "sync");
  const vidSet = new Set(im.versions.map((v) => v.id));
  im.conversation.forEach((c) => assertTrue(vidSet.has(c.version_id), `conv refs unknown ${c.version_id}`));
});

test("roundtrip: parent_version_id remaps correctly", async () => {
  resetStore();
  const im = await S.importFromMorphix(S.exportToMorphix(makeTestProject()), "sync");
  const v2 = im.versions[0], v1 = im.versions[1];
  assertEqual(v2.parent_version_id, v1.id);
  assertEqual(v1.parent_version_id, null);
});

test("roundtrip: CSS/JS preserved exactly", async () => {
  resetStore();
  const p = makeTestProject();
  const im = await S.importFromMorphix(S.exportToMorphix(p), "sync");
  assertEqual(im.versions[0].css, p.versions[0].css);
  assertEqual(im.versions[0].js, p.versions[0].js);
  assertEqual(im.versions[1].css, p.versions[1].css);
});

test("roundtrip: URL pattern preserved exactly", async () => {
  resetStore();
  const im = await S.importFromMorphix(S.exportToMorphix(makeTestProject()), "sync");
  assertEqual(im.url_pattern.type, "domain");
  assertEqual(im.url_pattern.value, "example.com");
});

test("import with no versions falls back to active_version", async () => {
  resetStore();
  const e = S.exportToMorphix(makeTestProject());
  e.style.versions = [];
  const im = await S.importFromMorphix(e, "sync");
  assertArrayLength(im.versions, 1);
  assertEqual(im.versions[0].css, "body { background: #0a0a0a; }");
});

test("import restores conversation from active_version when empty", async () => {
  resetStore();
  const e = S.exportToMorphix(makeTestProject());
  e.style.conversation = [];
  e.style.versions = [];
  const im = await S.importFromMorphix(e, "sync");
  assertTrue(im.conversation.length >= 1);
});

test("import persists to sync storage", async () => {
  resetStore();
  await S.importFromMorphix(S.exportToMorphix(makeTestProject()), "sync");
  const saved = await S.getSavedProjects();
  assertArrayLength(saved, 1);
  assertEqual(saved[0].name, "Test Dark Mode");
});

test("duplicate import is rejected", async () => {
  resetStore();
  const e = S.exportToMorphix(makeTestProject());
  await S.importFromMorphix(e, "sync");
  try {
    await S.importFromMorphix(e, "sync");
    throw new Error("should have thrown");
  } catch (err) {
    assertTrue(err.message.includes("already exists"), "dup msg: " + err.message);
  }
});

test("different name allows re-import", async () => {
  resetStore();
  await S.importFromMorphix(
    S.exportToMorphix(makeTestProject({ name: "A" })),
    "sync",
  );
  await S.importFromMorphix(
    S.exportToMorphix(makeTestProject({ name: "B" })),
    "sync",
  );
  assertArrayLength(await S.getSavedProjects(), 2);
});

test("library scope sets enabled=false", async () => {
  resetStore();
  const p = makeTestProject({ url_pattern: { type: "library", value: "library" } });
  const im = await S.importFromMorphix(S.exportToMorphix(p), "sync");
  assertFalse(im.enabled);
});

// ── Run ────────────────────────────────────────────────
(async () => {
  for (const { name, fn } of tests) {
    try {
      if (fn.constructor.name === "AsyncFunction") await fn();
      else fn();
      passed++;
    } catch (err) {
      failed++;
      console.error(`\n  FAIL: ${name}`);
      console.error(`    ${err.message}`);
    }
  }
  console.log(`\n${"─".repeat(40)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log(`${"─".repeat(40)}\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
