(function () {
  const PROVIDER_CONFIG_KEY = "ai_provider_config";

  const DEFAULT_PROVIDER_CONFIG = {
    provider: "openrouter",
    model: "openrouter/free",
    apiKey: "",
    baseUrl: "https://openrouter.ai/api/v1",
    customHeaders: ""
  };

  const PROVIDERS = {
    anthropic: {
      name: "Anthropic",
      type: "anthropic",
      defaultModel: "claude-sonnet-4-20250514",
      defaultBaseUrl: "https://api.anthropic.com",
      requiresKey: true
    },
    openrouter: {
      name: "OpenRouter",
      type: "openai-compatible",
      defaultModel: "openrouter/free",
      defaultBaseUrl: "https://openrouter.ai/api/v1",
      requiresKey: true,
      structuredOutput: "json_schema",
      responseHealing: true,
      headers: {
        "HTTP-Referer": "https://morphix.local",
        "X-OpenRouter-Title": "Morphix Restyle"
      }
    },
    opencode_go: {
      name: "OpenCode Go",
      type: "openai-compatible",
      defaultModel: "glm-5",
      defaultBaseUrl: "https://opencode.ai/zen/go/v1",
      requiresKey: true
    },
    ollama: {
      name: "Ollama",
      type: "openai-compatible",
      defaultModel: "qwen2.5-coder:7b",
      defaultBaseUrl: "http://localhost:11434/v1",
      requiresKey: false,
      structuredOutput: "json_object",
      sendAuth: false
    },
    custom_openai: {
      name: "Custom OpenAI-compatible",
      type: "openai-compatible",
      defaultModel: "",
      defaultBaseUrl: "",
      requiresKey: false
    }
  };

  function normalizeBaseUrl(baseUrl) {
    return (baseUrl || "").trim().replace(/\/+$/, "");
  }

  function getProviderDefinition(provider) {
    return PROVIDERS[provider] || PROVIDERS.openrouter;
  }

  async function getProviderConfig() {
    const legacy = await chrome.storage.local.get({ anthropic_api_key: "" });
    const result = await chrome.storage.local.get({ [PROVIDER_CONFIG_KEY]: null });
    const stored = result[PROVIDER_CONFIG_KEY] || {};
    const provider = stored.provider || DEFAULT_PROVIDER_CONFIG.provider;
    const definition = getProviderDefinition(provider);

    return {
      provider,
      model: stored.model || definition.defaultModel || DEFAULT_PROVIDER_CONFIG.model,
      apiKey: stored.apiKey || (provider === "anthropic" ? legacy.anthropic_api_key : "") || "",
      baseUrl: normalizeBaseUrl(stored.baseUrl || definition.defaultBaseUrl || DEFAULT_PROVIDER_CONFIG.baseUrl),
      customHeaders: stored.customHeaders || ""
    };
  }

  async function saveProviderConfig(config) {
    const definition = getProviderDefinition(config.provider);
    const next = {
      provider: config.provider || DEFAULT_PROVIDER_CONFIG.provider,
      model: (config.model || definition.defaultModel || "").trim(),
      apiKey: (config.apiKey || "").trim(),
      baseUrl: normalizeBaseUrl(config.baseUrl || definition.defaultBaseUrl || ""),
      customHeaders: (config.customHeaders || "").trim()
    };
    await chrome.storage.local.set({ [PROVIDER_CONFIG_KEY]: next });
    if (next.provider === "anthropic") {
      await chrome.storage.local.set({ anthropic_api_key: next.apiKey });
    }
    return next;
  }

  function parseCustomHeaders(raw) {
    if (!raw || !raw.trim()) return {};
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Custom headers must be a JSON object");
      }
      return Object.fromEntries(
        Object.entries(parsed).filter((entry) => typeof entry[1] === "string")
      );
    } catch (error) {
      throw new Error("Custom headers must be valid JSON, for example {\"X-App\":\"Morphix\"}");
    }
  }

  function validateProviderConfig(config) {
    const definition = getProviderDefinition(config.provider);
    if (!config.model || !config.model.trim()) throw new Error("Enter a model name");
    if (!config.baseUrl || !config.baseUrl.trim()) throw new Error("Enter a base URL");
    if (definition.requiresKey && !config.apiKey.trim()) throw new Error(`${definition.name} requires an API key`);
    parseCustomHeaders(config.customHeaders);
  }

  async function requestJson(url, options) {
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload.error && payload.error.message
        ? payload.error.message
        : payload.message || `Provider request failed with HTTP ${response.status}`;
      throw new Error(message);
    }
    if (payload.error) {
      const message = payload.error.message || payload.error.code || "Provider returned an error";
      throw new Error(message);
    }
    return payload;
  }

  function buildOpenAiMessages(systemPrompt, userPrompt) {
    return [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];
  }

  const RESTYLE_RESPONSE_SCHEMA = {
    type: "object",
    properties: {
      css: {
        type: "string",
        description: "CSS to inject into the page. Use an empty string when no CSS is needed."
      },
      js: {
        type: "string",
        description: "JavaScript to inject into the page. Use an empty string when no JavaScript is needed."
      },
      description: {
        type: "string",
        description: "One plain-English sentence summarizing the visible change."
      }
    },
    required: ["css", "js", "description"],
    additionalProperties: false
  };

  function addStructuredOutputOptions(body, providerDefinition, options) {
    if (!options || !options.structured) return body;
    if (providerDefinition.structuredOutput === "json_schema") {
      body.response_format = {
        type: "json_schema",
        json_schema: {
          name: "restyle_patch",
          strict: true,
          schema: RESTYLE_RESPONSE_SCHEMA
        }
      };
      if (providerDefinition.responseHealing) {
        body.plugins = [{ id: "response-healing" }];
      }
    } else if (providerDefinition.structuredOutput === "json_object") {
      body.response_format = { type: "json_object" };
    }
    return body;
  }

  async function callAnthropic(config, systemPrompt, userPrompt, maxTokens) {
    const payload = await requestJson(`${normalizeBaseUrl(config.baseUrl)}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: maxTokens,
        temperature: 0.2,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }]
      })
    });

    const textBlock = (payload.content || []).find((block) => block.type === "text");
    if (!textBlock || !textBlock.text) throw new Error("Provider returned no text");
    return textBlock.text;
  }

  function isStructuredOutputUnsupported(error) {
    const message = (error && error.message ? error.message : String(error)).toLowerCase();
    return message.includes("response_format")
      || message.includes("structured")
      || message.includes("schema")
      || message.includes("plugin");
  }

  async function callOpenAiCompatible(config, providerDefinition, systemPrompt, userPrompt, maxTokens, options) {
    const headers = {
      "content-type": "application/json",
      ...providerDefinition.headers,
      ...parseCustomHeaders(config.customHeaders)
    };
    const apiKey = providerDefinition.sendAuth === false ? "" : config.apiKey;
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const body = addStructuredOutputOptions({
        model: config.model,
        messages: buildOpenAiMessages(systemPrompt, userPrompt),
        max_tokens: maxTokens,
        temperature: 0.2,
        stream: false
      },
      providerDefinition,
      options
    );

    let payload;
    try {
      payload = await requestJson(`${normalizeBaseUrl(config.baseUrl)}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });
    } catch (error) {
      if (!options || !options.structured || !isStructuredOutputUnsupported(error)) throw error;
      delete body.response_format;
      delete body.plugins;
      payload = await requestJson(`${normalizeBaseUrl(config.baseUrl)}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });
    }

    const choice = payload.choices && payload.choices[0];
    if (choice && choice.error) {
      throw new Error(choice.error.message || choice.error.code || "Provider returned a choice error");
    }
    const message = choice && choice.message;
    const content = message && message.content;
    if (!content) {
      const finishReason = choice && choice.finish_reason ? ` Finish reason: ${choice.finish_reason}.` : "";
      const model = payload.model ? ` Model: ${payload.model}.` : "";
      const refusal = message && message.refusal ? ` Refusal: ${message.refusal}.` : "";
      const hint = choice && choice.finish_reason === "length"
        ? " The model used its token budget before producing final text; retry or choose a smaller/non-reasoning free model."
        : "";
      throw new Error(`Provider returned no text.${model}${finishReason}${refusal}${hint}`);
    }
    return Array.isArray(content)
      ? content.map((part) => part.text || "").join("")
      : content;
  }

  async function callProvider(config, systemPrompt, userPrompt, maxTokens, options) {
    validateProviderConfig(config);
    const definition = getProviderDefinition(config.provider);
    if (definition.type === "anthropic") {
      return callAnthropic(config, systemPrompt, userPrompt, maxTokens);
    }
    return callOpenAiCompatible(config, definition, systemPrompt, userPrompt, maxTokens, options || {});
  }

  async function testProviderConfig(config) {
    const text = await callProvider(
      config,
      "You test AI provider connectivity.",
      "Reply with only the word OK.",
      256
    );
    if (!/\bOK\b/i.test(text)) throw new Error("Provider responded, but not with the expected test output");
  }

  self.RestyleProviders = {
    DEFAULT_PROVIDER_CONFIG,
    PROVIDERS,
    getProviderConfig,
    getProviderDefinition,
    saveProviderConfig,
    testProviderConfig,
    validateProviderConfig,
    callProvider
  };
})();
