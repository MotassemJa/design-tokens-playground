/* ============================================================
   Graph layout — pure tree building, placement and edge paths.
   No DOM: GraphView measures node widths and hands them in.
   ============================================================ */

const ROW = 40; // vertical distance between leaf rows
const GAP = 56; // horizontal space between columns
const PAD = 24; // margin around the drawing
const ARC_ROOM = 160; // extra width on the right for reference arcs

/** Nests flat entries by path segment under a single root node. */
export function buildTree(entries) {
  const root = { name: "tokens", path: "", children: [], count: 0 };
  for (const entry of entries) {
    const parts = entry.name.split(".");
    let node = root;
    root.count++;
    parts.forEach((part, i) => {
      const path = parts.slice(0, i + 1).join(".");
      if (i === parts.length - 1) {
        node.children.push({ name: part, path, token: entry });
        return;
      }
      let group = node.children.find((c) => c.children && c.path === path);
      if (!group) node.children.push((group = { name: part, path, children: [], count: 0 }));
      group.count++;
      node = group;
    });
  }
  return root;
}

/**
 * Lists the visible nodes, children before parents, and gives each a depth
 * and a row: one row per visible leaf (a token or a folded group), with an
 * open group centred beside its children.
 */
export function placeRows(root, collapsed) {
  const nodes = [];
  let rows = 0;
  const place = (node, depth) => {
    node.depth = depth;
    node.open = !!node.children && !collapsed.has(node.path);
    if (node.open) {
      node.children.forEach((child) => place(child, depth + 1));
      node.row = (node.children[0].row + node.children.at(-1).row) / 2;
    } else {
      node.row = rows++;
    }
    nodes.push(node);
  };
  place(root, 0);
  return { nodes, rows };
}

/**
 * Sets `x`/`y` (left edge, vertical centre) on nodes that already carry a
 * measured width `w`. Each depth gets a column as wide as its widest node.
 * Returns the size of the whole drawing.
 */
export function placeColumns(nodes, rows) {
  const widths = [];
  for (const n of nodes) widths[n.depth] = Math.max(widths[n.depth] || 0, n.w);
  const columnX = [PAD];
  widths.forEach((w, depth) => (columnX[depth + 1] = columnX[depth] + w + GAP));

  for (const n of nodes) {
    n.x = columnX[n.depth];
    n.y = PAD + n.row * ROW + ROW / 2;
  }
  return { width: columnX.at(-1) - GAP + PAD + ARC_ROOM, height: PAD * 2 + rows * ROW };
}

/** Tree edge: an S-curve from a parent's right edge to a child's left edge. */
export function treeEdge(parent, child) {
  const x1 = parent.x + parent.w;
  const x2 = child.x;
  const mid = (x1 + x2) / 2;
  return `M${x1},${parent.y} C${mid},${parent.y} ${mid},${child.y} ${x2},${child.y}`;
}

/** Reference edge: an arc bulging out to the right, between two right edges. */
export function refEdge(from, to) {
  const x1 = from.x + from.w;
  const x2 = to.x + to.w + 2;
  const cx = Math.max(x1, x2) + 40 + Math.abs(from.y - to.y) * 0.3;
  return `M${x1},${from.y} C${cx},${from.y} ${cx},${to.y} ${x2},${to.y}`;
}
