import { squeeze, unsqueeze } from "./codec";

// Peer-to-peer link for online play. There is no server: the two players swap a pair of
// invite codes by any messenger they like, and the browsers then talk to each other directly.

export type NetMessage =
  | { k: "i"; t: number; i: number } // input for tick t
  | { k: "h"; t: number; h: string } // state check for tick t
  | { k: "p"; n: number } // ping
  | { k: "q"; n: number } // its answer
  | { k: "pick"; id: string }
  /** `id` names the match, so that after a drop both sides can tell they mean the same one. `resumeAt` picks it up from a checkpoint. */
  | { k: "start"; id: number; stage: number; host: string; guest: string; delay: number; resumeAt?: number }
  /** After reconnecting: the match that was interrupted, and the checkpoints this device still holds for it. */
  | { k: "resume"; id: number | null; ticks: number[] }
  | { k: "again" };

// A public STUN server lets two players behind home routers find each other. On one network it is not needed.
const CONFIG: RTCConfiguration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

/** A connection description as an invite or reply code. */
const encode = (sdp: string) => squeeze(sdp);

async function decode(code: string, type: "offer" | "answer"): Promise<RTCSessionDescriptionInit> {
  // A whole invite link works too: the code is the part after #join=.
  const sdp = await unsqueeze(code.split("#join=").pop() ?? "");
  if (!sdp.startsWith("v=0")) throw new Error("not an invite code");
  return { type, sdp };
}

export class NetLink {
  private pc = new RTCPeerConnection(CONFIG);
  private channel: RTCDataChannel | null = null;
  private listeners = new Set<(m: NetMessage) => void>();
  private pongs = new Map<number, () => void>();
  private pings = 0;
  onOpen: () => void = () => {};
  onClose: () => void = () => {};
  /** The connection has gone shaky (true) or steadied again (false). It often recovers by itself. */
  onShaky: (shaky: boolean) => void = () => {};

  constructor() {
    this.pc.oniceconnectionstatechange = () => {
      const s = this.pc.iceConnectionState;
      if (s === "disconnected") this.onShaky(true);
      else if (s === "connected" || s === "completed") this.onShaky(false);
      else if (s === "failed") this.onClose();
    };
  }

  private wire(ch: RTCDataChannel) {
    this.channel = ch;
    ch.onopen = () => this.onOpen();
    ch.onclose = () => this.onClose();
    ch.onmessage = (e) => {
      let m: NetMessage;
      try {
        m = JSON.parse(e.data) as NetMessage;
      } catch {
        return;
      }
      if (m.k === "p") this.send({ k: "q", n: m.n });
      else if (m.k === "q") this.pongs.get(m.n)?.();
      else this.listeners.forEach((fn) => fn(m));
    };
  }

  /** The finished local description, once the browser has gathered its routes (or three seconds have passed). */
  private async code(): Promise<string> {
    if (this.pc.iceGatheringState !== "complete") {
      await new Promise<void>((done) => {
        const timer = setTimeout(done, 3000);
        this.pc.addEventListener("icegatheringstatechange", () => {
          if (this.pc.iceGatheringState === "complete") {
            clearTimeout(timer);
            done();
          }
        });
      });
    }
    return encode(this.pc.localDescription?.sdp ?? "");
  }

  /** Host, step 1: make an invite code to send to the other player. */
  async host(): Promise<string> {
    this.wire(this.pc.createDataChannel("fight", { ordered: true }));
    await this.pc.setLocalDescription(await this.pc.createOffer());
    return this.code();
  }

  /** Guest: take the host's invite and make a reply code to send back. */
  async join(invite: string): Promise<string> {
    this.pc.ondatachannel = (e) => this.wire(e.channel);
    await this.pc.setRemoteDescription(await decode(invite, "offer"));
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    return this.code();
  }

  /** Host, step 2: paste the guest's reply. The link opens shortly after. */
  async accept(reply: string): Promise<void> {
    await this.pc.setRemoteDescription(await decode(reply, "answer"));
  }

  send(m: NetMessage) {
    if (this.channel?.readyState === "open") this.channel.send(JSON.stringify(m));
  }

  /** Round trip to the other player and back, in milliseconds. Infinity if no answer comes. */
  ping(): Promise<number> {
    const n = ++this.pings;
    const sent = performance.now();
    return new Promise((done) => {
      const timer = setTimeout(() => {
        this.pongs.delete(n);
        done(Infinity);
      }, 2000);
      this.pongs.set(n, () => {
        clearTimeout(timer);
        this.pongs.delete(n);
        done(performance.now() - sent);
      });
      this.send({ k: "p", n });
    });
  }

  /** Listen for messages. Returns a function that stops listening. */
  subscribe(fn: (m: NetMessage) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  close() {
    this.onClose = () => {};
    this.onShaky = () => {};
    this.channel?.close();
    this.pc.close();
  }
}

/**
 * How many ticks after pressing an input takes effect online. Rollback hides most of the journey,
 * so this stays small: one tick on a quick link, two or three on a slow one, to keep wrong guesses rare.
 */
export function delayFor(rtt: number): number {
  if (!Number.isFinite(rtt)) return 2;
  return rtt < 50 ? 1 : rtt < 140 ? 2 : 3;
}
