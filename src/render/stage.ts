import { BARN, BARN_DEEP, CARROT, CREAM, CREAM_DEEP, INK, STRAW_DEEP } from "../palette";

// Arenas. Each one is painted once into a few off-screen layers (far, mid, floor) that
// scroll at different speeds behind the fight. Flat shapes only, to match the chickens.
// The band the fighters stand in front of is kept mid-to-dark so pale feathers stand out.

export const VIEW_H = 360;
/** Screen y of the ground line the fighters stand on. */
export const GROUND_Y = 300;
const FLOOR_TOP = 262;

type Ctx = CanvasRenderingContext2D;

interface StageArt {
  id: string;
  name: string;
  /** Fills the whole view; does not scroll. */
  sky(ctx: Ctx, w: number): void;
  far(ctx: Ctx, w: number): void;
  mid(ctx: Ctx, w: number): void;
  floor(ctx: Ctx, w: number): void;
  /** Drifting clouds: start (0 to 1 across the view), height, size, colour. */
  clouds?: [number, number, number, string][];
  /** Hanging lanterns that sway, as fractions of the mid layer's width. */
  lanterns?: number[];
  /** Where the spectators sit, in the mid layer's coordinates. */
  perches(w: number): [number, number][];
}

const FAR = 0.25;
export const MID = 0.55;

/** Width a layer needs so every camera position, in every view width, is covered. */
export const layerWidth = (p: number) => Math.ceil(Math.max(420 * p + 480, 260 * p + 640)) + 2;

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}

function blob(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function vGradient(ctx: Ctx, y0: number, y1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [at, color] of stops) g.addColorStop(at, color);
  return g;
}

/** Cheap repeatable noise so scattered details stay put between repaints. */
function scatter(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function hills(ctx: Ctx, w: number, y: number, amp: number, period: number, phase: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(0, VIEW_H);
  for (let x = 0; x <= w + 8; x += 8) ctx.lineTo(x, y - Math.sin(x / period + phase) * amp - Math.sin(x / (period * 0.37) + phase * 2) * amp * 0.3);
  ctx.lineTo(w + 8, VIEW_H);
  ctx.closePath();
  ctx.fill();
}

function cloud(ctx: Ctx, x: number, y: number, s: number, fill: string) {
  blob(ctx, x, y, 26 * s, 10 * s, fill);
  blob(ctx, x - 14 * s, y - 6 * s, 14 * s, 9 * s, fill);
  blob(ctx, x + 8 * s, y - 9 * s, 16 * s, 11 * s, fill);
}

function fence(ctx: Ctx, w: number, y: number, post: string, rail: string) {
  rect(ctx, 0, y + 8, w, 5, rail);
  rect(ctx, 0, y + 22, w, 5, rail);
  for (let x = 6; x < w; x += 34) {
    ctx.fillStyle = post;
    ctx.beginPath();
    ctx.moveTo(x, y + 40);
    ctx.lineTo(x, y + 4);
    ctx.lineTo(x + 4, y);
    ctx.lineTo(x + 8, y + 4);
    ctx.lineTo(x + 8, y + 40);
    ctx.closePath();
    ctx.fill();
  }
}

function hayBale(ctx: Ctx, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "#b98a2c";
  ctx.beginPath();
  ctx.roundRect(x, y - h, w, h, 5);
  ctx.fill();
  ctx.fillStyle = "#96701f";
  for (let i = 1; i < 4; i++) ctx.fillRect(x + (w * i) / 4 - 1, y - h, 2, h);
  rect(ctx, x, y - h * 0.58, w, 3, BARN_DEEP);
}

function strawBits(ctx: Ctx, w: number, seed: number, color: string, n: number) {
  const r = scatter(seed);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = r() * w;
    const y = FLOOR_TOP + 8 + r() * (VIEW_H - FLOOR_TOP - 12);
    const a = r() * Math.PI;
    const len = 4 + r() * 6;
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len * 0.35);
  }
  ctx.stroke();
}

