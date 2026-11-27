import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const vector = readFileSync(new URL("../public/icon.svg", import.meta.url), "utf8");
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [size, maskable] of [[180, false], [192, false], [512, false], [512, true]]) {
    const icon = maskable ? vector.replace(' rx="112"', "") : vector;
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>body{margin:0}svg{display:block;width:100vw;height:100vh}</style>${icon}`);
    const filename = `icon-${maskable ? "maskable-" : ""}${size}.png`;
    await page.screenshot({ path: fileURLToPath(new URL(`../public/${filename}`, import.meta.url)), omitBackground: true });
  }
} finally {
  await browser.close();
}
