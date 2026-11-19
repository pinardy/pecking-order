import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Label for the button that closes the sheet. */
}

/** A centred sheet over a dimmed backdrop. Escape and a tap outside close it. */
/**
 * A sheet over the screen. The way out is always in the same place: Close, at the top right, beside the title.
 * (Full screens have Back at the top left instead.)
 */
export function Modal({ title, onClose, children }: Props) {
  const sheet = useRef<HTMLDivElement>(null);
  useEffect(() => {
    sheet.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Nothing behind the sheet should also react to this key.
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [onClose]);

  return (
    <div className="backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={sheet}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="link" onClick={onClose}>Close</button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