const barnyard: StageArt = {
  id: "barnyard",
  name: "The barnyard",
  clouds: [[0.1, 60, 1.2, CREAM], [0.45, 96, 0.8, "#eef5e6"], [0.8, 124, 1, CREAM]],
  perches: (w) => {
    const bx = w * 0.5 - 110;
    return [[bx - 104, 236], [bx - 72, 208], [bx + 366, 236], [bx + 392, 236], [46, 240], [w - 60, 240]];
  },
  sky(ctx, w) {
    rect(ctx, 0, 0, w, VIEW_H, "#000");
    ctx.fillStyle = vGradient(ctx, 0, 230, [[0, "#6fb3c9"], [1, "#bfe0d2"]]);
    ctx.fillRect(0, 0, w, VIEW_H);
    blob(ctx, w * 0.78, 58, 40, 40, "#f7dc8a");
    blob(ctx, w * 0.78, 58, 27, 27, CREAM);
  },
  far(ctx, w) {
    hills(ctx, w, 176, 16, 90, 0.4, "#6ea86f");
    hills(ctx, w, 196, 12, 60, 2.1, "#4f8f61");
    // A windmill on the ridge.
    const x = w * 0.3;
    rect(ctx, x - 3, 136, 6, 46, CREAM_DEEP);
    ctx.strokeStyle = CREAM;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = 0.4 + (i * Math.PI) / 2;
      ctx.moveTo(x, 138);
      ctx.lineTo(x + Math.cos(a) * 20, 138 + Math.sin(a) * 20);
    }
    ctx.stroke();
    for (const tx of [0.08, 0.62, 0.7, 0.93]) {
      blob(ctx, w * tx, 178, 16, 20, "#2f7a55");
      rect(ctx, w * tx - 2, 186, 4, 16, "#5a3421");
    }
  },
  mid(ctx, w) {
    hills(ctx, w, 232, 5, 120, 1, "#3f7f5a");
    // The barn.
    const bx = w * 0.5 - 110;
    rect(ctx, bx, 120, 220, 150, BARN);
    ctx.fillStyle = BARN_DEEP;
    ctx.beginPath();
    ctx.moveTo(bx - 14, 124);
    ctx.lineTo(bx + 40, 70);
    ctx.lineTo(bx + 180, 70);
    ctx.lineTo(bx + 234, 124);
    ctx.closePath();
    ctx.fill();
    rect(ctx, bx, 120, 220, 6, CREAM);
    // Hayloft window and the big door.
    rect(ctx, bx + 94, 86, 32, 26, "#3f2316");
    rect(ctx, bx + 92, 84, 36, 3, CREAM);
    rect(ctx, bx + 70, 170, 80, 100, "#8f2c22");
    ctx.strokeStyle = CREAM;
    ctx.lineWidth = 4;
    ctx.strokeRect(bx + 70, 170, 80, 100);
    ctx.beginPath();
    ctx.moveTo(bx + 70, 170);
    ctx.lineTo(bx + 150, 270);
    ctx.moveTo(bx + 150, 170);
    ctx.lineTo(bx + 70, 270);
    ctx.stroke();
    // Silo.
    const sx = bx + 262;
    rect(ctx, sx, 110, 46, 160, "#9aa3a0");
    blob(ctx, sx + 23, 110, 23, 16, "#7c8684");
    for (let y = 136; y < 262; y += 26) rect(ctx, sx, y, 46, 3, "#7c8684");
    // Trough and bales.
    hayBale(ctx, bx - 120, 268, 54, 32);
    hayBale(ctx, bx - 96, 238, 50, 30);
    hayBale(ctx, bx + 350, 268, 56, 32);
    fence(ctx, w, 232, "#6b4028", "#7d4d30");
  },
  floor(ctx, w) {
    ctx.fillStyle = vGradient(ctx, FLOOR_TOP, VIEW_H, [[0, "#a2744a"], [1, "#74502f"]]);
    ctx.fillRect(0, FLOOR_TOP, w, VIEW_H - FLOOR_TOP);
    rect(ctx, 0, FLOOR_TOP, w, 4, "#b98a5c");
    const r = scatter(7);
    for (let i = 0; i < 46; i++) {
      // Grass tufts along the back edge.
      const x = r() * w;
      ctx.fillStyle = r() < 0.5 ? "#3f7f5a" : "#4f8f61";
      ctx.beginPath();
      ctx.moveTo(x - 5, FLOOR_TOP + 2);
      ctx.lineTo(x - 2, FLOOR_TOP - 6 - r() * 4);
      ctx.lineTo(x, FLOOR_TOP + 1);
      ctx.lineTo(x + 3, FLOOR_TOP - 8 - r() * 4);
      ctx.lineTo(x + 6, FLOOR_TOP + 2);
      ctx.closePath();
      ctx.fill();
    }
    strawBits(ctx, w, 11, "#c9a25a", 90);
    for (let i = 0; i < 26; i++) blob(ctx, r() * w, FLOOR_TOP + 10 + r() * 80, 2 + r() * 2.5, 1.2 + r(), "#6a4829");
  },
};

