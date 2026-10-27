// Renders a handful of frames as PNGs for a quick layout check: node stills.mjs 60 225 ...
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const frames = process.argv.slice(2).map(Number);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id: "AestrodomDemo" });
for (const frame of frames) {
  await renderStill({ serveUrl, composition, frame, output: `out/stills/f${String(frame).padStart(4, "0")}.png`, scale: 0.5 });
  console.log("frame", frame);
}
