import { readLocalStorage, writeLocalStorage } from "@/lib/storage";

export type GratitudeEntry = {
  id: string;
  text: string;
  createdAt: string;
};

const GRATITUDE_KEY = "peaceful-room-gratitude-entries";

export const readGratitudeEntries = (): GratitudeEntry[] =>
  readLocalStorage<GratitudeEntry[]>(GRATITUDE_KEY, []);

export const saveGratitudeEntry = (text: string): GratitudeEntry[] => {
  const previous = readGratitudeEntries();

  const next: GratitudeEntry = {
    id: `${Date.now()}`,
    text,
    createdAt: new Date().toISOString()
  };

  const updated = [next, ...previous].slice(0, 8);
  writeLocalStorage(GRATITUDE_KEY, updated);

  return updated;
};

export const deleteGratitudeEntry = (id: string): GratitudeEntry[] => {
  const previous = readGratitudeEntries();
  const updated = previous.filter((entry) => entry.id !== id);
  writeLocalStorage(GRATITUDE_KEY, updated);
  return updated;
};
