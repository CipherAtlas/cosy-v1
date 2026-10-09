/** Idle villages stay animated without doing a full refresh-rate frame on a second monitor. */
export class VillageFrameBudget {
  private awakeUntil = 0;
  private renderedAt = -Infinity;
  private interval = 0;
  private changed = false;

  wake(now: number) { this.awakeUntil = now + 1500; }
  reset() { this.renderedAt = -Infinity; }

  accept(now: number, active: boolean) {
    if (active) this.wake(now);
    const interval = now < this.awakeUntil ? 0 : 1000 / 30;
    if (now - this.renderedAt < interval - .5) return false;
    this.changed = interval !== this.interval;
    this.interval = interval;
    this.renderedAt = now;
    return true;
  }

  get idle() { return this.interval !== 0; }
  get cadenceChanged() { return this.changed; }
}
