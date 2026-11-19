import type { Move } from "../../game";

// Frame data for training: how a move is built, and who moves first when it is blocked.
/** Frame data for a move, as shown in training. */
export interface FrameInfo {
  name: string;
  startup: number;
  active: number;
  recovery: number;
  onBlock: string;
}

export function frameInfo(mv: Move): FrameInfo {
  // Blocked on its first active frame: how many frames the attacker is free before (or after) the blocker.
  const advantage = mv.blockstun - (mv.active - 1 + mv.recovery);
  const onBlock = mv.shot ? "A projectile: it depends how far away it hits." : mv.grab !== undefined ? "A throw: it cannot be blocked." : advantage >= 0 ? `Blocked, you move ${advantage} ${advantage === 1 ? "frame" : "frames"} first.` : `Blocked, they move ${-advantage} ${advantage === -1 ? "frame" : "frames"} first.`;
  return { name: mv.name, startup: mv.startup, active: mv.active, recovery: mv.recovery, onBlock };
}
