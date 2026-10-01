"use client";
import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Bird, BookOpen, Coffee, Drop, EnvelopeSimple, Fire, Leaf, Timer } from "@phosphor-icons/react";
import { PLACES, JAPANESE_PLACE_NAMES, type PlaceId } from "./places";
import { BIRD_CLEARING, BRIDGE, HEARTH, POND, POND_DOCK, riverX } from "./environment";
import { BEDS, GARDEN_COURT, SUNFLOWER_BED } from "./garden";
import type { World } from "./world";

type MapScenery = World["mapScenery"];
type MapPose = { x: number; z: number; heading: number } | null;
const icons = [Timer, Fire, Drop, Coffee, BookOpen, EnvelopeSimple, Leaf, Bird];
// Callouts separate neighbouring controls without moving their true ground anchors.
const pinOffsets = [[6, 24], [0, -10], [-8, -8], [-7, -17], [-12, 18], [-6, -8], [21, 12], [-17, 7]];
function mapBounds(scenery?: MapScenery) {
  const positions = [...(scenery?.buildings ?? []), ...(scenery?.trees ?? []), ...(scenery?.layout.swings ?? [])];
  const x = Math.min(-50, ...positions.map(item => item.x - 9));
  const z = Math.min(-52, ...positions.map(item => item.z - 9));
  return { x, z, width: Math.max(46, ...positions.map(item => item.x + 9)) - x,
    height: Math.max(45, ...positions.map(item => item.z + 9)) - z };
}
const point = (x: number, z: number, bounds: ReturnType<typeof mapBounds>) => [(x - bounds.x) * 10, (z - bounds.z) * 10];
function mapLocation(current: PlaceId | null, position: MapPose) {
  return current === "focus" ? PLACES.find(place => place.id === "focus")!.position
    : position ? [position.x, 0, position.z] : current ? PLACES.find(place => place.id === current)!.position : [0, 0, 18];
}
function mapView(bounds: ReturnType<typeof mapBounds>, x: number, y: number, mini: boolean) {
  const width = mini ? 560 : bounds.width * 10, height = mini ? 440 : bounds.height * 10;
  const left = mini ? Math.max(0, Math.min(bounds.width * 10 - width, x - width / 2)) : 0;
  const top = mini ? Math.max(0, Math.min(bounds.height * 10 - height, y - height / 2)) : 0;
  return `${left} ${top} ${width} ${height}`;
}

