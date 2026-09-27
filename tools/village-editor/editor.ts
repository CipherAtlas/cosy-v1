import * as T from "three";
import { landscapeHeight } from "../../features/village/environment";
import { StudioView } from "./view";
import { validateLayout, type Layout, type LayoutItem, type Asset } from "./model";

type DocumentState = { layout: Layout; fileId: string | null; revision: string };
const $ = <E extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as E;
const input = (id: string) => $<HTMLInputElement>(id);
const select = (id: string) => $<HTMLSelectElement>(id);
const button = (id: string) => $<HTMLButtonElement>(id);
const DRAFT_KEY = "cosy-layout-studio-draft-v1";
const categories = ["All", "Buildings", "Bridges", "Nature", "Villagers", "Furnishings", "Paths", "Landscape"];
let state: DocumentState;
let selection: string[] = [];
let category = "All", tab = "assets", activeTool = "select", placement: string | null = null;
let before: DocumentState | null = null;
let savedFingerprint = "";
let past: DocumentState[] = [], future: DocumentState[] = [];
let toastTimer = 0, preview = false, ready = false, saving = false;
let presets: { id: string; layout: Layout; description: string; image?: string }[] = [];
let libraryGeneration = 0;
const fingerprint = () => JSON.stringify(state.layout);
const clone = <T>(value: T): T => structuredClone(value);
const status = (text: string) => { $("status-message").textContent = text; };
function toast(message: string) { $("toast").textContent = message; $("toast").hidden = false; clearTimeout(toastTimer); toastTimer = window.setTimeout(() => { $("toast").hidden = true; }, 4500); status(message); }
function error(error: unknown) { toast(error instanceof Error ? error.message : String(error)); }
function dom<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = "") { const el = document.createElement(tag); el.className = className; el.textContent = text; return el; }
const view = new StudioView($("viewport"), {
  select: (id, additive) => {
    if (!ready) return;
    if (additive && id) selection = selection.includes(id) ? selection.filter(s => s !== id) : [...selection, id];
    else selection = id ? [id] : [];
    updateSelection();
  },
  begin: () => begin(),
  transform: changes => {
    for (const { id, transform } of changes) { const item = state.layout.objects.find(o => o.id === id); if (item) Object.assign(item, transform); }
    refreshFields();
  },
  commit: () => { try { validateLayout(state.layout, view.model.assets); finish(); } catch (issue) { if (before) { state = before; before = null; view.sync(state.layout); update(); } error(issue); } },
  place: (asset, position, yaw, repeat) => {
    transact(() => { const item = makeItem(asset, position); item.rotation[1] = yaw; state.layout.objects.push(item); selection = [item.id]; });
    if (!repeat) cancelPlacement(); else toast("Placed. Click again to add another, or Esc to finish.");
  },
  path: points => {
    const origin = points[0];
    transact(() => {
      const item = makeItem("custom-path", [origin[0], 0, origin[1]]);
      item.path = { width: 2.4, points: points.map(([x, z]) => [x - origin[0], z - origin[1]]) };
      state.layout.objects.push(item); selection = [item.id];
    }); toast("Path added. Adjust its width and control points in the inspector.");
  },
  status: toast,
  coordinates: p => { $("coordinates").textContent = `X ${p.x.toFixed(1)} · Z ${p.z.toFixed(1)}`; },
  stats: (draws, triangles) => { $("render-stats").textContent = `${draws.toLocaleString()} draws · ${(triangles / 1000).toFixed(0)}k triangles`; },
});

