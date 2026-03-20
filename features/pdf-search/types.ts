export type PdfSearchResult = {
  id: string;
  title: string;
  url: string;
  domain: string;
  snippet: string;
  isDirectPdf: boolean;
  score: number;
};

export type PdfSearchResponse = {
  results: PdfSearchResult[];
  provider: "bing-rss";
};
