// The ring announcer. It speaks only from recorded clips, if a hosted copy of the game has
// them (see the README); there is no synthesised voice, which sounded too robotic. Without
// clips the rounds and the winner are called on screen, with the bell and the crowd from sounds.ts.

let on = true;
export function setAnnouncer(value: boolean) {
  on = value;
  if (!value) for (const p of playing) p.stop();
}

/** One beat of a line. `punch` is the word the announcer leans on: slower, lower, louder. */
type Beat = string | { say: string; punch: true };

// Recorded clips. If the hosted game has a voice/ folder beside it with an index.json listing the
// clips it holds (by name, without ".mp3"), lines are played from those recordings. A line
// without a recording for every part of it is simply not said. See the README for the names.
let clips: Map<string, Promise<AudioBuffer | null>> | null = null;
let playing: AudioBufferSourceNode[] = [];

/** A line's clip name: its words in lower case, joined by hyphens ("Round 1!" is round-1). */
export const clipName = (text: string) =>
  text.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Looks for recorded clips once, early, so the first line can already use them. */
export function loadClips(audio: () => AudioContext | null) {
  fetch("voice/index.json")
    .then((r) => (r.ok ? r.json() : null))
    .then((names: unknown) => {
      if (!Array.isArray(names)) return;
      clips = new Map(
        names.map((n) => [
          String(n),
          fetch(`voice/${n}.mp3`)
            .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
            .then((data) => audio()?.decodeAudioData(data) ?? null)
            .catch(() => null),
        ]),
      );
      context = audio;
    })
    .catch(() => {
      /* no recordings: the device voice it is */
    });
}
let context: () => AudioContext | null = () => null;

/** Plays recordings one after another. Returns false (having played nothing) unless every one is ready. */
async function fromClips(parts: string[]): Promise<boolean> {
  const c = context();
  if (!clips || !c || !parts.every((p) => clips!.has(p))) return false;
  const buffers = await Promise.all(parts.map((p) => clips!.get(p)!));
  if (buffers.some((b) => !b)) return false;
  for (const p of playing) p.stop();
  let t = c.currentTime + 0.02;
  playing = buffers.map((b) => {
    const src = c.createBufferSource();
    src.buffer = b;
    src.connect(c.destination);
    src.start(t);
    t += b!.duration + 0.08;
    return src;
  });
  return true;
}

/** Plays a clip for every part of a line, if there are recordings for them all. */
function speakOrPlay(_beats: Beat[], parts: string[]) {
  void fromClips(parts);
}

/** Whether this copy of the game has recorded clips, so that the announcer has anything to say. */
export const hasClips = () => clips !== null && clips.size > 0;

/**
 * Says a line, replacing anything still being said. Each beat is its own utterance, which is what
 * gives the pause between "And your winner" and the name. With recordings, each beat is its own clip.
 */
export function announce(...beats: Beat[]) {
  if (!on) return;
  speakOrPlay(beats, beats.map((b) => clipName(typeof b === "string" ? b : b.say)));
}

/** The same, for a line spoken in one breath but recorded in pieces ("Henrietta, versus Rusty!" from three clips). */
export function announceIn(text: string, parts: string[]) {
  if (!on) return;
  speakOrPlay([text], parts.map(clipName));
}

/** Marks the word to lean on. */
export const punch = (say: string): Beat => ({ say, punch: true });
