/** Shared canvas treatment for kitchen beds and authored farm rows. */
export function drawGardenGrowthClock(canvas: HTMLCanvasElement, text: string, progress: number) {
  const c = canvas.getContext("2d")!;
  c.clearRect(0, 0, 192, 192); c.fillStyle = "#faf3de";
  c.beginPath(); c.arc(96, 96, 84, 0, Math.PI * 2); c.fill();
  c.lineWidth = 9; c.strokeStyle = "#d7dfc6"; c.beginPath(); c.arc(96, 96, 69, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = "#537850"; c.lineCap = "round"; c.beginPath(); c.arc(96, 96, 69, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress); c.stroke();
  c.fillStyle = "#36573d"; c.font = "43px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(text, 96, 99);
}
