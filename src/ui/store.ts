// Everything the game saves on the device goes through here, with a version number alongside it.
// When a later release changes the shape of something saved, it bumps that thing's version and
// says how to bring the old shape up to date; anything unreadable falls back to the defaults.

const PREFIX = "po-";

/** Turns saved data of version `from` into the current shape. Return null to throw it away. */
export type Upgrade = (old: Record<string, unknown>, from: number) => Record<string, unknown> | null;

/**
 * Reads a saved object. Only the fields the current release knows about are kept (anything else
 * is left behind), and missing ones take their defaults, so the result is always complete.
 */
export function read<T extends object>(name: string, version: number, defaults: T, upgrade?: Upgrade): T {
  try {
    const raw = localStorage.getItem(PREFIX + name);
    if (!raw) return defaults;
    let saved = JSON.parse(raw) as Record<string, unknown> | null;
    if (!saved || typeof saved !== "object") return defaults;
    // Data saved before versions were recorded counts as version 0.
    const from = typeof saved.v === "number" ? saved.v : 0;
    if (from > version) return defaults;
    if (from < version && upgrade) saved = upgrade(saved, from);
    if (!saved) return defaults;
    const out = { ...defaults } as Record<string, unknown>;
    for (const key of Object.keys(defaults)) if (saved[key] !== undefined && saved[key] !== null) out[key] = saved[key];
    return out as T;
  } catch {
    return defaults;
  }
}

/** Saves an object with its version. Returns false where storage is unavailable; nothing else changes. */
export function write(name: string, version: number, value: object): boolean {
  try {
    localStorage.setItem(PREFIX + name, JSON.stringify({ v: version, ...value }));
    return true;
  } catch {
    return false;
  }
}

export function remove(name: string) {
  try {
    localStorage.removeItem(PREFIX + name);
  } catch {
    /* nothing to remove */
  }
}

/** Forgets everything the game has saved on this device. */
export function clearAll() {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(PREFIX)) localStorage.removeItem(key);
  } catch {
    /* storage unavailable: there was nothing saved */
  }
}
