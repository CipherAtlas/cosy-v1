const BOOK_PROXY = (process.env.NEXT_PUBLIC_BOOKS_PROXY ?? process.env.NEXT_PUBLIC_MANGADEX_PROXY ?? "").trim();
const PUBLIC_PROXY_FALLBACKS = ["https://corsproxy.io/?{url}", "https://api.allorigins.win/raw?url={url}"];

const RESPONSE_CACHE = new Map<string, { expiresAt: number; value: unknown }>();
const TEXT_CACHE = new Map<string, { expiresAt: number; value: string }>();
let directRequestsLikelyBlocked = false;

class HttpStatusError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const wait = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });

const buildProxyUrl = (template: string, targetUrl: string): string => {
  const encoded = encodeURIComponent(targetUrl);
  return template.includes("{url}") ? template.replace("{url}", encoded) : `${template}${encoded}`;
};

const getProxyCandidates = (targetUrl: string): string[] => {
  const candidates = [BOOK_PROXY, ...PUBLIC_PROXY_FALLBACKS]
    .map((entry) => entry.trim())
    .filter((entry, index, all) => entry.length > 0 && all.indexOf(entry) === index);

  return candidates.map((template) => buildProxyUrl(template, targetUrl));
};

const isLikelyCorsFailure = (error: unknown): boolean => {
  if (error instanceof TypeError) {
    return true;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("cors") || message.includes("failed to fetch") || message.includes("networkerror");
};

const shouldRetryError = (error: unknown): boolean => {
  if (error instanceof HttpStatusError) {
    return error.status === 429 || error.status >= 500;
  }

  return true;
};

const requestRaw = async (url: string): Promise<Response> => {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "*/*"
    },
    cache: "no-store",
    credentials: "omit"
  });

  if (!response.ok) {
    throw new HttpStatusError(response.status, `Request failed: ${response.status}`);
  }

  return response;
};

const requestRawWithRetry = async (url: string, maxAttempts = 3): Promise<Response> => {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await requestRaw(url);
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !shouldRetryError(error)) {
        throw error;
      }

      const jitterMs = Math.floor(Math.random() * 120);
      await wait(120 * attempt + jitterMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Request failed after retries.");
};

const fetchRaw = async (url: string): Promise<Response> => {
  if (!directRequestsLikelyBlocked) {
    try {
      return await requestRawWithRetry(url);
    } catch (error) {
      if (isLikelyCorsFailure(error)) {
        directRequestsLikelyBlocked = true;
      } else {
        throw error;
      }
    }
  }

  for (const proxiedUrl of getProxyCandidates(url)) {
    try {
      return await requestRawWithRetry(proxiedUrl);
    } catch {
      // Try next proxy.
    }
  }

  throw new Error("Could not load data from the source right now.");
};

type FetchJsonOptions = {
  cacheTtlMs?: number;
  forceRefresh?: boolean;
};

export const fetchJson = async <T>(url: string, options: FetchJsonOptions = {}): Promise<T> => {
  const { cacheTtlMs = 0, forceRefresh = false } = options;
  if (!forceRefresh && cacheTtlMs > 0) {
    const cached = RESPONSE_CACHE.get(url);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }
  }

  const response = await fetchRaw(url);
  const json = (await response.json()) as T;
  if (cacheTtlMs > 0) {
    RESPONSE_CACHE.set(url, {
      expiresAt: Date.now() + cacheTtlMs,
      value: json
    });
  }

  return json;
};

export const fetchText = async (url: string, options: FetchJsonOptions = {}): Promise<string> => {
  const { cacheTtlMs = 0, forceRefresh = false } = options;
  if (!forceRefresh && cacheTtlMs > 0) {
    const cached = TEXT_CACHE.get(url);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
  }

  const response = await fetchRaw(url);
  const text = await response.text();

  if (cacheTtlMs > 0) {
    TEXT_CACHE.set(url, {
      expiresAt: Date.now() + cacheTtlMs,
      value: text
    });
  }

  return text;
};
