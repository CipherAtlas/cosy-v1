import { fetchText } from "@/features/books/api/http";
import { BookReadSource, BookReaderContent } from "@/features/books/types";

const SECTION_LIMIT = 80;
const MAX_HTML_INPUT_CHARS = 1_200_000;
const MAX_TEXT_INPUT_CHARS = 1_200_000;
const MAX_TEXT_OUTPUT_CHARS = 900_000;
const MAX_HTML_OUTPUT_CHARS = 700_000;
const MAX_PARAGRAPH_COUNT = 2_500;

const ALLOWED_HTML_TAGS = new Set([
  "a",
  "abbr",
  "b",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "li",
  "ol",
  "p",
  "pre",
  "section",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "u",
  "ul"
]);

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

const sanitizeHref = (rawHref: string | null): string | null => {
  if (!rawHref) {
    return null;
  }

  const trimmed = rawHref.trim();
  if (!trimmed) {
    return null;
  }

  // Remove control chars/whitespace that can obfuscate protocols.
  const compacted = trimmed.replace(/[\u0000-\u001F\u007F\s]+/g, "");

  if (compacted.startsWith("#")) {
    return compacted;
  }

  if (compacted.startsWith("/")) {
    return compacted;
  }

  try {
    const parsed = new URL(compacted, "https://example.com");
    const protocol = parsed.protocol.toLowerCase();
    if (protocol === "http:" || protocol === "https:" || protocol === "mailto:") {
      return compacted;
    }
  } catch {
    return null;
  }

  return null;
};

const parseTextSections = (plainText: string): { plainText: string; sectionAnchors: { id: string; label: string }[] } => {
  const trimmed = trimProjectGutenbergBoilerplate(plainText.slice(0, MAX_TEXT_INPUT_CHARS));
  const lines = trimmed.split(/\r?\n/).slice(0, MAX_PARAGRAPH_COUNT).map((line) => line.trim());
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

  const limitedText = lines.join("\n").slice(0, MAX_TEXT_OUTPUT_CHARS);
  return {
    plainText: limitedText,
    sectionAnchors
  };
};

const sanitizeHtml = (
  rawHtml: string
): { htmlContent: string; sectionAnchors: { id: string; label: string }[]; plainTextFallback: string | null } => {
  if (typeof window === "undefined") {
    return { htmlContent: "", sectionAnchors: [], plainTextFallback: null };
  }

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(rawHtml.slice(0, MAX_HTML_INPUT_CHARS), "text/html");
  const body = documentNode.body;
  const sectionAnchors: { id: string; label: string }[] = [];

  body.querySelectorAll("script, style, iframe, object, embed, form, nav, footer, noscript, svg, math, canvas, video, audio").forEach((element) => {
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
    if (!ALLOWED_HTML_TAGS.has(tag)) {
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }

    const allowed = tag === "a" ? new Set(["href"]) : new Set(["id"]);
    [...element.attributes].forEach((attribute) => {
      if (!allowed.has(attribute.name.toLowerCase())) {
        element.removeAttribute(attribute.name);
      }
    });

    if (tag === "a") {
      const safeHref = sanitizeHref(element.getAttribute("href"));
      if (!safeHref) {
        element.removeAttribute("href");
      } else {
        element.setAttribute("href", safeHref);
      }

      if (safeHref && (safeHref.startsWith("http://") || safeHref.startsWith("https://"))) {
        element.setAttribute("target", "_blank");
        element.setAttribute("rel", "noopener noreferrer nofollow");
      }
    }
  });

  const htmlContent = body.innerHTML;
  if (htmlContent.length > MAX_HTML_OUTPUT_CHARS) {
    const plainTextFallback = (body.textContent ?? "").replace(/\u00a0/g, " ").slice(0, MAX_TEXT_OUTPUT_CHARS);
    return {
      htmlContent: "",
      sectionAnchors,
      plainTextFallback: plainTextFallback || null
    };
  }

  return {
    htmlContent,
    sectionAnchors,
    plainTextFallback: null
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

      if (sanitized.plainTextFallback) {
        const parsed = parseTextSections(sanitized.plainTextFallback);
        return {
          title: fallbackTitle,
          authorName: fallbackAuthor,
          source,
          htmlContent: null,
          plainText: parsed.plainText,
          sectionAnchors: parsed.sectionAnchors,
          mode: "text"
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
