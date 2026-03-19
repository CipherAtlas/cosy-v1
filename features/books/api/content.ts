import { fetchText } from "@/features/books/api/http";
import { BookReadSource, BookReaderContent } from "@/features/books/types";

const SECTION_LIMIT = 80;

const cleanWhitespace = (value: string): string =>
  value
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const trimProjectGutenbergBoilerplate = (value: string): string => {
  const startMatch = value.match(/\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG EBOOK[\s\S]*?\*\*\*/i);
  const endMatch = value.match(/\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG EBOOK[\s\S]*?\*\*\*/i);

  let text = value;
  if (startMatch && startMatch.index !== undefined) {
    text = text.slice(startMatch.index + startMatch[0].length);
  }

  if (endMatch && endMatch.index !== undefined) {
    text = text.slice(0, endMatch.index);
  }

  return text.trim();
};

const parseTextSections = (plainText: string): { plainText: string; sectionAnchors: { id: string; label: string }[] } => {
  const trimmed = trimProjectGutenbergBoilerplate(plainText);
  const lines = trimmed.split(/\r?\n/).map((line) => line.trim());
  const sectionAnchors: { id: string; label: string }[] = [];

  lines.forEach((line, index) => {
    if (sectionAnchors.length >= SECTION_LIMIT) {
      return;
    }

    const chapterLike = /^(chapter|book|part|section|act)\b/i.test(line) || /^([ivxlcdm]+)\.?$/i.test(line);
    if (!chapterLike) {
      return;
    }

    const label = cleanWhitespace(line);
    if (!label || label.length > 120) {
      return;
    }

    sectionAnchors.push({ id: `line-${index}`, label });
  });

  return {
    plainText: trimmed,
    sectionAnchors
  };
};

const sanitizeHtml = (rawHtml: string): { htmlContent: string; sectionAnchors: { id: string; label: string }[] } => {
  if (typeof window === "undefined") {
    return { htmlContent: "", sectionAnchors: [] };
  }

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(rawHtml, "text/html");
  const body = documentNode.body;
  const sectionAnchors: { id: string; label: string }[] = [];

  body.querySelectorAll("script, style, iframe, object, embed, form, nav, footer, noscript").forEach((element) => {
    element.remove();
  });

  let sectionIndex = 0;
  body.querySelectorAll("h1, h2, h3").forEach((heading) => {
    if (sectionIndex >= SECTION_LIMIT) {
      return;
    }

    const text = cleanWhitespace(heading.textContent ?? "");
    if (!text || text.length > 120) {
      return;
    }

    const id = `section-${sectionIndex}`;
    heading.setAttribute("id", id);
    sectionAnchors.push({ id, label: text });
    sectionIndex += 1;
  });

  body.querySelectorAll("*").forEach((element) => {
    const tag = element.tagName.toLowerCase();
    const allowed = new Set(["id", "href"]);
    [...element.attributes].forEach((attribute) => {
      if (!allowed.has(attribute.name.toLowerCase())) {
        element.removeAttribute(attribute.name);
      }
    });

    if (tag === "a") {
      const href = element.getAttribute("href");
      if (!href || href.startsWith("javascript:")) {
        element.removeAttribute("href");
      } else if (href.startsWith("http")) {
        element.setAttribute("target", "_blank");
        element.setAttribute("rel", "noreferrer");
      }
    }
  });

  return {
    htmlContent: body.innerHTML,
    sectionAnchors
  };
};

export const loadReaderContent = async (
  source: BookReadSource,
  fallbackTitle: string,
  fallbackAuthor: string
): Promise<BookReaderContent | null> => {
  const htmlUrl = source.htmlUrl;
  const textUrl = source.textUrl;

  if (htmlUrl) {
    try {
      const html = await fetchText(htmlUrl, { cacheTtlMs: 60_000 });
      const sanitized = sanitizeHtml(html);
      if (sanitized.htmlContent.trim().length > 0) {
        return {
          title: fallbackTitle,
          authorName: fallbackAuthor,
          source,
          htmlContent: sanitized.htmlContent,
          plainText: null,
          sectionAnchors: sanitized.sectionAnchors,
          mode: "html"
        };
      }
    } catch {
      // Try text fallback below.
    }
  }

  if (textUrl) {
    try {
      const plainText = await fetchText(textUrl, { cacheTtlMs: 60_000 });
      const parsed = parseTextSections(plainText);
      return {
        title: fallbackTitle,
        authorName: fallbackAuthor,
        source,
        htmlContent: null,
        plainText: parsed.plainText,
        sectionAnchors: parsed.sectionAnchors,
        mode: "text"
      };
    } catch {
      return null;
    }
  }

  return null;
};
