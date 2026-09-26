import * as T from "three";

/** Small, original painted surfaces. Large color shapes survive mipmapping at distance. */
export function paintedTextures() {
  let seed = 9128;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) | 0) >>> 0) / 4294967296;
  const make = (kind: "wood" | "roof" | "plaster" | "stone" | "meadow" | "path" | "window") => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const c = canvas.getContext("2d")!;
    c.fillStyle = kind === "wood" ? "#c6ac89" : kind === "roof" ? "#647a85" : "#d5d0ba";
    c.fillRect(0, 0, 512, 512);
    if (kind === "window") {
      const light = c.createLinearGradient(0,0,0,512);
      light.addColorStop(0,"#607b99"); light.addColorStop(.55,"#95b6c5"); light.addColorStop(1,"#f9dfae");
      c.fillStyle=light; c.fillRect(0,0,512,512);
      c.fillStyle="#fff9da32";
      c.beginPath();c.moveTo(25,0);c.lineTo(135,0);c.lineTo(360,512);c.lineTo(265,512);c.closePath();c.fill();
      c.fillStyle="#fff9da1c";
      c.beginPath();c.moveTo(180,0);c.lineTo(220,0);c.lineTo(445,512);c.lineTo(405,512);c.closePath();c.fill();
    } else if (kind === "roof") {
      for (let row = -1; row < 9; row++) for (let col = -1; col < 9; col++) {
        const x = col * 64 + (row % 2) * 32, y = row * 64;
        const tone = 56 + random() * 19;
        c.fillStyle = `hsl(205 10% ${tone}%)`;
        c.beginPath(); c.moveTo(x + 2, y); c.lineTo(x + 62, y);
        c.lineTo(x + 60, y + 53); c.quadraticCurveTo(x + 32, y + 77, x + 4, y + 53);
        c.closePath(); c.fill();
        c.strokeStyle = "#324b6160"; c.lineWidth = 2; c.stroke();
        c.beginPath(); c.moveTo(x + 9, y + 48); c.quadraticCurveTo(x + 32, y + 66, x + 54, y + 48);
        c.strokeStyle = "#ebf4f04a"; c.lineWidth = 3; c.stroke();
        c.fillStyle = "#f8f8e610"; c.fillRect(x + 12, y + 9, 7, 30);
      }
    } else if (kind === "stone" || kind === "path") {
      const rows = kind === "stone" ? 5 : 6, h = 512 / rows, w = 128;
      c.fillStyle = "#8e9b9070"; c.fillRect(0, 0, 512, 512);
      for (let row = -1; row <= rows; row++) for (let col = -1; col < 5; col++) {
        const x = col * w + (row % 2) * w * .5, y = row * h;
        c.fillStyle = `hsl(${41 + random() * 10} ${12 + random() * 6}% ${72 + random() * 15}%)`;
        c.beginPath(); c.roundRect(x + 3, y + 3, w - 6, h - 6, 10 + random() * 8); c.fill();
        c.strokeStyle = "#fff8df70"; c.lineWidth = 3;
        c.beginPath(); c.moveTo(x + 16, y + 8); c.lineTo(x + w - 18, y + 8); c.stroke();
        c.fillStyle = "#7f927817";
        c.beginPath(); c.ellipse(x + w * .65, y + h * .7, 36, 7, -.25, 0, Math.PI * 2); c.fill();
      }
    } else if (kind === "wood") {
      for (let board = 0; board < 4; board++) {
        const x = board * 128;
        c.fillStyle = `hsl(32 30% ${66 + random() * 9}%)`; c.fillRect(x, 0, 126, 512);
        c.fillStyle = "#715a4650"; c.fillRect(x + 126, 0, 2, 512);
        for (let line = 0; line < 8; line++) {
          c.beginPath(); const xx = x + 8 + line * 15;
          c.moveTo(xx, 0); c.bezierCurveTo(xx + 12, 160, xx - 16, 340, xx, 512);
          c.strokeStyle = line % 3 ? "#7a614526" : "#ffedc133"; c.lineWidth = 2 + random() * 3; c.stroke();
        }
      }
    }
    // Low-contrast brush marks, wrapped around every edge to avoid seams.
    for (let i = 0; i < 240; i++) {
      const x = random() * 512, y = random() * 512, rx = 7 + random() * 28, ry = 2 + random() * 9;
      c.fillStyle = i % 2 ? "#fffde60a" : "#4b715507";
      for (const dx of [-512, 0, 512]) for (const dy of [-512, 0, 512]) {
        c.beginPath(); c.ellipse(x + dx, y + dy, rx, ry, -.3, 0, Math.PI * 2); c.fill();
      }
    }
    const texture = new T.CanvasTexture(canvas);
    texture.name = `painted-${kind}`;
    texture.colorSpace = T.SRGBColorSpace;
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.anisotropy = 4;
    return texture;
  };
  return { wood: make("wood"), roof: make("roof"), plaster: make("plaster"),
    stone: make("stone"), meadow: make("meadow"), path: make("path"), window: make("window") };
}
