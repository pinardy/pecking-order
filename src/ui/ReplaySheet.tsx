import { useEffect, useRef, useState } from "react";
import type { Replay } from "./fight/sources";
import { Modal } from "./Modal";
import { decodeReplay, encodeReplay } from "./replayCode";

/** Share a replay as a code or a file (when given one), or open one that someone sent. */
export function ReplaySheet({ replay, onWatch, onClose }: { replay?: Replay; onWatch: (r: Replay) => void; onClose: () => void }) {
  const [code, setCode] = useState("");
  const [pasted, setPasted] = useState("");
  const [note, setNote] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (replay) void encodeReplay(replay).then(setCode);
  }, [replay]);

  const copy = () => {
    box.current?.select();
    navigator.clipboard?.writeText(code).then(() => setNote("Copied."), () => setNote("Select the code and copy it by hand."));
  };
  const save = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([code], { type: "text/plain" }));
    a.download = "pecking-order-replay.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const open = (text: string) => decodeReplay(text).then(onWatch, (e: Error) => setNote(e.message));

  if (replay) {
    return (
      <Modal title="Replay" onClose={onClose}>
        <button type="button" onClick={() => onWatch(replay)}>Watch it now</button>
        <h3>Share it</h3>
        <p className="fine">Send this code to a friend. They open it from More on the title screen. It only plays on the same version of the game.</p>
        <label className="code">
          Replay code
          <textarea ref={box} readOnly rows={4} value={code || "Making the code…"} onFocus={(e) => e.currentTarget.select()} />
          <span className="code-actions">
            <button type="button" className="ghost" disabled={!code} onClick={copy}>Copy code</button>
            {typeof navigator.share === "function" && <button type="button" className="ghost" disabled={!code} onClick={() => void navigator.share({ text: code }).catch(() => {})}>Share</button>}
            <button type="button" className="ghost" disabled={!code} onClick={save}>Save as a file</button>
          </span>
        </label>
        {note && <p className="fine" role="status">{note}</p>}
      </Modal>
    );
  }
  return (
    <Modal title="Watch a replay" onClose={onClose}>
      <label className="code">
        Paste a replay code
        <textarea rows={4} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="PO-REPLAY-…" />
        <span className="code-actions">
          <button type="button" disabled={!pasted.trim()} onClick={() => void open(pasted)}>Watch</button>
          <label className="file-pick">
            Or open a saved file
            <input type="file" accept=".txt,text/plain" onChange={(e) => void e.target.files?.[0]?.text().then(open)} />
          </label>
        </span>
      </label>
      {note && <p className="error" role="alert">{note}</p>}
    </Modal>
  );
}
