import { BookFrame } from "@/features/books/components/BookFrame";
import { BookHome } from "@/features/books/components/BookHome";

export default function BooksLandingPage() {
  return (
    <BookFrame
      title="Book Reader"
      subtitle="A calm Kindle-style space for public-domain books with local progress."
    >
      <BookHome />
    </BookFrame>
  );
}
