import { ArrangementBarContext, ArrangementSegment, TrackSection } from "@/features/music/types";

type BaseSegment = {
  section: TrackSection;
  bars: number;
};

const ARRANGEMENT_TEMPLATES: BaseSegment[][] = [
  [
    { section: "intro", bars: 2 },
    { section: "main", bars: 4 },
    { section: "variation", bars: 4 },
    { section: "break", bars: 2 },
    { section: "main", bars: 4 },
    { section: "variation", bars: 4 }
  ],
  [
    { section: "intro", bars: 2 },
    { section: "main", bars: 6 },
    { section: "break", bars: 2 },
    { section: "variation", bars: 4 },
    { section: "main", bars: 4 }
  ]
];

const getWrappedBar = (arrangement: ArrangementSegment[], bar: number): number => {
  const totalBars = arrangement.reduce((sum, segment) => sum + segment.bars, 0);
  return totalBars > 0 ? bar % totalBars : 0;
};

export const createArrangement = (): ArrangementSegment[] => {
  const selected = ARRANGEMENT_TEMPLATES[Math.floor(Math.random() * ARRANGEMENT_TEMPLATES.length)];
  const arranged: ArrangementSegment[] = [];

  selected.forEach((segment, index) => {
    arranged.push({ ...segment, kind: "section" });

    const next = selected[index + 1];
    if (!next || next.section === segment.section) {
      return;
    }

    arranged.push({
      section: segment.section,
      bars: 1,
      kind: "transition",
      transitionTo: next.section
    });
  });

  return arranged;
};

export const getArrangementBarContext = (arrangement: ArrangementSegment[], bar: number): ArrangementBarContext => {
  const wrappedBar = getWrappedBar(arrangement, bar);

  let cursor = 0;

  for (const segment of arrangement) {
    if (wrappedBar >= cursor && wrappedBar < cursor + segment.bars) {
      const barInSegment = wrappedBar - cursor;
      const segmentKind = segment.kind ?? "section";

      return {
        section: segment.section,
        segmentKind,
        transitionTo: segment.transitionTo,
        isTransitionBar: segmentKind === "transition",
        isSectionIntro: segmentKind === "section" && barInSegment === 0,
        isSectionOutro: segmentKind === "section" && barInSegment === segment.bars - 1,
        barInSegment,
        segmentLength: segment.bars
      };
    }

    cursor += segment.bars;
  }

  return {
    section: "main",
    segmentKind: "section",
    isTransitionBar: false,
    isSectionIntro: false,
    isSectionOutro: false,
    barInSegment: 0,
    segmentLength: 1
  };
};

export const getSectionAtBar = (arrangement: ArrangementSegment[], bar: number): TrackSection => {
  return getArrangementBarContext(arrangement, bar).section;
};
