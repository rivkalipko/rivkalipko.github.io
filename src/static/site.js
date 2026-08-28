(() => {
  const root = document.documentElement;
  const themeButton = document.querySelector("#theme-toggle");
  const dialog = document.querySelector("#search-dialog");
  const openButton = document.querySelector("#search-open");
  const input = document.querySelector("#search-input");
  const results = document.querySelector("#search-results");
  let index = null;

  function syncThemeLabel() {
    if (themeButton) themeButton.setAttribute("aria-label", root.dataset.theme === "dark" ? "Use light theme" : "Use dark theme");
  }

  const siteHeader = document.querySelector(".site-header");
  if (siteHeader) {
    const syncScrollState = () => {
      siteHeader.dataset.scrolled = window.scrollY > 8 ? "true" : "false";
    };
    syncScrollState();
    addEventListener("scroll", syncScrollState, { passive: true });
  }

  themeButton?.addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch { /* private mode */ }
    syncThemeLabel();
  });
  syncThemeLabel();

  async function loadIndex() {
    if (!index) index = await fetch("/search.json").then((response) => response.json());
    return index;
  }

  function escapeHtml(value) {
    const element = document.createElement("span");
    element.textContent = value;
    return element.innerHTML;
  }

  async function runSearch(query) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      results.innerHTML = '<p class="search-hint">Search all articles by title, topic, or text.</p>';
      return;
    }
    const records = await loadIndex();
    const terms = normalized.split(/\s+/);
    const matches = records.filter((record) => {
      const haystack = `${record.title} ${record.categories.join(" ")} ${record.excerpt} ${record.text}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    }).slice(0, 12);
    results.innerHTML = matches.length ? matches.map((record) => `
      <a class="search-result" href="${record.url}">
        <span>${escapeHtml(record.title)}</span>
        <small>${escapeHtml(record.categories.join(" · "))} · ${escapeHtml(record.date)}</small>
      </a>`).join("") : '<p class="search-hint">No articles matched that search.</p>';
  }

  openButton?.addEventListener("click", async () => {
    dialog.showModal();
    input.focus();
    await loadIndex();
  });
  input?.addEventListener("input", () => runSearch(input.value));
  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  function setUpBlogStream() {
    const list = document.querySelector("[data-infinite-list]");
    if (!list) return;
    const cards = [...list.querySelectorAll(".post-card")];
    const buttons = [...document.querySelectorAll("[data-category-filter]")];
    const loadButton = document.querySelector("[data-load-more]");
    const sentinel = document.querySelector("[data-scroll-sentinel]");
    const batchSize = 8;
    let visibleLimit = batchSize;
    let activeCategory = "all";

    const matchesFilter = (card) => activeCategory === "all" || card.dataset.categories.split(/\s+/).includes(activeCategory);

    function render() {
      const matching = cards.filter(matchesFilter);
      cards.forEach((card) => { card.hidden = true; });
      matching.slice(0, visibleLimit).forEach((card) => { card.hidden = false; });
      buttons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.categoryFilter === activeCategory)));
      const shown = Math.min(visibleLimit, matching.length);
      if (loadButton) loadButton.hidden = shown >= matching.length;
      if (sentinel) sentinel.hidden = shown >= matching.length;
    }

    function revealMore() {
      const remaining = cards.filter(matchesFilter).length - visibleLimit;
      if (remaining <= 0) return;
      visibleLimit += batchSize;
      render();
    }

    function chooseCategory(category, updateHistory = true) {
      activeCategory = buttons.some((button) => button.dataset.categoryFilter === category) ? category : "all";
      visibleLimit = batchSize;
      if (updateHistory) {
        const url = new URL(location.href);
        if (activeCategory === "all") url.searchParams.delete("category");
        else url.searchParams.set("category", activeCategory);
        history.replaceState({}, "", url);
      }
      render();
    }

    // Switching categories deep in the list would otherwise leave the reader
    // stranded partway down a much shorter list.
    function scrollListIntoView() {
      const filterBar = document.querySelector(".category-filters");
      if (!filterBar) return;
      const headerOffset = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--header-height"), 10) || 64;
      const listTop = list.getBoundingClientRect().top + window.scrollY;
      const target = listTop - filterBar.offsetHeight - headerOffset;
      if (window.scrollY > target) window.scrollTo({ top: target, behavior: "smooth" });
    }

    buttons.forEach((button) => button.addEventListener("click", () => {
      chooseCategory(button.dataset.categoryFilter);
      scrollListIntoView();
    }));
    loadButton?.addEventListener("click", revealMore);
    addEventListener("popstate", () => chooseCategory(new URLSearchParams(location.search).get("category") || "all", false));

    if ("IntersectionObserver" in window && sentinel) {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) revealMore();
      }, { rootMargin: "600px 0px" });
      observer.observe(sentinel);
    }

    chooseCategory(new URLSearchParams(location.search).get("category") || "all", false);
  }

  function setUpSubscription() {
    const form = document.querySelector("[data-subscribe-form]");
    if (!form) return;
    const status = form.querySelector("[data-subscribe-status]");
    const button = form.querySelector("button[type=submit]");

    // Without JS the form posts normally and the endpoint redirects back here.
    const outcome = new URLSearchParams(location.search).get("subscribed");
    if (outcome && status) {
      status.textContent = outcome === "1"
        ? "Thanks — you’re on the list."
        : "That didn’t work. Please try again.";
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (status) status.textContent = "Subscribing…";
      if (button) button.disabled = true;
      try {
        const response = await fetch(form.action, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            email: form.elements.email.value,
            website: form.elements.website.value
          })
        });
        const result = await response.json().catch(() => ({}));
        if (response.ok && result.ok) {
          form.reset();
          if (status) status.textContent = "Thanks — you’re on the list.";
        } else if (status) {
          status.textContent = result.error || "That didn’t work. Please try again.";
        }
      } catch {
        if (status) status.textContent = "Couldn’t reach the server. Please try again in a moment.";
      }
      if (button) button.disabled = false;
    });
  }

  if (window.renderMathInElement) {
    document.querySelectorAll(".prose").forEach((element) => window.renderMathInElement(element, {
      delimiters: [
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false }
      ],
      throwOnError: false
    }));
  }

  setUpBlogStream();
  setUpSubscription();

  const params = new URLSearchParams(location.search);
  const legacyGlossary = params.get("glossary");
  if (legacyGlossary && location.pathname === "/") {
    location.replace(`/glossary/${encodeURIComponent(legacyGlossary)}/`);
    return;
  }
  const legacySearch = params.get("s");
  if (legacySearch && dialog) {
    dialog.showModal();
    input.value = legacySearch;
    runSearch(legacySearch);
  }
})();
