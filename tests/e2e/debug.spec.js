import { test } from '@playwright/test';

test('debug sidebar layout', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(2000);

  // Outer flex container
  const outer = page.locator('div[style*="display: flex"]').first();
  console.log('Outer container tag name:', await outer.evaluate(el => el.tagName));

  // Find immediate children of the outer container
  const children = await outer.evaluate((parent) => {
    return Array.from(parent.children).map((el, i) => {
      const box = el.getBoundingClientRect();
      const s = window.getComputedStyle(el);
      return {
        index: i,
        tagName: el.tagName,
        id: el.id,
        className: el.className,
        box: { x: box.x, y: box.y, width: box.width, height: box.height },
        display: s.display,
        width: s.width,
        height: s.height,
        position: s.position,
      };
    });
  });

  console.log('Children of outer container:', JSON.stringify(children, null, 2));
});