const MapLandscape = memo(function MapLandscape({ scenery, bounds, language }: {
  scenery?: MapScenery; bounds: ReturnType<typeof mapBounds>; language: "en" | "ja";
}) {
  const id = useId();
  const width = bounds.width * 10, height = bounds.height * 10;
  const at = (x: number, z: number) => point(x, z, bounds);
  const river = Array.from({ length: 160 }, (_, i) => { const z = bounds.z + i * bounds.height / 159; return at(riverX(z), z).join(","); }).join(" ");
  const ja = language === "ja";
  return <g>
    <defs>
      <pattern id={`${id}-grain`} width="13" height="13" patternUnits="userSpaceOnUse"><circle cx="3" cy="4" r=".6" fill="#315f44" opacity=".09" /><circle cx="10" cy="11" r=".6" fill="#fff9e9" opacity=".3" /></pattern>
      <pattern id={`${id}-plot`} width="14" height="14" patternUnits="userSpaceOnUse"><path d="M0 7H14" stroke="#71915c" strokeWidth="3" /></pattern>
    </defs>
    <rect width={width} height={height} fill="#d3dfb5" />
    {scenery?.layout.walkable.map(area => <ellipse key={area.id} cx={at(area.x, area.z)[0]} cy={at(area.x, area.z)[1]} rx={area.radiusX * 10} ry={area.radiusZ * 10} transform={`rotate(${-area.yaw * 180 / Math.PI} ${at(area.x, area.z).join(" ")})`} fill="#e0e7bf" />)}
    {scenery?.trees.map(tree => <circle key={tree.id} cx={at(tree.x, tree.z)[0]} cy={at(tree.x, tree.z)[1]} r={tree.scale[0] * 42} fill="#a7c39a" opacity=".24" />)}
    {scenery?.layout.grass.map(patch => { const [x, y] = at(patch.x, patch.z); return <ellipse key={patch.id} cx={x} cy={y} rx={patch.radiusX * 10} ry={patch.radiusZ * 10} transform={`rotate(${-patch.yaw * 180 / Math.PI} ${x} ${y})`} fill="#b9d098" opacity=".5" />; })}
    <polyline points={river} fill="none" stroke="#eff0ce" strokeWidth="61" strokeLinecap="round" />
    <polyline points={river} fill="none" stroke="#87b9b5" strokeWidth="48" strokeLinecap="round" />
    <polyline points={river} fill="none" stroke="#aed1c4" strokeWidth="20" opacity=".6" />
    <ellipse cx={at(POND.x, POND.z)[0]} cy={at(POND.x, POND.z)[1]} rx={POND.rx * 10 + 6} ry={POND.rz * 10 + 6} fill="#ebedce" />
    <ellipse cx={at(POND.x, POND.z)[0]} cy={at(POND.x, POND.z)[1]} rx={POND.rx * 10} ry={POND.rz * 10} fill="#86b8b2" />
    <g transform={`translate(${at(POND.x, POND.z).join(" ")})`} fill="none" stroke="#d1e5d6" strokeWidth="3" strokeLinecap="round"><path d="M-42 10q18-8 35 0m-25 16q18-8 35 0m-4-53q18-8 35 0" /></g>
    {scenery?.paths.map((path, i) => <g key={i}><polyline points={path.spine.map(([x, z]) => at(x, z).join(",")).join(" ")} fill="none" stroke="#b2af89" strokeWidth={path.width * 10 + 4} strokeLinecap="round" strokeLinejoin="round" /><polyline points={path.spine.map(([x, z]) => at(x, z).join(",")).join(" ")} fill="none" stroke="#eee5bf" strokeWidth={path.width * 10} strokeLinecap="round" strokeLinejoin="round" /></g>)}
    <g transform={`translate(${at(BRIDGE.x, BRIDGE.z).join(" ")})`}><rect x={-BRIDGE.length * 5} y={-BRIDGE.width * 5} width={BRIDGE.length * 10} height={BRIDGE.width * 10} rx="4" fill="#c6b593" stroke="#847e62" strokeWidth="3" />{[-45, -30, -15, 0, 15, 30, 45].map(x => <path key={x} d={`M${x} -14V14`} stroke="#e9dbb9" strokeWidth="3" />)}</g>
    <rect x={at(POND_DOCK.x - POND_DOCK.w / 2, POND_DOCK.z - POND_DOCK.d / 2)[0]} y={at(POND_DOCK.x, POND_DOCK.z - POND_DOCK.d / 2)[1]} width={POND_DOCK.w * 10} height={POND_DOCK.d * 10} rx="3" fill="#c6b593" stroke="#847e62" strokeWidth="2" />
    <rect x={at(GARDEN_COURT.left, GARDEN_COURT.back)[0]} y={at(GARDEN_COURT.left, GARDEN_COURT.back)[1]} width={(GARDEN_COURT.right - GARDEN_COURT.left) * 10} height={(GARDEN_COURT.front - GARDEN_COURT.back) * 10} rx="10" fill="#e7dfbb" stroke="#c4ba95" strokeWidth="2" />
    {BEDS.map((bed, i) => <g key={i} transform={`translate(${at(bed.x, bed.z).join(" ")})`}><rect x={i === SUNFLOWER_BED ? -49 : -18} y="-13" width={i === SUNFLOWER_BED ? 98 : 36} height="26" rx="3" fill={`url(#${id}-plot)`} stroke="#ab9572" strokeWidth="3" />{i === SUNFLOWER_BED && [-36, -18, 0, 18, 36].map(x => <circle key={x} cx={x} r="5" fill="#d3b66a" />)}</g>)}
    <g transform={`translate(${at(HEARTH.x, HEARTH.z).join(" ")})`}><circle r={HEARTH.pavingRadius * 10} fill="#ded8b0" /><circle r="16" fill="#b5a78e" /><path d="M-5 8q-11-13 2-24q0 9 7 12q9 9 1 15Z" fill="#da9671" /></g>
    <circle cx={at(BIRD_CLEARING.x, BIRD_CLEARING.z)[0]} cy={at(BIRD_CLEARING.x, BIRD_CLEARING.z)[1]} r={BIRD_CLEARING.radius * 10} fill="#e3e6bf" stroke="#bfcc9f" strokeWidth="2" />
    {scenery?.buildings.map((building, i) => <g key={building.id} data-map-building={building.id} transform={`translate(${at(building.x, building.z).join(" ")}) rotate(${-building.yaw * 180 / Math.PI})`}>
      {building.id === "tower" ? <><circle r="29" fill="#506b4829" transform="translate(5 7)" /><circle r="26" fill="#f5ebcd" stroke="#83775b" strokeWidth="2" /><path d="M0-25 23 0 0 25-23 0Z" fill="#6c9590" stroke="#526d60" strokeWidth="2" /><circle r="5" fill="#dfc791" /></> : <>
        <rect x={-building.width * 5} y={-building.depth * 5} width={building.width * 10} height={building.depth * 10} rx="6" fill="#506b4829" transform="translate(4 6)" />
        <rect x={-building.width * 5} y={-building.depth * 5} width={building.width * 10} height={building.depth * 10} rx="4" fill={i % 2 ? "#bd8871" : "#6c9590"} stroke="#526d60" strokeWidth="2" />
        <path d={`M${-building.width * 5} 0H${building.width * 5}`} stroke="#fff6d9" strokeWidth="2" opacity=".55" />
        <path d="M-19-20V20M-8-20V20M8-20V20M19-20V20" stroke="#fff6d9" strokeWidth="1" opacity=".25" />
        <rect x="-4" y={-building.depth * 5 - 3} width="8" height="9" rx="1" fill="#dbc4a0" stroke="#83775b" />
      </>}
    </g>)}
    {scenery?.benches.map(bench => <g key={bench.id} transform={`translate(${at(bench.x, bench.z).join(" ")}) rotate(${-bench.facing * 180 / Math.PI})`}><rect x="-12" y="-4" width="24" height="8" rx="2" fill="#ba9670" stroke="#7d8061" strokeWidth="1.5" /><path d="M-12-5H12" stroke="#ece0b8" strokeWidth="2" /></g>)}
    {scenery?.layout.fences.map(fence => <polyline key={fence.id} points={fence.points.map(([x, z]) => at(x, z).join(",")).join(" ")} fill="none" stroke="#ac9775" strokeWidth="3" strokeDasharray="8 3" />)}
    {scenery?.trees.map((tree, i) => { const [x, y] = at(tree.x, tree.z); return <g key={tree.id} transform={`translate(${x} ${y})`}><ellipse cx="5" cy="7" rx="15" ry="12" fill="#4163421c" /><circle r={12 + tree.scale[0] * 2} fill={i % 3 ? "#7ca275" : "#94b386"} stroke="#678960" strokeWidth="1.5" /><circle cx="-4" cy="-4" r="7" fill="#afc69a" opacity=".6" /></g>; })}
    {scenery?.layout.swings.map(swing => <g key={swing.id} data-map-swing={swing.id} transform={`translate(${at(swing.x, swing.z).join(" ")}) rotate(${-swing.yaw * 180 / Math.PI}) scale(${swing.scale[0]})`}><rect x="-34" y="-22" width="68" height="44" rx="11" fill="#e8e4bd" stroke="#c1c49b" strokeWidth="2" /><path d="M-25-13V13M25-13V13" stroke="#6d8c78" strokeWidth="4" /><path d="M-27 0H27" stroke="#af8864" strokeWidth="5" />{[-10, 10].map(x => <g key={x}><path d={`M${x - 3} 0V12M${x + 3} 0V12`} stroke="#718977" strokeWidth="1.5" /><rect x={x - 5} y="9" width="10" height="5" rx="2" fill="#406c56" /></g>)}</g>)}
    <rect width={width} height={height} fill={`url(#${id}-grain)`} />
    {scenery?.layout.swings.map(swing => <text key={swing.id} x={at(swing.x, swing.z)[0]} y={at(swing.x, swing.z)[1] + 62} textAnchor="middle" fill="#4b7159" fontSize="30" fontFamily="Georgia, serif">{ja ? "草原のブランコ" : "Meadow swings"}</text>)}
    <text x={at(43, 39)[0]} y={at(43, 39)[1]} fill="#719068" fontSize="31" fontFamily="Georgia, serif" fontStyle="italic" transform={`rotate(-7 ${at(43, 39).join(" ")})`}>{ja ? "日の出の草原" : "Sunrise meadow"}</text>
  </g>;
});

