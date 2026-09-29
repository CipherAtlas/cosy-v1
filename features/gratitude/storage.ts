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

export const exportGratitudeText = (): string => {
  const notes = readGratitudeEntries().map((entry) =>
    `[${entry.createdAt}]\n${entry.text.split(/\r\n|\r|\n/).map((line) => `  ${line}`).join("\n")}`
  );
  const heading = "Hearthwillow notes\n==================\n\n";
  return heading + (notes.length ? `${notes.join("\n\n")}\n` : "");
};

export const importGratitudeText = (raw: string): GratitudeEntry[] => {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  if (lines[0] !== "Hearthwillow notes" || lines[1] !== "==================" || lines[2] !== "") {
    throw new Error("Unrecognized notes backup");
  }
  const imported: Pick<GratitudeEntry, "text" | "createdAt">[] = [];
  for (let index = 3; index < lines.length;) {
    if (index === lines.length - 1 && lines[index] === "") break;
    const date = /^\[([^\]]+)\]$/.exec(lines[index]);
    if (!date || !Number.isFinite(Date.parse(date[1]))) throw new Error("Invalid note date");
    index += 1;
    const textLines: string[] = [];
    while (index < lines.length && lines[index].startsWith("  ")) {
      textLines.push(lines[index].slice(2));
      index += 1;
    }
    if (!textLines.length || !textLines.join("\n").trim() || lines[index] !== "") {
      throw new Error("Invalid note text");
    }
    imported.push({ createdAt: date[1], text: textLines.join("\n") });
    index += 1;
  }

  const existing = readGratitudeEntries();
  const merged = [...existing];
  const existingCounts = new Map<string, number>();
  for (const entry of existing) {
    const key = JSON.stringify([entry.createdAt, entry.text]);
    existingCounts.set(key, (existingCounts.get(key) ?? 0) + 1);
  }
  const importedCounts = new Map<string, number>();
  for (const entry of imported) {
    const key = JSON.stringify([entry.createdAt, entry.text]);
    const count = (importedCounts.get(key) ?? 0) + 1;
    importedCounts.set(key, count);
    if (count > (existingCounts.get(key) ?? 0)) merged.push({ ...entry, id: crypto.randomUUID() });
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
