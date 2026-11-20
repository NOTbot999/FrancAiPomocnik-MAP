#!/usr/bin/env node
// Builds the FrancMap desktop app and zips it into release/.
//   node scripts/build-desktop.mjs            # Windows x64 (default)
//   node scripts/build-desktop.mjs linux      # Linux x64
//   node scripts/build-desktop.mjs win32 --skip-build   # reuse existing dist/
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import packager from "@electron/packager";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const platform = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "win32";
const skipBuild = process.argv.includes("--skip-build");
const desktopPkg = JSON.parse(readFileSync(path.join(ROOT, "desktop", "package.json"), "utf8"));
const electronVersion = JSON.parse(readFileSync(path.join(ROOT, "node_modules", "electron", "package.json"), "utf8")).version;
const label = { win32: "Windows", linux: "Linux", darwin: "macOS" }[platform] || platform;

const STAGE = path.join(ROOT, "release", ".stage");
const OUT = path.join(ROOT, "release", ".out");
const ZIP = path.join(ROOT, "release", `FrancMap-${desktopPkg.version}-${label}.zip`);

const run = (cmd, args, cwd = ROOT) => execFileSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });

// 1. Web build (offline mode, bundled data)
if (!skipBuild) run("npm", ["run", "build"]);
if (!existsSync(path.join(ROOT, "dist", "index.html"))) throw new Error("dist/index.html missing");

// 2. Stage the app folder: main.cjs + package.json + dist/
rmSync(STAGE, { recursive: true, force: true });
rmSync(OUT, { recursive: true, force: true });
mkdirSync(STAGE, { recursive: true });
cpSync(path.join(ROOT, "desktop", "main.cjs"), path.join(STAGE, "main.cjs"));
writeFileSync(path.join(STAGE, "package.json"), JSON.stringify(desktopPkg, null, 2));
cpSync(path.join(ROOT, "dist"), path.join(STAGE, "dist"), { recursive: true });
rmSync(path.join(STAGE, "dist", "app_source.txt"), { force: true }); // source dump, not needed in the app

// 3. Package with Electron
const [appDir] = await packager({
  dir: STAGE,
  out: OUT,
  name: "FrancMap",
  executableName: "FrancMap",
  platform,
  arch: "x64",
  electronVersion,
  appVersion: desktopPkg.version,
  overwrite: true,
  prune: false,
  asar: false,
  quiet: true,
  win32metadata: { CompanyName: "FrancMap", ProductName: "FrancMap", FileDescription: "FrancMap — GIS Explorer Slovenije" },
});

// 4. Zip into release/
rmSync(ZIP, { force: true });
const folder = path.basename(appDir);
const renamed = path.join(OUT, `FrancMap-${desktopPkg.version}`);
cpSync(appDir, renamed, { recursive: true, verbatimSymlinks: true });
if (process.platform === "win32") {
  run("powershell", ["-NoProfile", "-Command", `Compress-Archive -Path '${renamed}' -DestinationPath '${ZIP}' -Force`]);
} else {
  run("zip", ["-qry", ZIP, path.basename(renamed)], OUT);
}
rmSync(STAGE, { recursive: true, force: true });
console.log(`\n${folder} → ${path.relative(ROOT, ZIP)} (${(statSync(ZIP).size / 1024 / 1024).toFixed(1)} MB)`);
