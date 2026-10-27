// Pins the Aestrodom Pass artwork and metadata to IPFS (Pinata) and prints the ipfs:// metadata URI.
//   node --env-file=.env scripts/pin-pass-metadata.mjs
// Then the contract owner calls setMetadataURI(<uri>) (owner tools on /pass).
import { readFileSync } from "node:fs";

const jwt = process.env.PINATA_JWT;
if (!jwt) {
  console.error("Set PINATA_JWT.");
  process.exit(1);
}

async function pin(bytes, filename, mime) {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mime }), filename);
  form.append("network", "public");
  form.append("name", filename);
  const res = await fetch("https://uploads.pinata.cloud/v3/files", { method: "POST", headers: { Authorization: `Bearer ${jwt}` }, body: form });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.data?.cid) throw new Error(`Pinata upload failed (${res.status}).`);
  return body.data.cid;
}

const image = await pin(readFileSync(new URL("../public/nft/aestrodom-pass.png", import.meta.url)), "aestrodom-pass.png", "image/png");
console.log(`Image:    ipfs://${image}`);
const meta = JSON.parse(readFileSync(new URL("../public/nft/pass.json", import.meta.url), "utf8"));
meta.image = `ipfs://${image}`;
const metadata = await pin(new TextEncoder().encode(JSON.stringify(meta, null, 2)), "aestrodom-pass.json", "application/json");
console.log(`Metadata: ipfs://${metadata}`);
console.log(`Gateway:  https://gateway.pinata.cloud/ipfs/${metadata}`);
