import type { FighterDef, Move } from "../game";
import { moveRole } from "../game";
import { keyHelp } from "./input";
import { Modal } from "./Modal";

const ROLE_NOTE: Record<ReturnType<typeof moveRole>, string> = {
  shot: "Hits from a distance.",
  dash: "Charges across the floor. Risky if blocked.",
  rise: "Shoots upward. Use it on anyone jumping at you.",
  pound: "Drops from above. Must be blocked standing.",
  flurry: "Several quick hits up close.",
  grab: "A throw that cannot be blocked. Leaves you open if it misses.",
};

function MoveRow({ input, move }: { input: string; move: Move }) {
  return (
    <li>
      <span className="keys">{input}</span>
      <span>
        <b>{move.name}</b>
        <small>{move.kind === "super" ? "Uses a full crow meter." : move.dive ? "Drops on them from the air. Must be blocked standing." : ROLE_NOTE[moveRole(move)]}</small>
      </span>
    </li>
  );
}

/** Controls, the basics, and (when a fighter is given) that fighter's own moves. */
export function HowTo({ fighter, onClose }: { fighter?: FighterDef; onClose: () => void }) {
  return (
    <Modal title={fighter ? `${fighter.name}’s moves` : "How to play"} onClose={onClose}>
      {fighter && (
        <ul className="moves">
          <MoveRow input="Special" move={fighter.specials[0]} />
          <MoveRow input="Toward + Special" move={fighter.specials[1]} />
          <MoveRow input="Down + Special" move={fighter.specials[2]} />
          <MoveRow input="Jump, then Special" move={fighter.air} />
          <MoveRow input="Crow" move={fighter.super} />
          <li>
            <span className="keys">{fighter.breed === "hen" ? "Hold up in the air" : fighter.breed === "chick" ? "Down + a direction" : "Jump"}</span>
            <span>
              <b>{fighter.trait.split(":")[0]}</b>
              <small>{fighter.trait.split(": ")[1]}</small>
            </span>
          </li>
        </ul>
      )}
      <h3>The basics</h3>
      <ul className="basics">
        <li><b>Peck</b> is quick. <b>Kick</b> is slower and hits harder. Both change when you crouch or jump.</li>
        <li><b>Block</b> by holding away from your opponent. Crouch to block sweeps and low pecks; stand to block anything coming from the air.</li>
        <li><b>Throw</b> a blocking opponent: stand right next to them, hold toward or away, and press Kick.</li>
        <li><b>Special</b> does three different moves: on its own, with toward, and with down.</li>
        <li>Pressed while <b>grabbed</b>, Kick shakes the throw off.</li>
        <li><b>Dash</b> by tapping toward twice. Tapping away twice hops back, out of reach.</li>
        <li>A peck that lands can be followed straight into a special. That is your first combo.</li>
        <li>Blocking wears your <b>guard</b> down (the thin bar under your health). If it empties, you are left wide open.</li>
        <li>Take too many hits in a row and you are knocked <b>dizzy</b>.</li>
        <li>Hitting and being hit fills the <b>crow meter</b>. When it is full, press Crow on its own for your super.</li>
        <li>With half a meter, <b>Crow with a direction</b> does a charged special: toward, down, or away for the plain one.</li>
        <li>Hit someone out of their own attack for a <b>counter</b>: more damage, longer stun.</li>
        <li>Block at the last moment for a <b>perfect block</b>: no damage, and you recover first.</li>
        <li>On the floor, hold a direction to <b>roll</b> as you get up, or down to get up late.</li>
        <li><b>Down + Toward + Kick</b> is a launcher: it pops them up, and you can jump after them and hit them again.</li>
        <li>Caught in a combo with a full meter? Press Crow to <b>burst</b> out of it, once a round.</li>
        <li>Below a quarter of your health, your crow meter fills <b>faster</b>.</li>
        <li>In <b>Tag team</b>, Peck and Kick together swaps in your partner, and Kick and Special together calls them in to charge across once. A partner on the bench gets some health back.</li>
        <li>In the air, next to a bird that is also in the air, hold toward and press Kick for an <b>air throw</b>. Hold away when throwing on the ground to throw them behind you.</li>
      </ul>
      <h3>Controls</h3>
      <div className="table-scroll">
      <table className="controls">
        <thead>
          <tr><th></th><th>Move</th><th>Peck</th><th>Kick</th><th>Special</th><th>Crow</th></tr>
        </thead>
        <tbody>
          <tr><th>Touch</th><td>Stick</td><td colSpan={4}>The four buttons on screen</td></tr>
          {keyHelp().map((k, i) => (
            <tr key={k.move}>
              <th>{i === 0 ? "Keys" : "Keys, player 2"}</th>
              <td>{k.move}</td><td>{k.light}</td><td>{k.heavy}</td><td>{k.special}</td><td>{k.sup}</td>
            </tr>
          ))}
          <tr><th>Gamepad</th><td>Stick or D-pad</td><td>X / □</td><td>A / ✕</td><td>Y / △</td><td>B / ○</td></tr>
        </tbody>
      </table>
      </div>
      <p className="fine">With one player, either set of keys works. Esc pauses. Keys can be changed in Settings.</p>
    </Modal>
  );
}
