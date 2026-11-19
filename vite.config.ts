import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

/**
 * A fingerprint of the engine's code, for replays: a replay only plays back on exactly the rules it was
 * recorded with, so shared replay codes carry this, and a code from a build with different engine code
 * is turned away. Comments and layout are ignored, so tidying the engine does not break old replays.
 */
function engineFingerprint(): string {
  const dir = "src/game";
  const code = readdirSync(dir)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .sort()
    .map((f) => readFileSync(`${dir}/${f}`, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s+/g, " "))
    .join("\n");
  return createHash("sha256").update(code).digest("hex").slice(0, 12);
}

// Single-file output so the game can be hosted as one self-contained HTML page.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: { outDir: "dist", target: "es2020" },
  define: { __ENGINE__: JSON.stringify(engineFingerprint()) },
});
