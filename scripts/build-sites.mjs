import { build } from "esbuild";
import { build as viteBuild } from "vite";
import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  copyFile,
} from "node:fs/promises";
await viteBuild({ mode: "sites" });
const assets = {};
async function collect(dir, prefix = "") {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`,
      url = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) await collect(path, url);
    else
      assets[url] = {
        data: (await readFile(path)).toString("base64"),
        type: entry.name.endsWith(".js")
          ? "application/javascript"
          : entry.name.endsWith(".css")
            ? "text/css"
            : "text/html",
      };
  }
}
await collect("dist/client");
await writeFile(
  "worker/assets.generated.js",
  `export default ${JSON.stringify(assets)};`,
);
await build({
  entryPoints: ["worker/index.ts"],
  outfile: "dist/server/index.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  external: ["node:crypto"],
  minify: true,
});
await mkdir("dist/.openai", { recursive: true });
await copyFile(".openai/hosting.json", "dist/.openai/hosting.json");
await writeFile(
  "dist/server/wrangler.json",
  JSON.stringify({
    main: "index.js",
    compatibility_date: "2026-01-01",
    compatibility_flags: ["nodejs_compat"],
    d1_databases: [
      {
        binding: "DB",
        database_name: "double-agent",
        database_id: "00000000-0000-4000-8000-000000000000",
      },
    ],
  }),
);
