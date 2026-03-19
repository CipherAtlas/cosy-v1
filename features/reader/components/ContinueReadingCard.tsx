import Link from "next/link";
import { ReaderHistoryItem } from "@/features/reader/types";
import { toReadHref, toSeriesHref } from "@/features/reader/utils/routes";
import { READER_THEME, readerCardStyle, readerControlClassName } from "@/features/reader/components/readerTheme";

type ContinueReadingCardProps = {
  item: ReaderHistoryItem;
};

export const ContinueReadingCard = ({ item }: ContinueReadingCardProps) => {
  const continueHref = item.lastReadChapterId
    ? toReadHref(item.seriesId, item.lastReadChapterId)
    : toSeriesHref(item.seriesId);

  return (
    <article className="rounded-[1.6rem] border p-4 sm:p-5" style={readerCardStyle}>
      <p className="text-[12px] uppercase tracking-[0.13em]" style={{ color: READER_THEME.textSecondary }}>
        Continue Reading
      </p>

      <h2 className="mt-2 text-[22px] font-medium leading-tight" style={{ color: READER_THEME.textPrimary }}>
        {item.seriesTitle}
      </h2>

      <p className="mt-1 text-[14px]" style={{ color: READER_THEME.textSecondary }}>
        {item.lastReadChapterLabel ?? "Resume from series page"}
      </p>

      <div className="mt-4 flex flex-wrap gap-2.5">
        <Link
          href={continueHref}
          className={readerControlClassName}
          style={{
            borderColor: READER_THEME.border,
            background: `${READER_THEME.accentPeach}95`,
            color: READER_THEME.textPrimary
          }}
        >
          Continue
        </Link>
        <Link
          href={toSeriesHref(item.seriesId)}
          className={readerControlClassName}
          style={{
            borderColor: READER_THEME.border,
            background: READER_THEME.surface,
            color: READER_THEME.textPrimary
          }}
        >
          Open Series
        </Link>
      </div>
    </article>
  );
};
