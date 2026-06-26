import { test, expect } from '@playwright/test';

test.describe('Trading Journal Dashboard E2E Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Open home page
    await page.goto('/');
  });

  test('should load the dashboard and navigate through sidebar views', async ({ page }) => {
    // Verify initial layout has "Dashboard" view showing "No trades yet" by default since journal is empty
    await expect(page.locator('text=No trades yet')).toBeVisible({ timeout: 15000 });
    
    // Switch to Finished Trades view
    const finishedTradesBtn = page.locator('button:has-text("Finished Trades")');
    await finishedTradesBtn.click();
    await expect(page.locator('text=Finished Trades').first()).toBeVisible();

    // Switch to Watchlist view
    const watchlistBtn = page.locator('button:has-text("Watchlist")');
    await watchlistBtn.click();
    await expect(page.locator('text=Watchlist').first()).toBeVisible();

    // Switch to Alerts view
    const alertsBtn = page.locator('button:has-text("Alerts")');
    await alertsBtn.click();
    await expect(page.getByText('PRICE ALERTS', { exact: true }).first()).toBeVisible();
  });

  test('should toggle dark and light themes', async ({ page }) => {
    // Check initial state (should have dark theme body color by default or moon/sun icon toggle)
    const themeBtn = page.locator('button:has-text("☀"), button:has-text("🌙")').first();
    await expect(themeBtn).toBeVisible();

    const initialText = await themeBtn.innerText();
    
    // Click toggle button
    await themeBtn.click();
    
    // Icon should change to indicate theme switched
    const newText = await themeBtn.innerText();
    expect(newText).not.toBe(initialText);
  });

  test('should create a price alert and verify it is active', async ({ page }) => {
    // Navigate to Alerts tab
    await page.locator('button:has-text("Alerts")').click();
    await expect(page.getByText('PRICE ALERTS', { exact: true }).first()).toBeVisible();

    // Fill the create alert form
    const symbolInput = page.locator('input[placeholder="BTCUSDT, ETHUSDT..."]');
    await symbolInput.fill('BTCUSDT');

    const targetPriceInput = page.locator('input[placeholder="100000"]');
    await targetPriceInput.fill('95000');

    // Submit alert
    await page.locator('button:has-text("Create Alert")').click();

    // Verify alert appears in active alerts section
    await expect(page.locator('text=BTCUSDT').first()).toBeVisible();
    await expect(page.getByText('Crosses above ▲ 95,000')).toBeVisible();
  });

  test('should log a deposit first and then log a finished trade successfully', async ({ page }) => {
    // 1. Log Deposit
    const addTradeBtn = page.locator('button:has-text("+ Add Trade")').first();
    await addTradeBtn.click();
    await expect(page.getByText('ADD TRADE', { exact: true })).toBeVisible();

    // Click on Deposit tab in Modal
    await page.locator('button:has-text("Deposit")').click();
    await expect(page.getByText('LOG DEPOSIT', { exact: true })).toBeVisible();

    // Fill quantity/amount
    await page.locator('div:has(> label:has-text("Amount")) >> input').fill('10000');

    // Confirm checkbox
    await page.locator('input[type="checkbox"]').check();

    // Submit deposit
    await page.locator('button:has-text("Log Deposit ↗")').click();
    await expect(page.getByText('ADD TRADE', { exact: true })).not.toBeVisible();

    // 2. Log finished trade
    await addTradeBtn.click();
    await expect(page.getByText('ADD TRADE', { exact: true })).toBeVisible();

    // Select "Fully Closed" status to show Sell Price input
    await page.locator('button:has-text("Fully Closed")').click();

    // Fill symbol
    const symbolInput = page.locator('input[placeholder="e.g. BTCUSDT"]');
    await symbolInput.fill('ETHUSDT');

    // Fill buy price (entry)
    const buyPriceInput = page.locator('div:has(> label:has-text("Buy Price")) >> input');
    await buyPriceInput.fill('3000');

    // Fill sell price (exit)
    const sellPriceInput = page.locator('div:has(> label:has-text("Sell Price")) >> input');
    await sellPriceInput.fill('3300');

    // Fill quantity
    const qtyInput = page.locator('div:has(> label:has-text("Quantity")) >> input');
    await qtyInput.fill('2');

    // Confirm details checkbox
    await page.locator('input[type="checkbox"]').check();

    // Submit trade
    await page.locator('button:has-text("Add Trade ↗")').click();
    await expect(page.getByText('ADD TRADE', { exact: true })).not.toBeVisible();

    // Verify trade appears in Finished Trades log
    await page.locator('button:has-text("Finished Trades")').click();
    await expect(page.locator('table >> text=ETHUSDT').first()).toBeVisible();
    await expect(page.locator('table >> text=Long').first()).toBeVisible();
  });
});
