/* ============================================================
   PanZoom — zoom and pan for content inside a scroll container.
   The content is scaled with a CSS transform; a sizer element
   takes the scaled size so the scrollbars match what is drawn.
   ============================================================ */

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;

export class PanZoom {
  /**
   * @param {{
   *   scroll: HTMLElement,      // the scrolling viewport
   *   sizer: HTMLElement,       // sized to the scaled content
   *   content: HTMLElement,     // scaled from its top-left corner
   *   panIgnore?: string,       // selector of elements a drag must not start on
   *   onZoom?: (zoom: number) => void,
   * }} options
   */
  constructor({ scroll, sizer, content, panIgnore, onZoom = () => {} }) {
    this.scroll = scroll;
    this.sizer = sizer;
    this.content = content;
    this.onZoom = onZoom;
    this.zoom = 1;
    this.size = { width: 0, height: 0 }; // unscaled content size

    // Ctrl + wheel zooms around the cursor (a trackpad pinch also sends
    // ctrlKey); a plain wheel scrolls as usual.
    scroll.addEventListener(
      "wheel",
      (e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        // Firefox can report whole lines rather than pixels.
        const delta = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * 33 : e.deltaY;
        const box = scroll.getBoundingClientRect();
        this.zoomTo(this.zoom * Math.exp(-delta * 0.002), { x: e.clientX - box.left, y: e.clientY - box.top });
      },
      { passive: false }
    );

    // Dragging the background pans.
    let drag = null;
    scroll.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || (panIgnore && e.target.closest(panIgnore))) return;
      drag = { x: e.clientX, y: e.clientY, left: scroll.scrollLeft, top: scroll.scrollTop };
      scroll.setPointerCapture(e.pointerId);
      scroll.classList.add("panning");
    });
    scroll.addEventListener("pointermove", (e) => {
      if (!drag) return;
      scroll.scrollLeft = drag.left - (e.clientX - drag.x);
      scroll.scrollTop = drag.top - (e.clientY - drag.y);
    });
    const endDrag = () => {
      drag = null;
      scroll.classList.remove("panning");
    };
    scroll.addEventListener("pointerup", endDrag);
    scroll.addEventListener("pointercancel", endDrag);
  }

  /** Records a new unscaled content size (0 × 0 when there is nothing to draw). */
  setSize(width, height) {
    this.size = { width, height };
    this.apply();
  }

  zoomBy(factor) {
    this.zoomTo(this.zoom * factor);
  }

  /**
   * Zooms to `next`, keeping the point at `anchor` (px inside the viewport;
   * its centre by default) where it is.
   */
  zoomTo(next, anchor) {
    const { scroll } = this;
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    const ax = anchor ? anchor.x : scroll.clientWidth / 2;
    const ay = anchor ? anchor.y : scroll.clientHeight / 2;
    const x = (scroll.scrollLeft + ax) / this.zoom;
    const y = (scroll.scrollTop + ay) / this.zoom;
    this.zoom = zoom;
    this.apply();
    scroll.scrollLeft = x * zoom - ax;
    scroll.scrollTop = y * zoom - ay;
  }

  /** Scales the whole content into view (never above 100%) and scrolls home. */
  fit() {
    const { width, height } = this.size;
    if (!width) return;
    this.zoomTo(Math.min(this.scroll.clientWidth / width, this.scroll.clientHeight / height, 1));
    this.scroll.scrollTo(0, 0);
  }

  apply() {
    const { width, height } = this.size;
    this.content.style.transform = width ? `scale(${this.zoom})` : "";
    this.sizer.style.width = width ? `${width * this.zoom}px` : "";
    this.sizer.style.height = height ? `${height * this.zoom}px` : "";
    this.onZoom(this.zoom);
  }
}