const cornfield: StageArt = {
  id: "cornfield",
  name: "Cornfield at dusk",
  clouds: [[0.05, 70, 1.3, "#7a4160"], [0.6, 110, 1, "#c7634f"]],
  perches: (w) => [[w * 0.3 - 28, 176], [w * 0.3 + 27, 176], [w * 0.74 + 49, 190], [w * 0.74 + 16, 214]],
  sky(ctx, w) {
    ctx.fillStyle = vGradient(ctx, 0, 240, [[0, "#4a2f5a"], [0.45, "#b8514a"], [0.8, "#f0914b"], [1, "#f7c66b"]]);
    ctx.fillRect(0, 0, w, VIEW_H);
    blob(ctx, w * 0.5, 214, 64, 64, "#f9d27a");
    blob(ctx, w * 0.5, 214, 46, 46, "#fff0c2");
  },
  far(ctx, w) {
    hills(ctx, w, 206, 10, 110, 0.9, "#5b2f45");
    // Farmhouse and power line in silhouette.
    const x = w * 0.72;
    ctx.fillStyle = "#3d2136";
    ctx.fillRect(x, 176, 50, 34);
    ctx.beginPath();
    ctx.moveTo(x - 6, 178);
    ctx.lineTo(x + 25, 156);
    ctx.lineTo(x + 56, 178);
    ctx.closePath();
    ctx.fill();
    rect(ctx, x + 36, 158, 7, 16, "#3d2136");
    rect(ctx, x + 10, 188, 9, 9, "#f7c66b");
    ctx.strokeStyle = "#3d2136";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let px = 20; px < w; px += 120) {
      ctx.moveTo(px, 214);
      ctx.lineTo(px, 150);
      ctx.moveTo(px - 10, 158);
      ctx.lineTo(px + 10, 158);
      ctx.moveTo(px, 158);
      ctx.quadraticCurveTo(px + 60, 176, px + 120, 158);
    }
    ctx.stroke();
    hills(ctx, w, 222, 6, 70, 2.6, "#3d2136");
  },
  mid(ctx, w) {
    const r = scatter(23);
    // Two ranks of corn, the back one paler.
    for (const [yBase, tall, stalk, leaf] of [[262, 96, "#3b5a34", "#4c7040"], [272, 118, "#2c4729", "#39592f"]] as const) {
      for (let x = -6; x < w + 10; x += 15) {
        const h = tall * (0.82 + r() * 0.3);
        const lean = (r() - 0.5) * 8;
        ctx.strokeStyle = stalk;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(x, yBase);
        ctx.quadraticCurveTo(x + lean * 0.4, yBase - h * 0.5, x + lean, yBase - h);
        ctx.stroke();
        ctx.fillStyle = leaf;
        for (let k = 0; k < 4; k++) {
          const ly = yBase - h * (0.25 + k * 0.2);
          const side = k % 2 === 0 ? 1 : -1;
          ctx.beginPath();
          ctx.moveTo(x, ly);
          ctx.quadraticCurveTo(x + side * 12, ly - 12, x + side * 20, ly + 2);
          ctx.quadraticCurveTo(x + side * 10, ly - 4, x, ly + 3);
          ctx.fill();
        }
        if (r() < 0.45) blob(ctx, x + 4, yBase - h * 0.55, 3, 7, STRAW_DEEP);
      }
    }
    // Scarecrow.
    const sx = w * 0.3;
    rect(ctx, sx - 2, 150, 5, 122, "#5a3421");
    rect(ctx, sx - 34, 176, 70, 5, "#5a3421");
    ctx.fillStyle = "#8f3a2c";
    ctx.beginPath();
    ctx.moveTo(sx - 30, 172);
    ctx.lineTo(sx + 30, 172);
    ctx.lineTo(sx + 16, 226);
    ctx.lineTo(sx - 16, 226);
    ctx.closePath();
    ctx.fill();
    blob(ctx, sx, 160, 12, 12, "#d8b77a");
    ctx.fillStyle = "#3f2316";
    ctx.beginPath();
    ctx.moveTo(sx - 20, 152);
    ctx.lineTo(sx + 20, 152);
    ctx.lineTo(sx + 9, 150);
    ctx.lineTo(sx + 6, 134);
    ctx.lineTo(sx - 6, 134);
    ctx.lineTo(sx - 9, 150);
    ctx.closePath();
    ctx.fill();
    // Tractor.
    const tx = w * 0.74;
    rect(ctx, tx, 214, 66, 30, "#8f2c22");
    rect(ctx, tx + 34, 190, 30, 28, BARN_DEEP);
    rect(ctx, tx + 40, 196, 18, 14, "#f7c66b");
    rect(ctx, tx + 8, 198, 5, 18, "#3f2316");
    blob(ctx, tx + 50, 250, 22, 22, INK);
    blob(ctx, tx + 50, 250, 9, 9, STRAW_DEEP);
    blob(ctx, tx + 10, 258, 13, 13, INK);
    blob(ctx, tx + 10, 258, 5, 5, STRAW_DEEP);
  },
  floor(ctx, w) {
    ctx.fillStyle = vGradient(ctx, FLOOR_TOP, VIEW_H, [[0, "#7c4f35"], [1, "#4f2e1e"]]);
    ctx.fillRect(0, FLOOR_TOP, w, VIEW_H - FLOOR_TOP);
    rect(ctx, 0, FLOOR_TOP, w, 4, "#99613f");
    // Furrows.
    ctx.strokeStyle = "#633c27";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let y = FLOOR_TOP + 18; y < VIEW_H; y += 20) {
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 30) ctx.quadraticCurveTo(x + 15, y + 3, x + 30, y);
    }
    ctx.stroke();
    strawBits(ctx, w, 31, "#b98a2c", 60);
  },
};

