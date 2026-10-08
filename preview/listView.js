/* ============================================================
   ListView — token cards grouped by category, with copyable
   values and clickable {reference} badges.
   ============================================================ */

import { categoryOf } from "./tokenCatalog.js";
import { copyText, esc, isValidColor, REF_PATTERN, refsOf, toText, tokenId } from "./utils.js";

const HIGHLIGHT_MS = 1700;
const COPIED_MS = 1500;

export class ListView {
  /**
   * @param {HTMLElement} root  the grid the category cards render into
   * @param {{ onOpenToken: (path: string) => void }} options
   *   `onOpenToken` is called for a reference badge; the host decides how to
   *   show a token that may be filtered out.
   */
  constructor(root, { onOpenToken }) {
    this.root = root;
    this.onOpenToken = onOpenToken;
    this.highlightTimer = null;
    this.copyTimers = new WeakMap(); // value box -> timer resetting its icon

    // Delegated, so the listener survives every re-render.
    root.addEventListener("click", (e) => {
      const badge = e.target.closest(".ref-badge");
      if (badge) return this.onOpenToken(badge.dataset.ref);
      const box = e.target.closest(".value-box");
      if (box) this.copy(box);
    });
  }

  render(entries) {
    if (!entries.length) {
      this.root.innerHTML = '<div class="empty-state">No tokens found. Try adjusting your search.</div>';
      return;
    }
    const byCategory = Map.groupBy(entries, categoryOf);
    this.root.innerHTML = [...byCategory.keys()]
      .sort()
      .map((category) => this.renderCategory(category, byCategory.get(category)))
      .join("");
  }

  /** Scrolls to a token's card and flashes it. False when it isn't rendered. */
  highlight(path) {
    const card = document.getElementById(tokenId(path));
    if (!card || !this.root.contains(card)) return false;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    // Restart the animation cleanly, even mid-flash.
    card.classList.remove("highlight");
    void card.offsetWidth;
    card.classList.add("highlight");
    clearTimeout(this.highlightTimer);
    this.highlightTimer = setTimeout(() => card.classList.remove("highlight"), HIGHLIGHT_MS);
    return true;
  }

  /** Copies a value box's text and briefly swaps its icon to a check mark. */
  async copy(box) {
    await copyText(box.dataset.copy);
    const icon = box.querySelector(".copy-icon");
    box.classList.add("copying");
    icon.textContent = "✓";
    icon.style.opacity = "1";
    icon.style.color = "#16a34a";
    clearTimeout(this.copyTimers.get(box));
    this.copyTimers.set(
      box,
      setTimeout(() => {
        box.classList.remove("copying");
        icon.textContent = "⎘";
        icon.style.opacity = "";
        icon.style.color = "";
      }, COPIED_MS)
    );
  }

  renderCategory(category, entries) {
    return `
      <div class="category-card">
        <div class="category-header">
          <span class="category-name">${esc(category)}</span>
          <span class="category-count">${entries.length}</span>
        </div>
        <div class="tokens-list">
          ${entries.map((entry) => this.renderToken(entry)).join("")}
        </div>
      </div>`;
  }

  renderToken(entry) {
    const raw = toText(entry.rawValue);
    const resolved = toText(entry.resolvedValue);
    // Show the calculation when the raw value differs from what it resolves to.
    const isCalc = entry.rawValue !== undefined && (refsOf(entry).length > 0 || raw !== resolved);

    const swatch =
      entry.type === "color" && isValidColor(resolved)
        ? `<div class="color-swatch" style="background:${esc(resolved)}" title="${esc(resolved)}"></div>`
        : "";
    const typeBadge = entry.type ? `<span class="type-badge">${esc(entry.type)}</span>` : "";
    const values = isCalc
      ? this.renderValue("CALCULATION", "calc", raw, renderWithRefs(raw)) +
        this.renderValue("RESOLVED", "resolved", resolved, esc(resolved))
      : this.renderValue("VALUE", "plain", resolved, esc(resolved));
    const desc = entry.description ? `<p class="token-desc">${esc(entry.description)}</p>` : "";

    return `
      <div id="${tokenId(entry.name)}" class="token-item">
        <div class="token-item-inner">
          ${swatch}
          <div class="token-body">
            <div class="token-header">
              <code class="token-name">${esc(entry.name)}</code>
              ${typeBadge}
            </div>
            <div class="value-section">${values}</div>
            ${desc}
          </div>
        </div>
      </div>`;
  }

  renderValue(label, kind, copy, html) {
    return `
      <div class="value-row">
        <label class="value-label">${label}</label>
        <div class="value-box ${kind}" data-copy="${esc(copy)}" title="Click to copy">
          <span class="value-content">${html}</span>
          <i class="copy-icon" aria-hidden="true">⎘</i>
        </div>
      </div>`;
  }
}

/** A raw value as HTML, with each {reference} turned into a jump badge. */
function renderWithRefs(raw) {
  let html = "";
  let last = 0;
  for (const match of raw.matchAll(REF_PATTERN)) {
    const path = match[1];
    html += esc(raw.slice(last, match.index));
    html += `<button type="button" class="ref-badge" data-ref="${esc(path)}" title="Jump to ${esc(path)}">${esc(path)}</button>`;
    last = match.index + match[0].length;
  }
  return html + esc(raw.slice(last));
}
