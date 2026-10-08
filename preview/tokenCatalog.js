/* ============================================================
   TokenCatalog — the built tokens as flat entries, plus the
   lookups both views share. Read-only once loaded.
   ============================================================ */

import { refsOf, toText } from "./utils.js";

/** The top-level group a token belongs to, e.g. `colors` for `colors.black`. */
export function categoryOf(entry) {
  return entry.name.split(".")[0];
}

export class TokenCatalog {
  /** Loads the resolved and raw token trees written by `npm run build`. */
  static async load() {
    const [resolved, raw] = await Promise.all([
      fetchJson("../dist/tokens.resolved.json"),
      fetchJson("../dist/tokens.json"),
    ]);
    return new TokenCatalog(resolved, raw);
  }

  constructor(resolved, raw) {
    /** @type {{name: string, resolvedValue: unknown, rawValue: unknown, type: string, description: string}[]} */
    this.entries = flatten(resolved, raw);
    this.categories = [...new Set(this.entries.map(categoryOf))].sort();

    /** Token path -> paths of the tokens whose raw value references it. */
    this.dependents = new Map();
    for (const entry of this.entries) {
      for (const ref of refsOf(entry)) {
        if (!this.dependents.has(ref)) this.dependents.set(ref, []);
        this.dependents.get(ref).push(entry.name);
      }
    }
  }

  /** Every group path: each proper prefix of a token name. */
  groupPaths() {
    const paths = new Set();
    for (const { name } of this.entries) {
      const parts = name.split(".");
      for (let i = 1; i < parts.length; i++) paths.add(parts.slice(0, i).join("."));
    }
    return paths;
  }

  /**
   * Entries in any of the selected categories (all when none are selected)
   * whose name, description or values contain the search text.
   */
  filter({ search, categories }) {
    const needle = search.toLowerCase();
    return this.entries.filter((entry) => {
      if (categories.length && !categories.includes(categoryOf(entry))) return false;
      if (!needle) return true;
      return [entry.name, entry.description, toText(entry.rawValue), toText(entry.resolvedValue)].some(
        (text) => text.toLowerCase().includes(needle)
      );
    });
  }
}

async function fetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status} ${res.statusText}`);
  return res.json();
}

/** Walks the resolved and raw trees together, one entry per token. */
function flatten(resolved, raw, prefix = "") {
  return Object.entries(resolved ?? {}).flatMap(([key, node]) => {
    if (!node || typeof node !== "object") return [];
    const path = prefix ? `${prefix}.${key}` : key;
    const rawNode = raw?.[key];
    if (!("$value" in node)) return flatten(node, rawNode, path);
    return [
      {
        name: path,
        resolvedValue: node.$value,
        rawValue: rawNode?.$value,
        type: node.$type || rawNode?.$type || "",
        description: node.$description || rawNode?.$description || "",
      },
    ];
  });
}