const henhouse: StageArt = {
  id: "henhouse",
  name: "The henhouse, after dark",
  lanterns: [0.2, 0.5, 0.8],
  perches: () => [[129, 160], [519, 160], [207, 224], [597, 224]],
  sky(ctx, w) {
    rect(ctx, 0, 0, w, VIEW_H, "#3a2014");
  },
  far(ctx, w) {
    // Plank wall with two windows onto the night.
    rect(ctx, 0, 0, w, VIEW_H, "#4d2c1b");
    ctx.fillStyle = "#42251a";
    for (let x = 0; x < w; x += 44) ctx.fillRect(x, 0, 3, VIEW_H);
    const r = scatter(5);
    for (let i = 0; i < 20; i++) blob(ctx, r() * w, r() * 240, 3, 5, "#3f2316");
    for (const wx of [w * 0.22, w * 0.76]) {
      rect(ctx, wx - 44, 60, 88, 78, "#6b4028");
      rect(ctx, wx - 38, 66, 76, 66, "#1f3350");
      blob(ctx, wx + 14, 90, 13, 13, CREAM);
      blob(ctx, wx + 20, 86, 11, 11, "#1f3350");
      for (let i = 0; i < 7; i++) blob(ctx, wx - 34 + r() * 68, 70 + r() * 56, 1.2, 1.2, CREAM_DEEP);
      rect(ctx, wx - 2, 66, 4, 66, "#6b4028");
      rect(ctx, wx - 38, 97, 76, 4, "#6b4028");
    }
    // Rafters.
    rect(ctx, 0, 30, w, 10, "#3a2014");
    ctx.strokeStyle = "#3a2014";
    ctx.lineWidth = 8;
    ctx.beginPath();
    for (let x = -40; x < w; x += 150) {
      ctx.moveTo(x, 34);
      ctx.lineTo(x + 75, 0);
      ctx.moveTo(x + 150, 34);
      ctx.lineTo(x + 75, 0);
    }
    ctx.stroke();
  },
  mid(ctx, w) {
    // Two shelves of nest boxes.
    for (const y of [168, 232]) {
      rect(ctx, 0, y, w, 8, "#7d4d30");
      rect(ctx, 0, y + 8, w, 4, "#3a2014");
      for (let x = 10, i = 0; x < w; x += 78, i++) {
        rect(ctx, x, y - 44, 4, 44, "#6b4028");
        // Straw nest.
        ctx.fillStyle = "#b98a2c";
        ctx.beginPath();
        ctx.ellipse(x + 41, y - 2, 28, 12, 0, Math.PI, 0);
        ctx.fill();
        const kind = (i * 7 + (y > 200 ? 3 : 0)) % 5;
        if (kind === 0 || kind === 3) {
          // A sleeping hen: body, tucked head, comb.
          blob(ctx, x + 41, y - 16, 20, 15, kind === 0 ? CREAM_DEEP : "#b96a36");
          blob(ctx, x + 55, y - 26, 8, 8, kind === 0 ? CREAM_DEEP : "#b96a36");
          blob(ctx, x + 56, y - 34, 4, 3, "#8f2c22");
          rect(ctx, x + 51, y - 26, 5, 1.5, "#3f2316");
        } else if (kind !== 2) {
          for (let e = 0; e < (kind === 1 ? 3 : 2); e++) blob(ctx, x + 30 + e * 11, y - 9, 5, 6.5, CREAM_DEEP);
        }
        ctx.fillStyle = "#96701f";
        ctx.beginPath();
        ctx.ellipse(x + 41, y - 1, 30, 6, 0, 0, Math.PI);
        ctx.fill();
      }
    }
    // A ramp up to the lower shelf and a couple of feed sacks.
    ctx.strokeStyle = "#6b4028";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(w * 0.06, 270);
    ctx.lineTo(w * 0.06 + 70, 236);
    ctx.stroke();
    for (const sx of [w * 0.64, w * 0.9]) {
      ctx.fillStyle = "#c9b48a";
      ctx.beginPath();
      ctx.roundRect(sx, 240, 40, 32, 8);
      ctx.fill();
      rect(ctx, sx + 8, 250, 24, 8, "#8f2c22");
    }
  },
  floor(ctx, w) {
    ctx.fillStyle = vGradient(ctx, FLOOR_TOP, VIEW_H, [[0, "#6f452c"], [1, "#4a2a1a"]]);
    ctx.fillRect(0, FLOOR_TOP, w, VIEW_H - FLOOR_TOP);
    rect(ctx, 0, FLOOR_TOP, w, 4, "#8a5a3a");
    ctx.fillStyle = "#4a2a1a";
    for (let y = FLOOR_TOP + 22; y < VIEW_H; y += 24) ctx.fillRect(0, y, w, 2);
    const r = scatter(9);
    for (let i = 0; i < 30; i++) ctx.fillRect(r() * w, FLOOR_TOP + 4 + Math.floor(r() * 4) * 24, 2, 22);
    strawBits(ctx, w, 17, "#c9a25a", 120);
  },
};

