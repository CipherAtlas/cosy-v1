import { useEffect, useState } from "react";
import { BRIDGE, POND, POND_DOCK, riverX } from "./environment";
import { layoutWorldPoint } from "./layoutTransforms";
import type { AuthoredWorld, WorldItem } from "./worldLayout";

import type { MapActor } from "./sharedActors";
import { farmCrop } from "./townShared";
export type MapBounds = { x: number; z: number; width: number; height: number };
const at = (x: number, z: number, bounds: MapBounds) => [(x - bounds.x) * 10, (z - bounds.z) * 10];
const items = (world: AuthoredWorld | undefined, asset: string) => world?.items?.filter(item => item.visible && item.asset === asset) ?? [];
const transform = (item: WorldItem, bounds: MapBounds) => `translate(${at(item.position[0], item.position[2], bounds).join(" ")}) rotate(${-item.rotation[1]}) scale(${item.scale[0]} ${item.scale[2]})`;

export function MapWater({ world, bounds }: { world?: AuthoredWorld; bounds: MapBounds }) {
  const rivers = items(world, "river").map(item => ({ id: item.id, width: 7.2 * Math.max(item.scale[0], item.scale[2]),
    spine: Array.from({ length: 221 }, (_, i) => { const z = i - 110, p = layoutWorldPoint(item, [riverX(z), 0, z], [0, 0, 0]); return [p[0], p[2]]; }) }));
  return <g>
    {[...rivers, ...(world?.rivers ?? [])].map(river => <g key={river.id} data-map-river={river.id}>
      <polyline points={river.spine.map(p => at(p[0], p[1], bounds).join(",")).join(" ")} fill="none" stroke="#eff0ce" strokeWidth={river.width * 10 + 6} strokeLinecap="round" />
      <polyline points={river.spine.map(p => at(p[0], p[1], bounds).join(",")).join(" ")} fill="none" stroke="#87b9b5" strokeWidth={river.width * 10} strokeLinecap="round" />
      <polyline points={river.spine.map(p => at(p[0], p[1], bounds).join(",")).join(" ")} fill="none" stroke="#aed1c4" strokeWidth={river.width * 4} strokeLinecap="round" opacity=".6" />
    </g>)}
    {items(world, "pond").map(item => <g key={item.id} data-map-pond={item.id} transform={transform(item, bounds)}>
      <ellipse rx={POND.rx * 10 + 6} ry={POND.rz * 10 + 6} fill="#ebedce" /><ellipse rx={POND.rx * 10} ry={POND.rz * 10} fill="#86b8b2" />
      <g fill="none" stroke="#d1e5d6" strokeWidth="3" strokeLinecap="round"><path d="M-42 10q18-8 35 0m-25 16q18-8 35 0m-4-53q18-8 35 0" /></g>
    </g>)}
  </g>;
}

export function MapCrossings({ world, bounds }: { world?: AuthoredWorld; bounds: MapBounds }) {
  return <g>{items(world, "bridge").map(item => <g key={item.id} data-map-bridge={item.id} transform={transform(item, bounds)}>
    <rect x={-BRIDGE.length * 5} y={-BRIDGE.width * 5} width={BRIDGE.length * 10} height={BRIDGE.width * 10} rx="4" fill="#c6b593" stroke="#847e62" strokeWidth="3" />
    {[-45, -30, -15, 0, 15, 30, 45].map(x => <path key={x} d={`M${x} -14V14`} stroke="#e9dbb9" strokeWidth="3" />)}
  </g>)}{items(world, "dock").map(item => <rect key={item.id} transform={transform(item, bounds)} x={-POND_DOCK.w * 5} y={-POND_DOCK.d * 5} width={POND_DOCK.w * 10} height={POND_DOCK.d * 10} rx="3" fill="#c6b593" stroke="#847e62" strokeWidth="2" />)}</g>;
}

