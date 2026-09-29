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

const backup = storage.exportGratitudeEntries();
storage.saveGratitudeEntry("Newer local note");
const restored = storage.importGratitudeEntries(backup);
assert.equal(restored.length, 14, "restoring a backup keeps newer local notes");
assert.equal(storage.importGratitudeEntries(backup).length, 14, "restoring twice does not duplicate notes");

const collision = JSON.stringify({ format: "hearthwillow-notes-v1", entries: [
  { id: saved[0].id, text: "Different note with a reused ID", createdAt: "2026-09-02T00:00:00.000Z" }
] });
assert.equal(storage.importGratitudeEntries(collision).length, 15, "an ID collision does not drop a different note");
assert.equal(storage.importGratitudeEntries(collision).length, 15, "restoring a colliding note twice is idempotent");

const beforeFailure = data.get(key);
assert.throws(() => storage.importGratitudeEntries('{"entries":[]}'));
assert.equal(data.get(key), beforeFailure, "invalid backups do not replace notes");
failWrites = true;
assert.throws(() => storage.saveGratitudeEntry("Unsaved"));
assert.equal(data.get(key), beforeFailure, "failed writes leave saved notes intact");
failWrites = false;
data.set(key, "{bad json");
assert.throws(() => storage.saveGratitudeEntry("Unsafe overwrite"));
assert.equal(data.get(key), "{bad json", "unreadable data is never overwritten with an empty list");

console.log("Notes persistence checks passed");