const rooftop: StageArt = {
  id: "rooftop",
  name: "The coop roof at dawn",
  clouds: [[0.2, 64, 1.1, "#d98a8a"], [0.7, 100, 0.9, "#e9a27a"]],
  perches: (w) => [[w * 0.12, 214], [w * 0.2, 214], [w * 0.78, 214], [w * 0.9, 214], [w * 0.55 + 24, 132]],
  sky(ctx, w) {
    ctx.fillStyle = vGradient(ctx, 0, 240, [[0, "#3d3a66"], [0.5, "#a8576b"], [0.85, "#f0a060"], [1, "#f8d27a"]]);
    ctx.fillRect(0, 0, w, VIEW_H);
    blob(ctx, w * 0.26, 216, 58, 58, "#fbd58a");
    blob(ctx, w * 0.26, 216, 42, 42, "#fff0c2");
  },
  far(ctx, w) {
    hills(ctx, w, 204, 12, 100, 0.2, "#5a3d62");
    // A water tower and a far barn against the sunrise.
    const x = w * 0.68;
    ctx.fillStyle = "#43304f";
    ctx.fillRect(x, 150, 34, 26);
    ctx.beginPath();
    ctx.moveTo(x - 3, 152);
    ctx.lineTo(x + 17, 138);
    ctx.lineTo(x + 37, 152);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(x + 4, 176, 3, 34);
    ctx.fillRect(x + 27, 176, 3, 34);
    ctx.fillRect(x - 150, 186, 60, 26);
    ctx.beginPath();
    ctx.moveTo(x - 156, 188);
    ctx.lineTo(x - 120, 166);
    ctx.lineTo(x - 84, 188);
    ctx.closePath();
    ctx.fill();
    hills(ctx, w, 222, 6, 64, 1.7, "#43304f");
    for (const tx of [0.1, 0.4, 0.86]) blob(ctx, w * tx, 214, 20, 24, "#3a2c48");
  },
  mid(ctx, w) {
    // The next roof over, a chimney, and the ridge this fight is happening on.
    ctx.fillStyle = BARN_DEEP;
    ctx.beginPath();
    ctx.moveTo(-10, 236);
    ctx.lineTo(w * 0.16, 150);
    ctx.lineTo(w * 0.36, 236);
    ctx.closePath();
    ctx.fill();
    rect(ctx, w * 0.2, 150, 22, 40, "#5a3421");
    rect(ctx, w * 0.2 - 3, 146, 28, 6, "#3f2316");
    rect(ctx, 0, 214, w, 60, "#5b3a4a");
    ctx.fillStyle = "#6b4658";
    for (let row = 0; row < 4; row++) {
      for (let x = (row % 2) * 12 - 12; x < w; x += 24) {
        ctx.beginPath();
        ctx.ellipse(x + 12, 222 + row * 14, 11, 7, 0, 0, Math.PI);
        ctx.fill();
      }
    }
    rect(ctx, 0, 212, w, 5, "#3f2a36");
    // Weather vane.
    const vx = w * 0.55;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(vx, 214);
    ctx.lineTo(vx, 112);
    ctx.moveTo(vx - 30, 134);
    ctx.lineTo(vx + 34, 134);
    ctx.moveTo(vx + 34, 134);
    ctx.lineTo(vx + 25, 128);
    ctx.moveTo(vx + 34, 134);
    ctx.lineTo(vx + 25, 140);
    ctx.stroke();
    blob(ctx, vx - 2, 104, 13, 10, INK);
    blob(ctx, vx + 9, 93, 6, 6, INK);
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(vx + 14, 93);
    ctx.lineTo(vx + 21, 95);
    ctx.lineTo(vx + 14, 97);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(vx - 12, 102);
    ctx.quadraticCurveTo(vx - 24, 96, vx - 24, 84);
    ctx.moveTo(vx - 12, 104);
    ctx.quadraticCurveTo(vx - 28, 104, vx - 31, 94);
    ctx.stroke();
  },
  floor(ctx, w) {
    ctx.fillStyle = vGradient(ctx, FLOOR_TOP, VIEW_H, [[0, "#7a5038"], [1, "#553422"]]);
    ctx.fillRect(0, FLOOR_TOP, w, VIEW_H - FLOOR_TOP);
    rect(ctx, 0, FLOOR_TOP, w, 4, "#96644a");
    ctx.fillStyle = "#553422";
    for (let x = 0; x < w; x += 46) ctx.fillRect(x, FLOOR_TOP + 4, 2, VIEW_H - FLOOR_TOP);
    const r = scatter(41);
    for (let i = 0; i < 40; i++) blob(ctx, r() * w, FLOOR_TOP + 10 + r() * 84, 1.5, 1.5, "#3f2316");
  },
};

