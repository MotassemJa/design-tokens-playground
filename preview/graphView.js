/* ============================================================
   GraphView — the token tree as foldable nodes joined by curves,
   with reference tracing on hover and pan/zoom. Folds and zoom
   live here so they survive the redraws a filter change causes.
   ============================================================ */

import { buildTree, placeColumns, placeRows, refEdge, treeEdge } from "./graphLayout.js";
import { PanZoom } from "./panZoom.js";
import { esc, isValidColor, refsOf, toText } from "./utils.js";

const ZOOM_STEP = 1.25;

export class GraphView {
  /**
   * @param {HTMLElement} root  the graph card (header controls + scroll area)
   * @param {{
   *   catalog: import("./tokenCatalog.js").TokenCatalog,
   *   onOpenToken: (path: string) => void,
   * }} options
   */
  constructor(root, { catalog, onOpenToken }) {
    this.root = root;
    this.catalog = catalog;
    this.onOpenToken = onOpenToken;
    this.canvas = root.querySelector(".graph-canvas");
    this.entries = [];
    this.collapsed = catalog.groupPaths(); // folded group paths; all folded at first
    this.nodes = new Map(); // path -> laid-out node of the current drawing

    const level = root.querySelector(".graph-zoom-level");
    this.viewport = new PanZoom({
      scroll: root.querySelector(".graph-scroll"),
      sizer: root.querySelector(".graph-zoom"),
      content: this.canvas,
      panIgnore: ".graph-node",
      onZoom: (zoom) => (level.textContent = `${Math.round(zoom * 100)}%`),
    });

    root.querySelectorAll("[data-graph]").forEach((btn) =>
      btn.addEventListener("click", () => {
        this.collapsed = btn.dataset.graph === "expand" ? new Set() : catalog.groupPaths();
        this.draw();
      })
    );
    const zoomActions = {
      in: () => this.viewport.zoomBy(ZOOM_STEP),
      out: () => this.viewport.zoomBy(1 / ZOOM_STEP),
      reset: () => this.viewport.zoomTo(1),
      fit: () => this.viewport.fit(),
    };
    root.querySelectorAll("[data-zoom]").forEach((btn) =>
      btn.addEventListener("click", zoomActions[btn.dataset.zoom])
    );
  }

  /** Draws the tree for `entries`, keeping the current folds and zoom. */
  render(entries) {
    this.entries = entries;
    this.draw();
  }

  draw() {
    this.nodes = new Map();
    if (!this.entries.length) {
      this.canvas.style.width = "100%";
      this.canvas.style.height = "";
      this.canvas.innerHTML = '<div class="empty-state">No tokens found. Try adjusting your search.</div>';
      this.viewport.setSize(0, 0);
      return;
    }

    const { nodes, rows } = placeRows(buildTree(this.entries), this.collapsed);
    this.canvas.innerHTML = `
      <svg class="graph-edges" aria-hidden="true">
        <defs>
          <marker id="arrow-out" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#1d4ed8"/></marker>
          <marker id="arrow-in" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#f59e0b"/></marker>
        </defs>
        <g class="graph-tree"></g>
        <g class="graph-refs"></g>
      </svg>
      ${nodes.map((n) => this.renderNode(n)).join("")}`;

    // Columns depend on rendered widths: measure first, then place.
    const els = this.canvas.querySelectorAll(".graph-node");
    nodes.forEach((n, i) => {
      n.el = els[i];
      n.w = n.el.offsetWidth;
    });
    const size = placeColumns(nodes, rows);
    for (const n of nodes) {
      n.el.style.left = `${n.x}px`;
      n.el.style.top = `${n.y}px`;
      this.nodes.set(n.path, n);
      this.bindNode(n);
    }
    this.canvas.style.width = `${size.width}px`;
    this.canvas.style.height = `${size.height}px`;
    this.viewport.setSize(size.width, size.height);

    this.canvas.querySelector(".graph-tree").innerHTML = nodes
      .filter((n) => n.open)
      .flatMap((n) => n.children.map((child) => `<path d="${treeEdge(n, child)}"/>`))
      .join("");
  }

  renderNode(n) {
    const path = esc(n.path);
    if (n.token) {
      const resolved = toText(n.token.resolvedValue);
      const swatch =
        n.token.type === "color" && isValidColor(resolved)
          ? `<span class="graph-swatch" style="background:${esc(resolved)}"></span>`
          : "";
      return `<button type="button" class="graph-node token" data-path="${path}" title="${esc(`${n.path}: ${resolved}`)}">${swatch}<code class="graph-label">${esc(n.name)}</code><span class="graph-value">${esc(resolved)}</span></button>`;
    }
    return `<button type="button" class="graph-node group${n.depth === 0 ? " root" : ""}" data-path="${path}" aria-expanded="${n.open}" title="${n.open ? "Fold" : "Unfold"} ${esc(n.path || "all tokens")}"><svg class="graph-caret" viewBox="0 0 10 10" aria-hidden="true"><path d="M2.5 3.5 5 6.5l2.5-3"/></svg><span class="graph-label">${esc(n.name)}</span><span class="category-count">${n.count}</span></button>`;
  }

  bindNode(n) {
    if (n.token) {
      n.el.addEventListener("click", () => this.onOpenToken(n.path));
      n.el.addEventListener("mouseenter", () => this.traceRefs(n));
      n.el.addEventListener("focus", () => this.traceRefs(n));
      n.el.addEventListener("mouseleave", () => this.clearRefs());
      n.el.addEventListener("blur", () => this.clearRefs());
      return;
    }
    n.el.addEventListener("click", () => {
      if (!this.collapsed.delete(n.path)) this.collapsed.add(n.path);
      this.draw();
      this.nodes.get(n.path)?.el.focus({ preventScroll: true });
    });
  }

  /**
   * The node showing `path`: the token itself, or the folded group hiding
   * it. Null when the token is filtered out.
   */
  visibleNode(path) {
    if (this.nodes.has(path)) return this.nodes.get(path);
    const parts = path.split(".");
    for (let i = parts.length - 1; i > 0; i--) {
      const ancestor = this.nodes.get(parts.slice(0, i).join("."));
      if (ancestor) return ancestor.open ? null : ancestor;
    }
    return null;
  }

  /** Draws arcs to the tokens `source` references and from those referencing it. */
  traceRefs(source) {
    this.clearRefs();
    source.el.classList.add("ref-source");
    const arcs = new Set();
    for (const ref of refsOf(source.token)) {
      const target = this.visibleNode(ref);
      if (!target || target === source) continue;
      target.el.classList.add("ref-out");
      arcs.add(`<path class="out" marker-end="url(#arrow-out)" d="${refEdge(source, target)}"/>`);
    }
    for (const name of this.catalog.dependents.get(source.path) || []) {
      const dependent = this.visibleNode(name);
      if (!dependent || dependent === source) continue;
      dependent.el.classList.add("ref-in");
      arcs.add(`<path class="in" marker-end="url(#arrow-in)" d="${refEdge(dependent, source)}"/>`);
    }
    this.canvas.querySelector(".graph-refs").innerHTML = [...arcs].join("");
  }

  clearRefs() {
    this.canvas
      .querySelectorAll(".ref-source, .ref-out, .ref-in")
      .forEach((el) => el.classList.remove("ref-source", "ref-out", "ref-in"));
    const layer = this.canvas.querySelector(".graph-refs");
    if (layer) layer.innerHTML = "";
  }
}
