// PRISMATIC sandbox build: type-check + Vite production build of /workspace.
//
// Runs inside the project container as the unprivileged `node` user with no network.
// The Vite config is fixed here; the project's own vite.config.ts is ignored so a project
// cannot add plugins or change the toolchain. Output is written to a staging directory
// and swapped into SITE_DIR only on success, so a failed build never breaks the live preview.
import { build } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { spawnSync } from "node:child_process";
import { rmSync, renameSync, existsSync, mkdirSync, cpSync } from "node:fs";

const WORKSPACE = "/workspace";
const SITE_DIR = process.env.SITE_DIR || "/srv/prismatic/site";
const STAGING = "/tmp/prismatic-build";

function out(kind, message) {
  process.stdout.write(JSON.stringify({ kind, message }) + "\n");
}

out("step", "Type-checking");
const tsc = spawnSync(
  process.execPath,
  ["/opt/prismatic/node_modules/typescript/bin/tsc", "-p", "/opt/prismatic/tsconfig.base.json", "--pretty", "false"],
  { encoding: "utf8", cwd: WORKSPACE, timeout: 120_000 },
);
if (tsc.status !== 0) {
  const text = `${tsc.stdout || ""}${tsc.stderr || ""}`.replaceAll("/workspace/", "").trim();
  out("error", text.split("\n").slice(0, 60).join("\n") || "TypeScript failed");
  process.exit(1);
}

out("step", "Building application");
rmSync(STAGING, { recursive: true, force: true });
try {
  await build({
    root: WORKSPACE,
    configFile: false,
    cacheDir: "/tmp/vite-cache",
    logLevel: "error",
    plugins: [react(), tailwindcss()],
    build: { outDir: STAGING, emptyOutDir: true, reportCompressedSize: false, sourcemap: false },
  });
} catch (err) {
  const msg = String(err && err.message ? err.message : err).replaceAll("/workspace/", "");
  out("error", msg.split("\n").slice(0, 40).join("\n"));
  process.exit(1);
}

if (!existsSync(`${STAGING}/index.html`)) {
  out("error", "Build produced no index.html");
  process.exit(1);
}

// Swap: copy into SITE_DIR contents (SITE_DIR itself may be a mount point).
mkdirSync(SITE_DIR, { recursive: true });
const OLD = `${SITE_DIR}.old`;
rmSync(OLD, { recursive: true, force: true });
try {
  renameSync(SITE_DIR, OLD);
  renameSync(STAGING, SITE_DIR);
  rmSync(OLD, { recursive: true, force: true });
} catch {
  rmSync(SITE_DIR, { recursive: true, force: true });
  mkdirSync(SITE_DIR, { recursive: true });
  cpSync(STAGING, SITE_DIR, { recursive: true });
}
out("done", "Build completed");
