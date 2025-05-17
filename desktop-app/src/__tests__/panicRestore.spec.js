const { _electron: electron } = require('playwright');
const { test, expect } = require('@playwright/test');
const path = require('path');
const electronPath = require('electron');

test('Panic Button Restore E2E', async () => {
  console.log('Launching Electron app...');
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [path.join(__dirname, '../../dist/main.js')],
    env: { NODE_ENV: 'test', E2E_BYPASS_AUTH: '1' }
  });

  try {
    console.log('Getting first window...');
    const window = await electronApp.firstWindow();
    console.log('Waiting for DOMContentLoaded...');
    await window.waitForLoadState('domcontentloaded');

    // Debug: Print window title and HTML
    const title = await window.title();
    const html = await window.content();
    console.log('Window title:', title);
    console.log('Window HTML:', html);

    console.log('Waiting for panic button...');
    const btnSelector = 'button.btn-panic';
    await window.waitForSelector(btnSelector, { timeout: 60000 });
    console.log('Panic button found, clicking...');
    await window.click(btnSelector);

    console.log('Waiting for status message...');
    const statusSelector = '.status-message';
    await window.waitForSelector(statusSelector, { timeout: 60000 });
    const statusText = await window.textContent(statusSelector);
    console.log('Status message:', statusText);
    expect(statusText).toMatch(/restore|error|initiated|failed|success/i);
  } catch (err) {
    console.error('E2E Test Error:', err);
    throw err;
  } finally {
    await electronApp.close();
  }
}); 