import { BookReadSource, BookSearchItem } from "@/features/books/types";
import { fetchJson } from "@/features/books/api/http";

const GUTENDEX_BASE = "https://gutendex.com/books";
const MIN_MATCH_SCORE = 42;

type GutendexAuthor = {
  name?: string;
};

type GutendexBook = {
  id: number;
  title?: string;
  authors?: GutendexAuthor[];
  languages?: string[];
  formats?: Record<string, string>;
};

type GutendexResponse = {
  results?: GutendexBook[];
};

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[\u2019']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const simplifyTitle = (title: string): string => {
  const stripped = title.split(/[:\-–—(]/)[0]?.trim() ?? title.trim();
  return stripped || title.trim();
};

const tokens = (value: string): string[] => normalize(value).split(" ").filter((token) => token.length > 1);

const tokenOverlap = (a: string, b: string): number => {
  const tokensA = tokens(a);
  const tokensB = tokens(b);
  if (tokensA.length === 0 || tokensB.length === 0) {
    return 0;
  }

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let overlap = 0;
  setA.forEach((token) => {
    if (setB.has(token)) {
      overlap += 1;
    }
  });

  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? overlap / union : 0;
};

const pickFormatUrl = (formats: Record<string, string> | undefined, candidates: string[]): string | null => {
  if (!formats) {
    return null;
  }

  for (const key of candidates) {
    const value = formats[key];
    if (!value) {
      continue;
    }

    const looksDownloadArchive = value.toLowerCase().endsWith(".zip");
    if (!looksDownloadArchive) {
      return value;
    }
  }

  return null;
};

const buildReadSource = (book: GutendexBook): BookReadSource | null => {
  if (!book.id || !book.formats) {
    return null;
  }

  const htmlUrl = pickFormatUrl(book.formats, [
    "text/html; charset=utf-8",
    "text/html",
    "application/xhtml+xml",
    "application/xhtml+xml; charset=utf-8"
  ]);

  const textUrl = pickFormatUrl(book.formats, ["text/plain; charset=utf-8", "text/plain"]);
  const epubUrl = pickFormatUrl(book.formats, ["application/epub+zip"]);

  if (!htmlUrl && !textUrl && !epubUrl) {
    return null;
  }

  return {
    sourceType: "gutendex",
    sourceBookId: book.id,
    htmlUrl,
    textUrl,
    epubUrl,
    languages: book.languages ?? []
  };
};

const scoreCandidate = (target: { title: string; authorName: string; firstPublishYear?: number | null }, candidate: GutendexBook): number => {
  const candidateTitle = candidate.title ?? "";
  const candidateAuthor = candidate.authors?.map((author) => author.name ?? "").join(" ") ?? "";

  const normalizedTargetTitle = normalize(target.title);
  const normalizedCandidateTitle = normalize(candidateTitle);
  const normalizedTargetAuthor = normalize(target.authorName);
  const normalizedCandidateAuthor = normalize(candidateAuthor);

  let score = 0;

  if (normalizedTargetTitle === normalizedCandidateTitle) {
    score += 60;
  } else if (normalizedTargetTitle && normalizedCandidateTitle.includes(normalizedTargetTitle)) {
    score += 48;
  } else if (normalizedCandidateTitle && normalizedTargetTitle.includes(normalizedCandidateTitle)) {
    score += 42;
  } else {
    score += Math.round(tokenOverlap(target.title, candidateTitle) * 48);
  }

  if (normalizedTargetAuthor && normalizedCandidateAuthor) {
    if (normalizedTargetAuthor === normalizedCandidateAuthor) {
      score += 34;
    } else if (normalizedCandidateAuthor.includes(normalizedTargetAuthor) || normalizedTargetAuthor.includes(normalizedCandidateAuthor)) {
      score += 26;
    } else {
      score += Math.round(tokenOverlap(target.authorName, candidateAuthor) * 30);
    }
  }

  if ((candidate.languages ?? []).includes("en")) {
    score += 10;
  }

  if (target.firstPublishYear && Number.isFinite(target.firstPublishYear)) {
    // Gutendex does not always have a reliable publish year. Keep this bonus small and optional.
    score += 2;
  }

  return score;
};

const getBestMatch = (target: { title: string; authorName: string; firstPublishYear?: number | null }, candidates: GutendexBook[]) => {
  let best: { score: number; source: BookReadSource } | null = null;

  for (const candidate of candidates) {
    const source = buildReadSource(candidate);
    if (!source) {
      continue;
    }

    const score = scoreCandidate(target, candidate);
    if (!best || score > best.score) {
      best = { score, source };
    }
  }

  if (!best || best.score < MIN_MATCH_SCORE) {
    return null;
  }

  return best.source;
};

export const findGutendexSource = async (target: {
  title: string;
  authorName: string;
  firstPublishYear?: number | null;
}): Promise<BookReadSource | null> => {
  const title = target.title.trim();
  const authorName = target.authorName.trim();
  const simplifiedTitle = simplifyTitle(title);
  const queryCandidates = [...new Set([`${title} ${authorName}`.trim(), `${simplifiedTitle} ${authorName}`.trim(), title, simplifiedTitle].filter(Boolean))];

  if (queryCandidates.length === 0) {
    return null;
  }

  try {
    const byId = new Map<number, GutendexBook>();

    for (const query of queryCandidates) {
      const englishUrl = `${GUTENDEX_BASE}?search=${encodeURIComponent(query)}&languages=en`;
      const englishPayload = await fetchJson<GutendexResponse>(englishUrl, { cacheTtlMs: 45_000 });
      (englishPayload.results ?? []).forEach((candidate) => {
        if (candidate.id) {
          byId.set(candidate.id, candidate);
        }
      });

      if (byId.size >= 12) {
        break;
      }
    }

    if (byId.size === 0) {
      for (const query of queryCandidates) {
        const fallbackUrl = `${GUTENDEX_BASE}?search=${encodeURIComponent(query)}`;
        const fallbackPayload = await fetchJson<GutendexResponse>(fallbackUrl, { cacheTtlMs: 45_000 });
        (fallbackPayload.results ?? []).forEach((candidate) => {
          if (candidate.id) {
            byId.set(candidate.id, candidate);
          }
        });

        if (byId.size >= 12) {
          break;
        }
      }
    }

    return getBestMatch(target, Array.from(byId.values()));
  } catch {
    return null;
  }
};

export const resolveSearchMatches = async (
  items: BookSearchItem[],
  options: { concurrency?: number } = {}
): Promise<Record<string, BookReadSource | null>> => {
  const { concurrency = 3 } = options;
  const results: Record<string, BookReadSource | null> = {};
  const queue = items.filter((item) => item.matchStatus === "checking");
  let index = 0;

  const workers = Array.from({ length: Math.min(Math.max(1, concurrency), queue.length) }, async () => {
    while (index < queue.length) {
      const currentIndex = index;
      index += 1;
      const item = queue[currentIndex];
      const source = await findGutendexSource({
        title: item.title,
        authorName: item.authorName,
        firstPublishYear: item.firstPublishYear
      });
      results[item.openLibraryKey] = source;
    }
  });

  await Promise.all(workers);
  return results;
};
