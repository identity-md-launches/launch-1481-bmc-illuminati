import {
  readFile,
  writeFile,
  cp,
  mkdir,
  rm,
  stat,
  readdir,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const esbuild = await import(
  process.env.BMC_ESBUILD
    ? pathToFileURL(process.env.BMC_ESBUILD).href
    : "esbuild"
);
const destination = path.join(root, "dist");
await mkdir(destination, { recursive: true });
// Explicit runtime asset list; tooling, archives, original full-size downloads and caches never enter dist.
const files = [
  "index.html",
  "config.js",
  "pass-abi.js",
  "bmc-abi.js",
  "mint-client.js",
  "app.js",
  "styles.css",
  "platform.css",
  "mint-nav.js",
  "mint-nav.css",
  "favicon.svg",
  "favicon-gold.svg",
  "favicon-32.png",
  "og.png",
  "mint/index.html",
  "assets/index-CPnoBN9P.css",
  "artwork",
];
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const file of files) {
  await mkdir(path.dirname(path.join(destination, file)), { recursive: true });
  await cp(path.join(root, "website", file), path.join(destination, file), {
    recursive: true,
  });
}
const inherited = await readFile(
  path.join(root, "website/assets/index-C3VUAmkN.js"),
  "utf8",
);
const marker = inherited.indexOf("const jn={");
if (marker < 0)
  throw new Error(
    "Inherited application boundary changed; inspect before rebuilding.",
  );
const runtime =
  inherited.slice(0, marker) +
  "\nexport { ne, m, Yu, o0, Gw, Yw, $w, Db, Hw, gS, dw, tc, DS, Q6, m6, yw, y6 };\n";
await writeFile(path.join(destination, "assets/legacy-runtime.js"), runtime);
await esbuild.build({
  entryPoints: [path.join(root, "website/site.js")],
  outfile: path.join(destination, "site.js"),
  bundle: false,
  format: "esm",
  target: "es2022",
  minify: true,
  legalComments: "inline",
});
await esbuild.build({
  entryPoints: [path.join(root, "web/src/platform.ts")],
  outfile: path.join(destination, "platform.js"),
  bundle: true,
  format: "iife",
  target: "es2022",
  minify: true,
  legalComments: "inline",
});
async function size(dir) {
  let bytes = 0;
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, item.name);
    bytes += item.isDirectory() ? await size(p) : (await stat(p)).size;
  }
  return bytes;
}
console.log(
  `Production export: dist/ (${await size(destination)} bytes), relative URLs, no runtime CDN.`,
);
