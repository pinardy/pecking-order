import { useEffect, useState } from "react";

// Fullscreen, orientation lock and keeping the screen awake. Every one of these is optional:
// where a browser does not offer it, the call quietly does nothing.

export const canFullscreen = () => !!document.fullscreenEnabled && !!document.documentElement.requestFullscreen;

export async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen({ navigationUI: "hide" });
  } catch {
    /* refused: stay as we are */
  }
}

/** True while the page is fullscreen. */
export function useFullscreen(): boolean {
  const [on, setOn] = useState(() => !!document.fullscreenElement);
  useEffect(() => {
    const change = () => setOn(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", change);
    return () => document.removeEventListener("fullscreenchange", change);
  }, []);
  return on;
}

/** Holds the screen in landscape. Browsers only allow this in fullscreen or in the installed app. */
export function lockLandscape(on: boolean) {
  try {
    const o = screen.orientation as ScreenOrientation & { lock?: (kind: string) => Promise<void> };
    if (on) o.lock?.("landscape").catch(() => {});
    else o.unlock?.();
  } catch {
    /* not supported */
  }
}

let sentinel: WakeLockSentinel | null = null;
let wanted = false;

/** Stops the screen dimming mid-fight, which matters most on a keyboard or gamepad. */
export async function keepAwake(on: boolean) {
  wanted = on;
  try {
    if (!on) {
      await sentinel?.release();
      sentinel = null;
    } else if (!sentinel && navigator.wakeLock) {
      sentinel = await navigator.wakeLock.request("screen");
      sentinel.addEventListener("release", () => (sentinel = null));
    }
  } catch {
    sentinel = null;
  }
}
// The lock is dropped whenever the tab is hidden; take it again on return.
document.addEventListener("visibilitychange", () => {
  if (wanted && !document.hidden) void keepAwake(true);
});

export function useMedia(query: string): boolean {
  const [hit, setHit] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const change = () => setHit(mq.matches);
    mq.addEventListener("change", change);
    return () => mq.removeEventListener("change", change);
  }, [query]);
  return hit;
}
