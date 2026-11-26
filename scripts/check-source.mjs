import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const paths = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" });
const source = /\.(?:[cm]?[jt]sx?|css)$/;
const tests = /^(?:test|tests)\/|\.(?:test|spec)\.[^.]+$|^scripts\/check-browser\.mjs$/;
const spacingProperties = /(?<=^|[{;\s])((?:padding|margin)(?:-[a-z-]+)?|gap|row-gap|column-gap)\s*:\s*([^;{}]+)/gi;
const pixels = /([+-]?(?:\d*\.\d+|\d+))px\b/gi;

for (const path of new Set(paths.split("\0"))) {
  if (!source.test(path) || tests.test(path) || !existsSync(path)) continue;
  const content = readFileSync(path, "utf8");
  const lines = content ? content.replace(/\r?\n$/, "").split(/\r?\n/).length : 0;
  if (lines > 400) {
    console.error(`${path}: ${lines} Zeilen, höchstens 400 erlaubt.`);
    process.exitCode = 1;
  }
  if (!path.endsWith(".css")) continue;
  const code = content.replace(/\/\*[\s\S]*?\*\//g, comment => comment.replace(/[^\n]/g, " "));
  for (const match of code.matchAll(spacingProperties)) {
    if (![...match[2].matchAll(pixels)].some(([, number]) => Number(number) % 4 !== 0)) continue;
    const line = code.slice(0, match.index).split("\n").length;
    console.error(`${path}:${line}: ${match[1]}: ${match[2].trim()} liegt außerhalb des 4-Pixel-Rasters.`);
    process.exitCode = 1;
  }
}
