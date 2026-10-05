// Labels use screen pixels so names stay readable at every atlas scale.
export function mapLabelWidth(name: string) {
  return Math.max(44, Array.from(name).reduce((width, letter) => width + (/[^\x00-\x7f]/.test(letter) ? 14 : 8), 0) + 18);
}

export function mapBoxesOverlap(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width + 6 && a.x + a.width + 6 > b.x && a.y < b.y + b.height + 6 && a.y + a.height + 6 > b.y;
}

export function placeMapLabels(points: { x: number; y: number; name: string }[], size: { width: number; height: number }, selected: number,
  players: { x: number; y: number; width: number; height: number }[]) {
  const boxes = [...players, ...points.map(point => ({ x: point.x - 23, y: point.y - 23, width: 46, height: 46 }))];
  const labels: { rise: number; visible: boolean }[] = Array(points.length);
  const ordered = points.map((point, index) => ({ ...point, index })).sort((a, b) =>
    a.index === selected ? -1 : b.index === selected ? 1 : a.y - b.y);
  for (const point of ordered) {
    const width = mapLabelWidth(point.name);
    let best = { rise: 0, visible: point.index === selected };
    for (let rise = 0; point.index !== selected && rise <= 60; rise += 30) {
      const box = { x: point.x - width / 2, y: point.y - 57 - rise, width, height: 28 };
      if (box.x < 12 || box.x + width > size.width - 12 || box.y < 64 || boxes.some(other => mapBoxesOverlap(box, other))) continue;
      best = { rise, visible: true }; break;
    }
    if (best.visible) boxes.push({ x: point.x - width / 2, y: point.y - 57 - best.rise, width, height: 28 });
    labels[point.index] = best;
  }
  return labels;
}
