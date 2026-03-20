import type { PdfSearchOptions, PdfSearchResponse, PdfSearchResult } from "@/features/pdf-search/types";

const MAX_RESULTS = 24;
const REQUEST_TIMEOUT_MS = 12000;

const PROXY_BUILDERS: Array<{ name: string; buildUrl: (sourceUrl: string) => string }> = [
  {
    name: "allorigins",
    buildUrl: (sourceUrl) => `https://api.allorigins.win/raw?url=${encodeURIComponent(sourceUrl)}`
  },
  {
    name: "corsproxy",
    buildUrl: (sourceUrl) => `https://corsproxy.io/?${encodeURIComponent(sourceUrl)}`
  },
  {
    name: "isomorphic-git-proxy",
    buildUrl: (sourceUrl) => `https://cors.isomorphic-git.org/${sourceUrl}`
  },
  {
    name: "thingproxy",
    buildUrl: (sourceUrl) => `https://thingproxy.freeboard.io/fetch/${sourceUrl}`
  }
];

type GoogleCseItem = {
  title?: string;
  link?: string;
  snippet?: string;
  displayLink?: string;
  mime?: string;
  fileFormat?: string;
};

type GoogleCseResponse = {
  items?: GoogleCseItem[];
};

const normalizeQuery = (query: string): string => query.trim().replace(/\s+/g, " ");

const stripHtml = (value: string): string => value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const isLikelyPdfUrl = (url: string): boolean => {
  const lower = url.toLowerCase();
  return lower.includes(".pdf") || lower.includes("filetype=pdf") || lower.includes("format=pdf");
};

const scoreCandidate = (title: string, snippet: string, url: string, preferredDomain?: string): number => {
  let score = 0;
  const lowerTitle = title.toLowerCase();
  const lowerSnippet = snippet.toLowerCase();
  const lowerUrl = url.toLowerCase();
  const lowerDomain = (preferredDomain ?? "").toLowerCase();

  if (isLikelyPdfUrl(url)) {
    score += 120;
  }

  if (lowerTitle.includes("pdf") || lowerSnippet.includes("pdf")) {
    score += 35;
  }

  if (lowerUrl.includes("/pdf") || lowerUrl.includes("download")) {
    score += 20;
  }

  if (lowerUrl.includes(".edu") || lowerUrl.includes(".gov") || lowerUrl.includes(".org")) {
    score += 10;
  }

  if (lowerDomain.endsWith(".edu") || lowerDomain.endsWith(".gov") || lowerDomain.endsWith(".org")) {
    score += 6;
  }

  return score;
};

const toDomain = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Unknown source";
  }
};

const toAbsoluteUrl = (value: string): string => {
  if (value.startsWith("//")) {
    return `https:${value}`;
  }

  return value;
};

const rankAndLimit = (items: PdfSearchResult[]): PdfSearchResult[] => {
  const deduped = new Map<string, PdfSearchResult>();
  for (const item of items) {
    const key = item.url.toLowerCase();
    const existing = deduped.get(key);
    if (!existing || existing.score < item.score) {
      deduped.set(key, item);
    }
  }

  const sorted = Array.from(deduped.values()).sort((a, b) => b.score - a.score);
  const directFirst = sorted.filter((item) => item.isDirectPdf);
  const likelyPdf = sorted.filter((item) => !item.isDirectPdf);

  const preferred = [...directFirst, ...likelyPdf].slice(0, MAX_RESULTS);
  return preferred.length > 0 ? preferred : sorted.slice(0, MAX_RESULTS);
};

const parseBingRss = (rssText: string): PdfSearchResult[] => {
  if (typeof DOMParser === "undefined") {
    return [];
  }

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(rssText, "application/xml");
  const itemNodes = Array.from(documentNode.querySelectorAll("item"));

  const mapped = itemNodes
    .map((itemNode, index) => {
      const title = stripHtml(itemNode.querySelector("title")?.textContent ?? "Untitled PDF");
      const rawLink = (itemNode.querySelector("link")?.textContent ?? "").trim();
      const description = stripHtml(itemNode.querySelector("description")?.textContent ?? "");

      if (!rawLink) {
        return null;
      }

      const url = toAbsoluteUrl(rawLink);
      const score = scoreCandidate(title, description, url);
      const isDirectPdf = isLikelyPdfUrl(url);

      if (score <= 0) {
        return null;
      }

      return {
        id: `${url}-${index}`,
        title,
        url,
        domain: toDomain(url),
        snippet: description,
        isDirectPdf,
        score
      } satisfies PdfSearchResult;
    })
    .filter((item): item is PdfSearchResult => item !== null);

  return rankAndLimit(mapped);
};

