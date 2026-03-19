import { ReaderFrame } from "@/features/reader/components/ReaderFrame";
import { ReaderHistory } from "@/features/reader/components/ReaderHistory";

export default function ReaderHistoryPage() {
  return (
    <ReaderFrame title="History" subtitle="Continue where you left off across series and chapters.">
      <ReaderHistory />
    </ReaderFrame>
  );
}
