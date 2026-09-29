export type GratitudeEntry = {
  id: string;
  text: string;
  createdAt: string;
};

const GRATITUDE_KEY = "peaceful-room-gratitude-entries";

const parseEntries = (entries: unknown): GratitudeEntry[] => {
  if (!Array.isArray(entries) || !entries.every((entry) =>
    entry !== null && typeof entry === "object" &&
    typeof entry.id === "string" &&
    typeof entry.text === "string" &&
    typeof entry.createdAt === "string"
  )) {
    throw new Error("Saved notes could not be read");
  }
  return entries as GratitudeEntry[];
};

export const readGratitudeEntries = (): GratitudeEntry[] => {
  const raw = window.localStorage.getItem(GRATITUDE_KEY);
  return raw === null ? [] : parseEntries(JSON.parse(raw));
};

export const exportGratitudeEntries = (): string =>
  JSON.stringify({ format: "hearthwillow-notes-v1", entries: readGratitudeEntries() }, null, 2);

export const importGratitudeEntries = (raw: string): GratitudeEntry[] => {
  const backup: unknown = JSON.parse(raw);
  if (backup === null || typeof backup !== "object" ||
    !("format" in backup) || backup.format !== "hearthwillow-notes-v1" ||
    !("entries" in backup)) {
    throw new Error("Unrecognized notes backup");
  }
  const imported = parseEntries(backup.entries);
  const existing = readGratitudeEntries();
  const merged = [...existing];
  const identities = new Set(existing.map((entry) => JSON.stringify([entry.id, entry.text, entry.createdAt])));
  const ids = new Set(existing.map((entry) => entry.id));
  for (const entry of imported) {
    const identity = JSON.stringify([entry.id, entry.text, entry.createdAt]);
    if (identities.has(identity)) continue;
    if (ids.has(entry.id) && merged.some((saved) =>
      saved.text === entry.text && saved.createdAt === entry.createdAt
    )) continue;
    const restored = ids.has(entry.id) ? { ...entry, id: crypto.randomUUID() } : entry;
    merged.push(restored);
    identities.add(identity);
    ids.add(restored.id);
  }
  window.localStorage.setItem(GRATITUDE_KEY, JSON.stringify(merged));
  return merged;
};

export const saveGratitudeEntry = (text: string): GratitudeEntry[] => {
  const previous = readGratitudeEntries();

  const next: GratitudeEntry = {
    id: crypto.randomUUID(),
    text,
    createdAt: new Date().toISOString()
  };

  const updated = [next, ...previous];
  window.localStorage.setItem(GRATITUDE_KEY, JSON.stringify(updated));

  return updated;
};

export const deleteGratitudeEntry = (id: string): GratitudeEntry[] => {
  const previous = readGratitudeEntries();
  const updated = previous.filter((entry) => entry.id !== id);
  window.localStorage.setItem(GRATITUDE_KEY, JSON.stringify(updated));
  return updated;
};
