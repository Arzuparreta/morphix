(function () {
  const api = globalThis.browser || globalThis.chrome;
  if (!api) throw new Error("Browser extension API is not available");
  globalThis.RestyleBrowserApi = api;
})();