function MapArtwork({ scenery, current, position, language, mini = false }: {
  scenery?: MapScenery; current: PlaceId | null; position: MapPose; language: "en" | "ja"; mini?: boolean;
}) {
  const bounds = useMemo(() => mapBounds(scenery), [scenery]);
  const location = mapLocation(current, position);
  const [x, y] = point(location[0], location[2], bounds);
  return <svg viewBox={mapView(bounds, x, y, mini)} aria-hidden="true" className="v-map-art">
    <MapLandscape scenery={scenery} bounds={bounds} language={language} />
    {PLACES.map(place => <circle key={place.id} cx={point(place.position[0], place.position[2], bounds)[0]} cy={point(place.position[0], place.position[2], bounds)[1]} r={mini ? 6 : 4} fill="#476e58" stroke="#fff9e9" strokeWidth="2" />)}
    <g className="v-map-player" data-x={location[0]} data-z={location[2]} transform={`translate(${x} ${y})`}>
      <circle r="19" fill="#bc985840" /><circle r="13" fill="#fff9e9" stroke="#96784e" strokeWidth="2" />
      {!current && position && <path className="v-map-heading" d="M0-26-5-17H5Z" fill="#315646" transform={`rotate(${180 - position.heading * 180 / Math.PI})`} />}
      <path d="M0-10C-10-1-12 7-5 10H5C12 7 10-1 0-10Z" fill="#fff9e9" stroke="#96784e" strokeWidth="2" /><circle cx="-3" cy="3" r="1.2" fill="#426953" /><circle cx="3" cy="3" r="1.2" fill="#426953" />
    </g>
  </svg>;
}

