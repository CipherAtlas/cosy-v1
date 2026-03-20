export type PdfSearchProvider = "google-cse" | "bing-rss";

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
  provider: PdfSearchProvider;
};

export type PdfSearchOptions = {
  preferGoogle?: boolean;
  googleApiKey?: string;
  googleCx?: string;
};
