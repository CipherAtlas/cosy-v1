/** One simulation clock per shared world, independent of visitor renewal messages. */
export class SharedWorldClock {
  /** @param {() => boolean} shouldRun @param {() => void} tick */
  constructor(shouldRun, tick) {
    this.shouldRun = shouldRun;
    this.tick = tick;
    /** @type {ReturnType<typeof setTimeout> | null} */
    this.timer = null;
  }

  refresh() {
    if (!this.shouldRun()) {
      if (this.timer !== null) clearTimeout(this.timer);
      this.timer = null;
      return;
    }
    if (this.timer !== null) return;
    this.timer = setTimeout(() => {
      try {
        if (this.shouldRun()) this.tick();
      } finally {
        this.timer = null;
        this.refresh();
      }
    }, 100);
  }
}
