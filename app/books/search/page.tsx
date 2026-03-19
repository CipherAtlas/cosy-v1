import { BookFrame } from "@/features/books/components/BookFrame";
import { BookSearch } from "@/features/books/components/BookSearch";

export default function BookSearchPage() {
  return (
    <BookFrame title="Search Books" subtitle="Search Open Library and auto-match readable English sources.">
      <BookSearch />
    </BookFrame>
  );
}
