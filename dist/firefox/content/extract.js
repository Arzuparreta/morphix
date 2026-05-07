(function () {
  const MAX_NODES = 150;
  const TEXT_LIMIT = 90;
  const CLASS_LIMIT = 6;
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG", "PATH", "META", "LINK"]);

  function compact(value, limit) {
    return (value || "").replace(/\s+/g, " ").trim().slice(0, limit);
  }

  function isVisible(element) {
    if (!(element instanceof Element) || SKIP_TAGS.has(element.tagName)) return false;
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    if (element.getAttribute("aria-hidden") === "true") return false;
    const rect = element.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
    if (rect.bottom < 0 || rect.right < 0 || rect.top > window.innerHeight || rect.left > window.innerWidth) return false;
    return true;
  }

  function stableClasses(element) {
    return Array.from(element.classList || [])
      .filter((className) => className.length < 40)
      .filter((className) => !/[a-f0-9]{7,}/i.test(className))
      .slice(0, CLASS_LIMIT);
  }

  function ownText(element) {
    let text = "";
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) text += " " + node.textContent;
    }
    return compact(text || element.getAttribute("aria-label") || element.getAttribute("title") || "", TEXT_LIMIT);
  }

  function summarizeElement(element, index) {
    const rect = element.getBoundingClientRect();
    const summary = {
      index,
      tag: element.tagName.toLowerCase()
    };

    if (element.id && element.id.length < 80) summary.id = element.id;
    const classes = stableClasses(element);
    if (classes.length) summary.class = classes.join(" ");
    if (element.getAttribute("role")) summary.role = element.getAttribute("role");
    if (element.getAttribute("data-testid")) summary.data_testid = element.getAttribute("data-testid");
    if (element.getAttribute("data-test")) summary.data_test = element.getAttribute("data-test");
    if (element.getAttribute("name")) summary.name = element.getAttribute("name");
    if (element.getAttribute("type")) summary.type = element.getAttribute("type");
    if (element instanceof HTMLAnchorElement && element.href) summary.href = compact(element.href, 120);

    const text = ownText(element);
    if (text) summary.text = text;

    summary.rect = {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      w: Math.round(rect.width),
      h: Math.round(rect.height)
    };

    return summary;
  }

  function extractPageContext() {
    const nodes = [];
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_ELEMENT);
    let current = walker.currentNode;

    while (current && nodes.length < MAX_NODES) {
      if (isVisible(current)) {
        nodes.push(summarizeElement(current, nodes.length));
      }
      current = walker.nextNode();
    }

    return {
      url: location.href,
      title: document.title,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      nodes
    };
  }

  window.RestyleExtract = {
    extractPageContext
  };
})();
