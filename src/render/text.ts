import { INK } from "../palette";

type Ctx = CanvasRenderingContext2D;

// Text on the canvas: one font, and one way of drawing it (with a hard drop shadow so it reads over any arena).

export const FONT = '"Fredoka", "Arial Rounded MT Bold", "Trebuchet MS", sans-serif';

// Font strings are built once per weight and size rather than on every draw.
const fontCache = new Map<number, string>();
function fontOf(weight: number, size: number): string {
  const key = weight * 4096 + Math.round(size * 4);
  let f = fontCache.get(key);
  if (!f) fontCache.set(key, (f = `${weight} ${Math.round(size * 4) / 4}px ${FONT}`));
  return f;
}

/** Draws a line of text. `shadow` is how far below the ink-coloured copy sits; 0 for none. */
export function text(ctx: Ctx, s: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign = "center", weight = 700, shadow = 2) {
  ctx.font = fontOf(weight, size);
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  if (shadow) {
    ctx.fillStyle = INK;
    ctx.fillText(s, x, y + shadow);
  }
  ctx.fillStyle = fill;
  ctx.fillText(s, x, y);
}
