import * as T from "three";
import { landscapeHeight } from "../../features/village/environment";
import { StudioView } from "./view";
import { validateLayout, pathCurve, type Layout, type LayoutItem, type Asset } from "./model";
import { projectWorldLayout, RESIDENT_IDS, type ResidentId, type ResidentRoute } from "../../features/village/worldLayout";
import { setAuthoredWorld } from "../../features/village/environment";
import { VillageNavigation } from "../../features/village/navigation";
import { VillageMovement } from "../../features/village/movement";

type DocumentState = { layout: Layout; fileId: string | null; revision: string };
const $ = <E extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as E;
const input = (id: string) => $<HTMLInputElement>(id);
const select = (id: string) => $<HTMLSelectElement>(id);
const button = (id: string) => $<HTMLButtonElement>(id);
const DRAFT_KEY = "cosy-layout-studio-draft-v1";
const CLIPBOARD_KEY = "cosy-layout-studio-clipboard-v1";
let clipboard: LayoutItem[] = [];
let pasteCount = 0;
let contextPoint: [number, number, number] | null = null;
let extendingPath: string | null = null;
const categories = ["All", "Buildings", "Bridges", "Nature", "Animals", "Villagers", "Puppies", "Furnishings", "Paths", "Landscape"];
let state: DocumentState;
let selection: string[] = [];
let category = "All", tab = "assets", placement: string | null = null;
let before: DocumentState | null = null;
let savedFingerprint = "";
let past: DocumentState[] = [], future: DocumentState[] = [];
let toastTimer = 0, preview = false, ready = false, saving = false;
let routeEditing = false, publishedRevision = "";
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
  selectArea: ids => {
    if (!ready) return;
    selection = [...new Set([...selection, ...ids])]; updateSelection();
    status(`${selection.length} objects selected. Cut, copy or move them together. Locked and hidden objects are skipped.`);
  },
  begin: () => begin(),
  transform: changes => {
    for (const { id, transform } of changes) { const item = state.layout.objects.find(o => o.id === id); if (item) Object.assign(item, transform); }
    refreshFields();
  },
  commit: () => { try { validateLayout(state.layout, view.model.assets); finish(); } catch (issue) { if (before) { state = before; before = null; view.sync(state.layout); update(); } error(issue); } },
  place: (asset, position, yaw) => {
    const placed = transact(() => { const item = makeItem(asset, position); item.rotation[1] = yaw; if (!view.model.assets.get(asset)?.surface) view.collision.ground(item, true); state.layout.objects.push(item); selection = [item.id]; });
    if (!placed) return;
    toast("Placed. Click again to add another, or Esc to finish.");
  },
  path: points => {
    const existing = state.layout.objects.find(item => item.id === extendingPath);
    const fence = placement === "fence";
    const added = transact(() => {
      if (existing?.path) {
        const root = view.model.roots.get(existing.id)!;
        existing.path.points = points.map(([x, z]) => {
          const local = root.worldToLocal(new T.Vector3(x, root.position.y, z)); return [local.x, local.z];
        }); selection = [existing.id];
      } else {
        const origin = points[0], item = makeItem(fence ? "fence-line" : "custom-path", [origin[0], view.collision.height(...origin), origin[1]]);
        item.path = { width: fence ? 1.4 : 2.4, points: points.map(([x, z]) => [x - origin[0], z - origin[1]]) };
        state.layout.objects.push(item); selection = [item.id];
      }
    });
    extendingPath = null; placement = null; $("placement").hidden = true;
    if (added) { updateSelection(); toast(fence ? "Fence added. Drag its points or height handle to shape it." : existing ? "Path extended. Its width and shape are still editable." : "Path added. Drag its points or width handle to shape it."); }
  },
  editPath: (id, kind, index, point) => {
    const item = state.layout.objects.find(o => o.id === id);
    if (!item?.path || item.locked) return;
    const root = view.model.roots.get(id)!;
    if (kind === "point") {
      const local = root.worldToLocal(new T.Vector3(point[0], root.position.y, point[1]));
      item.path.points[index] = [Number(local.x.toFixed(3)), Number(local.z.toFixed(3))];
    } else {
      const a = item.path.points[0], b = item.path.points[1];
      const tangent = new T.Vector2(b[0] - a[0], b[1] - a[1]).normalize();
      const local = root.worldToLocal(new T.Vector3(point[0], root.position.y, point[1]));
      const distance = (local.x - (a[0] + b[0]) / 2) * tangent.y - (local.z - (a[1] + b[1]) / 2) * tangent.x;
      item.path.width = Number(Math.min(item.asset === "fence-line" ? 3 : 20, Math.max(.3, Math.abs(distance) * 2)).toFixed(2));
    }
    view.refreshPath(); renderPathSettings(item);
  },
  paintGrass: (asset, point) => {
    if (state.layout.objects.length >= 2000) return;
    const item = makeItem(asset, point);
    item.position[1] = view.collision.height(point[0], point[2]);
    state.layout.objects.push(item); view.refreshBrush();
  },
  erasePlanting: (points, radius) => {
    if (state.layout.objects.length >= 2000) { status("This layout has reached 2,000 objects. Undo or remove an object before erasing more planting."); return; }
    for (const point of points) {
      if (state.layout.objects.length >= 2000) break;
      const item = makeItem("planting-clearance", point);
      item.scale = [radius, 1, radius]; state.layout.objects.push(item);
    }
    view.refreshBrush();
  },
  routePoint: point => {
    const id = select("route-resident").value as ResidentId;
    transact(() => {
      const route = ensureRoute(id);
      if (route.points.length >= 100) throw Error("A resident route can have up to 100 waypoints.");
      route.points.push(point); route.pauses?.push(0);
    });
  },
  contextMenu: (id, point, x, y) => showContextMenu(id, point, x, y),
  status: toast,
  coordinates: p => { $("coordinates").textContent = `X ${p.x.toFixed(1)} · Z ${p.z.toFixed(1)}`; },
  stats: (draws, triangles) => { $("render-stats").textContent = `${draws.toLocaleString()} draws · ${(triangles / 1000).toFixed(0)}k triangles`; },
});

