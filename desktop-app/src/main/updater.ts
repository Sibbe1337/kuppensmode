import { app, ipcMain } from 'electron';
import { autoUpdater, UpdateInfo, UpdateDownloadedEvent, ProgressInfo } from 'electron-updater';
import * as windowManager from './windowManager'; // To send messages to renderer
import log from 'electron-log'; // Recommended for electron-updater logging

let updateInterval: NodeJS.Timeout | null = null;

export function initAutoUpdater() {
  // Configure electron-log to catch logs from electron-updater
  // You can configure electron-log further (e.g., file transport) as needed
  log.transports.file.level = 'info';
  autoUpdater.logger = log;
  // (autoUpdater.logger as any).transports.file.level = 'info'; // This might be redundant if above sets it
  log.info('[Updater] Initializing auto updater...');

  // Optional: If you want to host updates on a private GitHub repo or use a different provider
  // autoUpdater.setFeedURL({
  //   provider: 'github',
  //   owner: 'YOUR_GITHUB_USERNAME_OR_ORG',
  //   repo: 'YOUR_GITHUB_REPO_NAME',
  //   // token: 'YOUR_GH_TOKEN', // If private repo, set token (better via env var)
  // });

  // It's usually better to let the user decide when to download and install an update.
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true; // If downloaded, install on quit

  const getMainWindowForUpdater = () => {
    // This function is to ensure we always try to get the most current mainWindow instance.
    // It might be null if called too early or after window is closed.
    return windowManager.getMainWindow();
  };

  autoUpdater.on('checking-for-update', () => {
    log.info('[Updater] Checking for update...');
    getMainWindowForUpdater()?.webContents.send('updater-event', { event: 'checking-for-update' });
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    log.info('[Updater] Update available:', info);
    getMainWindowForUpdater()?.webContents.send('updater-event', { event: 'update-available', data: info });
    // Optionally, auto-download here if you prefer, or let user trigger it via IPC
    // autoUpdater.downloadUpdate(); 
  });

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    log.info('[Updater] Update not available.', info);
    getMainWindowForUpdater()?.webContents.send('updater-event', { event: 'update-not-available', data: info });
  });

  autoUpdater.on('error', (err: Error) => {
    log.error('[Updater] Error in auto-updater:', err);
    getMainWindowForUpdater()?.webContents.send('updater-event', { event: 'error', data: err.message });
  });

  autoUpdater.on('download-progress', (progressObj: ProgressInfo) => {
    log.info(`[Updater] Download progress: ${progressObj.percent}%`);
    getMainWindowForUpdater()?.webContents.send('updater-event', { event: 'download-progress', data: progressObj });
  });

  autoUpdater.on('update-downloaded', (info: UpdateDownloadedEvent) => {
    log.info('[Updater] Update downloaded. Will quit and install on restart.', info);
    getMainWindowForUpdater()?.webContents.send('updater-event', { event: 'update-downloaded', data: info });
    // autoUpdater.quitAndInstall() can be called here if you want to force it,
    // or better, prompt the user in the renderer and let them trigger it via an IPC call.
  });

  // Check for updates immediately and then periodically
  // Add a delay on startup to ensure the app is fully initialized
  setTimeout(() => {
    log.info('[Updater] First check for updates after startup delay.');
    autoUpdater.checkForUpdates();
  }, 10 * 1000); // 10 seconds delay

  // Check every 4 hours
  if (updateInterval) clearInterval(updateInterval);
  updateInterval = setInterval(() => {
    log.info('[Updater] Periodic check for updates...');
    autoUpdater.checkForUpdates();
  }, 4 * 60 * 60 * 1000);
}

// IPC handler for renderer to trigger download (if autoDownload is false)
ipcMain.on('updater-download-update', () => {
  log.info('[Updater IPC] Received request to download update.');
  autoUpdater.downloadUpdate();
});

// IPC handler for renderer to trigger quit and install
ipcMain.on('updater-quit-and-install', () => {
  log.info('[Updater IPC] Received request to quit and install update.');
  autoUpdater.quitAndInstall();
});

export function checkForUpdatesManual() {
    log.info('[Updater] Manual check for updates triggered.');
    autoUpdater.checkForUpdatesAndNotify(); // Simpler method that shows default notifications
} 