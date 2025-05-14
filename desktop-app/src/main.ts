declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;
declare const AUTH_WINDOW_PRELOAD_VITE_DEV_SERVER_URL: string;
declare const AUTH_WINDOW_PRELOAD_VITE_NAME: string;

import { app, BrowserWindow, Tray, Menu, nativeImage, shell, Notification, ipcMain, NativeImage } from 'electron';
import path from 'node:path';
import fs from 'node:fs'; // Import fs for existsSync
import axios from 'axios'; // Ensure axios is in dependencies
import { URL, URLSearchParams } from 'node:url'; // Import URL and URLSearchParams
import keytar from 'keytar'; // Import keytar
import { base64URLEncode, sha256 } from './main/utils'; // Import from new utils.ts
import {
  KEYTAR_SERVICE, // Will be used by handleSignOut if it directly calls keytar
  KEYTAR_ACCOUNT_JWT, // Will be used by handleSignOut if it directly calls keytar
  getStoredTokenObject as auth_getStoredTokenObject, // Renamed to avoid conflict if a local one existed
  attemptTokenRefresh as auth_attemptTokenRefresh,
  getStoredAccessToken as auth_getStoredAccessToken,
  storeTokenObject as auth_storeTokenObject,
  clearStoredTokens as auth_clearStoredTokens,
  exchangeCodeForTokensAndStore as auth_exchangeCodeForTokensAndStore // Import new function
} from './main/auth';
import * as windowManager from './main/windowManager'; // Import windowManager
import * as trayManager from './main/trayManager'; // Import trayManager
import * as appLifecycle from './main/appLifecycle'; // Import appLifecycle
import * as ipcManager from './main/ipcHandlers'; // Import ipcManager
import * as authService from './main/auth';
import { API_BASE_URL as AppApiBaseUrl } from './main/config'; // Only API_BASE_URL is needed from config by main.ts

// Handle Squirrel Startup Events for Windows (important for installers)
// This should be one of the first things your app does.
if (appLifecycle.handleSquirrelEvents()) {
  // If squirrel handled it, app.quit() was called in the function.
}

// --- App Protocol ---
// const APP_PROTOCOL = 'pagelifeline';
// if (process.defaultApp) {
//   if (process.argv.length >= 2) {
//     app.setAsDefaultProtocolClient(APP_PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
//   }
// } else {
//   app.setAsDefaultProtocolClient(APP_PROTOCOL);
// }
appLifecycle.registerProtocol();
// --- End App Protocol ---

// Tray variable MOVED to trayManager.ts
// let tray: Tray | null = null;

// const API_BASE_URL = 'https://www.pagelifeline.app'; // MOVED to config.ts
// const API_BASE_URL = 'http://localhost:3000'; // For local Next.js dev server

// let deeplinkingUrl: string | undefined; // MOVED to appLifecycle.ts
const ELECTRON_RELAY_CALLBACK_URL = 'https://pagelifeline.app/api/auth/electron-relay'; // For initial redirect to Clerk
const FINAL_APP_CALLBACK_URL = `${appLifecycle.APP_PROTOCOL}://auth-callback`; // Use exported APP_PROTOCOL from appLifecycle

// --- PKCE Helper functions ---
// MOVED to ./main/utils.ts
// function base64URLEncode(str: Buffer): string {
//   return str.toString('base64')
//     .replace(/\+/g, '-')
//     .replace(/\//g, '_')
//     .replace(/=/g, '');
// }

// function sha256(buffer: string): Buffer {
//   return crypto.createHash('sha256').update(buffer).digest();
// }
// --- End PKCE Helpers ---

// --- Constants for Keytar --- (Add these)
// const KEYTAR_SERVICE = 'PageLifelineDesktop';
// const KEYTAR_ACCOUNT_JWT = 'userSessionJWT'; // Storing the JWT directly
// --- End Keytar Constants ---

