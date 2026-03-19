import { Suspense } from "react";
import { BookFrame } from "@/features/books/components/BookFrame";
import { BookDetailPageClient } from "@/app/books/book/BookDetailPageClient";

export default function BookDetailPage() {
  return (
    <Suspense
      fallback={
        <BookFrame title="Book" subtitle="Loading book details...">
          <p className="text-[15px]">Preparing book view...</p>
        </BookFrame>
      }
    >
      <BookDetailPageClient />
    </Suspense>
  );
}
