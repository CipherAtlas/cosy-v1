import { MouseEvent } from "react";
import type { PdfSearchResult } from "@/features/pdf-search/types";
import { triggerPdfDownload } from "@/features/pdf-search/pdfSearchService";
import { READER_THEME, readerControlClassName } from "@/features/reader/components/readerTheme";

type PdfSearchResultCardProps = {
  result: PdfSearchResult;
};

export const PdfSearchResultCard = ({ result }: PdfSearchResultCardProps) => {
  const handleDownload = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    triggerPdfDownload(result.url);
  };

  return (
    <article className="rounded-[1.3rem] border p-3 sm:p-4" style={{ borderColor: READER_THEME.border, background: READER_THEME.surface }}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span
          className="rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em]"
          style={{ borderColor: READER_THEME.border, color: READER_THEME.textSecondary, background: `${READER_THEME.accentBlue}6D` }}
        >
          PDF
        </span>
        {result.isDirectPdf ? (
          <span
            className="rounded-full border px-2 py-0.5 text-[11px] font-medium"
            style={{ borderColor: READER_THEME.border, color: READER_THEME.textSecondary, background: `${READER_THEME.accentMint}72` }}
          >
            Direct file
          </span>
        ) : null}
      </div>

      <h3 className="mt-2 break-words text-[18px] font-medium leading-tight" style={{ color: READER_THEME.textPrimary }}>
        {result.title}
      </h3>

      <p className="mt-1 break-all text-[13px]" style={{ color: READER_THEME.textSecondary }}>
        {result.domain}
      </p>

      {result.snippet ? (
        <p className="mt-2 break-words text-[14px] leading-relaxed" style={{ color: READER_THEME.textSecondary }}>
          {result.snippet}
        </p>
      ) : null}

      <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`${readerControlClassName} w-full justify-center sm:w-auto`}
          style={{ borderColor: READER_THEME.border, background: `${READER_THEME.accentLavender}8F`, color: READER_THEME.textPrimary }}
          aria-label={`View PDF: ${result.title}`}
        >
          View
        </a>

        <button
          type="button"
          onClick={handleDownload}
          className={`${readerControlClassName} w-full justify-center sm:w-auto`}
          style={{ borderColor: READER_THEME.border, background: `${READER_THEME.accentPeach}95`, color: READER_THEME.textPrimary }}
          aria-label={`Download PDF: ${result.title}`}
        >
          Download
        </button>
      </div>
    </article>
  );
};
