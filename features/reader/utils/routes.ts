export const toSeriesHref = (seriesId: string): string => `/reader/series?id=${encodeURIComponent(seriesId)}`;

export const toReadHref = (seriesId: string, chapterId: string): string =>
  `/reader/read?seriesId=${encodeURIComponent(seriesId)}&chapterId=${encodeURIComponent(chapterId)}`;
