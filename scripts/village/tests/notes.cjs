const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const ts = require("typescript");

const sourcePath = path.resolve(__dirname, "../../../features/gratitude/storage.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

const data = new Map();
let failWrites = false;
global.window = { localStorage: {
  getItem: key => data.get(key) ?? null,
  setItem: (key, value) => {
    if (failWrites) throw new Error("Storage unavailable");
    data.set(key, value);
  }
} };

function loadRelease() {
  const instance = new Module(sourcePath);
  instance._compile(compiled, sourcePath);
  return instance.exports;
}

const key = "peaceful-room-gratitude-entries";
const oldEntries = Array.from({ length: 12 }, (_, index) => ({
  id: String(index), text: `Existing note ${index}`, createdAt: "2026-09-01T00:00:00.000Z"
}));
data.set(key, JSON.stringify(oldEntries));

let storage = loadRelease();
const saved = storage.saveGratitudeEntry("After update");
assert.equal(saved.length, 13, "saving never truncates older notes");
storage = loadRelease();
assert.deepEqual(storage.readGratitudeEntries(), saved, "a new release reads the same stored notes");

const backup = storage.exportGratitudeText();
storage.saveGratitudeEntry("Newer local note");
const restored = storage.importGratitudeText(backup);
assert.equal(restored.length, 14, "restoring a backup keeps newer local notes");
assert.equal(storage.importGratitudeText(backup).length, 14, "restoring twice does not duplicate notes");

const multiline = "First line\n  indented line\n[2026-09-02T00:00:00.000Z]\n";
storage.saveGratitudeEntry(multiline);
const textBackup = storage.exportGratitudeText();
assert.match(textBackup, /^Hearthwillow notes\n/);
assert.match(textBackup, /  First line\n    indented line/);
assert.doesNotMatch(textBackup, /"format":/);
data.set(key, JSON.stringify([]));
assert.equal(storage.importGratitudeText(textBackup).length, 15, "a text backup restores every note");
assert.equal(storage.readGratitudeEntries().find(entry => entry.text === multiline)?.text, multiline,
  "text restore preserves newlines and indentation");
assert.equal(storage.importGratitudeText(textBackup).length, 15, "restoring text twice does not duplicate notes");
data.set(key, JSON.stringify([]));
assert.equal(storage.importGratitudeText(storage.exportGratitudeText()).length, 0,
  "an empty text backup is valid");
storage.importGratitudeText(textBackup);
const twin = { text: "Same moment", createdAt: "2026-09-03T00:00:00.000Z" };
data.set(key, JSON.stringify([
  ...storage.readGratitudeEntries(),
  { ...twin, id: "twin-a" },
  { ...twin, id: "twin-b" }
]));
const twinsBackup = storage.exportGratitudeText();
data.set(key, JSON.stringify([]));
assert.equal(storage.importGratitudeText(twinsBackup).filter(entry => entry.text === twin.text).length, 2,
  "distinct identical notes are preserved");
assert.equal(storage.importGratitudeText(twinsBackup).filter(entry => entry.text === twin.text).length, 2,
  "reimporting identical notes is idempotent");

const beforeFailure = data.get(key);
assert.throws(() => storage.importGratitudeText('{"format":"hearthwillow-notes-v1","entries":[]}'));
assert.throws(() => storage.importGratitudeText("Hearthwillow notes\n==================\n\n[bad date]\n  note\n"));
assert.equal(data.get(key), beforeFailure, "invalid backups do not replace notes");
failWrites = true;
assert.throws(() => storage.saveGratitudeEntry("Unsaved"));
assert.equal(data.get(key), beforeFailure, "failed writes leave saved notes intact");
failWrites = false;
data.set(key, "{bad json");
assert.throws(() => storage.saveGratitudeEntry("Unsafe overwrite"));
assert.equal(data.get(key), "{bad json", "unreadable data is never overwritten with an empty list");

console.log("Notes persistence checks passed");
