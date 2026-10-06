/* ASELab homepage v6 · vanilla JS · no framework, package manager or build step. */
(() => {
  "use strict";
  const config = window.ASE_CONFIG || {};
  const snapshot = window.ASE_PREVIEW_DATA || { news: [], publications: [], checkedOn: "" };
  const isSite = config.mode === "site";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clean = (value) => String(value ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
  const boundedLimit = (value, fallback = 5) => Number.isInteger(value) && value >= 1 && value <= 30 ? value : fallback;
  const newsLimit = boundedLimit(config.newsLimit);

  // The original site's style.css remains the single source of base font tokens.
  // Offline previews use ase-site-typography.css; no requests are made in preview mode.
  if (isSite && location.protocol !== "file:") {
    const sharedStyle = document.createElement("link");
    sharedStyle.id = "ase-live-site-style";
    sharedStyle.rel = "stylesheet";
    sharedStyle.href = "style.css";
    sharedStyle.addEventListener("error", () => {
      sharedStyle.remove();
      console.warn("ASELab: style.css could not be loaded; using the preview typography fallback.");
    });
    const layoutStyle = document.getElementById("ase-layout-stylesheet");
    if (layoutStyle) layoutStyle.before(sharedStyle);
    else document.head.append(sharedStyle);
  }

  function siteURL(path) {
    return isSite ? path : new URL(path, config.existingSite || "https://uselab.korea.ac.kr/").href;
  }
  function textElement(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = clean(text);
    return element;
  }

  // Configurable branding: real DOM text, never an image.
  const labName = clean(config.name || "ASELab");
  $$(".ase-wordmark, .ase-hero-title").forEach((element) => {
    element.replaceChildren();
    if (labName.endsWith("Lab")) {
      const accent = document.createElement("span");
      accent.textContent = labName.slice(0, -3);
      element.append(accent, document.createTextNode("Lab"));
    } else { element.textContent = labName; }
  });
  $$("[data-lab-name]").forEach((el) => { el.textContent = labName; });
  $$("[data-english-name]").forEach((el) => { el.textContent = config.englishName || "AI and Security Engineering Lab"; });
  $$("[data-korean-name]").forEach((el) => { el.textContent = config.koreanName || "지능형 보안공학 연구실"; });
  const brandSub = $(".ase-brand-sub");
  if (brandSub) {
    brandSub.textContent = (config.englishName || "AI and Security Engineering Lab").replace(" Engineering", "\nEngineering");
    brandSub.style.whiteSpace = "pre-line";
  }
  document.title = `${labName} — ${config.koreanName || "지능형 보안공학 연구실"}`;
  const email = clean(config.email || "geumhwan@korea.ac.kr");
  $$("[data-email-link]").forEach((el) => { el.href = `mailto:${email}`; });
  $$("[data-email-label]").forEach((el) => { el.textContent = email; });
  $$("[data-site-path]").forEach((el) => { el.setAttribute("href", siteURL(el.dataset.sitePath)); });
  $("#ase-year").textContent = String(new Date().getFullYear());
  if (config.universityName) $(".ase-university-name").textContent = config.universityName;
  if (config.universityCampus) $(".ase-university-campus").textContent = config.universityCampus;

  // Official image slot. Keep the text affiliation visible until the image loads.
  const logo = $("[data-university-logo]");
  const universityLabel = $("[data-university-label]");
  if (logo && clean(config.universityLogo)) {
    logo.addEventListener("load", () => { logo.hidden = false; universityLabel.hidden = true; });
    logo.addEventListener("error", () => { logo.hidden = true; universityLabel.hidden = false; });
    logo.classList.toggle("is-light", config.universityLogoBackground === "light");
    logo.src = config.universityLogo;
  }

  // Accessible mobile navigation. Without JS, all links remain visible.
  document.documentElement.classList.add("ase-js");
  const menu = $("#main-nav");
  const menuButton = $(".ase-menu-button");
  const narrow = window.matchMedia("(max-width: 700px)");
  function setMenu(open, returnFocus = false) {
    menu.classList.toggle("is-open", open);
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
    if (returnFocus) menuButton.focus();
  }
  function updateMenuLayout() {
    menuButton.hidden = !narrow.matches;
    setMenu(false);
  }
  menuButton.addEventListener("click", () => setMenu(menuButton.getAttribute("aria-expanded") !== "true"));
  menu.addEventListener("click", (event) => { if (event.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") setMenu(false, true);
  });
  document.addEventListener("click", (event) => {
    if (narrow.matches && !event.target.closest(".ase-header")) setMenu(false);
  });
  narrow.addEventListener("change", updateMenuLayout);
  updateMenuLayout();

  // Keep only harmless emphasis. No arbitrary HTML/event handlers are inserted.
  function newsText(html) {
    const source = new DOMParser().parseFromString(String(html ?? ""), "text/html");
    const out = document.createDocumentFragment();
    const allowed = new Set(["STRONG", "B", "EM", "I", "BR"]);
    const discarded = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "SVG", "MATH"]);
    function copy(node, target) {
      if (node.nodeType === Node.TEXT_NODE) {
        target.append(document.createTextNode(node.textContent.normalize("NFC")));
      } else if (node.nodeType === Node.ELEMENT_NODE && !discarded.has(node.tagName)) {
        const next = allowed.has(node.tagName) ? document.createElement(node.tagName.toLowerCase()) : target;
        if (next !== target) target.append(next);
        for (const child of node.childNodes) copy(child, next);
      }
    }
    for (const node of source.body.childNodes) copy(node, out);
    return out;
  }

  function renderNews(items) {
    const list = $("#ase-latest-news");
    const nodes = document.createDocumentFragment();
    items.slice(0, newsLimit).forEach((item) => {
      const li = textElement("li", "ase-news-item", "");
      const meta = textElement("div", "ase-news-meta", "");
      const date = textElement("time", "ase-news-date", item.date);
      const dateMatch = clean(item.date).match(/^(\d{4})[.-](\d{2})(?:[.-](\d{2}))?$/);
      if (dateMatch) date.dateTime = [dateMatch[1], dateMatch[2], dateMatch[3]].filter(Boolean).join("-");
      meta.append(date, textElement("span", "ase-news-tag", item.tag || "News"));
      const title = textElement("p", "ase-news-title", "");
      title.append(newsText(item.title));
      li.append(meta, title);
      nodes.append(li);
    });
    if (!items.length) nodes.append(textElement("li", "ase-news-item", "등록된 소식이 없습니다."));
    list.replaceChildren(nodes);
  }

  function status(id, message) {
    const el = $(id);
    el.hidden = !message;
    el.textContent = message || "";
  }

  function loadNewsScript(src) {
    return new Promise((resolve, reject) => {
      // NEWS in the existing file is a global `const`, not window.NEWS.
      const read = () => {
        if (typeof NEWS !== "undefined" && Array.isArray(NEWS)) return NEWS;
        if (Array.isArray(window.NEWS)) return window.NEWS;
        throw new Error("NEWS 배열을 찾지 못했습니다.");
      };
      try { resolve(read()); return; } catch (_) { /* Load it once below. */ }
      const script = document.createElement("script");
      let settled = false;
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        script.onload = script.onerror = null;
        error ? reject(error) : resolve(value);
      };
      const timer = window.setTimeout(() => { script.remove(); finish(new Error("뉴스 로딩 시간 초과")); }, 8000);
      script.src = src;
      script.onload = () => { try { finish(null, read()); } catch (error) { finish(error); } };
      script.onerror = () => finish(new Error("news-data.js를 불러오지 못했습니다."));
      document.head.append(script);
    });
  }

  // Render immediately, including file:// without Internet access.
  renderNews(Array.isArray(snapshot.news) ? snapshot.news : []);
  document.body.dataset.dataMode = isSite ? "site" : "preview";
  if (isSite) {
    const fallback = `${snapshot.checkedOn || "제작 시점"} 기준 미리보기 자료를 표시합니다.`;
    if (location.protocol === "file:") {
      status("#ase-news-status", `실시간 연결은 로컬 서버 또는 웹사이트에서 확인하세요. ${fallback}`);
    } else {
      loadNewsScript(config.newsSource || "news-data.js")
        .then((items) => { renderNews(items); status("#ase-news-status", ""); document.body.dataset.newsSource = "live"; })
        .catch(() => status("#ase-news-status", `뉴스 파일을 읽지 못했습니다. ${fallback}`));
    }
  }
})();
