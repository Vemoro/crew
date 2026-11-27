import type { Page } from "playwright";
import type { ShowScreenshot } from "./check-browser";
import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';

export async function checkAccessibility(page: Page, state: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const findings = violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) }));
  assert.deepEqual(findings, [], `Axe · ${state}`);
}

export async function checkMobileNavigation(page: Page, show: ShowScreenshot) {
  const menu = page.locator('.mobile-nav');
  const summary = menu.locator('summary');
  const profile = menu.getByRole('link', { name: 'Profil', includeHidden: true });
  await summary.click();
  await menu.getByRole('group', { name: 'Einsatzplanung' }).getByRole('link', { name: 'Schichten' }).waitFor();
  await menu.getByRole('group', { name: 'Personalportal' }).getByRole('link', { name: 'Aufgaben' }).waitFor();
  await menu.getByRole('group', { name: 'Konto und Hilfe' }).getByRole('button', { name: 'Abmelden' }).waitFor();
  await show(page, 'navigation-handy-hell-offen', false);
  await page.emulateMedia({ colorScheme: 'dark' });
  await show(page, 'navigation-handy-dunkel-offen', false);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.locator('main').focus();
  await page.keyboard.press('Escape');
  assert.equal(await summary.evaluate(node => node === document.activeElement), true);
  assert.equal(await menu.getAttribute('open'), null);
  await summary.click();
  await profile.click();
  assert.match(page.url(), /#profil$/);
  assert.equal(await profile.getAttribute('aria-current'), 'location');
  assert.equal(await page.locator('#profil').evaluate(node => node === document.activeElement), true);
  assert.equal(await menu.getAttribute('open'), null);
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('#profil').evaluate(node => node.contains(document.activeElement)), true);
  await summary.click();
  await profile.focus();
  const viewport = page.viewportSize();
  assert.ok(viewport);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForFunction(() => document.activeElement?.matches('.desktop-nav a[href$="#profil"]'));
  await page.setViewportSize(viewport);
  await page.waitForFunction(() => document.activeElement?.matches('.mobile-nav summary'));
  await summary.click();
  await menu.getByRole('button', { name: 'Abmelden' }).focus();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForFunction(() => document.activeElement?.matches('.desktop-nav .sign-out button'));
  await page.setViewportSize(viewport);
  await page.waitForFunction(() => document.activeElement?.matches('.mobile-nav summary'));
}
