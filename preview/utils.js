/* ============================================================
   Shared helpers: escaping, value text, references, clipboard.
   ============================================================ */

/** Escapes text for HTML element content and attribute values alike. */
export function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** A token value as display text: strings as-is, objects and arrays as JSON. */
export function toText(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

/** DOM id of a token's card in the list view. */
export function tokenId(path) {
  return "tok-" + path.replace(/\./g, "-");
}

/**
 * A reference is `{path}` with no braces or quotes inside. Object values
 * arrive as JSON, whose own braces always contain a quoted key.
 */
export const REF_PATTERN = /\{([^{}"]+)\}/g;

/** Token paths referenced by an entry's raw (unresolved) value. */
export function refsOf(entry) {
  return [...toText(entry.rawValue).matchAll(REF_PATTERN)].map((m) => m[1]);
}

/** Whether the browser accepts `color` as a CSS colour. */
export function isValidColor(color) {
  try {
    const style = new Option().style;
    style.color = color;
    return !!style.color;
  } catch {
    return false;
  }
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for environments without the clipboard API.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}