function begin() { before = clone(state); }
function finish() {
  if (before && view.avoidOverlaps) view.collision.validateEdits(state.layout, before.layout);
  state.layout = validateLayout(state.layout, view.model.assets);
  if (before && JSON.stringify(before.layout) !== fingerprint()) { past.push(before); if (past.length > 80) past.shift(); future = []; }
  before = null; view.sync(state.layout); update(); draft();
}
function transact(change: () => void) {
  if (!ready) return false;
  begin();
  try { change(); state.layout = validateLayout(state.layout, view.model.assets); finish(); return true; }
  catch (issue) { if (before) state = before; before = null; view.sync(state.layout); update(); error(issue); return false; }
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
  return { id: `object-${crypto.randomUUID()}`, asset: assetId, name: asset.name.replace(/ 1$/, ""), position, rotation: [0, 0, 0], scale: [1, 1, 1], visible: true, locked: false, ...(asset.path ? { path: clone(asset.path) } : {}) };
}
function duplicate() {
  const items = selectedItems(true); if (!items.length) return toast("Unlock an object before duplicating it.");
  const added = transact(() => {
    if (state.layout.objects.length + items.length > 2000) throw Error("Duplicating would exceed the 2,000 object limit.");
    const size = view.getBounds().getSize(new T.Vector3()), offset = Math.max(size.x, size.z) + 2;
    const copies = items.map(item => ({ ...clone(item), id: `object-${crypto.randomUUID()}`, name: `${item.name.replace(/ copy$/, "")} copy`.slice(0, 100), position: [item.position[0] + offset, item.position[1], item.position[2] + offset] as [number, number, number] }));
    state.layout.objects.push(...copies); selection = copies.map(o => o.id);
  }); if (added) toast(`Duplicated ${items.length === 1 ? items[0].name : `${items.length} objects`}.`);
}
function removeSelection() { const ids = new Set(selectedItems(true).map(o => o.id)); if (!ids.size) return; transact(() => { state.layout.objects = state.layout.objects.filter(o => !ids.has(o.id)); selection = []; }); status(`Removed ${ids.size} object${ids.size === 1 ? "" : "s"}. Undo is available.`); }
function copySelection(cut = false) {
  const items = selectedItems(cut); if (!items.length) return toast("Select objects first. Unlock them before cutting.");
  // Persist before a cut, so reloading cannot lose the removed group.
  try { localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(items)); }
  catch { toast("The studio clipboard could not be saved. Your objects have been left in place."); return; }
  clipboard = clone(items); pasteCount = 0;
  if (cut) removeSelection();
  updateSelection(); toast(`${cut ? "Cut" : "Copied"} ${items.length} object${items.length === 1 ? "" : "s"}. Paste at the view centre or right-click a place on the map.`);
}
function readClipboard() {
  const raw = localStorage.getItem(CLIPBOARD_KEY);
  if (raw) clipboard = validateLayout({ version: 1, base: "cosy-village-2026-09-27", name: "Clipboard", objects: JSON.parse(raw) }, view.model.assets).objects;
}
function pasteSelection(at?: [number, number, number]) {
  try { readClipboard(); } catch (issue) { error(issue); return; }
  if (!clipboard.length) return toast("Copy some objects in the studio first.");
  if (state.layout.objects.length + clipboard.length > 2000) return toast("Pasting would exceed the 2,000 object limit.");
  const center = new T.Vector3(); clipboard.forEach(item => center.add(new T.Vector3(...item.position))); center.divideScalar(clipboard.length);
  const point = at ?? view.pastePoint(), offset = pasteCount * 2;
  const dy = Math.max(0, landscapeHeight(point[0] + offset, point[2] + offset)) - Math.max(0, landscapeHeight(center.x, center.z));
  const added = transact(() => {
    const items = clipboard.map(item => ({ ...clone(item), id: `object-${crypto.randomUUID()}`, locked: false,
      position: [item.position[0] + point[0] + offset - center.x, item.position[1] + dy, item.position[2] + point[2] + offset - center.z] as [number, number, number] }));
    state.layout.objects.push(...items); selection = items.map(item => item.id);
  });
  if (!added) return;
  pasteCount++; setTool("translate"); toast(`Pasted ${clipboard.length} objects. Drag the handles to move the group; Undo is available.`);
}
function hideContextMenu() { $("context-menu").hidden = true; }
function showContextMenu(id: string | null, point: [number, number, number] | null, x: number, y: number) {
  if (!ready || preview) return;
  if (placement) cancelPlacement();
  contextPoint = point;
  selection = id ? [id] : [];
  updateSelection();
  const menu = $("context-menu");
  for (const action of menu.querySelectorAll<HTMLButtonElement>("[data-context]")) {
    action.disabled = action.dataset.context === "paste" ? !clipboard.length : action.dataset.context === "undo" ? !past.length : action.dataset.context === "redo" ? !future.length : action.dataset.context === "focus" || action.dataset.context === "copy" ? !selectedItems().length : !selectedItems(true).length;
  }
  menu.hidden = false;
  const bounds = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(x, innerWidth - bounds.width - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, innerHeight - bounds.height - 8))}px`;
  menu.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
}
function setTool(tool: string) { cancelPlacement(); routeEditing = false; view.setTool(tool); renderRoute(); for (const el of document.querySelectorAll<HTMLButtonElement>("[data-tool]")) el.setAttribute("aria-pressed", String(el.dataset.tool === tool)); }
function startPlacement(asset: Asset) {
  if (!ready) return;
  if (asset.id === "fence-line") { startFence(); return; }
  routeEditing = false; renderRoute();
  placement = asset.id; view.startPlacement(asset); $("placement").hidden = false; $("finish-path").hidden = true;
  $("placement-text").textContent = `Place ${asset.name.toLowerCase()} · [ / ] to turn`;
  renderAssets(); status("Click the ground to place. Keep clicking for more; Escape cancels.");
}
function startPath() { if (!ready) return; routeEditing = false; renderRoute(); extendingPath = null; placement = "path"; view.startPath(); $("placement").hidden = false; $("finish-path").hidden = false; button("finish-path").textContent = "Finish path"; $("placement-text").textContent = "Drag to draw a path, or click points for a curve"; renderAssets(); status("Drag a path segment or click two or more points. Enter finishes a curve."); }
function startFence() { if (!ready) return; routeEditing = false; renderRoute(); extendingPath = null; placement = "fence"; view.startPath([], true); $("placement").hidden = false; $("finish-path").hidden = false; button("finish-path").textContent = "Finish fence"; $("placement-text").textContent = "Drag a fence line, or click its corner points"; renderAssets(); status("Draw a fence like a path. Enter finishes; Escape cancels."); }
function cancelPlacement() { extendingPath = null; placement = null; view.cancelPlacement(); $("placement").hidden = true; button("paint-grass").setAttribute("aria-pressed", "false"); button("erase-planting").setAttribute("aria-pressed", "false"); renderAssets(); }
function finishPath() { if (view.finishPath()) { placement = null; $("placement").hidden = true; updateSelection(); renderAssets(); } }
function setPreview(value: boolean) { preview = value; routeEditing = false; cancelPlacement(); document.body.classList.toggle("preview-mode", value); $("leave-preview").hidden = !value; view.setPreview(value); renderRoute(); }
function update() {
  if (!ready) return;
  input("layout-name").value = state.layout.name;
  $("save-state").textContent = fingerprint() === savedFingerprint ? "Saved on this Mac" : state.fileId ? "Unsaved changes · draft kept" : "Working copy · draft kept";
  button("undo").disabled = !past.length; button("redo").disabled = !future.length;
  $("object-count").textContent = String(state.layout.objects.length);
  updateSelection(); renderRoute();
}
function updateSelection() {
  selection = selection.filter(id => state.layout.objects.some(o => o.id === id));
  view.setSelection(selection);
  const items = selectedItems(), single = items.length === 1 ? items[0] : null;
  button("copy").disabled = !items.length; button("cut").disabled = !selectedItems(true).length; button("paste").disabled = !clipboard.length;
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
    const overlap = items.map(item => view.collision.overlap(item, state.layout)).find(Boolean);
    $("overlap-warning").hidden = !overlap; $("overlap-warning").textContent = overlap ? `Solid bounds overlap ${overlap.name}. Move them apart or use intentional layering.` : "";
    $("land-settings").hidden = !(single && ["land-tile-20", "land-tile-40", "land-hill", "meadow-island"].includes(single.asset));
    for (const el of document.querySelectorAll<HTMLButtonElement>("[data-expand]")) el.disabled = locked;

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
  const fence = item.asset === "fence-line";
  $("path-settings-title").textContent = fence ? "Fence shape" : "Path shape";
  $("path-shape-field").hidden = fence;
  $("path-width-label").textContent = fence ? "Height (metres)" : "Width (metres)";
  input("path-width").max = fence ? "3" : "20";
  select("path-shape").value = item.asset === "path-straight" ? "straight" : "curved"; select("path-shape").disabled = item.locked;
  input("path-length").value = pathCurve(item.path, item.asset === "path-straight" || fence).getLength().toFixed(1); input("path-length").disabled = item.locked; input("path-length").max = fence ? "300" : "1000";
  button("path-continue").disabled = item.locked || item.path.points.length >= 100;
  input("path-width").value = String(item.path.width); input("path-width").disabled = item.locked;
  button("path-add-point").disabled = item.locked || item.path.points.length >= 100;
  $("path-points").replaceChildren();
  item.path.points.forEach((point, index) => {
    const row = dom("div", "point-row"); row.append(dom("span", "", String(index + 1)));
    for (let axis = 0; axis < 2; axis++) {
      const field = dom("input"); field.type = "number"; field.step = ".5"; field.value = String(point[axis]); field.disabled = item.locked;
      field.setAttribute("aria-label", `${fence ? "Fence" : "Path"} point ${index + 1} ${axis ? "Z" : "X"}`);
      field.onchange = () => { if (field.value === "" || !Number.isFinite(field.valueAsNumber)) return renderPathSettings(item); transact(() => { item.path!.points[index][axis] = field.valueAsNumber; }); }; row.append(field);
    }
    const remove = dom("button", "", "×"); remove.setAttribute("aria-label", `Remove ${fence ? "fence" : "path"} point ${index + 1}`); remove.disabled = item.locked || item.path!.points.length <= 2;
    remove.onclick = () => transact(() => { item.path!.points.splice(index, 1); }); row.append(remove); $("path-points").append(row);
  });
}
function ensureRoute(id: ResidentId): ResidentRoute {
  state.layout.routes ??= {};
  state.layout.routes[id] ??= clone(view.model.defaultRoutes[id] ?? { points: [[0, 0], [1, 0]] });
  return state.layout.routes[id]!;
}
function renderRoute() {
  if (!ready) return;
  const id = select("route-resident").value as ResidentId;
  const route = state.layout.routes?.[id] ?? view.model.defaultRoutes[id];
  const points = route?.points ?? [];
  view.showRoute(points, routeEditing);
  button("route-edit").textContent = routeEditing ? "Done adding" : "Add waypoints on map";
  $("route-points").replaceChildren();
  $("route-status").textContent = `${points.length} waypoints${state.layout.routes?.[id] ? " · saved with this layout" : " · original route"}. Roads guide travel; residents may cross open ground.`;
  points.forEach((point, index) => {
    const row = dom("div", "point-row"); row.append(dom("span", "", String(index + 1)));
    for (let axis = 0; axis < 2; axis++) {
      const field = dom("input"); field.type = "number"; field.step = ".5"; field.value = String(point[axis]);
      field.setAttribute("aria-label", `${id} waypoint ${index + 1} ${axis ? "Z" : "X"}`);
      field.onchange = () => { if (!Number.isFinite(field.valueAsNumber)) return renderRoute(); transact(() => { ensureRoute(id).points[index][axis] = field.valueAsNumber; }); };
      row.append(field);
    }
    const pause = dom("input"); pause.type = "number"; pause.min = "0"; pause.max = "30"; pause.step = ".5"; pause.value = String(route?.pauses?.[index] ?? 0);
    pause.title = "Pause in seconds"; pause.setAttribute("aria-label", `${id} waypoint ${index + 1} pause`);
    pause.onchange = () => transact(() => { const current = ensureRoute(id); current.pauses ??= current.points.map(() => 0); current.pauses[index] = pause.valueAsNumber; });
    row.append(pause);
    const remove = dom("button", "", "×"); remove.setAttribute("aria-label", `Remove ${id} waypoint ${index + 1}`); remove.disabled = points.length <= 2;
    remove.onclick = () => transact(() => { const current = ensureRoute(id); current.points.splice(index, 1); current.pauses?.splice(index, 1); });
    row.append(remove); $("route-points").append(row);
  });
}
function checkRoute(id: ResidentId) {
  const authored = projectWorldLayout(state.layout);
  setAuthoredWorld(authored);
  const route = state.layout.routes?.[id] ?? view.model.defaultRoutes[id];
  if (!route) return `${id} has no route.`;
  const previous = view.model.world.authored;
  const priorSolids = [...previous.trees.filter(tree => !/^tree-\d+$/.test(tree.id)), ...previous.benches];
  const fenceBoxes = (fences: typeof authored.fences) => fences.flatMap(fence => fence.points.slice(1).flatMap(([bx, bz], index) => {
    const [ax, az] = fence.points[index], steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 2));
    return Array.from({ length: steps }, (_, step) => {
      const x0 = ax + (bx - ax) * step / steps, z0 = az + (bz - az) * step / steps;
      const x1 = ax + (bx - ax) * (step + 1) / steps, z1 = az + (bz - az) * (step + 1) / steps;
      const x = (x0 + x1) / 2, z = (z0 + z1) / 2;
      return { x, z, w: Math.abs(x1 - x0) + .35, d: Math.abs(z1 - z0) + .35, top: landscapeHeight(x, z) + fence.height };
    });
  }));
  const oldFences = fenceBoxes(previous.fences);
  const colliders = view.model.world.colliders.filter(collider =>
    !priorSolids.some(solid => Math.abs(collider.x - solid.x) < .0001 && Math.abs(collider.z - solid.z) < .0001) &&
    !oldFences.some(fence => Math.abs(collider.x - fence.x) < .0001 && Math.abs(collider.z - fence.z) < .0001 && Math.abs(collider.w - fence.w) < .0001 && Math.abs(collider.d - fence.d) < .0001));
  colliders.push(...fenceBoxes(authored.fences));
  for (const tree of authored.trees) if (!/^tree-\d+$/.test(tree.id)) colliders.push({ x: tree.x, z: tree.z, w: .7 * tree.scale[0], d: .7 * tree.scale[2], bottom: tree.y, top: tree.y + 5 * tree.scale[1] });
  for (const bench of authored.benches) colliders.push({ x: bench.x, z: bench.z,
    w: Math.abs(Math.cos(bench.yaw)) * 2.2 * bench.scale[0] + Math.abs(Math.sin(bench.yaw)) * .7 * bench.scale[2],
    d: Math.abs(Math.sin(bench.yaw)) * 2.2 * bench.scale[0] + Math.abs(Math.cos(bench.yaw)) * .7 * bench.scale[2],
    bottom: bench.y - .1, top: bench.y + 1.4 * bench.scale[1] });
  const movement = new VillageMovement(colliders, () => {});
  for (const [index, point] of route.points.entries()) if (!movement.clear(...point))
    return `${id} waypoint ${index + 1} is blocked. Move it to clear ground or enlarge the walkable area.`;
  const navigation = new VillageNavigation(colliders, authored);
  for (let i = 1; i < route.points.length; i++) {
    const destination = route.points[i], path = navigation.path(route.points[i - 1], destination);
    const end = path.at(-1);
    if (!end || Math.hypot(end[0] - destination[0], end[1] - destination[1]) > .6) return `${id} cannot reach waypoint ${i + 1}. Move it to clear ground or add a walkable area.`;
  }
  return `${id} can reach all ${route.points.length} waypoints using the playable movement rules.`;
}
async function applyToGame() {
  if (!ready || saving) return;
  try {
    projectWorldLayout(state.layout);
    for (const id of RESIDENT_IDS) if (state.layout.routes?.[id]) {
      const result = checkRoute(id);
      if (!result.includes("can reach all")) throw Error(result);
    }
    saving = true; button("apply-game").disabled = true;
    const result = await request<{ revision: string }>("/api/apply", { method: "POST", headers: { "Content-Type": "application/json", "If-Match": publishedRevision }, body: JSON.stringify(state.layout) });
    publishedRevision = result.revision;
    const playable = presets.find(preset => preset.id === "playable"); if (playable) playable.layout = clone(state.layout);
    $<HTMLDialogElement>("layout-dialog").close(); toast("Applied to the local game. Reload its preview to see the new layout.");
  } catch (issue) { error(issue); }
  finally { saving = false; button("apply-game").disabled = false; }
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
  savedFingerprint = fileId ? JSON.stringify(validated) : ""; selection = []; routeEditing = false; cancelPlacement(); view.sync(state.layout); update(); draft(); view.home();
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
select("path-shape").onchange = () => transact(() => { const item = selectedItems(true)[0]; if (item?.path && item.asset !== "fence-line") item.asset = select("path-shape").value === "straight" ? "path-straight" : "path-curved"; });
input("path-length").onchange = () => {
  const length = input("path-length").valueAsNumber;
  const fence = selectedItems()[0]?.asset === "fence-line";
  if (!Number.isFinite(length) || length < .5 || length > (fence ? 300 : 1000)) return toast(`Use a ${fence ? "fence" : "path"} length between 0.5 and ${fence ? 300 : 1000} metres.`);
  transact(() => {
    const item = selectedItems(true)[0]; if (!item?.path) return;
    const oldLength = pathCurve(item.path, item.asset === "path-straight" || item.asset === "fence-line").getLength();
    if (oldLength < .001) throw Error("Separate two path points before changing length.");
    const origin = item.path.points[0]; item.path.points = item.path.points.map(([x, z]) => [origin[0] + (x - origin[0]) * length / oldLength, origin[1] + (z - origin[1]) * length / oldLength]);
  });
};
button("path-continue").onclick = () => {
  const item = selectedItems(true)[0]; if (!item?.path) return;
  const root = view.model.roots.get(item.id)!;
  const points = item.path.points.map(([x, z]) => { const p = root.localToWorld(new T.Vector3(x, 0, z)); return [p.x, p.z] as [number, number]; });
  extendingPath = item.id; placement = item.asset === "fence-line" ? "fence" : "path"; view.startPath(points, item.asset === "path-straight" || item.asset === "fence-line");
  $("placement").hidden = false; $("finish-path").hidden = false; button("finish-path").textContent = item.asset === "fence-line" ? "Finish fence" : "Finish path"; $("placement-text").textContent = `Continue from the last ${item.asset === "fence-line" ? "fence" : "path"} point`;
  status(`Click to extend the ${item.asset === "fence-line" ? "fence" : "path"}, then finish. Escape cancels.`);
};
for (const el of document.querySelectorAll<HTMLButtonElement>("[data-expand]")) el.onclick = () => transact(() => {
  const item = selectedItems(true)[0]; if (!item) return;
  const size = new T.Box3().setFromObject(view.model.roots.get(item.id)!).getSize(new T.Vector3());
  const next = clone(item); next.id = `object-${crypto.randomUUID()}`; next.locked = false;
  const direction = el.dataset.expand!;
  next.position[0] += direction === "east" ? size.x : direction === "west" ? -size.x : 0;
  next.position[2] += direction === "south" ? size.z : direction === "north" ? -size.z : 0;
  state.layout.objects.push(next); selection = [next.id];
});
input("avoid-overlaps").onchange = () => { view.avoidOverlaps = input("avoid-overlaps").checked; status(view.avoidOverlaps ? "Solid collision protection is on." : "Intentional layering is enabled. Camera collision stays on."); };
button("path-add-point").onclick = () => transact(() => { const item = selectedItems(true)[0]; if (item?.path) { const last = item.path.points.at(-1)!, previous = item.path.points.at(-2)!; const direction = new T.Vector2(last[0] - previous[0], last[1] - previous[1]).normalize().multiplyScalar(5); item.path.points.push([last[0] + direction.x, last[1] + direction.y]); } });
button("ground").onclick = () => transact(() => { for (const item of selectedItems(true)) view.collision.ground(item, true); });
for (const el of document.querySelectorAll<HTMLButtonElement>("[data-turn]")) el.onclick = () => transact(() => { selectedItems(true).forEach(item => { item.rotation[1] += Number(el.dataset.turn); }); });
for (const el of document.querySelectorAll<HTMLButtonElement>("[data-tool]")) el.onclick = () => setTool(el.dataset.tool!);
button("assets-tab").onclick = () => setTab("assets"); button("scene-tab").onclick = () => setTab("scene");
for (const id of ["assets-tab", "scene-tab"]) button(id).onkeydown = event => { if (["ArrowLeft", "ArrowRight"].includes(event.key)) { event.preventDefault(); setTab(tab === "assets" ? "scene" : "assets"); button(`${tab}-tab`).focus(); } };
input("search").oninput = () => { renderAssets(); renderScene(); };
button("undo").onclick = undo; button("redo").onclick = redo; button("duplicate").onclick = duplicate; button("delete").onclick = removeSelection;
button("cut").onclick = () => copySelection(true); button("copy").onclick = () => copySelection(); button("paste").onclick = () => pasteSelection();
for (const action of document.querySelectorAll<HTMLButtonElement>("[data-context]")) action.onclick = () => {
  hideContextMenu();
  switch (action.dataset.context) {
    case "remove": removeSelection(); break;
    case "cut": copySelection(true); break;
    case "copy": copySelection(); break;
    case "paste": pasteSelection(contextPoint ?? undefined); break;
    case "duplicate": duplicate(); break;
    case "focus": view.focus(); break;
    case "undo": undo(); break;
    case "redo": redo(); break;
  }
};
document.addEventListener("pointerdown", event => { if (!(event.target instanceof Node) || !$("context-menu").contains(event.target)) hideContextMenu(); }, true);
button("focus-object").onclick = () => view.focus(); button("home-view").onclick = () => view.home();
button("start-house").onclick = () => { selection = [state.layout.objects.find(o => o.asset.startsWith("cottage-"))?.id ?? ""]; updateSelection(); view.focus(); setTool("rotate"); };
button("draw-path").onclick = startPath; button("draw-fence").onclick = startFence; button("finish-path").onclick = finishPath; button("cancel-placement").onclick = cancelPlacement;
button("paint-grass").onclick = () => {
  if (placement === "grass-brush") { cancelPlacement(); return; }
  cancelPlacement(); routeEditing = false; renderRoute(); placement = "grass-brush";
  view.startGrassBrush(select("grass-size").value); button("paint-grass").setAttribute("aria-pressed", "true");
  $("placement").hidden = false; $("finish-path").hidden = true; $("placement-text").textContent = "Drag across the meadow to paint grass";
  status("Drag across the ground to paint natural grass clusters. Undo removes a full stroke.");
};
select("grass-size").onchange = () => { if (placement === "grass-brush") view.startGrassBrush(select("grass-size").value); };
button("erase-planting").onclick = () => {
  if (placement === "planting-eraser") { cancelPlacement(); return; }
  cancelPlacement(); routeEditing = false; renderRoute(); placement = "planting-eraser";
  view.startErase(Number(select("erase-size").value)); button("erase-planting").setAttribute("aria-pressed", "true");
  $("placement").hidden = false; $("finish-path").hidden = true; $("placement-text").textContent = "Drag to erase meadow grass and lane flowers";
  status("Drag across planting to clear it. Paths and buildings stay in place; Undo restores the full stroke.");
};
select("erase-size").onchange = () => { if (placement === "planting-eraser") view.startErase(Number(select("erase-size").value)); };
select("route-resident").onchange = () => { routeEditing = false; renderRoute(); };
button("route-edit").onclick = () => { if (!ready) return; cancelPlacement(); routeEditing = !routeEditing; renderRoute(); status(routeEditing ? "Click the ground to add waypoints. Use Done adding when finished." : "Route editing finished."); };
button("route-check").onclick = () => { if (!ready) return; try { const result = checkRoute(select("route-resident").value as ResidentId); $("route-status").textContent = result; status(result); } catch (issue) { error(issue); } };
button("view-top").onclick = () => { view.topDown(true); $("view-top").setAttribute("aria-pressed", "true"); $("view-perspective").setAttribute("aria-pressed", "false"); };
button("view-perspective").onclick = () => { view.topDown(false); $("view-top").setAttribute("aria-pressed", "false"); $("view-perspective").setAttribute("aria-pressed", "true"); };
button("grid").onclick = () => { const value = $("grid").getAttribute("aria-pressed") !== "true"; $("grid").setAttribute("aria-pressed", String(value)); view.toggleGrid(value); };
select("space").onchange = () => view.setSpace(select("space").value);
for (const id of ["snap", "angle-snap"]) select(id).onchange = () => view.setSnap(Number(select("snap").value), Number(select("angle-snap").value));
select("lighting").onchange = () => view.setLighting(select("lighting").value);
button("layouts").onclick = () => { void showLayouts(); }; button("more").onclick = () => { void showLayouts(); };
button("help").onclick = () => $<HTMLDialogElement>("help-dialog").showModal();
button("save").onclick = () => { void save(); }; button("save-copy").onclick = () => { void save(true); }; button("export").onclick = exportJSON;
button("apply-game").onclick = () => { void applyToGame(); };
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
  const editing = event.target instanceof HTMLElement && event.target.matches("input, select, textarea, [contenteditable=true]");
  const mod = event.metaKey || event.ctrlKey;
  if (mod && event.key.toLowerCase() === "s") { event.preventDefault(); if (editing) (event.target as HTMLElement).blur(); void save(); return; }
  if (editing) return;
  if (!mod && !event.altKey && view.navigate(event)) return;
  if (event.key === "Escape") { if (!$("context-menu").hidden) hideContextMenu(); else if (preview) setPreview(false); else if (placement) cancelPlacement(); else { selection = []; updateSelection(); } return; }
  if (preview) return;
  if (mod) {
    if (event.key.toLowerCase() === "c") { event.preventDefault(); copySelection(); }
    if (event.key.toLowerCase() === "x") { event.preventDefault(); copySelection(true); }
    if (event.key.toLowerCase() === "v") { event.preventDefault(); pasteSelection(); }
    if (event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
    if (event.key.toLowerCase() === "d") { event.preventDefault(); duplicate(); }
    if (event.key.toLowerCase() === "y") { event.preventDefault(); redo(); }
    return;
  }
  if (placement && ["[", "]"].includes(event.key)) { view.turnPlacement(event.key === "[" ? -15 : 15); return; }
  if ((placement === "path" || placement === "fence") && event.key === "Enter") { event.preventDefault(); finishPath(); return; }
  const tool = ({ v: "select", g: "translate", e: "rotate", r: "scale" } as Record<string,string>)[event.key.toLowerCase()];
  if (tool) setTool(tool);
  if (event.key.toLowerCase() === "p") startPath();
  if (event.key.toLowerCase() === "b") startFence();
  if (event.key.toLowerCase() === "f") view.focus();
  if (event.key === "Home") { event.preventDefault(); view.home(); }
  if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); removeSelection(); }
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) && selection.length) {
    event.preventDefault(); const step = (view.snap || .1) * (event.shiftKey ? 5 : 1);
    transact(() => { for (const item of selectedItems(true)) { item.position[0] += event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0; item.position[2] += event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0; } });
  }
});
window.addEventListener("beforeunload", event => { if (ready && fingerprint() !== savedFingerprint) { draft(); event.preventDefault(); event.returnValue = ""; } });
window.addEventListener("storage", event => {
  if (event.key === DRAFT_KEY && ready) status("Another studio tab updated the recovery draft. Save a named layout to keep this tab's version.");
  if (event.key === CLIPBOARD_KEY && ready) { try { readClipboard(); updateSelection(); } catch (issue) { error(issue); } }
});
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
    const playableResponse = await request<{ layout: Layout; revision: string }>("/api/playable");
    const playable = validateLayout(playableResponse.layout, view.model.assets);
    publishedRevision = playableResponse.revision;
    presets.unshift({ id: "playable", layout: clone(playable), description: "The map used by the local game." });
    const archiveResponse = await fetch("/api/presets/original-village");
    if (archiveResponse.ok) presets.push({ id: "original", layout: validateLayout((await archiveResponse.json()).layout, view.model.assets), description: "The earlier village, kept for reference." });
    state = { layout: clone(playable), fileId: null, revision: "" }; state.layout.name = "My village";
    let recovered = false;
    try { const raw = localStorage.getItem(DRAFT_KEY); if (raw) { const draft = JSON.parse(raw); state = { layout: validateLayout(draft.state.layout, view.model.assets), fileId: typeof draft.state.fileId === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(draft.state.fileId) ? draft.state.fileId : null, revision: typeof draft.state.revision === "string" ? draft.state.revision : "" }; savedFingerprint = typeof draft.savedFingerprint === "string" ? draft.savedFingerprint : ""; recovered = true; } }
    catch { toast("The previous browser draft could not be read. It remains in browser storage; a fresh working copy is open."); }
    try { readClipboard(); } catch { toast("The previous clipboard could not be restored. Your layout is unchanged."); }
    ready = true; view.sync(state.layout); update(); $("loading").hidden = true;
    status(recovered ? "Recovered your working copy. The original village is preserved." : "Your working copy is ready. Choose an asset, or click something in the village.");
    renderAssets();
    // Preset thumbnails use the same scene and camera as the working copy.
    const current = clone(state.layout);
    for (const preset of presets) { view.sync(preset.layout); preset.image = view.capture(); }
    view.sync(current); view.setSelection(selection);
    void view.thumbnails(() => renderAssets());
    // A read-only development inspection surface supports reproducible studio QA.
    Object.assign(window, { cosyStudio: { snapshot: () => clone(state), original: () => clone(view.model.original), presets: () => presets.map(p => ({ id: p.id, layout: clone(p.layout) })), selection: () => [...selection], assets: () => [...view.model.assets.values()].map(a => ({ id: a.id, name: a.name, category: a.category })), capture: () => view.capture(), screenPoint: (id: string, offset?: [number, number, number]) => view.screenPoint(id, offset), camera: () => view.navigationState() } });
  } catch (issue) { $("loading-text").textContent = issue instanceof Error ? issue.message : String(issue); $("loading").querySelector("h2")!.textContent = "The studio couldn't open"; error(issue); }
}
void start();
