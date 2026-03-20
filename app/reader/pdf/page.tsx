import { ReaderFrame } from "@/features/reader/components/ReaderFrame";
import { PdfSearch } from "@/features/pdf-search/components/PdfSearch";

export default function ReaderPdfPage() {
  return (
    <ReaderFrame title="PDF Search" subtitle="Find relevant PDF documents from the web and open or download them.">
      <PdfSearch />
    </ReaderFrame>
  );
}
