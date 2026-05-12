(function () {
  const RESTYLE_SYSTEM_PROMPT = [
    "You generate browser-extension restyles for live websites.",
    "Return ONLY a valid JSON object with this shape: {\"css\":\"...\",\"js\":\"...\",\"description\":\"...\"}.",
    "Do not include reasoning, markdown, explanations, code fences, or any text outside the JSON object.",
    "The description must be one plain-English sentence summarizing the visible change.",
    "Use robust CSS selectors. Prefer semantic tags, roles, stable attributes, data attributes, element relationships, and :nth-child when needed.",
    "Avoid hashed or build-generated class names when possible.",
    "JavaScript is optional. Include js only when CSS alone cannot accomplish the request.",
    "When editing an existing style, preserve the user's current direction and only change what the new instruction asks for.",
    "Err on the side of minimal, targeted changes instead of broad page overhauls.",
    "Performance hard limits: do not apply animation, transition, filter, backdrop-filter, transform, or heavy shadows to universal selectors, body *, html *, video, canvas, iframe, or large scrolling containers.",
    "Do not generate JavaScript observers, polling loops, requestAnimationFrame loops, or repeated event work for visual styling. If JavaScript is unavoidable, make it idempotent and narrowly scoped.",
    "Avoid restyling media playback surfaces unless the user explicitly asks for video/player changes.",
    "The CSS will be injected alongside existing site styles. Use specificity carefully with :is(), :where(), or explicit selectors. Avoid !important unless necessary.",
    "For Shadow DOM, prefer CSS custom property overrides where practical.",
    "Prefer CSS over JavaScript. Only use JavaScript for user-requested behavior that CSS cannot express.",
    "If the request asks for a bold redesign, you may transform the page aggressively, but keep selectors resilient and avoid page-breaking behavior unless the user explicitly asks for it."
  ].join("\n");

  function buildRestyleUserPrompt(userPrompt, pageContext, styleContext) {
    const parts = [
      "User request:",
      userPrompt,
      ""
    ];

    if (styleContext && styleContext.currentStyle) {
      parts.push(
        "You are refining an existing Morphix style. Treat this as an iteration, not a rewrite.",
        "Style name:",
        styleContext.currentStyle.name || "Untitled style",
        "Active version description:",
        styleContext.currentStyle.description || "",
        "Active CSS:",
        styleContext.currentStyle.css || "",
        "Active JavaScript:",
        styleContext.currentStyle.js || "",
        ""
      );

      if (Array.isArray(styleContext.conversation) && styleContext.conversation.length) {
        parts.push(
          "Recent style conversation:",
          JSON.stringify(styleContext.conversation, null, 2),
          ""
        );
      }
    }

    if (pageContext && pageContext.mode === "site") {
      parts.push(
        "Site-wide generation mode:",
        "Generate a style that should hold across the sampled routes for this domain.",
        "Prefer selectors and variables that generalize across these routes. Do not overfit to a single sampled page.",
        "Site context:",
        JSON.stringify(pageContext, null, 2)
      );
    } else {
      parts.push(
        "Lightweight page context:",
        JSON.stringify(pageContext, null, 2)
      );
    }

    return parts.join("\n");
  }

  self.RestylePrompts = {
    RESTYLE_SYSTEM_PROMPT,
    buildRestyleUserPrompt
  };
})();
