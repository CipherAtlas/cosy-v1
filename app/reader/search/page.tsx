import { ReaderFrame } from "@/features/reader/components/ReaderFrame";
import { MangaSearch } from "@/features/reader/components/MangaSearch";

export default function ReaderSearchPage() {
  return (
    <ReaderFrame title="Search" subtitle="Find a series and start reading in a smooth vertical view.">
      <MangaSearch />
    </ReaderFrame>
  );
}
