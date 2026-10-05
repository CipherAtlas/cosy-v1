import { useEffect, useRef, useState } from "react";
import { BRIDGE, POND, POND_DOCK, riverX } from "./environment";
import { layoutWorldPoint } from "./layoutTransforms";
import type { AuthoredWorld, WorldItem } from "./worldLayout";

import type { MapActor } from "./sharedActors";
import { mapLabelWidth } from "./mapLabels";
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

export function MapTown({ world, bounds }: { world?: AuthoredWorld; bounds: MapBounds }) {
  const farms = items(world, "farm-row"), herd = world?.items?.filter(item => item.visible && ["cow-highland", "cow-highland-girl", "sheep", "lamb"].includes(item.asset)) ?? [];
  const pasture = herd.length ? { x: herd.reduce((n, item) => n + item.position[0], 0) / herd.length,
    z: herd.reduce((n, item) => n + item.position[2], 0) / herd.length } : null;
  return <g>
    {pasture && <g data-map-landmark="grazing-field"><ellipse cx={at(pasture.x, pasture.z, bounds)[0]} cy={at(pasture.x, pasture.z, bounds)[1]} rx="125" ry="95" fill="#a7c98b" fillOpacity=".5" stroke="#86a576" strokeWidth="3" strokeDasharray="8 6" /></g>}
    {items(world, "horse-racetrack").map(item => <g key={item.id} data-map-landmark="racetrack" transform={transform(item, bounds)}>
      <ellipse rx="240" ry="140" fill="none" stroke="#b8966f" strokeWidth="53" /><ellipse rx="240" ry="140" fill="none" stroke="#e4c78c" strokeWidth="3" strokeDasharray="12 8" /><path d="M0 115V165" stroke="#fff8dc" strokeWidth="5" strokeDasharray="5 5" />
    </g>)}
    {items(world, "horse-stable").map(item => <g key={item.id} data-map-landmark="stable" transform={transform(item, bounds)}><rect x="-55" y="-34" width="110" height="68" rx="5" fill="#719887" stroke="#426750" strokeWidth="3" /><path d="M-50 0H50" stroke="#e3d0a0" strokeWidth="3" /></g>)}
    {farms.map(item => <g key={item.id} data-map-landmark="farm-row" transform={transform(item, bounds)}><rect x="-83.5" y="-11" width="167" height="22" rx="4" fill="#ad9972" stroke="#806f51" strokeWidth="2" />{[-45, -25, -5, 15, 35, 50].map(x => <path key={x} d={`M${x} -6V6`} stroke="#65834f" strokeWidth="5" />)}</g>)}
    {items(world, "owl-feeding-perch").map(item => <g key={item.id} data-map-landmark="owl-grove" transform={transform(item, bounds)}><circle r="26" fill="#ede2bd" stroke="#706e4d" strokeWidth="3" /><path d="M-15-11-7-19 0-13 7-19 15-11V11Q0 23-15 11Z" fill="#846f50" /><circle cx="-6" cy="-2" r="4" fill="#fff5cc" /><circle cx="6" cy="-2" r="4" fill="#fff5cc" /></g>)}
  </g>;
}

export function useMapActors(readActors?: () => MapActor[]) {
  const [actors, setActors] = useState<MapActor[]>(() => readActors?.() ?? []);
  useEffect(() => {
    if (!readActors) return;
    const update = () => {
      if (document.hidden) return;
      const next = readActors();
      setActors(previous => previous.length === next.length && previous.every((actor, i) =>
        actor.id === next[i].id && actor.name === next[i].name && actor.color === next[i].color) ? previous : next);
    };
    update(); const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [readActors]);
  return actors;
}

export function MapActors({ actors, readActors, bounds, mini, size }: { actors: MapActor[]; readActors?: () => MapActor[]; bounds: MapBounds; mini: boolean; size?: { width: number; height: number } }) {
  const root = useRef<SVGGElement>(null);
  useEffect(() => {
    if (!readActors || !root.current) return;
    const nodes = new Map([...root.current.querySelectorAll<SVGGElement>("[data-map-actor]")].map(node => [node.dataset.mapActor!, node]));
    let frame = 0;
    const update = () => {
      frame = requestAnimationFrame(update);
      if (document.hidden) return;
      for (const actor of readActors()) {
        const node = nodes.get(actor.id);
        if (!node) continue;
        const transform = `translate(${at(actor.x, actor.z, bounds).join(" ")})`;
        if (node.getAttribute("transform") !== transform) node.setAttribute("transform", transform);
      }
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [actors, bounds, readActors]);
  const scale = size?.width ? bounds.width * 10 / size.width : 1;
  return <g ref={root}>{actors.map(actor => {
    const width = mapLabelWidth(actor.name);
    return <g key={actor.id} data-map-actor={actor.id} data-map-kind={actor.kind} transform={`translate(${at(actor.x, actor.z, bounds).join(" ")})`}>
      <title>{actor.name}</title>
      <g transform={`scale(${mini ? 1 : scale})`}>
        <circle className="v-map-actor-dot" r={mini ? 21 : 14} fill={actor.color} stroke="#fff9e9" strokeWidth="2.5" />
        <path d="M0-8C-8-1-9 6-4 8H4C9 6 8-1 0-8ZM-3 2h.1M3 2h.1" fill="#fff9e9" stroke="#184d83" strokeWidth="1.5" strokeLinecap="round" />
        {!mini && <g className="v-map-actor-label is-visitor">
          <rect x={-width / 2} y="-44" width={width} height="24" rx="5" />
          <text data-map-label={actor.id} y="-28" textAnchor="middle">{actor.name}</text>
        </g>}
      </g>
    </g>;
  })}</g>;
}
