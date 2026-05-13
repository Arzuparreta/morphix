// shared/gallery-client.js
// Lightweight Supabase client for the browser extension.
// No bundler needed — uses the Supabase REST API directly via fetch.
// Supabase URL and anon key are hardcoded — they're public by design.
// Users only need an account (email + password) on the Morphix Gallery.

(function () {
  const ext = globalThis.RestyleBrowserApi || globalThis.browser || globalThis.chrome;

  // Hardcoded Morphix Gallery Supabase config (public anon key)
  const GALLERY_APP_URL = "https://gallery-eight-beta.vercel.app";
  const SUPABASE_URL = "https://srmqjagfdedeovkiqpuj.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNybXFqYWdmZGVkZW92a2lxcHVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MzE3NzAsImV4cCI6MjA5NDEwNzc3MH0.w_7XjUyRKxGmrc3_Z9qsqj2Dy1lCCDmMV_Z_ILLyg3Q";

  const GALLERY_CONFIG_KEY = "gallery_config";

  async function getConfig() {
    const result = await ext.storage.local.get({ [GALLERY_CONFIG_KEY]: null });
    return result[GALLERY_CONFIG_KEY];
  }

  async function saveConfig(config) {
    await ext.storage.local.set({ [GALLERY_CONFIG_KEY]: config });
  }

  function getSupabaseUrl() {
    return SUPABASE_URL;
  }

  function getSupabaseAnonKey() {
    return SUPABASE_ANON_KEY;
  }

  async function getGalleryAppUrl() {
    const config = await getConfig();
    return config?.galleryAppUrl || GALLERY_APP_URL;
  }

  function ensureConfig() {
    return { supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON_KEY };
  }

  async function clearAuthConfig() {
    const config = (await getConfig()) || {};
    delete config.accessToken;
    delete config.refreshToken;
    delete config.userId;
    delete config.expiresAt;
    await saveConfig(config);
  }

  async function parseErrorResponse(res, fallbackMessage) {
    const err = await res.json().catch(() => null);
    return err?.error_description || err?.message || err?.error || fallbackMessage;
  }

  async function refreshSession() {
    const config = await getConfig();
    if (!config?.refreshToken) {
      await clearAuthConfig();
      return null;
    }

    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: config.refreshToken }),
    });

    if (!res.ok) {
      await clearAuthConfig();
      return null;
    }

    const data = await res.json();
    config.accessToken = data.access_token;
    config.refreshToken = data.refresh_token || config.refreshToken;
    config.userId = data.user?.id || config.userId;
    config.expiresAt = data.expires_at ? data.expires_at * 1000 : Date.now() + ((data.expires_in || 3600) * 1000);
    await saveConfig(config);
    return config.accessToken;
  }

  async function getValidAccessToken(forceRefresh = false) {
    const config = await getConfig();
    if (!config?.accessToken) return null;

    const expiresAt = typeof config.expiresAt === "number" ? config.expiresAt : 0;
    const needsRefresh = forceRefresh || !expiresAt || Date.now() >= (expiresAt - 60_000);

    if (!needsRefresh) return config.accessToken;

    const refreshedToken = await refreshSession();
    return refreshedToken || null;
  }

  async function apiCall(path, options = {}) {
    const config = ensureConfig();
    const { method = "GET", body, headers = {} } = options;
    let token = await getValidAccessToken();

    const makeRequest = async () => fetch(`${config.supabaseUrl}/rest/v1${path}`, {
      method,
      headers: {
        "apikey": config.supabaseAnonKey,
        "Authorization": `Bearer ${token || config.supabaseAnonKey}`,
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    let res = await makeRequest();

    if (res.status === 401 && token) {
      token = await getValidAccessToken(true);
      res = await makeRequest();
    }

    if (!res.ok) {
      throw new Error(await parseErrorResponse(res, `API error ${res.status}`));
    }

    // 204 No Content
    if (res.status === 204) return null;

    return res.json();
  }

  // ── Auth ─────────────────────────────────────────────

  async function getAccessToken() {
    return getValidAccessToken();
  }

  async function signIn(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error_description: "Login failed" }));
      throw new Error(err.error_description || "Login failed");
    }
    const data = await res.json();

    // Store only auth tokens, not Supabase config (that's hardcoded now)
    const config = (await getConfig()) || {};
    config.accessToken = data.access_token;
    config.refreshToken = data.refresh_token;
    config.userId = data.user?.id;
    config.expiresAt = data.expires_at ? data.expires_at * 1000 : Date.now() + ((data.expires_in || 3600) * 1000);
    await saveConfig(config);
    return data;
  }

  async function signUp(email, password, username) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        data: { username, display_name: username },
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error_description: "Signup failed" }));
      throw new Error(err.error_description || err.msg || "Signup failed");
    }
    return res.json();
  }

  async function signOut() {
    await clearAuthConfig();
  }

  async function getCurrentUser() {
    try {
      const token = await getAccessToken();
      if (!token) return null;
      const config = await getConfig();
      if (!config?.userId) return null;
      const data = await apiCall("/profiles?id=eq." + encodeURIComponent(config.userId), {
        headers: { "Accept-Profile": "gallery" },
      });
      return Array.isArray(data) ? data[0] : null;
    } catch {
      return null;
    }
  }

  async function isAuthenticated() {
    const token = await getValidAccessToken();
    return !!token;
  }

  // ── Styles ───────────────────────────────────────────

  async function uploadStyle(morphixJson, tags) {
    const token = await getValidAccessToken();
    if (!token) throw new Error("Sign in to share styles.");

    const galleryAppUrl = await getGalleryAppUrl();
    const body = {
      morphix_json: morphixJson,
      tags: tags || [],
    };

    const makeRequest = async (bearerToken) => fetch(`${galleryAppUrl}/api/extension/upload`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${bearerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    let res = await makeRequest(token);

    if (res.status === 401) {
      const refreshedToken = await getValidAccessToken(true);
      if (!refreshedToken) throw new Error("Your gallery session expired. Sign in again.");
      res = await makeRequest(refreshedToken);
    }

    if (!res.ok) {
      throw new Error(await parseErrorResponse(res, "Upload failed"));
    }

    return res.json();
  }

  async function getStylesForSite(domain) {
    const styles = await apiCall(
      `/styles?select=id,name,slug,description,screenshot_urls,avg_rating,installs_count&url_pattern=cs.${encodeURIComponent(JSON.stringify({ type: "domain", value: domain }))}&is_published=eq.true&limit=5`
    );
    return styles || [];
  }

  // ── Exports ──────────────────────────────────────────

  self.MorphixGallery = {
    // Auth
    signIn,
    signUp,
    signOut,
    getCurrentUser,
    isAuthenticated,
    // Config (read-only for consumers that check config)
    getConfig,
    saveConfig,
    getGalleryAppUrl,
    getSupabaseUrl,
    getSupabaseAnonKey,
    // Styles
    uploadStyle,
    getStylesForSite,
  };
})();