const parseGoogleItems = (items: GoogleCseItem[]): PdfSearchResult[] => {
  const mapped = items
    .map((item, index) => {
      const rawLink = (item.link ?? "").trim();
      if (!rawLink) {
        return null;
      }

      const url = toAbsoluteUrl(rawLink);
      const title = stripHtml(item.title ?? "Untitled PDF");
      const snippet = stripHtml(item.snippet ?? "");
      const domain = (item.displayLink ?? "").trim() || toDomain(url);
      const declaredPdf = (item.mime ?? "").toLowerCase().includes("pdf") || (item.fileFormat ?? "").toLowerCase().includes("pdf");
      const isDirectPdf = declaredPdf || isLikelyPdfUrl(url);
      const score = scoreCandidate(title, snippet, url, domain) + (declaredPdf ? 30 : 0);

      if (score <= 0) {
        return null;
      }

      return {
        id: `${url}-${index}`,
        title,
        url,
        domain,
        snippet,
        isDirectPdf,
        score
      } satisfies PdfSearchResult;
    })
    .filter((item): item is PdfSearchResult => item !== null);

  return rankAndLimit(mapped);
};

const buildBingRssUrl = (query: string): string => {
  const fullQuery = `${query} filetype:pdf`;
  return `https://www.bing.com/search?format=rss&q=${encodeURIComponent(fullQuery)}`;
};

const buildGoogleCseUrl = (query: string, apiKey: string, cx: string): string => {
  const fullQuery = `${query} filetype:pdf`;
  return `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(cx)}&num=10&q=${encodeURIComponent(fullQuery)}`;
};

export const buildGooglePdfSearchHref = (rawQuery: string): string => {
  const query = normalizeQuery(rawQuery);
  const fullQuery = query ? `${query} filetype:pdf` : "filetype:pdf";
  return `https://www.google.com/search?q=${encodeURIComponent(fullQuery)}`;
};

export const hasGoogleCseCredentials = (apiKey?: string, cx?: string): boolean => {
  return Boolean(apiKey?.trim() && cx?.trim());
};

const fetchWithTimeout = async (url: string, acceptHeader: string): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      method: "GET",
      headers: {
        Accept: acceptHeader
      },
      signal: controller.signal
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const fetchRssViaFallbackProxies = async (sourceUrl: string): Promise<string> => {
  const errors: string[] = [];

  for (const proxy of PROXY_BUILDERS) {
    const url = proxy.buildUrl(sourceUrl);

    try {
      const response = await fetchWithTimeout(url, "application/rss+xml, application/xml, text/xml, text/plain");
      if (!response.ok) {
        errors.push(`${proxy.name}:${response.status}`);
        continue;
      }

      const text = await response.text();
      if (!text || !text.toLowerCase().includes("<item")) {
        errors.push(`${proxy.name}:invalid-feed`);
        continue;
      }

      return text;
    } catch {
      errors.push(`${proxy.name}:network`);
    }
  }

  throw new Error(`proxy-failed:${errors.join(",")}`);
};

const searchViaGoogleCse = async (query: string, apiKey: string, cx: string): Promise<PdfSearchResult[]> => {
  const url = buildGoogleCseUrl(query, apiKey, cx);
  const response = await fetchWithTimeout(url, "application/json");

  if (!response.ok) {
    throw new Error(`google-cse:${response.status}`);
  }

  const payload = (await response.json()) as GoogleCseResponse;
  return parseGoogleItems(payload.items ?? []);
};

const searchViaBingRss = async (query: string): Promise<PdfSearchResult[]> => {
  const sourceUrl = buildBingRssUrl(query);
  const text = await fetchRssViaFallbackProxies(sourceUrl);
  return parseBingRss(text);
};

export const searchPdfDocuments = async (rawQuery: string, options: PdfSearchOptions = {}): Promise<PdfSearchResponse> => {
  const query = normalizeQuery(rawQuery);

  if (!query) {
    return { results: [], provider: "bing-rss" };
  }

  const preferGoogle = options.preferGoogle ?? true;
  const apiKey = options.googleApiKey?.trim() ?? "";
  const cx = options.googleCx?.trim() ?? "";

  if (preferGoogle && hasGoogleCseCredentials(apiKey, cx)) {
    try {
      const googleResults = await searchViaGoogleCse(query, apiKey, cx);
      if (googleResults.length > 0) {
        return {
          results: googleResults,
          provider: "google-cse"
        };
      }
    } catch {
      // Fall through to backup provider.
    }
  }

  const bingResults = await searchViaBingRss(query);
  return {
    results: bingResults,
    provider: "bing-rss"
  };
};

export const triggerPdfDownload = (url: string): void => {
  if (typeof window === "undefined") {
    return;
  }

  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.download = "";
  window.document.body.appendChild(anchor);
  anchor.click();
  window.document.body.removeChild(anchor);
};
