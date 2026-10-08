/* ============================================================
   TokenPreviewApp — the top-level orchestrator. Loads the tokens,
   owns the filter state (search text, category tags) and which
   view is showing, and delegates rendering to ListView and
   GraphView so each stays focused on its own DOM.
   ============================================================ */

import { GraphView } from "./graphView.js";
import { ListView } from "./listView.js";
import { Toast } from "./toast.js";
import { TokenCatalog } from "./tokenCatalog.js";
import { esc } from "./utils.js";

class TokenPreviewApp {
  constructor() {
    this.filter = { search: "", categories: [] };
    this.view = "list";
    this.entries = []; // the entries passing the current filter

    this.searchInput = document.getElementById("searchInput");
    this.filterTags = document.getElementById("filterTags");
    this.listRoot = document.getElementById("categories");
    this.graphRoot = document.getElementById("graph");
    this.viewButtons = document.querySelectorAll(".view-btn");
    this.toast = new Toast(document.getElementById("toast"));
  }

  async start() {
    try {
      this.catalog = await TokenCatalog.load();
    } catch (err) {
      console.error(err);
      this.listRoot.innerHTML = `
        <div class="empty-state">
          ⚠ Failed to load tokens.<br>
          <small>Run <code>npm run build</code>, then serve via <code>npm run preview</code>.</small>
        </div>`;
      return;
    }

    const onOpenToken = (path) => this.openToken(path);
    this.list = new ListView(this.listRoot, { onOpenToken });
    this.graph = new GraphView(this.graphRoot, { catalog: this.catalog, onOpenToken });

    this.searchInput.addEventListener("input", () => {
      this.filter.search = this.searchInput.value;
      this.applyFilters();
    });
    document.getElementById("resetBtn").addEventListener("click", () => this.resetFilters());
    this.filterTags.addEventListener("click", (e) => {
      const tag = e.target.closest(".filter-tag");
      if (tag) this.toggleCategory(tag.dataset.cat);
    });
    this.viewButtons.forEach((btn) => btn.addEventListener("click", () => this.setView(btn.dataset.view)));

    this.applyFilters();
  }

  /* ── Filters ─────────────────────────────────────────── */

  applyFilters() {
    this.entries = this.catalog.filter(this.filter);
    this.renderFilterTags();
    this.render();
  }

  resetFilters() {
    this.filter = { search: "", categories: [] };
    this.searchInput.value = "";
    this.applyFilters();
  }

  toggleCategory(category) {
    const selected = this.filter.categories;
    const i = selected.indexOf(category);
    if (i >= 0) selected.splice(i, 1);
    else selected.push(category);
    this.applyFilters();
  }

  renderFilterTags() {
    this.filterTags.innerHTML = this.catalog.categories
      .map((category) => {
        const active = this.filter.categories.includes(category);
        return `<button class="filter-tag${active ? " active" : ""}" data-cat="${esc(category)}">${esc(category)}</button>`;
      })
      .join("");
  }

  /* ── Views ───────────────────────────────────────────── */

  setView(view) {
    this.view = view;
    // Unhide before rendering: the graph measures its nodes.
    this.listRoot.hidden = view !== "list";
    this.graphRoot.hidden = view !== "graph";
    this.viewButtons.forEach((btn) => {
      const active = btn.dataset.view === view;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
    this.render();
  }

  render() {
    (this.view === "graph" ? this.graph : this.list).render(this.entries);
  }

  /**
   * Shows a token's card in the list, from a reference badge or a graph node.
   * A token hidden by the filters is revealed by clearing them.
   */
  openToken(path) {
    if (this.view !== "list") this.setView("list");
    if (this.list.highlight(path)) return;
    this.resetFilters();
    if (!this.list.highlight(path)) this.toast.show(`Token not found: ${path}`);
  }
}

new TokenPreviewApp().start();
