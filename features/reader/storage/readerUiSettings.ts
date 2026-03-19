import { ReaderUiSettings } from "@/features/reader/types";

const SETTINGS_KEY = "peaceful-room.reader.ui-settings";

export const DEFAULT_READER_UI_SETTINGS: ReaderUiSettings = {
  pageWidth: "comfortable",
  pageGap: "normal",
  imageCorners: "soft",
  showProgressChip: true,
  autoHideChrome: false,
  tapToToggleChrome: true,
  showSettingsHints: true
};

const canUseStorage = (): boolean => typeof window !== "undefined";

export const readReaderUiSettings = (): ReaderUiSettings => {
  if (!canUseStorage()) {
    return DEFAULT_READER_UI_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return DEFAULT_READER_UI_SETTINGS;
    }

    const parsed = JSON.parse(raw) as Partial<ReaderUiSettings>;
    return {
      ...DEFAULT_READER_UI_SETTINGS,
      ...parsed
    };
  } catch {
    return DEFAULT_READER_UI_SETTINGS;
  }
};

export const saveReaderUiSettings = (settings: ReaderUiSettings): ReaderUiSettings => {
  if (!canUseStorage()) {
    return settings;
  }

  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage write failures (private mode, quota issues).
  }

  return settings;
};
