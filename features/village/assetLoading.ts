/** Bounded asset requests and shared, retryable loads for the village and local editor. */
export class VillageAssetLoadError extends Error {
  constructor(readonly kind: "stalled" | "timeout" | "unavailable", label: string) {
    super(kind === "stalled" ? `${label} stopped loading. Check your connection and retry.`
      : kind === "timeout" ? `${label} took too long to load. Please retry.`
      : `${label} could not load. Please retry.`);
    this.name = "VillageAssetLoadError";
  }
}

export async function readVillageAsset<T>(url: string, label: string, decode: (bytes: ArrayBuffer) => T | Promise<T>, options: {
  signal?: AbortSignal; timeoutMs?: number; stallMs?: number; abandon?: (value: T) => void;
} = {}): Promise<T> {
  if (options.signal?.aborted) throw options.signal.reason;
  const controller = new AbortController();
  const cancel = () => controller.abort(options.signal?.reason ?? new DOMException("Loading cancelled", "AbortError"));
  if (options.signal?.aborted) cancel();
  else options.signal?.addEventListener("abort", cancel, { once: true });
  let stall: ReturnType<typeof setTimeout> | undefined;
  const timeout = setTimeout(() => controller.abort(new VillageAssetLoadError("timeout", label)), options.timeoutMs ?? 45000);
  const progress = () => {
    clearTimeout(stall);
    stall = setTimeout(() => controller.abort(new VillageAssetLoadError("stalled", label)), options.stallMs ?? 20000);
  };
  let onAbort: (() => void) | undefined;
  const interrupted = new Promise<never>((_, reject) => {
    onAbort = () => reject(controller.signal.reason);
    if (controller.signal.aborted) onAbort();
    else controller.signal.addEventListener("abort", onAbort, { once: true });
  });
  const request = async () => {
    progress();
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new VillageAssetLoadError("unavailable", label);
    progress();
    let bytes: ArrayBuffer;
    if (response.body) {
      const reader = response.body.getReader(), chunks: Uint8Array[] = [];
      let length = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          chunks.push(chunk.value); length += chunk.value.byteLength; progress();
        }
      } finally {
        reader.releaseLock();
      }
      const data = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
      bytes = data.buffer;
    } else bytes = await response.arrayBuffer();
    clearTimeout(stall);
    const value = await decode(bytes);
    if (controller.signal.aborted) {
      options.abandon?.(value);
      throw controller.signal.reason;
    }
    return value;
  };
  try {
    return await Promise.race([request(), interrupted]);
  } catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason;
    if (error instanceof VillageAssetLoadError) throw error;
    throw new VillageAssetLoadError("unavailable", label);
  } finally {
    clearTimeout(timeout); clearTimeout(stall);
    options.signal?.removeEventListener("abort", cancel);
    if (onAbort) controller.signal.removeEventListener("abort", onAbort);
  }
}

/** One cancelled consumer must not cancel an asset another mounted view still needs. */
export function sharedVillageAsset<T>(start: (signal: AbortSignal) => Promise<T>): (signal?: AbortSignal) => Promise<T> {
  let value: { result: T } | undefined;
  let pending: { controller: AbortController; promise: Promise<T>; consumers: number } | undefined;
  return signal => {
    if (signal?.aborted) return Promise.reject(signal.reason);
    if (value) return Promise.resolve(value.result);
    if (!pending || pending.controller.signal.aborted) {
      const controller = new AbortController();
      const entry = { controller, promise: Promise.resolve().then(() => start(controller.signal)), consumers: 0 };
      entry.promise = entry.promise.then(result => {
        if (controller.signal.aborted) throw controller.signal.reason;
        value = { result }; return result;
      }).finally(() => { if (pending === entry) pending = undefined; });
      pending = entry;
    }
    const entry = pending; entry.consumers++;
    return new Promise<T>((resolve, reject) => {
      let finished = false;
      const finish = () => {
        if (finished) return false;
        finished = true; signal?.removeEventListener("abort", cancel); entry.consumers--;
        if (!entry.consumers && !value) entry.controller.abort(new DOMException("Loading cancelled", "AbortError"));
        return true;
      };
      const cancel = () => { if (finish()) reject(signal?.reason); };
      signal?.addEventListener("abort", cancel, { once: true });
      entry.promise.then(result => { if (finish()) resolve(result); }, error => { if (finish()) reject(error); });
    });
  };
}

/** Stop awaiting shared preparation without leaving an unhandled late rejection. */
export function waitForVillageLoad<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  return new Promise((resolve, reject) => {
    const cancel = () => reject(signal.reason);
    if (signal.aborted) cancel();
    else signal.addEventListener("abort", cancel, { once: true });
    promise.then(value => {
      signal.removeEventListener("abort", cancel);
      if (signal.aborted) reject(signal.reason); else resolve(value);
    }, error => { signal.removeEventListener("abort", cancel); reject(error); });
  });
}

/** Own unadopted startup results, including results arriving after a failed sibling. */
export class VillageLoading {
  readonly controller = new AbortController();
  readonly signal = this.controller.signal;
  private owned = new Map<unknown, () => void>();
  private deadline: ReturnType<typeof setTimeout>;
  constructor(timeoutMs = 90000) {
    this.deadline = setTimeout(() => this.cancel(new VillageAssetLoadError("timeout", "The village")), timeoutMs);
  }
  track<T>(promise: Promise<T>, dispose: (value: T) => void): Promise<T> {
    return promise.then(value => {
      if (this.signal.aborted) { dispose(value); throw this.signal.reason; }
      this.owned.set(value, () => dispose(value));
      return value;
    });
  }
  adopt(value: unknown) { this.owned.delete(value); }
  release(value: unknown) { this.owned.get(value)?.(); this.owned.delete(value); }
  wait<T>(promise: Promise<T>): Promise<T> {
    return waitForVillageLoad(promise, this.signal);
  }
  finish() {
    clearTimeout(this.deadline);
    for (const dispose of this.owned.values()) dispose();
    this.owned.clear();
  }
  cancel(reason: unknown = new DOMException("Loading cancelled", "AbortError")) {
    this.controller.abort(reason);
    this.finish();
  }
}
