import { useEffect } from "react";

/** Escape (and a gamepad's B, which sends Escape) goes back, as the Back link does. */
export function useEscape(back: () => void) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      // A sheet open over the screen gets the Escape first.
      if (e.key === "Escape" && !document.querySelector(".backdrop")) back();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [back]);
}
