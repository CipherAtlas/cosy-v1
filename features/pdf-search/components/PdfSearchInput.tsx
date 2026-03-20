import { FormEvent } from "react";
import { READER_THEME, readerControlClassName } from "@/features/reader/components/readerTheme";

type PdfSearchInputProps = {
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  isLoading: boolean;
};

export const PdfSearchInput = ({ query, onQueryChange, onSearch, isLoading }: PdfSearchInputProps) => {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-[1.4rem] border p-3 sm:rounded-[1.6rem] sm:p-4" style={{ borderColor: READER_THEME.border, background: READER_THEME.surface }}>
      <label htmlFor="pdf-search-query" className="block text-[13px] font-medium" style={{ color: READER_THEME.textSecondary }}>
        Search PDFs
      </label>
      <input
        id="pdf-search-query"
        type="text"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Try: machine learning syllabus, climate adaptation report..."
        className="cozy-outline min-h-12 w-full rounded-2xl border px-4 py-3 text-[16px] font-medium outline-none"
        style={{ borderColor: READER_THEME.border, background: READER_THEME.surface, color: READER_THEME.textPrimary }}
        aria-label="Search for PDF documents"
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px]" style={{ color: READER_THEME.textSecondary }}>
          Uses <code>filetype:pdf</code> search bias and supports Google-first results when configured.
        </p>
        <button
          type="submit"
          className={`${readerControlClassName} w-full justify-center sm:w-auto`}
          style={{ borderColor: READER_THEME.border, background: `${READER_THEME.accentBlue}9A`, color: READER_THEME.textPrimary }}
          disabled={isLoading}
          aria-label={isLoading ? "Searching PDFs" : "Search PDFs"}
        >
          {isLoading ? "Searching..." : "Search"}
        </button>
      </div>
    </form>
  );
};
