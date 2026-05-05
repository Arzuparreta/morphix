![Morphix Logo Banner](docs/branding/morphix_logo_banner.png)

# Morphix Restyle

Morphix Restyle is a browser extension for changing the look of live websites with natural language.

Open the extension on any page, describe the visual change you want, and Morphix asks your chosen AI provider to generate a small CSS/JavaScript restyle for the current page. You can preview the change immediately, inspect the page context that was sent, and then decide whether to keep it for one session, the current URL, the whole domain, or save it to your style library.

It is meant for personal, reversible page customization: tidy a cluttered page, improve contrast, hide visual noise, adjust spacing, make a site easier to read, or try a different look without editing the website itself.

## What it does

- Restyles the current website from a plain-English prompt.
- Extracts a lightweight summary of the visible page so the model can target real elements.
- Injects generated CSS, and optional JavaScript when CSS is not enough.
- Lets you review each draft before keeping it.
- Saves restyles for the exact page, an entire domain, or only the current browser session.
- Includes a style library where saved restyles can be deleted or retargeted.
- Supports multiple AI providers, including OpenRouter, Anthropic, OpenCode Go, Ollama, and custom OpenAI-compatible endpoints.

## Install locally

This repository does not need a build step.

1. Clone or download the repository.
2. Open Chrome or another Chromium-based browser.
3. Go to `chrome://extensions`.
4. Turn on **Developer mode**.
5. Click **Load unpacked**.
6. Select the `extension/` folder from this repository.

After that, pin **Morphix Restyle** from the extensions menu if you want quick access.

## Set up an AI provider

1. Open the extension options page.
2. Choose a provider.
3. Enter the model, base URL, API key, and any custom headers needed by that provider.
4. Click **Test provider**.
5. Click **Save provider**.

The default provider configuration is OpenRouter. Local providers such as Ollama can be used without an API key if they expose an OpenAI-compatible `/v1/chat/completions` endpoint.

## Use it

1. Visit a website you want to restyle.
2. Open Morphix Restyle from the browser toolbar.
3. Type a prompt, for example:
   - `Make this page calmer and easier to read.`
   - `Increase contrast and make buttons more obvious.`
   - `Hide distracting sidebars and widen the main article.`
4. Click **Apply**.
5. Review the result.
6. Keep it for this session, this URL, the whole domain, or save it to the library.

If the result is not right, retry with the same prompt or discard it and try a more specific one.

## Privacy notes

Morphix stores provider settings and saved styles in Chrome extension storage. API keys and provider settings are stored locally in the browser.

When you click **Apply**, Morphix sends your selected AI provider:

- your prompt,
- the current page URL and title,
- viewport size,
- a compact summary of visible page elements, including tags, stable identifiers, small text snippets, and element positions.

Morphix does not send the full page HTML by design. The exact context for each draft is shown in the popup under **What we sent**.

## Project layout

```text
extension/
  manifest.json                 Extension manifest
  background/service-worker.js   Message handling, provider calls, style injection
  content/extract.js             Visible page context extraction
  content/inject.js              Runtime style/script injection and route handling
  options/                       Provider settings and style library UI
  popup/                         Prompt, preview, and keep/discard UI
  shared/                        Provider, prompt, and storage helpers
```

## Status

Morphix Restyle is an early local extension. Expect rough edges, especially on sites with strict content security policies, heavy Shadow DOM usage, or very dynamic layouts.

Contributions and fixes are welcome.