function begin() { before = clone(state); }
function finish() {
  if (before && JSON.stringify(before.layout) !== fingerprint()) { past.push(before); if (past.length > 80) past.shift(); future = []; }
  before = null; view.sync(state.layout); update(); draft();
}
function transact(change: () => void) {
  if (!ready) return;
  begin();
  try { change(); state.layout = validateLayout(state.layout, view.model.assets); finish(); }
  catch (issue) { if (before) state = before; before = null; view.sync(state.layout); update(); error(issue); }
}
function draft() {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ state, savedFingerprint })); }
  catch { toast("Browser draft storage is full or unavailable. Save layout or Export JSON to keep your work."); }
}
function undo() { if (!past.length) return; future.push(clone(state)); state = past.pop()!; view.sync(state.layout); update(); draft(); status("Undid the last change."); }
function redo() { if (!future.length) return; past.push(clone(state)); state = future.pop()!; view.sync(state.layout); update(); draft(); status("Redid the change."); }
function selectedItems(unlocked = false) { return state.layout.objects.filter(item => selection.includes(item.id) && (!unlocked || !item.locked)); }
function makeItem(assetId: string, position: [number, number, number]): LayoutItem {
  if (state.layout.objects.length >= 2000) throw Error("This layout has reached 2,000 objects. Remove a few objects before adding more.");
  const asset = view.model.assets.get(assetId)!;
  return { id: `object-${crypto.randomUUID()}`, asset: assetId, name: asset.name.replace(/ 1$/, ""), position, rotation: [0, 0, 0], scale: [1, 1, 1], visible: true, locked: false };
}
function duplicate() {
  const items = selectedItems(true); if (!items.length) return toast("Unlock an object before duplicating it.");
  transact(() => {
    if (state.layout.objects.length + items.length > 2000) throw Error("Duplicating would exceed the 2,000 object limit.");
    const copies = items.map(item => ({ ...clone(item), id: `object-${crypto.randomUUID()}`, name: `${item.name.replace(/ copy$/, "")} copy`.slice(0, 100), position: [item.position[0] + 2, item.position[1], item.position[2] + 2] as [number, number, number] }));
    state.layout.objects.push(...copies); selection = copies.map(o => o.id);
  }); toast(`Duplicated ${items.length === 1 ? items[0].name : `${items.length} objects`}.`);
}
function removeSelection() { const ids = new Set(selectedItems(true).map(o => o.id)); if (!ids.size) return; transact(() => { state.layout.objects = state.layout.objects.filter(o => !ids.has(o.id)); selection = []; }); status(`Removed ${ids.size} object${ids.size === 1 ? "" : "s"}. Undo is available.`); }
function setTool(tool: string) { cancelPlacement(); activeTool = tool; view.setTool(tool); for (const el of document.querySelectorAll<HTMLButtonElement>("[data-tool]")) el.setAttribute("aria-pressed", String(el.dataset.tool === tool)); }
function startPlacement(asset: Asset) {
  if (!ready) return;
  placement = asset.id; view.startPlacement(asset); $("placement").hidden = false; $("finish-path").hidden = true;
  $("placement-text").textContent = `Place ${asset.name.toLowerCase()} · [ / ] to turn`;
  renderAssets(); status("Click the ground to place. Hold Shift to keep adding. Escape cancels.");
}
function startPath() { if (!ready) return; placement = "path"; view.startPath(); $("placement").hidden = false; $("finish-path").hidden = false; $("placement-text").textContent = "Click points to trace a path"; status("Click two or more ground points, then Finish path or Enter."); }
function cancelPlacement() { placement = null; view.cancelPlacement(); $("placement").hidden = true; renderAssets(); }
function finishPath() { if (view.finishPath()) { placement = null; $("placement").hidden = true; updateSelection(); } }
function setPreview(value: boolean) { preview = value; cancelPlacement(); document.body.classList.toggle("preview-mode", value); $("leave-preview").hidden = !value; view.setPreview(value); }
function update() {
  if (!ready) return;
  input("layout-name").value = state.layout.name;
  $("save-state").textContent = fingerprint() === savedFingerprint ? "Saved on this Mac" : state.fileId ? "Unsaved changes · draft kept" : "Working copy · draft kept";
  button("undo").disabled = !past.length; button("redo").disabled = !future.length;
  $("object-count").textContent = String(state.layout.objects.length);
  updateSelection();
}
function updateSelection() {
  selection = selection.filter(id => state.layout.objects.some(o => o.id === id));
  view.setSelection(selection);
  const items = selectedItems(), single = items.length === 1 ? items[0] : null;
  $("selection-empty").hidden = !!items.length; $("selection-controls").hidden = !items.length;
  if (items.length) {
    const locked = items.some(item => item.locked);
    $("selection-title").textContent = single ? single.name : `${items.length} objects`;
    $("selection-category").textContent = single ? view.model.assets.get(single.asset)!.category : "Multiple selection";
    const size = view.getBounds().getSize(new T.Vector3());
    $("selection-meta").textContent = `${size.x.toFixed(1)} × ${size.z.toFixed(1)} m footprint${locked ? " · locked" : ""}`;
    input("object-name").value = single?.name ?? "Multiple objects"; input("object-name").disabled = !single || locked;
    input("object-visible").checked = items.every(o => o.visible); input("object-locked").checked = items.every(o => o.locked);
    input("object-locked").indeterminate = locked && !items.every(o => o.locked);
    for (const id of ["duplicate", "delete", "ground"]) button(id).disabled = !selectedItems(true).length;
    for (const el of document.querySelectorAll<HTMLInputElement>(".xyz input")) el.disabled = locked;
    for (const el of document.querySelectorAll<HTMLButtonElement>("[data-turn]")) el.disabled = locked;
    refreshFields(); renderPathSettings(single);
    const others = state.layout.objects.filter(o => !selection.includes(o.id) && o.visible && ["Buildings", "Bridges", "Furnishings"].includes(view.model.assets.get(o.asset)!.category) && !o.locked);
    const own = items.filter(o => o.visible && ["Buildings", "Bridges", "Furnishings"].includes(view.model.assets.get(o.asset)!.category));
    const overlaps = own.length && others.some(o => {
      const box = new T.Box3().setFromObject(view.model.roots.get(o.id)!); box.expandByScalar(-.08);
      return own.some(item => box.intersectsBox(new T.Box3().setFromObject(view.model.roots.get(item.id)!)));
    });
    $("overlap-warning").hidden = !overlaps; $("overlap-warning").textContent = "Some object bounds overlap. Check doorways, bridge ends and paths in Preview.";
  }
  renderScene();
}
function refreshFields() {
  const items = selectedItems(); if (!items.length) return;
  for (const property of ["position", "rotation", "scale"] as const) for (let axis = 0; axis < 3; axis++) {
    const field = input(`${property}-${axis}`);
    const common = items.every(item => Math.abs(item[property][axis] - items[0][property][axis]) < .001);
    field.value = common ? String(Number(items[0][property][axis].toFixed(3))) : "";
    field.placeholder = common ? "" : "—";
  }
}
function renderPathSettings(item: LayoutItem | null) {
  $("path-settings").hidden = !item?.path; if (!item?.path) return;
  input("path-width").value = String(item.path.width); input("path-width").disabled = item.locked;
  button("path-add-point").disabled = item.locked || item.path.points.length >= 100;
  $("path-points").replaceChildren();
  item.path.points.forEach((point, index) => {
    const row = dom("div", "point-row"); row.append(dom("span", "", String(index + 1)));
    for (let axis = 0; axis < 2; axis++) {
      const field = dom("input"); field.type = "number"; field.step = ".5"; field.value = String(point[axis]); field.disabled = item.locked;
      field.setAttribute("aria-label", `Path point ${index + 1} ${axis ? "Z" : "X"}`);
      field.onchange = () => { if (field.value === "" || !Number.isFinite(field.valueAsNumber)) return renderPathSettings(item); transact(() => { item.path!.points[index][axis] = field.valueAsNumber; }); }; row.append(field);
    }
    const remove = dom("button", "", "×"); remove.setAttribute("aria-label", `Remove path point ${index + 1}`); remove.disabled = item.locked || item.path!.points.length <= 2;
    remove.onclick = () => transact(() => { item.path!.points.splice(index, 1); }); row.append(remove); $("path-points").append(row);
  });
}
function renderAssets() {
  if (!view.model.assets.size) return;
  const query = input("search").value.toLowerCase();
  const fragment = document.createDocumentFragment();
  for (const asset of [...view.model.assets.values()].sort((a, b) => categories.indexOf(a.category) - categories.indexOf(b.category))) {
    if (!asset.shelf || (category !== "All" && asset.category !== category) || !asset.name.toLowerCase().includes(query)) continue;
    const card = dom("button", "asset-card"); card.dataset.asset = asset.id; card.setAttribute("aria-label", `Place ${asset.name}`); card.setAttribute("aria-pressed", String(placement === asset.id));
    const img = dom("img"); img.alt = ""; if (asset.thumbnail) img.src = asset.thumbnail;
    card.append(img, dom("span", "", asset.name)); card.onclick = () => startPlacement(asset); fragment.append(card);
  }
  if (!fragment.childNodes.length) fragment.append(dom("p", "scene-empty", "No matches. Try another name or category."));
  $("asset-grid").replaceChildren(fragment);
}
function renderScene() {
  if (!ready || tab !== "scene") return;
  const query = input("search").value.toLowerCase(), fragment = document.createDocumentFragment();
  for (const categoryName of categories.slice(1)) {
    if (category !== "All" && category !== categoryName) continue;
    const items = state.layout.objects.filter(o => view.model.assets.get(o.asset)!.category === categoryName && o.name.toLowerCase().includes(query));
    if (!items.length) continue;
    const heading = dom("div", "scene-group", categoryName); heading.append(dom("span", "", String(items.length))); fragment.append(heading);
    for (const item of items) {
      const row = dom("div", `scene-row${selection.includes(item.id) ? " selected" : ""}`);
      const choose = dom("button", "scene-select", item.name); choose.title = item.name; choose.setAttribute("aria-pressed", String(selection.includes(item.id)));
      choose.onclick = event => { selection = event.shiftKey ? selection.includes(item.id) ? selection.filter(id => id !== item.id) : [...selection, item.id] : [item.id]; updateSelection(); };
      const lock = dom("button", "scene-lock", item.locked ? "◇" : "·"); lock.setAttribute("aria-label", `${item.locked ? "Unlock" : "Lock"} ${item.name}`);
      lock.onclick = () => transact(() => { item.locked = !item.locked; });
      const visible = dom("button", "scene-lock", item.visible ? "◉" : "○"); visible.setAttribute("aria-label", `${item.visible ? "Hide" : "Show"} ${item.name}`); visible.onclick = () => transact(() => { item.visible = !item.visible; });
      row.append(choose, visible, lock); fragment.append(row);
    }
  }
  if (!fragment.childNodes.length) fragment.append(dom("p", "scene-empty", "No objects match your search."));
  $("scene-list").replaceChildren(fragment);
}
function setTab(value: string) {
  tab = value; $("assets-panel").hidden = value !== "assets"; $("scene-panel").hidden = value !== "scene";
  $("assets-tab").setAttribute("aria-selected", String(value === "assets")); $("scene-tab").setAttribute("aria-selected", String(value === "scene")); renderScene();
}
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const body = await response.json(); if (!response.ok) throw Error(body.error ?? "The local studio server could not complete this request."); return body;
}
async function save(asCopy = false) {
  if (!ready || saving) return;
  saving = true; button("save").disabled = true;
  const sourceDocument = state;
  const snapshot = clone(state), id = asCopy || !snapshot.fileId ? `layout-${crypto.randomUUID()}` : snapshot.fileId;
  try {
    const result = await request<{ revision: string }>(`/api/layouts/${id}`, { method: "POST", headers: { "Content-Type": "application/json", "If-Match": asCopy || !snapshot.fileId ? "new" : snapshot.revision }, body: JSON.stringify(snapshot.layout) });
    // A slow save must not relabel a different document opened while the request was in flight.
    if (state === sourceDocument) { state.fileId = id; state.revision = result.revision; savedFingerprint = JSON.stringify(snapshot.layout); update(); draft(); }
    toast(`Saved “${snapshot.layout.name}”${asCopy ? " as a new copy" : ""} on this Mac.`);
    if ($<HTMLDialogElement>("layout-dialog").open) await showLayouts(false);
  } catch (issue) { error(issue); }
  finally { saving = false; button("save").disabled = false; }
}
function exportJSON() {
  if (!ready) return;
  const blob = new Blob([JSON.stringify(state.layout, null, 2) + "\n"], { type: "application/json" });
  const a = dom("a"); a.href = URL.createObjectURL(blob); a.download = (state.layout.name.replace(/[^a-z0-9-_]/gi, "-").slice(0, 70) || "cosy-layout") + ".json";
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); toast("Layout JSON exported.");
}
function openLayout(layout: Layout, fileId: string | null, revision = "") {
  const validated = validateLayout(layout, view.model.assets);
  past.push(clone(state)); future = [];
  state = { layout: validated, fileId, revision }; if (!fileId) state.layout.name = `${layout.name} copy`.slice(0, 100);
  savedFingerprint = fileId ? JSON.stringify(validated) : ""; selection = []; cancelPlacement(); view.sync(state.layout); update(); draft(); view.home();
  $<HTMLDialogElement>("layout-dialog").close(); toast(fileId ? `Opened “${layout.name}”.` : `Editing a copy of “${layout.name}”. The default stays preserved.`);
}
async function showLayouts(open = true) {
  if (!ready) return;
  const generation = ++libraryGeneration, dialog = $<HTMLDialogElement>("layout-dialog"); if (open && !dialog.open) dialog.showModal();
  $("preset-list").replaceChildren();
  for (const preset of presets) {
    const card = dom("button", "preset-card");
    const img = dom("img"); img.alt = ""; if (preset.image) img.src = preset.image;
    card.append(img, dom("strong", "", preset.layout.name), dom("small", "", preset.description)); card.onclick = () => openLayout(preset.layout, null); $("preset-list").append(card);
  }
  $("saved-list").replaceChildren(dom("p", "scene-empty", "Reading local layouts…"));
  try {
    const library = await request<{ layouts: { id: string; name: string; objects?: number; error?: string }[] }>("/api/library");
    if (generation !== libraryGeneration) return;
    $("saved-list").replaceChildren();
    if (!library.layouts.length) $("saved-list").append(dom("p", "scene-empty", "Your saved layouts will appear here. Your current draft is kept automatically in this browser."));
    for (const file of library.layouts) {
      const row = dom("div", "saved-row"), label = dom("span", "", file.name); label.append(dom("small", "", file.error ?? `${file.objects} objects · ${file.id.slice(0, 15)}…`));
      const openButton = dom("button", "", "Open"); openButton.disabled = !!file.error;
      openButton.onclick = async () => { try { const result = await request<{ layout: Layout; revision: string }>(`/api/layouts/${file.id}`); openLayout(result.layout, file.id, result.revision); } catch (issue) { error(issue); } };
      row.append(label, openButton); $("saved-list").append(row);
    }
  } catch (issue) { $("saved-list").replaceChildren(dom("p", "scene-empty", "The server is unavailable. Your open layout can still be exported.")); error(issue); }
}
function createPresets(original: Layout) {
  const meadow = clone(original); meadow.name = "Open meadow";
  meadow.objects = meadow.objects.filter(item => ["Landscape"].includes(view.model.assets.get(item.asset)!.category) && !["ivy"].includes(item.asset));
  const riverside = clone(original); riverside.name = "Riverside retreat";
  const cottages = riverside.objects.filter(o => o.asset.startsWith("cottage-"));
  const placements = [[-33, 14, 90], [-33, 27, 45], [-22, 32, 0], [9, -27, 10]];
  const keep = new Set(cottages.slice(0, 4).map(o => o.id));
  riverside.objects = riverside.objects.filter(item => !item.asset.startsWith("cottage-") || keep.has(item.id));
  cottages.slice(0, 4).forEach((item, index) => { const [x, z, angle] = placements[index]; item.position = [x, Math.max(0, landscapeHeight(x, z)), z]; item.rotation = [0, angle, 0]; });
  // A quiet south-bank composition opens up the central road without changing the baseline.
  riverside.objects = riverside.objects.filter(item => !(item.asset.startsWith("tree-") && placements.some(([x,z]) => Math.hypot(item.position[0]-x,item.position[2]-z)<7)));
  return [
    { id: "current", layout: clone(original), description: "The latest garden, bird clearing and friends." },
    { id: "riverside", layout: riverside, description: "Four cottages gathered by the river." },
    { id: "meadow", layout: meadow, description: "The valley, ready for a fresh beginning." },
  ];
}

