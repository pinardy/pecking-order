import { useEffect, useState, type CSSProperties } from "react";
import { useMedia } from "./screen";
import { offsetVars, useSettings, type Offsets } from "./settings";
import { TouchControls } from "./TouchControls";

/** Drag the stick and each button to where your thumbs want them. Saved per orientation. */
export function ControlEditor({ onClose }: { onClose: () => void }) {
  const [settings, update] = useSettings();
  const portrait = useMedia("(orientation: portrait)");
  const which = portrait ? "portrait" : "landscape";
  const [draft, setDraft] = useState<Offsets>(settings.layout[which]);
  // Turning the phone switches to the other layout.
  useEffect(() => setDraft(settings.layout[which]), [which]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    update({ layout: { ...settings.layout, [which]: draft } });
    onClose();
  };
  return (
    <div className="fight with-touch arranging" style={offsetVars(draft) as CSSProperties}>
      <div className="arena editor-note">
        <button type="button" className="link editor-back" onClick={onClose}>Back</button>
        <div>
          <h2>Arrange your controls</h2>
          <p>Drag the stick and each button to where your thumbs want them. This is the {which} layout; turn your device to arrange the other one. Back leaves without saving.</p>
          <div className="result-actions">
            <button type="button" onClick={save}>Save layout</button>
            <button type="button" className="ghost" onClick={() => setDraft({})}>Reset</button>
          </div>
        </div>
      </div>
      <TouchControls block={settings.blockButton} edit={{ offsets: draft, onMove: (part, to) => setDraft((d) => ({ ...d, [part]: to })) }} />
    </div>
  );
}
