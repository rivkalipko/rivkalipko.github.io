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
    localStorage.setItem("theme", root.dataset.theme);
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
