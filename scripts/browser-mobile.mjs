import assert from "node:assert/strict";

export async function checkMobilePlanning(browser, planning, origin, show, engine) {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 }, colorScheme: "light", isMobile: true,
    deviceScaleFactor: 1, hasTouch: true, locale: "de-DE" });
  try {
    await context.addCookies(await planning.cookies());
    const page = await context.newPage();
    for (const width of [360, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const theme of ["light", "dark"]) {
        await page.emulateMedia({ colorScheme: theme });
        await page.goto(origin + "/dispo");
        const heading = page.getByRole("heading", { name: "Personal und Einsätze" });
        await heading.waitFor();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth), true);
        const skipLink = page.getByRole("link", { name: "Zum Inhalt" });
        if (engine === "webkit") await skipLink.focus();
        else await page.keyboard.press("Tab");
        await checkFocus(skipLink);
        const button = page.getByRole("button", { name: "Poolmitglied einladen" });
        await checkTouchTargets(page.locator("main").locator("button:visible, summary:visible"));
        await button.press("Enter");
        const dialog = page.getByRole("dialog", { name: "Poolmitglied einladen" });
        await checkFocus(dialog.getByRole("combobox", { name: "Poolmitglied" }));
        await page.keyboard.press("Tab");
        await checkFocus(dialog.getByRole("button", { name: "Abbrechen" }));
        await page.keyboard.press("Tab");
        await checkFocus(dialog.getByRole("button", { name: "Einladung im Portal bereitstellen" }));
        await checkTouchTargets(dialog.locator("button, select"));
        await show(page, `einladung-${width}-${theme}`, false);
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "hidden" });
        await checkFocus(button);

        const status = page.getByText("Nur auf Einladung", { exact: true });
        await checkTextContrast(status);
        const form = page.locator("#neuer-einsatz");
        await form.locator("summary").tap();
        await form.getByLabel("Einsatzname").fill(" ");
        await form.getByLabel("Ort", { exact: true }).fill("Musterhalle");
        await checkTouchTargets(form.locator("summary, input:not([type=hidden]), textarea, button"));
        await form.getByRole("button", { name: "Einsatz anlegen" }).tap();
        const error = form.getByRole("alert");
        await checkTextContrast(error);
        await error.scrollIntoViewIfNeeded();
        await show(page, `dispo-fehler-${width}-${theme}`, false);
      }
    }
  } finally {
    await context.close();
  }
}

async function checkTouchTargets(controls) {
  for (const control of await controls.all()) {
    const box = await control.boundingBox();
    assert.ok(box?.height >= 44 && box?.width >= 44, `Touch-Ziel zu klein: ${await control.evaluate(element => element.outerHTML)}`);
  }
}

async function checkFocus(control) {
  assert.equal(await control.evaluate(element => {
    const style = getComputedStyle(element);
    return document.activeElement === element && style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2;
  }), true, "Tastaturfokus fehlt oder hat keinen sichtbaren Umriss.");
}

async function checkTextContrast(text) {
  await text.waitFor();
  const contrast = await text.evaluate(element => {
    const channels = value => value.match(/[\d.]+/g).map(Number);
    const luminance = rgb => rgb.slice(0, 3).reduce((result, component, index) => {
      const srgb = component / 255;
      const linear = srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
      return result + linear * [0.2126, 0.7152, 0.0722][index];
    }, 0);
    const ink = luminance(channels(getComputedStyle(element).color));
    for (let layer = element; layer; layer = layer.parentElement) {
      const background = channels(getComputedStyle(layer).backgroundColor);
      if (background[3] === 0) continue;
      const surface = luminance(background);
      return (Math.max(ink, surface) + 0.05) / (Math.min(ink, surface) + 0.05);
    }
    return 0;
  });
  assert.ok(contrast >= 4.5, `Textkontrast ${contrast.toFixed(2)}: ${await text.innerText()}`);
}