export function MapTown({ world, bounds, mini, language }: { world?: AuthoredWorld; bounds: MapBounds; mini: boolean; language: "en" | "ja" }) {
  const farms = items(world, "farm-row"), herd = world?.items?.filter(item => item.visible && ["cow-highland", "cow-highland-girl", "sheep", "lamb"].includes(item.asset)) ?? [];
  const farmLabels = farms.filter(item => /row-3$/.test(item.id));
  const ja = language === "ja";
  const pasture = herd.length ? { x: herd.reduce((n, item) => n + item.position[0], 0) / herd.length,
    z: herd.reduce((n, item) => n + item.position[2], 0) / herd.length } : null;
  return <g>
    {pasture && <g data-map-landmark="grazing-field"><ellipse cx={at(pasture.x, pasture.z, bounds)[0]} cy={at(pasture.x, pasture.z, bounds)[1]} rx="125" ry="95" fill="#a7c98b" fillOpacity=".5" stroke="#86a576" strokeWidth="3" strokeDasharray="8 6" />
      {!mini && <text x={at(pasture.x, pasture.z, bounds)[0]} y={at(pasture.x, pasture.z, bounds)[1] + 130} textAnchor="middle" fill="#385840" fontSize="42">{ja ? "放牧地" : "Grazing field"}</text>}</g>}
    {items(world, "horse-racetrack").map(item => <g key={item.id} data-map-landmark="racetrack" transform={transform(item, bounds)}>
      <ellipse rx="240" ry="140" fill="none" stroke="#b8966f" strokeWidth="53" /><ellipse rx="240" ry="140" fill="none" stroke="#e4c78c" strokeWidth="3" strokeDasharray="12 8" /><path d="M0 115V165" stroke="#fff8dc" strokeWidth="5" strokeDasharray="5 5" />
      {!mini && <text y="8" textAnchor="middle" fill="#385840" fontSize="42">{ja ? "柳のサーキット" : "Willow circuit"}</text>}
    </g>)}
    {items(world, "horse-stable").map(item => <g key={item.id} data-map-landmark="stable" transform={transform(item, bounds)}><rect x="-55" y="-34" width="110" height="68" rx="5" fill="#719887" stroke="#426750" strokeWidth="3" /><path d="M-50 0H50" stroke="#e3d0a0" strokeWidth="3" />{!mini && <text y="67" textAnchor="middle" fill="#385840" fontSize="38">{ja ? "馬小屋" : "Hay stable"}</text>}</g>)}
    {farms.map(item => <g key={item.id} data-map-landmark="farm-row" transform={transform(item, bounds)}><rect x="-83.5" y="-11" width="167" height="22" rx="4" fill="#ad9972" stroke="#806f51" strokeWidth="2" />{[-45, -25, -5, 15, 35, 50].map(x => <path key={x} d={`M${x} -6V6`} stroke="#65834f" strokeWidth="5" />)}</g>)}
    {!mini && farmLabels.map(item => { const crop = farmCrop(item); return <text key={item.id} x={at(item.position[0], item.position[2], bounds)[0]} y={at(item.position[0], item.position[2], bounds)[1] - 96} textAnchor="middle" fill="#385840" fontSize="42">{ja ? crop === "carrot" ? "ニンジン畑" : crop === "radish" ? "ラディッシュ畑" : crop === "mint" ? "ミント畑" : "畑" : crop ? `${crop[0].toUpperCase()}${crop.slice(1)} farm` : "Farm"}</text>; })}
    {items(world, "owl-feeding-perch").map(item => <g key={item.id} data-map-landmark="owl-grove" transform={transform(item, bounds)}><circle r="26" fill="#ede2bd" stroke="#706e4d" strokeWidth="3" /><path d="M-15-11-7-19 0-13 7-19 15-11V11Q0 23-15 11Z" fill="#846f50" /><circle cx="-6" cy="-2" r="4" fill="#fff5cc" /><circle cx="6" cy="-2" r="4" fill="#fff5cc" />{!mini && <text y="-40" textAnchor="middle" fill="#385840" fontSize="42">{ja ? "フクロウの木立" : "Owl grove"}</text>}</g>)}
  </g>;
}

export function MapActors({ readActors, bounds, mini }: { readActors?: () => MapActor[]; bounds: MapBounds; mini: boolean }) {
  const [actors, setActors] = useState<MapActor[]>(() => readActors?.() ?? []);
  useEffect(() => {
    if (!readActors) return;
    const update = () => { if (!document.hidden) setActors(readActors()); };
    update(); const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [readActors]);
  return <g>{actors.map(actor => <g key={actor.id} data-map-actor={actor.id} data-map-kind={actor.kind} transform={`translate(${at(actor.x, actor.z, bounds).join(" ")})`}>
    <title>{actor.name}</title>
    <circle r={mini ? 12 : 13} fill={actor.color} stroke="#fff9e9" strokeWidth="3" />
    {actor.kind === "puppy" ? <g fill="#4c5d44"><ellipse cy="3" rx="5" ry="4" />{[-6, 0, 6].map((x, i) => <circle key={x} cx={x} cy={i === 1 ? -6 : -3} r="2.5" />)}</g> : <path d="M-4 3Q0 7 4 3M-4-3h.1M4-3h.1" stroke="#426953" fill="none" strokeWidth="2" strokeLinecap="round" />}
    {!mini && <text y="-21" textAnchor="middle" fill="#284637" stroke="#e8edcf" strokeWidth="3" paintOrder="stroke" fontSize="34">{actor.name}</text>}
  </g>)}</g>;
}