for (const name of categories) {
  const b = dom("button", "", name); b.setAttribute("aria-pressed", String(name === category));
  b.onclick = () => { category = name; for (const el of $("categories").children) el.setAttribute("aria-pressed", String(el === b)); renderAssets(); renderScene(); };
  $("categories").append(b);
}
for (const property of ["position", "rotation", "scale"] as const) for (let axis = 0; axis < 3; axis++) {
  const label = dom("label"); label.append(dom("span", "", ["X", "Y", "Z"][axis]));
  const field = dom("input"); field.id = `${property}-${axis}`; field.type = "number"; field.step = property === "scale" ? ".05" : property === "rotation" ? "5" : ".1";
  field.setAttribute("aria-label", `${property[0].toUpperCase() + property.slice(1)} ${["X", "Y", "Z"][axis]}`);
  field.onchange = () => {
    const value = field.valueAsNumber;
    if (!Number.isFinite(value)) return refreshFields();
    transact(() => {
      for (const item of selectedItems(true)) {
        if (property === "scale" && input("uniform").checked) { const ratio = value / item.scale[axis]; item.scale = item.scale.map(n => n * ratio) as [number, number, number]; }
        else item[property][axis] = value;
      }
    });
  }; label.append(field); $(`${property}-fields`).append(label);
}
input("layout-name").onchange = () => transact(() => { state.layout.name = input("layout-name").value.trim() || "Untitled village"; });
input("object-name").onchange = () => transact(() => { const item = selectedItems(true)[0]; if (item) item.name = input("object-name").value.trim() || view.model.assets.get(item.asset)!.name; });
input("object-visible").onchange = () => transact(() => { selectedItems().forEach(item => { item.visible = input("object-visible").checked; }); });
input("object-locked").onchange = () => transact(() => { selectedItems().forEach(item => { item.locked = input("object-locked").checked; }); });
input("path-width").onchange = () => transact(() => { const item = selectedItems(true)[0]; if (item?.path) item.path.width = input("path-width").valueAsNumber; });
button("path-add-point").onclick = () => transact(() => { const item = selectedItems(true)[0]; if (item?.path) { const last = item.path.points.at(-1)!; item.path.points.push([last[0] + 3, last[1]]); } });
button("ground").onclick = () => transact(() => { for (const item of selectedItems(true)) item.position[1] = Math.max(0, landscapeHeight(item.position[0], item.position[2])); });
for (const el of document.querySelectorAll<HTMLButtonElement>("[data-turn]")) el.onclick = () => transact(() => { selectedItems(true).forEach(item => { item.rotation[1] += Number(el.dataset.turn); }); });
for (const el of document.querySelectorAll<HTMLButtonElement>("[data-tool]")) el.onclick = () => setTool(el.dataset.tool!);
button("assets-tab").onclick = () => setTab("assets"); button("scene-tab").onclick = () => setTab("scene");
for (const id of ["assets-tab", "scene-tab"]) button(id).onkeydown = event => { if (["ArrowLeft", "ArrowRight"].includes(event.key)) { event.preventDefault(); setTab(tab === "assets" ? "scene" : "assets"); button(`${tab}-tab`).focus(); } };
input("search").oninput = () => { renderAssets(); renderScene(); };
button("undo").onclick = undo; button("redo").onclick = redo; button("duplicate").onclick = duplicate; button("delete").onclick = removeSelection;
button("focus-object").onclick = () => view.focus(); button("home-view").onclick = () => view.home();
button("start-house").onclick = () => { selection = [state.layout.objects.find(o => o.asset.startsWith("cottage-"))?.id ?? ""]; updateSelection(); view.focus(); setTool("rotate"); };
button("draw-path").onclick = startPath; button("finish-path").onclick = finishPath; button("cancel-placement").onclick = cancelPlacement;
button("view-top").onclick = () => { view.topDown(true); $("view-top").setAttribute("aria-pressed", "true"); $("view-perspective").setAttribute("aria-pressed", "false"); };
button("view-perspective").onclick = () => { view.topDown(false); $("view-top").setAttribute("aria-pressed", "false"); $("view-perspective").setAttribute("aria-pressed", "true"); };
button("grid").onclick = () => { const value = $("grid").getAttribute("aria-pressed") !== "true"; $("grid").setAttribute("aria-pressed", String(value)); view.toggleGrid(value); };
select("space").onchange = () => view.setSpace(select("space").value);
for (const id of ["snap", "angle-snap"]) select(id).onchange = () => view.setSnap(Number(select("snap").value), Number(select("angle-snap").value));
select("lighting").onchange = () => view.setLighting(select("lighting").value);
button("layouts").onclick = () => { void showLayouts(); }; button("more").onclick = () => { void showLayouts(); };
button("help").onclick = () => $<HTMLDialogElement>("help-dialog").showModal();
button("save").onclick = () => { void save(); }; button("save-copy").onclick = () => { void save(true); }; button("export").onclick = exportJSON;
button("import").onclick = () => input("import-file").click();
input("import-file").onchange = async () => {
  const file = input("import-file").files?.[0]; if (!file) return;
  try { if (file.size > 2_000_000) throw Error("Choose a layout smaller than 2 MB."); const doc = validateLayout(JSON.parse(await file.text()), view.model.assets); openLayout(doc, null); }
  catch (issue) { error(issue); } finally { input("import-file").value = ""; }
};
button("preview").onclick = () => setPreview(true); button("leave-preview").onclick = () => setPreview(false);
for (const close of document.querySelectorAll<HTMLButtonElement>(".close-dialog")) close.onclick = () => close.closest("dialog")!.close();
window.addEventListener("keydown", event => {
  if (!ready || document.querySelector("dialog[open]")) return;
  const editing = event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement;
  const mod = event.metaKey || event.ctrlKey;
  if (mod && event.key.toLowerCase() === "s") { event.preventDefault(); if (editing) (event.target as HTMLElement).blur(); void save(); return; }
  if (editing) return;
  if (event.key === "Escape") { if (preview) setPreview(false); else if (placement) cancelPlacement(); else { selection = []; updateSelection(); } return; }
  if (preview) return;
  if (mod) {
    if (event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
    if (event.key.toLowerCase() === "d") { event.preventDefault(); duplicate(); }
    if (event.key.toLowerCase() === "y") { event.preventDefault(); redo(); }
    return;
  }
  if (placement && ["[", "]"].includes(event.key)) { view.turnPlacement(event.key === "[" ? -15 : 15); return; }
  if (placement === "path" && event.key === "Enter") { event.preventDefault(); finishPath(); return; }
  const tool = ({ v: "select", w: "translate", e: "rotate", r: "scale" } as Record<string,string>)[event.key.toLowerCase()];
  if (tool) setTool(tool);
  if (event.key.toLowerCase() === "p") startPath();
  if (event.key.toLowerCase() === "f") view.focus();
  if (event.key === "Home") { event.preventDefault(); view.home(); }
  if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); removeSelection(); }
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) && selection.length) {
    event.preventDefault(); const step = (view.snap || .1) * (event.shiftKey ? 5 : 1);
    transact(() => { for (const item of selectedItems(true)) { item.position[0] += event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0; item.position[2] += event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0; } });
  }
});
window.addEventListener("beforeunload", event => { if (ready && fingerprint() !== savedFingerprint) { draft(); event.preventDefault(); event.returnValue = ""; } });
window.addEventListener("storage", event => { if (event.key === DRAFT_KEY && ready) status("Another studio tab updated the recovery draft. Save a named layout to keep this tab's version."); });
window.addEventListener("error", event => { if (ready) error(event.message); });
window.addEventListener("unhandledrejection", event => error(event.reason));

