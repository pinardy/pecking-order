import type { Match } from "../../game";
import type { Particles } from "../../render/particles";
import { cameraTarget, drawMatch, type View } from "../../render/scene";
import { VIEW_H, buildStage, type StageLayers } from "../../render/stage";

// The canvas: sizing it to its box, drawing a frame, and keeping the frame rate honest.

/** Auto sharpness: the pixel-density cap found to hold 60 fps on this device, kept for the visit. */
let autoCap = 3;
const WINDOW = 90;

export interface Arena {
  view: View;
  /** Paints the match, if `fresh` (something has happened since the last paint) or the canvas needs it. */
  draw(m: Match, particles: Particles, fresh: boolean): void;
  /** Call once per frame with how long the frame took to arrive and to make. Paused frames are not counted. */
  timing(gap: number, work: number): void;
  dispose(): void;
}

interface Options {
  canvas: HTMLCanvasElement;
  /** The box the canvas should fill. */
  box: HTMLElement;
  match: Match;
  stage: number;
  quality: "auto" | "high" | "low";
  view: Pick<View, "labels" | "score" | "tag" | "alts">;
  showPerf(): boolean;
  /** Larger names and counters than the automatic size. */
  largeHud: boolean;
  /** Called after every resize with the box's width, for anything that scales with it. */
  resized?(width: number): void;
}

export function createArena(o: Options): Arena {
  const ctx = o.canvas.getContext("2d")!;
  const view: View = { w: 640, scale: 1, camX: 0, reducedMotion: false, ...o.view };
  let layers: StageLayers | null = null;
  let cap = o.quality === "low" ? 1 : o.quality === "high" ? 3 : autoCap;

  // Nothing is drawn unless something has changed: a tick was played, or the canvas was resized.
  let stale = true;
  const resize = () => {
    const box = o.box.getBoundingClientRect();
    if (box.width < 10 || box.height < 10) return;
    // Wide enough to hold both fighters at their furthest, up to 16:9; anything else is letterboxed.
    const aspect = Math.max((o.match.maxSep + 80) / VIEW_H, Math.min(16 / 9, box.width / box.height));
    const cssH = Math.min(box.height, box.width / aspect);
    const scale = Math.min(3, (cssH * Math.min(window.devicePixelRatio || 1, cap)) / VIEW_H);
    view.w = VIEW_H * aspect;
    view.scale = scale;
    o.canvas.width = Math.round(view.w * scale);
    o.canvas.height = Math.round(VIEW_H * scale);
    o.canvas.style.width = `${cssH * aspect}px`;
    o.canvas.style.height = `${cssH}px`;
    if (!layers || Math.abs(layers.scale - scale) > 0.01) layers = buildStage(o.stage, scale);
    view.camX = cameraTarget(o.match, view.w);
    // Names and counters are sized so they come out at a readable size in CSS pixels, however small the canvas.
    view.hud = Math.max(1, Math.min(1.4, 1.15 / (cssH / VIEW_H))) * (o.largeHud ? 1.25 : 1);
    o.resized?.(box.width);
    // Resizing a canvas wipes it.
    stale = true;
  };
  const observer = new ResizeObserver(resize);
  observer.observe(o.box);
  resize();

  let frames = 0;
  let gapSum = 0;
  let workSum = 0;
  let slow = 0;
  return {
    view,
    draw(m, particles, fresh) {
      if (!layers || !(fresh || stale)) return;
      stale = false;
      drawMatch(ctx, m, layers, view, particles);
      if (import.meta.env.DEV) (window as unknown as { __poDraws?: number }).__poDraws = ((window as unknown as { __poDraws?: number }).__poDraws ?? 0) + 1;
    },
    timing(gap, work) {
      // Hidden tabs produce long gaps that are not the device's fault.
      if (gap >= 100) return;
      gapSum += gap;
      workSum += work;
      if (++frames < WINDOW) return;
      const avg = gapSum / frames;
      view.perf = o.showPerf() ? `${Math.round(1000 / avg)} fps, ${(workSum / frames).toFixed(1)} ms of work a frame, drawn at ${view.scale.toFixed(2)}x` : undefined;
      // Auto sharpness: two slow stretches in a row and the canvas gets a little less sharp.
      slow = avg > 21 ? slow + 1 : 0;
      if (o.quality === "auto" && slow >= 2 && cap > 1) {
        cap = Math.max(1, Math.min(cap, window.devicePixelRatio || 1) - 0.5);
        autoCap = cap;
        slow = 0;
        resize();
      }
      frames = gapSum = workSum = 0;
    },
    dispose: () => observer.disconnect(),
  };
}