export const STAGES: readonly StageArt[] = [barnyard, cornfield, henhouse, rooftop];

export interface StageLayers {
  id: string;
  name: string;
  art: StageArt;
  scale: number;
  sky: HTMLCanvasElement;
  far: HTMLCanvasElement;
  mid: HTMLCanvasElement;
  floor: HTMLCanvasElement;
  /** The lanterns' pool of light, painted once. */
  glow: HTMLCanvasElement | null;
  perches: [number, number][];
}

function paint(w: number, scale: number, draw: (ctx: Ctx, w: number) => void): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.ceil(w * scale);
  c.height = Math.ceil(VIEW_H * scale);
  const ctx = c.getContext("2d")!;
  ctx.scale(scale, scale);
  draw(ctx, w);
  return c;
}

function paintGlow(scale: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.ceil(220 * scale);
  c.height = Math.ceil(230 * scale);
  const ctx = c.getContext("2d")!;
  ctx.scale(scale, scale);
  const g = ctx.createRadialGradient(110, 110, 4, 110, 110, 110);
  g.addColorStop(0, "rgba(240,194,79,0.42)");
  g.addColorStop(1, "rgba(240,194,79,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 220, 230);
  return c;
}

/** Paints a stage's layers at the given pixel scale. Call again when the canvas is resized. */
export function buildStage(index: number, scale: number): StageLayers {
  const art = STAGES[index % STAGES.length];
  return {
    id: art.id,
    name: art.name,
    art,
    scale,
    sky: paint(640, scale, art.sky),
    far: paint(layerWidth(FAR), scale, art.far),
    mid: paint(layerWidth(MID), scale, art.mid),
    floor: paint(900, scale, art.floor),
    glow: art.lanterns ? paintGlow(scale) : null,
    perches: art.perches(layerWidth(MID)),
  };
}

const CROWD = ["#f8d976", CREAM, "#dd8d50", "#d6d0c8", "#fbe9a6"];

/** A chick in the crowd. It bobs along, and jumps when something big lands. */
function spectator(ctx: Ctx, x: number, y: number, i: number, tick: number, excite: number) {
  const hop = Math.sin(tick * 0.1 + i * 1.7) * 1.2 + Math.abs(Math.sin(tick * 0.42 + i)) * excite * 8;
  const face = i % 2 === 0 ? 1 : -1;
  const color = CROWD[i % CROWD.length];
  ctx.save();
  ctx.translate(x, y - hop);
  ctx.scale(face, 1);
  blob(ctx, 0, -6, 8, 7, color);
  blob(ctx, 2, -15, 6, 6, color);
  ctx.fillStyle = CARROT;
  ctx.beginPath();
  ctx.moveTo(6, -15);
  ctx.lineTo(11, -13.5);
  ctx.lineTo(6, -12);
  ctx.closePath();
  ctx.fill();
  blob(ctx, 3, -16, 1.1, 1.1, INK);
  ctx.restore();
}

function lantern(ctx: Ctx, x: number, swing: number, glow: HTMLCanvasElement) {
  ctx.save();
  ctx.translate(x, 0);
  ctx.rotate(swing);
  ctx.drawImage(glow, -110, -14, 220, 230);
  rect(ctx, -1, -4, 2, 86, INK);
  rect(ctx, -9, 82, 18, 4, INK);
  ctx.fillStyle = "#f7dc8a";
  ctx.beginPath();
  ctx.roundRect(-7, 86, 14, 20, 3);
  ctx.fill();
  rect(ctx, -9, 106, 18, 4, INK);
  ctx.restore();
}

/**
 * Draws the stage behind the fight. `ctx` is already scaled to logical units.
 * `excite` (0 to 1) is how worked up the crowd is.
 */
export function drawStage(ctx: Ctx, s: StageLayers, camX: number, viewW: number, tick: number, excite: number) {
  const clampOffset = (c: HTMLCanvasElement, offset: number) => Math.max(0, Math.min(c.width / s.scale - viewW, offset));
  const put = (c: HTMLCanvasElement, offset: number) => {
    // Source rectangle in the layer's own pixels; destination in logical units.
    ctx.drawImage(c, clampOffset(c, offset) * s.scale, 0, viewW * s.scale, VIEW_H * s.scale, 0, 0, viewW, VIEW_H);
  };
  put(s.sky, (640 - viewW) / 2);
  for (const [start, y, size, color] of s.art.clouds ?? []) {
    const span = viewW + 160;
    cloud(ctx, ((start * span + tick * 0.1 * size) % span) - 80, y, size, color);
  }
  put(s.far, camX * FAR);
  put(s.mid, camX * MID);
  const midW = layerWidth(MID);
  const off = clampOffset(s.mid, camX * MID);
  const lanterns = s.art.lanterns;
  if (lanterns && s.glow) {
    for (let i = 0; i < lanterns.length; i++) lantern(ctx, lanterns[i] * midW - off, Math.sin(tick * 0.03 + i * 2) * 0.05 + Math.sin(tick * 0.4 + i) * excite * 0.08, s.glow);
  }
  for (let i = 0; i < s.perches.length; i++) spectator(ctx, s.perches[i][0] - off, s.perches[i][1], i, tick, excite);
  put(s.floor, camX);
}
