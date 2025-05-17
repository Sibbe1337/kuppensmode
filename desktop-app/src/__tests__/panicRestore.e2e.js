const { Application } = require('spectron');
const path = require('path');
const { expect } = require('chai');

describe('Panic Button Restore E2E', function () {
  this.timeout(60000);
  let app;

  before(async function () {
    app = new Application({
      path: require('electron'),
      args: [path.join(__dirname, '..')],
      env: { NODE_ENV: 'test' },
      startTimeout: 20000,
      waitTimeout: 20000,
    });
    await app.start();
    await app.client.waitUntilWindowLoaded();
  });

  after(async function () {
    if (app && app.isRunning()) {
      await app.stop();
    }
  });

  it('should show a success or error message after clicking Panic Restore', async function () {
    // Wait for the main window
    const count = await app.client.getWindowCount();
    expect(count).to.be.greaterThan(0);
    const win = app.browserWindow;
    await win.focus();

    // Find the Panic Restore button and click it
    const btnSelector = 'button.btn-panic';
    await app.client.waitForExist(btnSelector, 10000);
    await app.client.click(btnSelector);

    // Wait for a status message to appear
    const statusSelector = '.status-message';
    await app.client.waitForExist(statusSelector, 10000);
    const statusText = await app.client.getText(statusSelector);
    expect(statusText).to.match(/restore|error|initiated|failed|success/i);
  });
}); 