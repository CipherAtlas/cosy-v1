"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { getReaderLibraryImports, saveReaderLibraryImports } from "@/features/reader/storage/readerStorage";
import { ReaderLibraryImport } from "@/features/reader/types";
import { READER_THEME, readerCardStyle } from "@/features/reader/components/readerTheme";

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const ReaderLibrary = () => {
  const [imports, setImports] = useState<ReaderLibraryImport[]>([]);

  useEffect(() => {
    setImports(getReaderLibraryImports());
  }, []);

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    setImports(saveReaderLibraryImports(files));
    event.target.value = "";
  };

  return (
    <div className="space-y-5">
      <article className="rounded-[1.6rem] border p-4 sm:p-5" style={readerCardStyle}>
        <h2 className="text-[21px] font-medium">Import your files</h2>
        <p className="mt-2 text-[14px]" style={{ color: READER_THEME.textSecondary }}>
          Optional Phase 2 scaffold: import CBZ, ZIP, PDF, or image files from your device. This MVP stores metadata only
          so we can extend parsing support safely in a later pass.
        </p>

        <label className="mt-4 inline-flex cursor-pointer rounded-2xl border px-4 py-2 text-[14px] font-medium" style={{ borderColor: READER_THEME.border, background: `${READER_THEME.accentButter}66`, color: READER_THEME.textPrimary }}>
          Choose files
          <input
            type="file"
            className="sr-only"
            accept=".cbz,.zip,.pdf,image/*"
            multiple
            onChange={handleImport}
          />
        </label>
      </article>

      <section className="space-y-2">
        <h3 className="text-[16px] font-medium">Imported items</h3>
        {imports.length === 0 ? (
          <p className="rounded-xl border px-3 py-3 text-[14px]" style={{ ...readerCardStyle, color: READER_THEME.textSecondary }}>
            No imported files yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {imports.map((item) => (
              <li key={item.id} className="rounded-xl border px-3 py-3" style={readerCardStyle}>
                <p className="text-[15px] font-medium">{item.name}</p>
                <p className="mt-1 text-[12px]" style={{ color: READER_THEME.textSecondary }}>
                  {formatBytes(item.size)} · {item.type || "file"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
