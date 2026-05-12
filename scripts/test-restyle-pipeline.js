const fs = require("fs");
const path = require("path");

let passed = 0;
let failed = 0;
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || "assert"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(value, msg) {
  if (!value) throw new Error(msg || "expected true");
}

function bootstrapInject(queryMap) {
  globalThis.self = globalThis;
  globalThis.window = globalThis;
  globalThis.location = { href: "https://example.com/" };
  globalThis.history = {
    pushState() {},
    replaceState() {}
  };
  globalThis.setTimeout = () => 1;
  globalThis.clearTimeout = () => {};
  globalThis.MutationObserver = function () {
    return { observe() {}, disconnect() {} };
  };
  globalThis.addEventListener = () => {};
  globalThis.removeEventListener = () => {};
  globalThis.CSS = { escape: (value) => value };
  globalThis.CSSStyleSheet = class {
    replaceSync(css) {
      if (css.includes("INVALID_CSS")) throw new Error("bad css");
    }
  };

  const map = queryMap || {};
  globalThis.document = {
    head: { appendChild() {} },
    body: {},
    documentElement: { prepend() {}, appendChild() {} },
    querySelectorAll(selector) {
      if (Object.prototype.hasOwnProperty.call(map, selector)) {
        const value = map[selector];
        if (value instanceof Error) throw value;
        return Array.from({ length: value }, () => ({}));
      }
      return [];
    },
    createElement() {
      return {
        setAttribute() {},
        remove() {},
        appendChild() {},
        textContent: ""
      };
    }
  };

  globalThis.RestyleBrowserApi = {
    runtime: {
      id: "test-extension",
      sendMessage() {
        return { catch() {} };
      }
    }
  };

  delete globalThis.RestyleInject;
  eval(fs.readFileSync(path.join(__dirname, "../extension/content/inject.js"), "utf8"));
  return globalThis.RestyleInject;
}

function bootstrapServiceWorker() {
  globalThis.self = globalThis;
  globalThis.importScripts = () => {};
  globalThis.RestyleBrowserApi = {
    runtime: {
      onMessage: { addListener() {} },
      onMessageExternal: { addListener() {} }
    },
    tabs: {
      onRemoved: { addListener() {} },
      onUpdated: { addListener() {}, removeListener() {} }
    },
    scripting: {},
    declarativeNetRequest: {
      updateSessionRules: async () => {}
    }
  };
  globalThis.RestyleStorage = {};
  globalThis.RestylePrompts = {};
  globalThis.RestyleProviders = {};

  delete globalThis.RestyleServiceWorkerTest;
  eval(fs.readFileSync(path.join(__dirname, "../extension/background/service-worker.js"), "utf8"));
  return globalThis.RestyleServiceWorkerTest;
}

console.log("Restyle Pipeline Tests\n");

test("interactive selector misses are informational when the base selector matches", () => {
  const inject = bootstrapInject({
    ".button:hover": 0,
    ".button": 2
  });
  const result = inject.validateStylePayload({ css: ".button:hover { color: red; }", js: "" });
  assertEqual(result.summary.criticalCount, 0);
  assertEqual(result.findings[0].type, "interactive_miss");
});

test("route-specific selector misses are informational", () => {
  const inject = bootstrapInject({
    "ytd-mini-guide-entry-renderer:hover": 0,
    "ytd-mini-guide-entry-renderer": 0
  });
  const result = inject.validateStylePayload({ css: "ytd-mini-guide-entry-renderer:hover { color: red; }", js: "" });
  assertEqual(result.summary.criticalCount, 0);
  assertEqual(result.findings[0].type, "route_specific_miss");
});

test("unknown stable selector misses remain critical", () => {
  const inject = bootstrapInject({
    ".missing-card": 0
  });
  const result = inject.validateStylePayload({ css: ".missing-card { color: red; }", js: "" });
  assertTrue(result.summary.criticalCount > 0);
  assertEqual(result.findings[0].type, "unknown_selector_miss");
});

test("performance findings remain critical", () => {
  const inject = bootstrapInject({});
  const result = inject.validateStylePayload({ css: "body * { transform: scale(1.01); }", js: "" });
  assertTrue(result.findings.some((item) => item.type === "performance" && item.severity === "critical"));
});

test("service worker route candidate selection keeps unique route labels", () => {
  const worker = bootstrapServiceWorker();
  const selected = worker.selectRouteCandidates({
    url: "https://example.com/",
    route_label: "home",
    route_candidates: [
      { url: "https://example.com/watch?v=1", label: "watch" },
      { url: "https://example.com/watch?v=2", label: "watch" },
      { url: "https://example.com/results?search_query=x", label: "search" }
    ]
  });
  assertEqual(selected.length, 2);
  assertEqual(selected[0].label, "watch");
  assertEqual(selected[1].label, "search");
});

test("service worker stable anchors prefer repeated selectors", () => {
  const worker = bootstrapServiceWorker();
  const anchors = worker.inferStableAnchors([
    { nodes: [{ tag: "button", role: "button", class: "primary action" }, { tag: "main", id: "content" }] },
    { nodes: [{ tag: "button", role: "button", class: "primary action" }, { tag: "aside", id: "sidebar" }] }
  ]);
  assertEqual(anchors[0].selector_hint, "buttonrole:button.primary.action");
  assertEqual(anchors[0].occurrences, 2);
});

test("finalizeValidation adds auto-repair and site coverage metadata", () => {
  const worker = bootstrapServiceWorker();
  const result = worker.finalizeValidation(
    {
      summary: {
        criticalCount: 1,
        infoCount: 0,
        categories: { syntax: 1 },
        autoRepaired: false,
        siteCoverage: null
      }
    },
    {
      autoRepaired: true,
      routeSampleCount: 3,
      partialRouteCoverage: true
    }
  );
  assertTrue(result.summary.autoRepaired);
  assertEqual(result.summary.siteCoverage.routeSampleCount, 3);
  assertTrue(result.summary.siteCoverage.partial);
});

(async () => {
  for (const { name, fn } of tests) {
    try {
      await fn();
      passed += 1;
      console.log(`PASS ${name}`);
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${name}`);
      console.error("  " + error.message);
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
})();
