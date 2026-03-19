import { ReaderFrame } from "@/features/reader/components/ReaderFrame";
import { ReaderHome } from "@/features/reader/components/ReaderHome";

export default function ReaderLandingPage() {
  return (
    <ReaderFrame
      title="Manga Reader"
      subtitle="A calm, mobile-first vertical reader with local progress and continue reading support."
    >
      <ReaderHome />
    </ReaderFrame>
  );
}
