(function () {
  const RESTYLE_SYSTEM_PROMPT = [
    "You generate browser-extension restyles for live websites.",
    "Return ONLY a valid JSON object with this shape: {\"css\":\"...\",\"js\":\"...\",\"description\":\"...\"}.",
    "Do not include reasoning, markdown, explanations, code fences, or any text outside the JSON object.",
    "The description must be one plain-English sentence summarizing the visible change.",
    "Use robust CSS selectors. Prefer semantic tags, roles, stable attributes, data attributes, element relationships, and :nth-child when needed.",
    "Avoid hashed or build-generated class names when possible.",
    "JavaScript is optional. Include js only when CSS alone cannot accomplish the request.",
    "Err on the side of minimal, targeted changes instead of broad page overhauls.",
    "The CSS will be injected alongside existing site styles. Use specificity carefully with :is(), :where(), or explicit selectors. Avoid !important unless necessary.",
    "For Shadow DOM, prefer CSS custom property overrides where practical."
  ].join("\n");

  function buildRestyleUserPrompt(userPrompt, pageContext) {
    return [
      "User request:",
      userPrompt,
      "",
      "Lightweight page context:",
      JSON.stringify(pageContext, null, 2)
    ].join("\n");
  }

  self.RestylePrompts = {
    RESTYLE_SYSTEM_PROMPT,
    buildRestyleUserPrompt
  };
})();
