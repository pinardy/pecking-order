// After `vite build`, write dist/standalone.html: a copy of dist/index.html with the
// manifest and icons inlined as data: URIs, so that one file can be hosted entirely
// on its own (for example as a shared preview page) and still be installable.
//
// dist/index.html itself keeps linking the real manifest.webmanifest and icons served
// beside it. Android builds an installed app (a WebAPK) from the manifest *URL* and
// re-fetches it from there to check for updates, which a data: URL can't support.
import { readFileSync, writeFileSync } from "node:fs";

const source = "dist/index.html";
const target = "dist/standalone.html";
const b64 = (path) => `data:image/png;base64,${readFileSync(path).toString("base64")}`;
const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
for (const icon of manifest.icons) icon.src = b64(`public/${icon.src}`);
manifest.start_url = ".";
manifest.scope = ".";
delete manifest.id; // a relative id means nothing inside a data: URL
const manifestUri = `data:application/manifest+json,${encodeURIComponent(JSON.stringify(manifest))}`;

const html = readFileSync(source, "utf8");
const replacements = [
  ['href="./manifest.webmanifest"', `href="${manifestUri}"`],
  ['href="./icons/icon-192.png"', `href="${b64("public/icons/icon-192.png")}"`],
  ['href="./icons/apple-touch-icon-180.png"', `href="${b64("public/icons/apple-touch-icon-180.png")}"`],
];
let out = html;
for (const [from, to] of replacements) {
  if (!out.includes(from)) throw new Error(`inline-pwa: expected ${from} in ${source}`);
  out = out.replace(from, to);
}
writeFileSync(target, out);
console.log(`wrote ${target} with the manifest and icons inlined (${(out.length / 1024).toFixed(0)} kB); ${source} links them as files`);

// A third copy, dist/share.html, for publishing as a publicly shared preview. Public sharing
// only accepts embedded images, video and audio in common formats, so this copy carries
// neither the embedded font nor the embedded manifest: Fredoka comes from Google Fonts
// instead (with the usual fallbacks if that is unreachable), and there is no install
// manifest, since a preview page cannot be installed anyway.
const fontFace = /@font-face\{[^}]*data:font\/woff2[^}]*\}/;
if (!fontFace.test(html)) throw new Error("inline-pwa: expected the embedded Fredoka @font-face in dist/index.html");
const share = html
  .replace(fontFace, "")
  .replace(/\s*<link rel="manifest"[^>]*>/, "")
  .replace('href="./icons/icon-192.png"', `href="${b64("public/icons/icon-192.png")}"`)
  .replace('href="./icons/apple-touch-icon-180.png"', `href="${b64("public/icons/apple-touch-icon-180.png")}"`)
  .replace("</head>", '  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@300..700&display=swap" />\n  </head>');
const banned = [...share.matchAll(/data:([a-z0-9.+-]+\/[a-z0-9.+-]+)[;,]/gi)].map((m) => m[1]).filter((t) => !/^image\/(png|jpeg|gif|webp)$/.test(t));
if (banned.length) throw new Error(`inline-pwa: dist/share.html still embeds ${[...new Set(banned)].join(", ")}`);
writeFileSync("dist/share.html", share);
console.log(`wrote dist/share.html for public sharing (${(share.length / 1024).toFixed(0)} kB): font from Google Fonts, no manifest`);
