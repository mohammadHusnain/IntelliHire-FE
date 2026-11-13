import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const cachedRoot = resolve(root, "..", "..", "IntelliHire-FE-frontend", "frontend");
const require = createRequire(join(cachedRoot, "vite.config.js"));
const { defineConfig } = require("vite");
const reactModule = require("@vitejs/plugin-react");
const tailwindModule = require("tailwindcss");
const autoprefixerModule = require("autoprefixer");
const react = reactModule.default || reactModule;
const tailwindcss = tailwindModule.default || tailwindModule;
const autoprefixer = autoprefixerModule.default || autoprefixerModule;
const packageJson = require(join(root, "package.json"));
const packageNames = Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies }).sort((a, b) => b.length - a.length);

const aliases = packageNames.map((name) => ({
  find: new RegExp(`^${name.replaceAll(".", "\\.")}(?=/|$)`),
  replacement: join(cachedRoot, "node_modules", name),
}));
aliases.push({ find: "@", replacement: join(root, "src") });

export default defineConfig({
  root,
  cacheDir: join(cachedRoot, "node_modules", ".vite-active-preview"),
  plugins: [react()],
  resolve: { alias: aliases, dedupe: ["react", "react-dom"] },
  css: {
    postcss: {
      plugins: [tailwindcss({ config: join(root, "tailwind.config.js") }), autoprefixer()],
    },
  },
  build: { modulePreload: { polyfill: false } },
  server: { host: "127.0.0.1", port: 5175, strictPort: true },
});
