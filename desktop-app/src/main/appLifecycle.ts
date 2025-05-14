import { app } from 'electron';
import path from 'node:path';
import * as windowManager from './windowManager'; // To focus window

export const APP_PROTOCOL = 'pagelifeline';
let deeplinkingUrl: string | undefined; // Keep this managed here or pass if needed by main

// Callback types for functions that will still reside in main.ts or other modules
type HandleOAuthCallbackType = (url: string) => void;

let _handleOAuthCallback: HandleOAuthCallbackType;

export function handleSquirrelEvents(): boolean {
  if (require('electron-squirrel-startup')) {
    app.quit();
    return true;
  }
  return false;
}

export function registerProtocol() {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(APP_PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient(APP_PROTOCOL);
  }
  console.log(`[AppLifecycle] Registered protocol client for ${APP_PROTOCOL}`);
}

export function requestSingleInstanceLock(handleOAuthCallback: HandleOAuthCallbackType): boolean {
  _handleOAuthCallback = handleOAuthCallback; // Store the callback

  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
  } else {
    app.on('second-instance', (event, commandLine) => {
      console.log(`[AppLifecycle] second-instance event. Args: ${commandLine.join(' ')}`);
      const urlOpened = commandLine.find((arg) => arg.startsWith(`${APP_PROTOCOL}://`));
      const mainWindow = windowManager.getMainWindow();
      if (urlOpened) {
        console.log(`[AppLifecycle] URL found in second-instance: ${urlOpened}.`);
        deeplinkingUrl = undefined; // Clear any stored deeplink
        if (_handleOAuthCallback) {
            _handleOAuthCallback(urlOpened);
        } else {
            console.error('[AppLifecycle] _handleOAuthCallback not initialized for second-instance.');
        }
        // Focusing logic can remain here or be part of what _handleOAuthCallback does via windowManager
        if (mainWindow && mainWindow.isMinimized()) mainWindow.restore();
        if (mainWindow) mainWindow.focus();

      } else if (mainWindow) {
        console.log('[AppLifecycle] second-instance: No protocol URL, focusing main window.');
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });
  }
  return gotTheLock;
}

export function initializeOpenUrlHandler(handleOAuthCallback: HandleOAuthCallbackType) {
    if (!_handleOAuthCallback) _handleOAuthCallback = handleOAuthCallback; // Store if not already set

    app.on('open-url', (event, url) => {
        console.log(`[AppLifecycle] open-url event. URL: ${url}`);
        event.preventDefault();
        deeplinkingUrl = undefined; // Clear any stored deeplink
        if (_handleOAuthCallback) {
            _handleOAuthCallback(url);
        } else {
            console.error('[AppLifecycle] _handleOAuthCallback not initialized for open-url.');
        }
        // Focusing logic here too, or ensure _handleOAuthCallback handles it
        const mainWindow = windowManager.getMainWindow();
        if (mainWindow && mainWindow.isMinimized()) mainWindow.restore(); 
        if (mainWindow) mainWindow.focus(); 
    });
}

export function getInitialDeeplinkUrl(): string | undefined {
    let initialUrl: string | undefined = undefined;
    if (process.platform !== 'darwin') { // On Win/Linux, deeplinkingUrl might be set by first instance
        initialUrl = deeplinkingUrl;
    }
    // For all platforms, check argv, which is more reliable for first launch
    const argvUrl = process.argv.find(arg => arg.startsWith(`${APP_PROTOCOL}://`));
    if(argvUrl) initialUrl = argvUrl;
    
    if (initialUrl) deeplinkingUrl = undefined; // Consume it
    return initialUrl;
}

export function setDeeplinkingUrl(url: string | undefined) {
    deeplinkingUrl = url;
}

export function initializeWindowAllClosedHandler() {
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      // app.quit(); // Original behavior was to keep tray app running
    }
    console.log('[AppLifecycle] window-all-closed event.');
  });
} 