import { test, expect } from '@playwright/test';

test('dashboard loads and shows snapshot count', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Debug: Print current URL
  console.log('Current URL:', page.url());

  // Debug: Take a screenshot and print HTML before waiting for selector
  await page.screenshot({ path: 'tests/debug-screenshot.png', fullPage: true });
  console.log('Page HTML:', await page.content());

  // Wait for the dashboard selector with a longer timeout
  await page.waitForSelector('.dashboard', { timeout: 60000 });
  
  // Adjust selector for snapshot count as needed
  const snapshotCount = await page.textContent('.snapshot-count');
  expect(snapshotCount).toContain('0');
}); 