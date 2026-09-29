"use client";

import { FormEvent, useEffect, useState } from "react";
import { FeatureFrame } from "@/components/ui/FeatureFrame";
import { GratitudeEntry, readGratitudeEntries, saveGratitudeEntry } from "@/features/gratitude/storage";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });

export default function GratitudePage() {
  const [value, setValue] = useState("");
  const [entries, setEntries] = useState<GratitudeEntry[]>([]);
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    try {
      setEntries(readGratitudeEntries());
    } catch {
      setStorageError(true);
    }
  }, []);

  const onSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const next = value.trim();
    if (!next) {
      return;
    }

    try {
      setEntries(saveGratitudeEntry(next));
      setValue("");
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  };

  return (
    <FeatureFrame
      title="Gratitude"
      subtitle="What is one small thing you are grateful for today?"
      atmosphereClassName="bg-[radial-gradient(circle_at_18%_25%,rgba(214,173,130,0.14),transparent_45%),radial-gradient(circle_at_80%_76%,rgba(149,173,142,0.14),transparent_45%)]"
    >
      <div className="space-y-6 px-1 sm:px-1.5">
        <form className="space-y-3" onSubmit={onSave}>
          <label className="sr-only" htmlFor="gratitude-note">
            Gratitude note
          </label>
          <textarea
            id="gratitude-note"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="block min-h-24 w-full appearance-none rounded-2xl border border-white/15 bg-black/20 p-4 text-sm text-room-text placeholder:text-room-muted/70"
            placeholder="A warm drink, a message, a quiet sunset..."
          />
          <button type="submit" className="control text-sm">
            Save locally
          </button>
        </form>
        {storageError && <p role="alert" className="text-sm text-room-text">Notes could not be read or saved in this browser. Any text you entered remains above; please copy it before leaving.</p>}

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-room-muted">Recent entries</p>
          {entries.length === 0 && !storageError ? (
            <p className="text-sm text-room-muted">Your notes stay here, on this device.</p>
          ) : entries.length > 0 ? (
            <ul className="space-y-2">
              {entries.map((entry) => (
                <li key={entry.id} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="text-sm text-room-text">{entry.text}</p>
                  <p className="mt-1 text-xs text-room-muted">{formatDate(entry.createdAt)}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </FeatureFrame>
  );
}
