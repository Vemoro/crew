import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';

export async function checkAccessibility(page, state) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const findings = violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) }));
  assert.deepEqual(findings, [], `Axe · ${state}`);
}

export async function checkMobileNavigation(page, show) {
  const menu = page.locator('.mobile-nav');
  const summary = menu.locator('summary');
  const profile = menu.getByRole('link', { name: 'Profil' });
  await summary.click();
  await show(page, 'navigation-handy-offen', false);
  await profile.focus();
  await page.keyboard.press('Escape');
  assert.equal(await summary.evaluate(node => node === document.activeElement), true);
  assert.equal(await menu.getAttribute('open'), null);
  await summary.click();
  await profile.click();
  assert.match(page.url(), /#profil$/);
  assert.equal(await profile.getAttribute('aria-current'), 'location');
  assert.equal(await page.locator('main').evaluate(node => node === document.activeElement), true);
  assert.equal(await menu.getAttribute('open'), null);
}
