// Text squeezed into something that can be pasted into a message: deflated where the browser
// can ("z"), plain otherwise ("j"), then base64 with URL-safe characters. Used for online
// invites and for shared replays.

const toB64 = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64 = (text: string) => Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

export async function squeeze(text: string): Promise<string> {
  try {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    return "z" + toB64(new Uint8Array(await new Response(stream).arrayBuffer()));
  } catch {
    return "j" + toB64(new TextEncoder().encode(text));
  }
}

/** The reverse of squeeze. Throws if the code is not one of ours. */
export async function unsqueeze(code: string): Promise<string> {
  const c = code.trim();
  const bytes = fromB64(c.slice(1));
  if (c[0] === "z") return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
  if (c[0] === "j") return new TextDecoder().decode(bytes);
  throw new Error("not a code");
}