export function VillageMinimap({ scenery, current, language, readPose, expand }: {
  scenery?: MapScenery; current: PlaceId | null; language: "en" | "ja"; readPose: () => MapPose; expand: () => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const svg = button.current?.querySelector("svg.v-map-art");
    const marker = svg?.querySelector(".v-map-player"), heading = svg?.querySelector(".v-map-heading");
    if (!svg || !marker) return;
    const bounds = mapBounds(scenery), step = 1000 / 60;
    let frameId = 0, lastFrame = 0, previous: MapPose = null;
    const update = (time: number) => {
      frameId = requestAnimationFrame(update);
      if (time - lastFrame < step - .5) return;
      lastFrame = time - (time - lastFrame) % step;
      if (document.hidden) return;
      const pose = readPose(), location = mapLocation(current, pose);
      const next = { x: location[0], z: location[2], heading: pose?.heading ?? 0 };
      if (!previous || Math.hypot(next.x - previous.x, next.z - previous.z) > .001) {
        const [x, y] = point(next.x, next.z, bounds);
        marker.setAttribute("transform", `translate(${x} ${y})`);
        marker.setAttribute("data-x", String(next.x)); marker.setAttribute("data-z", String(next.z));
        svg.setAttribute("viewBox", mapView(bounds, x, y, true));
      }
      if (heading && (!previous || Math.abs(next.heading - previous.heading) > .001))
        heading.setAttribute("transform", `rotate(${180 - next.heading * 180 / Math.PI})`);
      previous = next;
    };
    // Move only the viewport and player glyph; the landscape stays mounted between frames.
    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, [current, readPose, scenery]);
  return <button ref={button} className="v-minimap" aria-label={language === "ja" ? "村の地図を広げる" : "Expand village map"} aria-keyshortcuts="M" onClick={expand}>
    <MapArtwork scenery={scenery} current={current} position={readPose()} language={language} mini />
    <span className="v-minimap-north" aria-hidden="true">N<span>↑</span></span>
    <span className="v-minimap-caption"><kbd aria-hidden="true">M</kbd>{language === "ja" ? "地図" : "Map"}<ArrowUpRight size={15} aria-hidden="true" /></span>
  </button>;
}