// --- Token Management Global State ---
let isRefreshingToken = false; // Prevents multiple refresh attempts simultaneously
// --- End Token Management Global State ---

// --- Helper function to show and focus the main window ---
// async function ensureMainWindowVisibleAndFocused() { ... }

// --- Token Management Functions ---
// Token Management Functions (getStoredTokenObject, attemptTokenRefresh, getStoredAccessToken) MOVED to auth.ts
// handleSignOut is KEPT here for now due to direct dependencies on Notification, updateTrayMenu, win.webContents
async function handleSignOut() {
  try {
    await authService.clearStoredTokens(); 
    console.log('[Main.ts] Tokens cleared. Proceeding with UI sign out.');
    new Notification({ title: "PageLifeline: Signed Out", body: "Successfully signed out."}).show();
    await trayManager.updateTrayMenu(); 
    const mainWindow = windowManager.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('user-signed-out');
    }
  } catch (error) {
    console.error('[Main.ts] Error during sign out process:', error);
    new Notification({ title: "PageLifeline: Sign Out Error", body: "Could not sign out properly."}).show();
    await trayManager.updateTrayMenu(); 
  }
}
// --- End Token Management ---


// createWindow MOVED to windowManager.ts
// async function createWindow() { ... }

async function restoreLatest(snapshotId?: string, isRetry = false): Promise<any> {
  console.log(`[main.ts] Attempting to restore snapshot... Retry: ${isRetry}`);
  const accessToken = await authService.getStoredAccessToken(handleSignOut);
  if (!accessToken) {
    new Notification({ title: 'PageLifeline: Authentication Required', body: 'Please sign in first.' }).show();
    if(!isRetry) await trayManager.updateTrayMenu(); 
    return { success: false, message: "Authentication required." };
  }
  if (!snapshotId) {
    new Notification({ title: 'PageLifeline: Restore Failed', body: 'No snapshot selected.' }).show();
    return { success: false, message: 'No snapshot selected.' };
  }
  try {
    const response = await axios.post(
      `${AppApiBaseUrl}/api/restore`,
      { snapshotId },
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    new Notification({ title: 'PageLifeline: Restore Initiated', body: response.data.message || '...progress.' }).show();
    return { success: true, ...response.data };
  } catch (err: any) {
    let errorMessage = 'Failed to initiate restore.';
    if (err.response) {
      errorMessage = err.response.data?.message || err.message || errorMessage;
      if (err.response.status === 401 && !isRetry) {
        const newAccessToken = await authService.attemptTokenRefresh(handleSignOut);
        if (newAccessToken) return restoreLatest(snapshotId, true); 
        else { errorMessage = 'Auth failed. Sign in again.'; await handleSignOut(); }
      } else if (err.response.status === 401 && isRetry) {
        errorMessage = 'Auth failed after retry. Sign in again.'; await handleSignOut();
      }
    }
    new Notification({ title: 'PageLifeline: Restore Failed', body: errorMessage }).show();
    return { success: false, message: errorMessage, errorDetails: err.response?.data };
  }
}

// RESTORED: handleOAuthCallback function definition
async function handleOAuthCallback(callbackUrl: string) {
  console.log(`[MainApp] handleOAuthCallback invoked with URL: ${callbackUrl}`);
  if (!callbackUrl || !callbackUrl.startsWith(appLifecycle.APP_PROTOCOL)) {
    console.warn(`[MainApp] handleOAuthCallback: Received non-custom-protocol or empty URL: ${callbackUrl}. Ignoring.`);
    return;
  }
  console.log(`[MainApp] handleOAuthCallback: Processing URL from relay: ${callbackUrl}`);
  let oneTimeCode: string | null = null; 
  try {
    const parsedUrl = new URL(callbackUrl);
    oneTimeCode = parsedUrl.searchParams.get('one_time_code');
    const error = parsedUrl.searchParams.get('error');

    if (error) {
      const errorDesc = parsedUrl.searchParams.get('error_description');
      console.error(`[MainApp] handleOAuthCallback: Error from relay: ${error}, Description: ${errorDesc}`);
      new Notification({ title: 'Auth Error', body: `Failed: ${errorDesc || error}` }).show();
      return;
    }
    if (!oneTimeCode) {
      console.error('[MainApp] handleOAuthCallback: One-Time Code not found in callback URL from relay.');
      new Notification({ title: 'Auth Error', body: 'Could not get one-time code.' }).show();
      return;
    }
    console.log(`[MainApp] handleOAuthCallback: Extracted One-Time Code: ${oneTimeCode}`);
    
    const authResult = await authService.exchangeCodeForTokensAndStore(oneTimeCode!, AppApiBaseUrl); 
    if (authResult.success && authResult.newAccessToken) {
      new Notification({ title: 'Authentication Successful!', body: 'You are now signed in.' }).show();
      await windowManager.ensureMainWindowVisibleAndFocused();
      await trayManager.updateTrayMenu(); 
    } else {
      throw new Error(authResult.error || 'Failed during token exchange by authService.');
    }
  } catch (error: any) {
    console.error('[MainApp] handleOAuthCallback: ##### OVERALL ERROR #####:', error.message);
    new Notification({ title: 'Auth Error', body: error.message || 'Sign in failed. Check logs.' }).show();
  }
}
// --- End Callbacks ---

// Initialize App Lifecycle Handlers
if (!appLifecycle.requestSingleInstanceLock(handleOAuthCallback)) {
  app.quit(); 
}
appLifecycle.initializeOpenUrlHandler(handleOAuthCallback);
appLifecycle.initializeWindowAllClosedHandler();

// Initialize IPC Handlers, pass AppApiBaseUrl from config
ipcManager.registerAllIpcHandlers(AppApiBaseUrl, handleSignOut, restoreLatest);

// Global VITE variable assignments - REMOVE THESE
// (global as any).MAIN_WINDOW_VITE_DEV_SERVER_URL = MAIN_WINDOW_VITE_DEV_SERVER_URL;
// (global as any).MAIN_WINDOW_VITE_NAME = MAIN_WINDOW_VITE_NAME;

// Callback for the tray to trigger the 'restore-latest-good' action
async function triggerRestoreLatestGoodFromTray() {
  console.log('[Main.ts] Tray requested \'restore-latest-good\'. Calling IPC handler logic.'); // Corrected string concatenation
  try {
    const result = await ipcManager.performRestoreLatestGood(); 
    console.log('[Main.ts] Result from performRestoreLatestGood via tray:', result);
  } catch (error) {
    console.error('[Main.ts] Error calling performRestoreLatestGood from tray:', error);
    new Notification({title: "Restore Error", body: "Could not start latest good restore via tray."}).show();
  }
}

app.whenReady().then(async () => {
  console.log('[AppEvent] App is ready.');
  // windowManager.createMainWindow() will use the declared constants directly from its own scope
  await windowManager.createMainWindow(); 
  await trayManager.initTray(handleSignOut, triggerRestoreLatestGoodFromTray); 
  console.log('[AppEvent] Core initializations complete (Window, Tray, IPC Handlers, Lifecycle).');

  const initialUrl = appLifecycle.getInitialDeeplinkUrl();
  if (initialUrl) {
    console.log(`[AppEvent] Processing initial deeplink URL on ready: ${initialUrl}`);
    handleOAuthCallback(initialUrl);
  } else {
    console.log('[AppEvent] No initial deeplink URL to process on ready.');
  }
});

app.on('window-all-closed', () => {
  // On macOS, apps usually stay active in the tray.
  // On other platforms, we also keep it running unless explicitly quit from tray.
  // Electron Forge default behavior might quit if not darwin; this ensures it stays for tray.
  if (process.platform !== 'darwin') {
    // app.quit(); // Keep commented to ensure tray app stays running
  }
});
