import assert from "node:assert/strict";

export async function checkInstallability(page, origin, engine) {
  assert.equal(await page.locator('link[rel="manifest"]').getAttribute("href"), "/manifest.webmanifest");
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller));
  const response = await page.request.get(origin + "/manifest.webmanifest");
  assert.equal(response.status(), 200);
  assert.match(response.headers()["content-type"], /^application\/manifest\+json/);
  const manifest = await response.json();
  assert.deepEqual([manifest.id, manifest.start_url, manifest.scope, manifest.display], ["/", "/", "/", "standalone"]);
  const icons = [["/icon-180.png", 180], ...manifest.icons.map(icon => [icon.src, Number(icon.sizes.split("x")[0])])];
  for (const [src, size] of icons) {
    const icon = await page.request.get(origin + src);
    assert.equal(icon.status(), 200);
    assert.equal(icon.headers()["content-type"], "image/png");
    const body = await icon.body();
    assert.deepEqual([body.readUInt32BE(16), body.readUInt32BE(20)], [size, size]);
  }
  assert.equal(await page.locator('link[rel="apple-touch-icon"]').getAttribute("href"), "/icon-180.png");
  if (engine === "chromium") {
    const cdp = await page.context().newCDPSession(page);
    const result = await cdp.send("Page.getInstallabilityErrors");
    assert.deepEqual(result.installabilityErrors, []);
    await cdp.detach();
  }
}

export async function checkDisconnection(page, writer, origin, show) {
  const failedPost = writer.waitForEvent("requestfailed", request => request.method() === "POST" && request.url() === origin + "/verfuegbarkeit");
  await writer.getByRole("button", { name: "Verfügbarkeit speichern" }).click();
  await failedPost;
  await writer.close();
  const offline = await page.goto(origin + "/");
  assert.equal(offline.status(), 503);
  await page.getByRole("heading", { name: "Verbindung fehlt" }).waitFor();
  assert.equal(await page.getByText("Mira Nord", { exact: false }).count(), 0);
  assert.deepEqual(await page.evaluate(() => caches.keys()), []);
  await show(page, "crew-ohne-verbindung", false);
  const evidence = await page.goto(origin + "/nachweis/1");
  assert.equal(evidence.status(), 503);
  assert.match(evidence.headers()["content-type"], /^text\/html/);
  await page.getByRole("heading", { name: "Verbindung fehlt" }).waitFor();
}
