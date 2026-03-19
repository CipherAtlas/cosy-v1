import { ReaderFrame } from "@/features/reader/components/ReaderFrame";
import { ReaderLibrary } from "@/features/reader/components/ReaderLibrary";

export default function ReaderLibraryPage() {
  return (
    <ReaderFrame
      title="Library"
      subtitle="User-import scaffold for CBZ, ZIP, PDF, and image files."
    >
      <ReaderLibrary />
    </ReaderFrame>
  );
}
