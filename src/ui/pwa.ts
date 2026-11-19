import { useEffect, useState } from "react";

// Installing the app and noticing new versions of it.

/** The browser's offer to install the app, held until the player asks for it. */
interface InstallEvent extends Event {
  prompt(): Promise<unknown>;
}

/** A function that opens the browser's install prompt, once the browser has offered one. */
export function useInstallPrompt(): (() => void) | undefined {
  const [offer, setOffer] = useState<InstallEvent | null>(null);
  useEffect(() => {
    const offered = (e: Event) => {
      e.preventDefault();
      setOffer(e as InstallEvent);
    };
    const installed = () => setOffer(null);
    window.addEventListener("beforeinstallprompt", offered);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", offered);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  return offer ? () => void offer.prompt() : undefined;
}

/** True once the service worker has fetched a newer copy of the app, with a way to wave the notice away. */
export function useUpdateNotice(): [boolean, () => void] {
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    const updated = () => setFresh(true);
    window.addEventListener("po-update", updated);
    return () => window.removeEventListener("po-update", updated);
  }, []);
  return [fresh, () => setFresh(false)];
}

/** An iPhone or iPad outside the installed app, where installing has to be done by hand from the Share menu. */
export const needsIosInstallHint = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.matchMedia?.("(display-mode: standalone)").matches && !(navigator as { standalone?: boolean }).standalone;