async function start() {
  try {
    await view.load(n => { $<HTMLProgressElement>("loading").querySelector("progress")!.value = n; $("loading-text").textContent = n < 70 ? "Preparing cottages, paths and trees…" : "Arranging your asset shelf…"; });
    let original = clone(view.model.original);
    const baselineResponse = await fetch("/api/presets/current-village");
    if (baselineResponse.ok) original = validateLayout((await baselineResponse.json()).layout, view.model.assets);
    else if (baselineResponse.status !== 404) throw Error("The preserved village could not be read. Its file has been left intact.");
    presets = createPresets(original);
    const archiveResponse = await fetch("/api/presets/original-village");
    if (archiveResponse.ok) presets.push({ id: "original", layout: validateLayout((await archiveResponse.json()).layout, view.model.assets), description: "The earlier village, kept for reference." });
    state = { layout: clone(original), fileId: null, revision: "" }; state.layout.name = "My village";
    let recovered = false;
    try { const raw = localStorage.getItem(DRAFT_KEY); if (raw) { const draft = JSON.parse(raw); state = { layout: validateLayout(draft.state.layout, view.model.assets), fileId: typeof draft.state.fileId === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(draft.state.fileId) ? draft.state.fileId : null, revision: typeof draft.state.revision === "string" ? draft.state.revision : "" }; savedFingerprint = typeof draft.savedFingerprint === "string" ? draft.savedFingerprint : ""; recovered = true; } }
    catch { toast("The previous browser draft could not be read. It remains in browser storage; a fresh working copy is open."); }
    ready = true; view.sync(state.layout); update(); $("loading").hidden = true;
    status(recovered ? "Recovered your working copy. The original village is preserved." : "Your working copy is ready. Choose an asset, or click something in the village.");
    renderAssets();
    // Preset thumbnails use the same scene and camera as the working copy.
    const current = clone(state.layout);
    for (const preset of presets) { view.sync(preset.layout); preset.image = view.capture(); }
    view.sync(current); view.setSelection(selection);
    void view.thumbnails(() => renderAssets());
    // A read-only development inspection surface supports reproducible studio QA.
    Object.assign(window, { cosyStudio: { snapshot: () => clone(state), original: () => clone(view.model.original), presets: () => presets.map(p => ({ id: p.id, layout: clone(p.layout) })), selection: () => [...selection], assets: () => [...view.model.assets.values()].map(a => ({ id: a.id, name: a.name, category: a.category })), capture: () => view.capture(), screenPoint: (id: string, offset?: [number, number, number]) => view.screenPoint(id, offset) } });
  } catch (issue) { $("loading-text").textContent = issue instanceof Error ? issue.message : String(issue); $("loading").querySelector("h2")!.textContent = "The studio couldn't open"; error(issue); }
}
void start();
