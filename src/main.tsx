import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { loadClips } from "./announcer";
import { audio } from "./sounds";
import "./styles/index.css";

// Recorded announcer clips, if this copy of the game has any (see the README).
if (location.protocol.startsWith("http")) loadClips(audio);

// Offline support when served from a real origin. On a single-file preview there is no sw.js; the rejection is ignored.
if (import.meta.env.PROD && "serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
  // The service worker says so when it has fetched a newer copy of the app than the one on screen.
  navigator.serviceWorker.addEventListener("message", (e) => {
    if (e.data?.type === "po-update") window.dispatchEvent(new Event("po-update"));
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
