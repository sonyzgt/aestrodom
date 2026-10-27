/**
 * Starter project every PRISMATIC app begins from: Vite + React 19 + TypeScript + Tailwind CSS v4.
 *
 * The toolchain files (package.json, vite.config.ts, tsconfig.json) are informational copies of
 * what the runtime image actually uses; the sandbox builds with its own pinned config, so a project
 * cannot change its toolchain or pull in unvetted packages.
 */
export const RUNTIME_PACKAGES: Record<string, string> = {
  react: "19",
  "react-dom": "19",
  "framer-motion": "12",
  "lucide-react": "0.4x",
  clsx: "2",
  "tailwind-merge": "3",
  gsap: "3",
  "@gsap/react": "2",
  "radix-ui": "1",
  "class-variance-authority": "0.7",
  "tw-animate-css": "1",
};

export const PROJECT_TEMPLATE: Record<string, string> = {
  "package.json": JSON.stringify(
    {
      name: "prismatic-app",
      private: true,
      type: "module",
      scripts: { dev: "vite", build: "tsc --noEmit && vite build" },
      dependencies: {
        react: "^19.0.0",
        "react-dom": "^19.0.0",
        "framer-motion": "^12.0.0",
        "lucide-react": "^0.460.0",
        clsx: "^2.1.1",
        "tailwind-merge": "^3.0.0",
        gsap: "^3.15.0",
        "@gsap/react": "^2.1.2",
        "radix-ui": "^1.8.1",
        "class-variance-authority": "^0.7.1",
        "tw-animate-css": "^1.4.0",
      },
      devDependencies: {
        vite: "^6.0.0",
        "@vitejs/plugin-react": "^4.3.0",
        tailwindcss: "^4.0.0",
        "@tailwindcss/vite": "^4.0.0",
        typescript: "^5.6.0",
      },
    },
    null,
    2,
  ) + "\n",
  "vite.config.ts": `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({ plugins: [react(), tailwindcss()] });
`,
  "tsconfig.json": JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        lib: ["ES2022", "DOM", "DOM.Iterable"],
        module: "ESNext",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        isolatedModules: true,
        noUnusedLocals: false,
        types: ["vite/client"],
      },
      include: ["src"],
    },
    null,
    2,
  ) + "\n",
  "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>New Project</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
  "src/main.tsx": `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`,
  "src/index.css": `@import "tailwindcss";

:root {
  color-scheme: dark;
}

body {
  @apply bg-neutral-950 text-neutral-100 antialiased;
}
`,
  "src/App.tsx": `export default function App() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-neutral-500">Your app is being built…</p>
    </main>
  );
}
`,
  "public/favicon.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0a0a0a"/><path d="M16 6l9 16H7z" fill="none" stroke="#a78bfa" stroke-width="2"/></svg>
`,
};
