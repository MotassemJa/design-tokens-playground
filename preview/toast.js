/** The status toast in the bottom corner. One message at a time. */
export class Toast {
  constructor(el) {
    this.el = el;
    this.timer = null;
  }

  show(message) {
    this.el.textContent = message;
    this.el.classList.add("show");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.el.classList.remove("show"), 2600);
  }
}