export function VillageMap({ scenery, current, position, language, notice, travel }: {
  scenery?: MapScenery; current: PlaceId | null; position: MapPose; language: "en" | "ja"; notice: string; travel: (id: PlaceId) => void;
}) {
  const ja = language === "ja";
  const [selected, setSelected] = useState<PlaceId>(current ?? "focus");
  const buttons = useRef(new Map<PlaceId, HTMLButtonElement>());
  const bounds = useMemo(() => mapBounds(scenery), [scenery]);
  const destination = PLACES.find(place => place.id === selected)!;
  const name = (id: PlaceId) => ja ? JAPANESE_PLACE_NAMES[PLACES.findIndex(place => place.id === id)] : PLACES.find(place => place.id === id)!.name;
  const move = (dx: number, dz: number) => {
    const origin = destination.position;
    const candidates = PLACES.filter(place => place.id !== selected).map(place => {
      const x = place.position[0] - origin[0], z = place.position[2] - origin[2];
      return { place, forward: x * dx + z * dz, score: Math.hypot(x, z) + Math.abs(x * dz - z * dx) * 1.8 };
    }).filter(candidate => candidate.forward > .1).sort((a, b) => a.score - b.score);
    const next = candidates[0]?.place;
    if (next) { setSelected(next.id); buttons.current.get(next.id)?.focus(); }
  };
  return <div className="v-map" onKeyDown={event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing ||
      (event.target instanceof Element && event.target.closest("input, textarea, select"))) return;
    const direction = ({ w: [0, -1], ArrowUp: [0, -1], a: [-1, 0], ArrowLeft: [-1, 0], s: [0, 1], ArrowDown: [0, 1], d: [1, 0], ArrowRight: [1, 0] } as Record<string, number[]>)[event.key.length === 1 ? event.key.toLowerCase() : event.key];
    if (direction) { event.preventDefault(); move(direction[0], direction[1]); }
  }}>
    <div className="v-map-canvas" role="group" aria-label={ja ? "村の目的地" : "Village destinations"} style={{ aspectRatio: `${bounds.width} / ${bounds.height}`, "--map-ratio": bounds.width / bounds.height } as React.CSSProperties}>
      <MapArtwork scenery={scenery} current={current} position={position} language={language} />
      <span className="v-map-north" aria-hidden="true">N ↑</span>
      {PLACES.map((place, i) => {
        const Icon = icons[i], [dx, dy] = pinOffsets[i];
        return <div className="v-map-pin" key={place.id} style={{ left: `${(place.position[0] - bounds.x) / bounds.width * 100}%`, top: `${(place.position[2] - bounds.z) / bounds.height * 100}%` }}>
          <span className="v-map-leader" style={{ width: Math.hypot(dx, dy), rotate: `${Math.atan2(dy, dx)}rad` }} />
          <button ref={button => { if (button) buttons.current.set(place.id, button); else buttons.current.delete(place.id); }}
            className={`v-map-marker v-map-marker-${place.id}${selected === place.id ? " is-selected" : ""}`} style={{ left: dx, top: dy }}
            aria-label={name(place.id)} aria-current={current === place.id ? "location" : undefined}
            onFocus={() => setSelected(place.id)} onPointerMove={() => setSelected(place.id)} onClick={() => travel(place.id)}>
            <span className="v-map-marker-icon"><Icon size={22} aria-hidden="true" /></span><span className="v-map-marker-name">{name(place.id)}</span>
          </button>
        </div>;
      })}
    </div>
    <div className="v-map-footer">
      <div className="v-map-destination" aria-live="polite"><strong>{name(selected)}</strong><span>{ja ? ["集中", "音楽", "深呼吸", "お茶", "感謝", "やさしい言葉", "野菜、お花とミント", "小鳥にパンくず"][PLACES.indexOf(destination)] : destination.description}</span>{notice && <span className="v-map-notice" role="status">{notice}</span>}</div>
      <button className="v-button v-primary" onClick={() => travel(selected)}><kbd aria-hidden="true">↵</kbd>{ja ? "ここへ行く" : "Go here"}<ArrowUpRight size={18} /></button>
    </div>
    <p className="v-map-help"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>{ja ? "目的地を選ぶ" : "Choose a place"}</span><span><kbd>↵</kbd>{ja ? "移動" : "Go"}</span><span><kbd>Esc</kbd>{ja ? "閉じる" : "Close"}</span></p>
  </div>;
}
