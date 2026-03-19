import { Suspense } from "react";
import { BookFrame } from "@/features/books/components/BookFrame";
import { BOOK_THEME, bookCardStyle, bookControlClassName } from "@/features/books/components/bookTheme";
import { BookReadPageClient } from "@/app/books/read/BookReadPageClient";

const LoadingFallback = () => (
  <BookFrame title="Read" subtitle="Opening book..." fullHeightContent>
    <div className="max-w-[520px] rounded-2xl border p-4 text-center" style={bookCardStyle}>
      <p className="text-[15px]">Opening reader...</p>
      <span
        className={`${bookControlClassName} mt-3 inline-flex`}
        style={{ borderColor: BOOK_THEME.border, background: `${BOOK_THEME.accentBlue}82`, color: BOOK_THEME.textPrimary }}
      >
        Loading
      </span>
    </div>
  </BookFrame>
);

export default function BookReadPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <BookReadPageClient />
    </Suspense>
  );
}
