// Regenerates the brand files in public/ from public/logo.svg and marketing/og-image.html.
// Usage: node scripts/make-brand-assets.mjs   (needs sharp, which Next.js installs, and Google Chrome)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const pub = (f) => path.join(root, "public", f);
const mark = readFileSync(pub("logo.svg"), "utf8");

/** The mark centred on a white rounded tile, as a PNG of `size` px. */
async function tile(size) {
  const pad = Math.round(size * 0.2);
  const inner = await sharp(Buffer.from(mark)).resize(size - pad * 2, size - pad * 2).png().toBuffer();
  const r = Math.round(size * 0.18);
  const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="#fff"/></svg>`);
  return sharp(bg).composite([{ input: inner, left: pad, top: pad }]).png().toBuffer();
}

/** ICO container holding PNG images (supported by every current browser). */
function ico(pngs) {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...pngs.map((p) => p.data)]);
}

writeFileSync(pub("icon.png"), await tile(512));
writeFileSync(pub("apple-icon.png"), await tile(180));
writeFileSync(pub("favicon.ico"), ico([{ size: 16, data: await tile(16) }, { size: 32, data: await tile(32) }, { size: 48, data: await tile(48) }]));

const chrome = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(existsSync);
if (!chrome) throw new Error("Google Chrome not found; og.png not rendered");
execFileSync(chrome, [
  "--headless=new",
  "--hide-scrollbars",
  "--force-device-scale-factor=1",
  "--window-size=1200,630",
  "--virtual-time-budget=5000",
  `--screenshot=${pub("og.png")}`,
  pathToFileURL(path.join(root, "marketing", "og-image.html")).href,
]);
console.log("Wrote icon.png, apple-icon.png, favicon.ico and og.png");
