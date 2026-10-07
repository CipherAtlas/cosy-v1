"use client";
import { useContext } from "react";
import { gameKey } from "./keybindings";
import { Keycap, ShortcutButton, KeybindingContext } from "./KeybindingControls";
import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Bird, BookOpen, CastleTurret, Coffee, Drop, EnvelopeSimple, Fire, Leaf, Timer } from "@phosphor-icons/react";
import { PLACES, JAPANESE_PLACE_NAMES, type PlaceId } from "./places";
import { BIRD_CLEARING, HEARTH } from "./environment";
import { BEDS, GARDEN_COURT, SUNFLOWER_BED } from "./garden";
import type { World } from "./world";

import { MapActors, MapCrossings, MapTown, MapWater, useMapActors } from "./VillageMapLandmarks";
import type { MapActor } from "./sharedActors";
import { outdoorMapDestinations } from "./mapDestinations";
import { mapLabelWidth, placeMapLabels } from "./mapLabels";

type MapScenery = World["mapScenery"];
type MapPose = { x: number; z: number; heading: number } | null;
const icons = [Timer, Fire, Drop, Coffee, BookOpen, EnvelopeSimple, Leaf, Bird];
function mapBounds(scenery?: MapScenery) {
  const positions = [...(scenery?.buildings ?? []), ...(scenery?.trees ?? []), ...(scenery?.layout.swings ?? []),
    ...(scenery?.layout.items?.filter(item => item.visible && ["horse-racetrack", "farm-row", "owl-feeding-perch", "cow-highland", "cow-highland-girl", "sheep", "lamb"].includes(item.asset)).map(item => ({ x: item.position[0], z: item.position[2] })) ?? [])];
  const x = Math.min(-50, ...positions.map(item => item.x - 30));
  const z = Math.min(-52, ...positions.map(item => item.z - 20));
  return { x, z, width: Math.max(46, ...positions.map(item => item.x + 30)) - x,
    height: Math.max(45, ...positions.map(item => item.z + 20)) - z };
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

const MapLandscape = memo(function MapLandscape({ scenery, bounds }: {
  scenery?: MapScenery; bounds: ReturnType<typeof mapBounds>;
}) {
  const id = useId();
  const width = bounds.width * 10, height = bounds.height * 10;
  const at = (x: number, z: number) => point(x, z, bounds);
  return <g>
    <defs>
      <pattern id={`${id}-grain`} width="13" height="13" patternUnits="userSpaceOnUse"><circle cx="3" cy="4" r=".6" fill="#315f44" opacity=".09" /><circle cx="10" cy="11" r=".6" fill="#fff9e9" opacity=".3" /></pattern>
      <pattern id={`${id}-plot`} width="14" height="14" patternUnits="userSpaceOnUse"><path d="M0 7H14" stroke="#71915c" strokeWidth="3" /></pattern>
    </defs>
    <rect width={width} height={height} fill="#d3dfb5" />
    {scenery?.layout.walkable.map(area => <ellipse key={area.id} cx={at(area.x, area.z)[0]} cy={at(area.x, area.z)[1]} rx={area.radiusX * 10} ry={area.radiusZ * 10} transform={`rotate(${-area.yaw * 180 / Math.PI} ${at(area.x, area.z).join(" ")})`} fill="#e0e7bf" />)}
    {scenery?.trees.map(tree => <circle key={tree.id} cx={at(tree.x, tree.z)[0]} cy={at(tree.x, tree.z)[1]} r={tree.scale[0] * 42} fill="#a7c39a" opacity=".24" />)}
    {scenery?.layout.grass.map(patch => { const [x, y] = at(patch.x, patch.z); return <ellipse key={patch.id} cx={x} cy={y} rx={patch.radiusX * 10} ry={patch.radiusZ * 10} transform={`rotate(${-patch.yaw * 180 / Math.PI} ${x} ${y})`} fill="#b9d098" opacity=".5" />; })}
    <MapWater world={scenery?.layout} bounds={bounds} />
    {scenery?.paths.map((path, i) => <g key={i}><polyline points={path.spine.map(([x, z]) => at(x, z).join(",")).join(" ")} fill="none" stroke="#b2af89" strokeWidth={path.width * 10 + 4} strokeLinecap="round" strokeLinejoin="round" /><polyline points={path.spine.map(([x, z]) => at(x, z).join(",")).join(" ")} fill="none" stroke="#eee5bf" strokeWidth={path.width * 10} strokeLinecap="round" strokeLinejoin="round" /></g>)}
    <MapCrossings world={scenery?.layout} bounds={bounds} />
    <MapTown world={scenery?.layout} bounds={bounds} />
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

  </g>;
});

function MapArtwork({ scenery, current, position, language, readActors, mini = false, viewportBounds }: {
  scenery?: MapScenery; current: PlaceId | null; position: MapPose; language: "en" | "ja"; mini?: boolean; readActors?: () => MapActor[]; viewportBounds?: ReturnType<typeof mapBounds>;
}) {
  const actors = useMapActors(mini ? readActors : undefined);
  const bounds = useMemo(() => viewportBounds ?? mapBounds(scenery), [scenery, viewportBounds]);
  const location = mapLocation(current, position);
  const [x, y] = point(location[0], location[2], bounds);
  return <svg viewBox={mapView(bounds, x, y, mini)} aria-hidden="true" className="v-map-art">
    <MapLandscape scenery={scenery} bounds={bounds} />
    {mini && <MapActors actors={actors} readActors={readActors} bounds={bounds} mini />}
    {PLACES.filter(place => place.id !== "mood").map(place => <circle key={place.id} cx={point(place.position[0], place.position[2], bounds)[0]} cy={point(place.position[0], place.position[2], bounds)[1]} r={mini ? 6 : 4} fill="#476e58" stroke="#fff9e9" strokeWidth="2" />)}
    {mini && <MapPlayer x={location[0]} z={location[2]} bounds={bounds} heading={!current ? position?.heading : undefined} mini language={language} />}
  </svg>;
}

function MapPlayer({ x, z, bounds, heading, mini = false, scale = 1, language, readPose, current = null }: {
  x: number; z: number; bounds: ReturnType<typeof mapBounds>; heading?: number; mini?: boolean; scale?: number; language: "en" | "ja"; readPose?: () => MapPose; current?: PlaceId | null;
}) {
  const marker = useRef<SVGGElement>(null);
  useEffect(() => {
    if (!readPose || !marker.current) return;
    const node = marker.current, arrow = node.querySelector(".v-map-heading");
    let frame = 0;
    const update = () => {
      frame = requestAnimationFrame(update);
      if (document.hidden) return;
      const pose = readPose(), location = mapLocation(current, pose);
      const transform = `translate(${point(location[0], location[2], bounds).join(" ")})`;
      if (node.getAttribute("transform") !== transform) {
        node.setAttribute("transform", transform);
        node.dataset.x = String(location[0]); node.dataset.z = String(location[2]);
      }
      if (arrow && pose) {
        const rotation = `rotate(${180 - pose.heading * 180 / Math.PI})`;
        if (arrow.getAttribute("transform") !== rotation) arrow.setAttribute("transform", rotation);
      }
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [bounds, current, readPose]);
  const label = language === "ja" ? "あなた" : "You", width = mapLabelWidth(label);
  return <g ref={marker} className="v-map-player" data-x={x} data-z={z} transform={`translate(${point(x, z, bounds).join(" ")})`}>
    <g transform={`scale(${mini ? 1 : scale})`}>
      <title>{label}</title>
      <circle r={mini ? 24 : 22} fill="#fff9e9" opacity=".8" />
      <path className="v-map-self-icon" d="M0-18 16 0 0 18-16 0Z" fill="#b17b29" stroke="#fff9e9" strokeWidth="2.5" />
      <path d="M0-10 5 5 0 2-5 5Z" fill="#fff9e9" />
      {heading !== undefined && <path className="v-map-heading" d="M0-29-5-22H5Z" fill="#805817" transform={`rotate(${180 - heading * 180 / Math.PI})`} />}
      {!mini && <g className="v-map-self-label"><rect x={-width / 2} y="-56" width={width} height="24" rx="5" /><text data-map-self-label y="-40" textAnchor="middle">{label}</text></g>}
    </g>
  </g>;
}

export function VillageMinimap({ scenery, current, language, readPose, readActors, expand }: {
  scenery?: MapScenery; current: PlaceId | null; language: "en" | "ja"; readPose: () => MapPose; readActors?: () => MapActor[]; expand: () => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const svg = button.current?.querySelector("svg.v-map-art");
    const marker = svg?.querySelector(".v-map-player"), heading = svg?.querySelector(".v-map-heading");
    if (!svg || !marker) return;
    const bounds = mapBounds(scenery);
    let frameId = 0, previous: MapPose = null;
    const update = () => {
      frameId = requestAnimationFrame(update);
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
  return <ShortcutButton ref={button} className="v-minimap" aria-label={language === "ja" ? "村の地図を広げる" : "Expand village map"} aria-keyshortcuts="M" onClick={expand}>
    <MapArtwork scenery={scenery} current={current} position={readPose()} language={language} readActors={readActors} mini />
    <span className="v-minimap-north" aria-hidden="true">N<span>↑</span></span>
    <span className="v-minimap-caption"><Keycap aria-hidden="true">M</Keycap>{language === "ja" ? "地図" : "Map"}<ArrowUpRight size={15} aria-hidden="true" /></span>
  </ShortcutButton>;
}

export function VillageMap({ scenery, current, position, language, notice, travel, travelOutdoor, readActors, readPose }: {
  scenery?: MapScenery; current: PlaceId | null; position: MapPose; language: "en" | "ja"; notice: string; travel: (id: PlaceId) => void; travelOutdoor: (id: string) => void; readActors?: () => MapActor[]; readPose?: () => MapPose;
}) {
  const ja = language === "ja";
  const actors = useMapActors(readActors);
  const [selected, setSelected] = useState<string>(current ?? "focus");
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const canvas = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setCanvasSize({ width: element.clientWidth, height: element.clientHeight }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const bounds = useMemo(() => {
    const world = mapBounds(scenery);
    if (!canvasSize.width || !canvasSize.height) return world;
    // Zoom in 18% while keeping the map geography and markers on one shared projection.
    const scale = Math.max(world.width / Math.max(1, canvasSize.width - 48), world.height / Math.max(1, canvasSize.height - 176)) / 1.18;
    const width = canvasSize.width * scale, height = canvasSize.height * scale;
    return { x: world.x - (width - world.width) / 2, z: world.z - (height - world.height) / 2, width, height };
  }, [scenery, canvasSize]);
  const destinations = useMemo(() => [
    ...PLACES.map((place, i) => ({ id: place.id as string, position: place.id === "compliment" ? scenery?.layout.items?.find(item => item.visible && item.asset === "postbox")?.position ?? place.position : place.position, name: place.name, japanese: JAPANESE_PLACE_NAMES[i], Icon: icons[i], outdoor: false })).filter(place => place.id !== "mood"),
    ...outdoorMapDestinations(scenery?.layout).filter((place, i, list) => place.kind !== "swing" || i === list.findIndex(item => item.kind === "swing")).map(place => ({ ...place,
      name: place.kind === "swing" ? "Meadow Swings" : place.name, japanese: place.kind === "swing" ? "草原のブランコ" : place.japanese,
      position: [place.x, 0, place.z], Icon: place.kind === "tower" ? CastleTurret : place.kind === "owls" ? Bird : place.kind === "circuit" ? Timer : Leaf, outdoor: true })),
  ], [scenery]);
  const location = mapLocation(current, position);
  const labelOffsets = useMemo(() => placeMapLabels(destinations.map(place => ({
    x: (place.position[0] - bounds.x) / bounds.width * canvasSize.width,
    y: (place.position[2] - bounds.z) / bounds.height * canvasSize.height,
    name: ja ? place.japanese : place.name,
  })), canvasSize, destinations.findIndex(place => place.id === selected), [
    { x: location[0], z: location[2], name: ja ? "あなた" : "You", self: true },
    ...(readActors?.() ?? actors).map(actor => ({ ...actor, self: false })),
  ].map(player => {
    const width = Math.max(player.self ? 44 : 28, mapLabelWidth(player.name));
    return { x: (player.x - bounds.x) / bounds.width * canvasSize.width - width / 2,
      y: (player.z - bounds.z) / bounds.height * canvasSize.height - (player.self ? 56 : 44),
      width, height: player.self ? 78 : 58 };
  })), [actors, bounds, canvasSize, destinations, ja, location[0], location[2], readActors, selected]);
  const destination = destinations.find(place => place.id === selected) ?? destinations[0];
  const name = (id: string) => { const place = destinations.find(place => place.id === id) ?? destinations[0]; return ja ? place.japanese : place.name; };
  const go = (id: string) => {
    if (destinations.find(place => place.id === id)?.outdoor) travelOutdoor(id);
    else travel(id as PlaceId);
  };
  const keybindings = useContext(KeybindingContext);
  const move = (dx: number, dz: number) => {
    const origin = destination.position;
    const candidates = destinations.filter(place => place.id !== selected).map(place => {
      const x = place.position[0] - origin[0], z = place.position[2] - origin[2];
      return { place, forward: x * dx + z * dz, score: Math.hypot(x, z) + Math.abs(x * dz - z * dx) * 1.8 };
    }).filter(candidate => candidate.forward > .1).sort((a, b) => a.score - b.score);
    const next = candidates[0]?.place;
    if (next) { setSelected(next.id); buttons.current.get(next.id)?.focus(); }
  };
  return <div className="v-map" onKeyDown={event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing ||
      (event.target instanceof Element && event.target.closest("input, textarea, select"))) return;
    const direction = ({ w: [0, -1], ArrowUp: [0, -1], a: [-1, 0], ArrowLeft: [-1, 0], s: [0, 1], ArrowDown: [0, 1], d: [1, 0], ArrowRight: [1, 0] } as Record<string, number[]>)[event.key.startsWith("Arrow") ? event.key : gameKey(keybindings, event.key)];
    if (direction) { event.preventDefault(); move(direction[0], direction[1]); }
  }}>
    <div ref={canvas} className="v-map-canvas" role="group" aria-label={ja ? "村の目的地" : "Village destinations"}>
      <MapArtwork scenery={scenery} current={current} position={position} language={language} readActors={readActors} viewportBounds={bounds} />
      <span className="v-map-north" aria-hidden="true">N ↑</span>
      {destinations.map((place, i) => {
        const Icon = place.Icon, label = labelOffsets[i];
        return <div className="v-map-pin" key={place.id} style={{ left: `${(place.position[0] - bounds.x) / bounds.width * 100}%`, top: `${(place.position[2] - bounds.z) / bounds.height * 100}%` }}>
          <button ref={button => { if (button) buttons.current.set(place.id, button); else buttons.current.delete(place.id); }}
            className={`v-map-marker v-map-marker-${place.id}${selected === place.id ? " is-selected" : ""}`} style={{ left: 0, top: 0 }}
            aria-label={name(place.id)} aria-current={current === place.id ? "location" : undefined}
            data-map-destination={place.id} data-map-x={place.position[0]} data-map-z={place.position[2]} onFocus={() => setSelected(place.id)} onPointerMove={() => setSelected(place.id)} onClick={() => go(place.id)}>
            <span className="v-map-marker-icon"><Icon size={22} aria-hidden="true" /></span><span className="v-map-marker-name" style={{ marginBottom: label.rise, visibility: label.visible ? "visible" : "hidden" }}>{name(place.id)}</span>
          </button>
        </div>;
      })}
      <svg className="v-map-actors" viewBox={`0 0 ${bounds.width * 10} ${bounds.height * 10}`} aria-hidden="true">
        <MapActors actors={actors} readActors={readActors} bounds={bounds} mini={false} size={canvasSize} />
        <MapPlayer x={location[0]} z={location[2]} bounds={bounds} heading={!current ? position?.heading : undefined} scale={canvasSize.width ? bounds.width * 10 / canvasSize.width : 1} language={language} readPose={readPose} current={current} />
      </svg>
    </div>
    <div className="v-map-footer">
      <div className="v-map-destination" aria-live="polite"><strong>{name(selected)}</strong>{notice && <span className="v-map-notice" role="status">{notice}</span>}</div>
      <button className="v-button v-primary" onClick={() => go(destination.id)}><Keycap aria-hidden="true">↵</Keycap>{ja ? "ここへ行く" : "Go here"}<ArrowUpRight size={18} /></button>
    </div>
    <p className="v-map-help"><span className="v-map-legend"><i className="v-map-legend-self" />{ja ? "あなた" : "You"}<i className="v-map-legend-visitors" />{ja ? "プレイヤー" : "Players"}</span><span className="v-map-direction-help"><Keycap>W</Keycap><Keycap>A</Keycap><Keycap>S</Keycap><Keycap>D</Keycap>{ja ? "目的地を選ぶ" : "Choose a place"}</span><span><Keycap>M</Keycap>{ja ? "閉じる" : "Close map"}</span></p>
  </div>;
}
