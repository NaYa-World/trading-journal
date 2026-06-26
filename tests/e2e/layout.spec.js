import { test, expect } from '@playwright/test';

test.describe('Dashboard Layout and Responsiveness Tests', () => {

  test('should keep sidebar visible at x=0 and have no horizontal scroll on medium desktop view', async ({ page }) => {
    // Set viewport to medium desktop size
    await page.setViewportSize({ width: 1000, height: 720 });
    await page.goto('/');

    // Check sidebar visibility and coordinates
    const sidebar = page.locator('div[style*="width: 220"]').first();
    await expect(sidebar).toBeVisible();

    const sidebarBox = await sidebar.boundingBox();
    expect(sidebarBox.x).toBe(0);
    expect(sidebarBox.width).toBe(220);

    // Verify there is no horizontal scrollbar on the page
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);
  });

  test('should render Open Spot Trades view without blank page/crash', async ({ page }) => {
    page.on('pageerror', (exception) => {
      console.error('CLIENT PAGE ERROR:', exception);
    });

    await page.goto('/');

    // Click "Open Spot Trades" in the sidebar
    const spotTradesBtn = page.locator('button:has-text("Open Spot Trades")');
    await expect(spotTradesBtn).toBeVisible();
    await spotTradesBtn.click();

    // Verify the view renders "No open spot positions" instead of blank screen
    const emptyStateHeader = page.locator('text=No open spot positions');
    await expect(emptyStateHeader).toBeVisible({ timeout: 5000 });
  });

});
