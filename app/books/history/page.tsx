import { BookFrame } from "@/features/books/components/BookFrame";
import { BookHistory } from "@/features/books/components/BookHistory";

export default function BookHistoryPage() {
  return (
    <BookFrame title="Book History" subtitle="Your recently opened books and reading progress.">
      <BookHistory />
    </BookFrame>
  );
}
