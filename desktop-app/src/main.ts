declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

import { app, BrowserWindow, Tray, Menu, nativeImage, shell, Notification, ipcMain, NativeImage } from 'electron';
import path from 'node:path';
import fs from 'node:fs'; // Import fs for existsSync
import axios from 'axios'; // Ensure axios is in dependencies
import { URL, URLSearchParams } from 'node:url'; // Import URL and URLSearchParams
import crypto from 'node:crypto'; // For PKCE
import keytar from 'keytar'; // Import keytar

// Handle Squirrel Startup Events for Windows (important for installers)
// This should be one of the first things your app does.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// --- App Protocol ---
const APP_PROTOCOL = 'pagelifeline';
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(APP_PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient(APP_PROTOCOL);
}
// --- End App Protocol ---

let win: BrowserWindow | null = null; // Renamed to avoid conflict with window global
let tray: Tray | null = null;
let authWindow: BrowserWindow | null = null; // Keep a reference to the auth window

const API_BASE_URL = 'https://www.pagelifeline.app';
// const API_BASE_URL = 'http://localhost:3000'; // For local Next.js dev server

let deeplinkingUrl: string | undefined;
const CLERK_CLIENT_ID = 'pk_live_Y2xlcmsucGFnZWxpZmVsaW5lLmFwcCQ';
const CLERK_TOKEN_ENDPOINT = 'https://clerk.pagelifeline.app/oauth/token';
const CLERK_CLIENT_SECRET = 'sk_live_2zbanEkqqOqlpJf6aNZXVW3r9Cod69okaXIqP1lnuX'; // Add this line; // Your actual token endpoint
const ELECTRON_RELAY_CALLBACK_URL = 'https://pagelifeline.app/api/auth/electron-relay'; // For initial redirect to Clerk
const FINAL_APP_CALLBACK_URL = `${APP_PROTOCOL}://auth-callback`; // For redirect from relay to Electron app

// --- PKCE Helper functions ---
function base64URLEncode(str: Buffer): string {
  return str.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function sha256(buffer: string): Buffer {
  return crypto.createHash('sha256').update(buffer).digest();
}

let pkceCodeVerifier: string | null = null;
// --- End PKCE Helpers ---

// --- Constants for Keytar --- (Add these)
const KEYTAR_SERVICE = 'PageLifelineDesktop';
const KEYTAR_ACCOUNT_JWT = 'userSessionJWT'; // Storing the JWT directly
// --- End Keytar Constants ---

async function createWindow() {
  win = new BrowserWindow({
    width: 800, // Main app window can be larger
    height: 600,
    show: false, 
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), 
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)); 
  }
  win.on('closed', () => { win = null; });
}

async function restoreLatest() {
  console.log('[main.ts] Attempting to restore latest good snapshot...');
  const jwt = await getStoredJwt();

  if (!jwt) {
    console.warn('[main.ts] No JWT found. Please sign in first.');
    new Notification({
      title: 'PageLifeline: Authentication Required',
      body: 'Please sign in first to restore a snapshot.'
    }).show();
    // TODO: Optionally trigger the sign-in flow here
    return { success: false, message: "Authentication required." };
  }

  console.log('[main.ts] Using JWT for restore API call.');
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/restore/latest-good`,
      {},
      { headers: { 'Authorization': `Bearer ${jwt}` } }
    );
    console.log('[main.ts] Restore API response status:', response.status);
    new Notification({
      title: 'PageLifeline: Restore Initiated',
      body: response.data.message || 'Check your dashboard for progress.' 
    }).show();
    return { success: true, ...response.data };
  } catch (err: any) {
    console.error('[main.ts] Restore API call failed:', err.isAxiosError ? err.toJSON() : err);
    let errorMessage = 'Failed to initiate restore.';
    if (err.response) {
      console.error('[main.ts] Restore API error response data:', err.response.data);
      errorMessage = err.response.data?.message || err.message || errorMessage;
      if (err.response.status === 401) {
        errorMessage = 'Authentication failed. JWT might be expired or invalid. Please sign in again.';
        // TODO: Clear stored JWT? Trigger re-authentication?
        await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_JWT);
        console.log('[main.ts] Invalid JWT detected during API call, cleared from keychain.');
      }
    }
    new Notification({ title: 'PageLifeline: Restore Failed', body: errorMessage }).show();
    return { success: false, message: errorMessage, errorDetails: err.response?.data };
  }
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    console.log(`[AppEvent] !!!!! SECOND-INSTANCE event. Full commandLine: ${commandLine.join(' ')} !!!!!`);
    const urlOpened = commandLine.find((arg) => arg.startsWith(`${APP_PROTOCOL}://`));
    if (urlOpened) {
      console.log(`[AppEvent] URL found in second-instance: ${urlOpened}. Calling handleOAuthCallback.`);
      deeplinkingUrl = undefined; 
      handleOAuthCallback(urlOpened);
      if (win && win.isMinimized()) win.restore();
      if (win) win.focus();
    } else if (win) {
      console.log('[AppEvent] second-instance: No protocol URL, focusing window.');
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

app.on('open-url', (event, url) => {
  console.log(`[AppEvent] !!!!! MACOS OPEN-URL event. URL: ${url} !!!!!`);
  event.preventDefault(); 
  deeplinkingUrl = undefined; 
  handleOAuthCallback(url);
  if (win && win.isMinimized()) win.restore(); 
  if (win) win.focus(); 
});

function getTrayIcon(): NativeImage {
  let iconPath: string;
  const iconFileName = process.platform === 'darwin' ? 'trayTemplate.png' : 'icon.png';

  if (app.isPackaged) {
    const packagedAssetsPath = path.join(path.dirname(app.getPath('exe')), 'assets');
    iconPath = path.join(packagedAssetsPath, iconFileName);
    if (!fs.existsSync(iconPath) && process.platform === 'darwin') {
        iconPath = path.join(process.resourcesPath, 'assets', iconFileName); // iconFileName already has trayTemplate.png for darwin
    }
     if (!fs.existsSync(iconPath) && process.platform === 'win32') { 
        const icoPath = path.join(path.dirname(app.getPath('exe')), 'assets', 'icon.ico');
        if (fs.existsSync(icoPath)) iconPath = icoPath; // Prefer .ico if available for Windows
        else if (!fs.existsSync(iconPath)) { // if icon.png also not found at exe/assets
            iconPath = path.join(process.resourcesPath, 'assets', 'icon.ico'); // Fallback to resources for .ico
             if (!fs.existsSync(iconPath)) { // if .ico also not found in resources, try .png in resources
                 iconPath = path.join(process.resourcesPath, 'assets', 'icon.png');
             }
        }
    }
  } else {
    iconPath = path.join(__dirname, '..', 'assets', iconFileName);
  }

  console.log(`[getTrayIcon] Determined icon path: ${iconPath}`);

  if (!fs.existsSync(iconPath)) {
    console.error(`[getTrayIcon] Icon file NOT FOUND at: ${iconPath}`);
    if (process.platform === 'darwin') {
        const systemIcon = nativeImage.createFromNamedImage('NSActionTemplate', [-1,-1,-1,-1]);
        if (systemIcon && !systemIcon.isEmpty()) {
            console.log('[getTrayIcon] Using system NSActionTemplate as fallback because file not found.');
            return systemIcon;
        }
    }
    console.log('[getTrayIcon] Creating empty image as final fallback (file not found).');
    return nativeImage.createEmpty();
  }

  try {
    const img = nativeImage.createFromPath(iconPath);
    if (!img) { 
      console.error(`[getTrayIcon] nativeImage.createFromPath(${iconPath}) returned null.`);
      throw new Error('createFromPath returned null');
    }
    if (img.isEmpty()) {
      console.error(`[getTrayIcon] Icon at ${iconPath} IS EMPTY after loading.`);
      throw new Error(`Icon at ${iconPath} is empty.`);
    }

    console.log(`[getTrayIcon] Successfully created NativeImage from: ${iconPath}. Size: ${img.getSize().width}x${img.getSize().height}`);
    if (process.platform === 'darwin') {
      img.setTemplateImage(true);
      console.log('[getTrayIcon] Applied setTemplateImage(true) for macOS.');
    }
    return img;
  } catch (e) {
    console.error(`[getTrayIcon] CRITICAL ERROR creating NativeImage from path: ${iconPath}. Error:`, e);
    if (process.platform === 'darwin') {
        const systemIcon = nativeImage.createFromNamedImage('NSActionTemplate', [-1,-1,-1,-1]);
        if (systemIcon && !systemIcon.isEmpty()) {
            console.log('[getTrayIcon] Using system NSActionTemplate due to error.');
            return systemIcon;
        }
    }
    console.log('[getTrayIcon] Creating empty image as final fallback (due to error).');
    return nativeImage.createEmpty();
  }
}

async function handleOAuthCallback(callbackUrl: string) {
  console.log(`[handleOAuthCallback] ##### INVOKED with URL: ${callbackUrl} #####`);
  if (!callbackUrl || !callbackUrl.startsWith(APP_PROTOCOL)) {
    console.warn(`[handleOAuthCallback] Received non-custom-protocol or empty URL: ${callbackUrl}. Ignoring.`);
    return;
  }
  console.log(`[handleOAuthCallback] Processing URL from relay: ${callbackUrl}`);
  try {
    const parsedUrl = new URL(callbackUrl);
    const oneTimeCode = parsedUrl.searchParams.get('one_time_code');
    const error = parsedUrl.searchParams.get('error');

    if (error) {
      const errorDesc = parsedUrl.searchParams.get('error_description');
      console.error(`[handleOAuthCallback] Error received from relay: ${error}, Description: ${errorDesc}`);
      new Notification({ title: 'Auth Error', body: `Failed: ${errorDesc || error}` }).show();
      return;
    }

    if (!oneTimeCode) {
      console.error('[handleOAuthCallback] One-Time Code not found in callback URL from relay.');
      new Notification({ title: 'Auth Error', body: 'Could not get one-time code.' }).show();
      return;
    }
    console.log(`[handleOAuthCallback] Extracted One-Time Code: ${oneTimeCode}`);

    // Step 2: Exchange OTC for actual tokens with your backend
    const exchangeOtcUrl = `${API_BASE_URL}/api/auth/exchange-otc`; // New backend endpoint needed
    console.log(`[handleOAuthCallback] Exchanging OTC at: ${exchangeOtcUrl}`);
    const tokenResponse = await axios.post(exchangeOtcUrl, { oneTimeCode });

    console.log('[handleOAuthCallback] OTC exchange response status:', tokenResponse.status);

    const { accessToken, refreshToken, idToken, expiresIn, userId } = tokenResponse.data; 
    // Ensure your /api/auth/exchange-otc returns these fields

    if (!accessToken) {
        throw new Error('Access Token not received from OTC exchange.');
    }

    const tokensToStore = {
      accessToken,
      refreshToken,
      idToken,
      expiresIn: expiresIn || 3600,
      obtainedAt: Date.now()
    };

    await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_JWT, JSON.stringify(tokensToStore));
    console.log('[handleOAuthCallback] Tokens securely stored in keychain.');
    const retrievedTokenString = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_JWT);
    if (retrievedTokenString) {
      console.log('[handleOAuthCallback] Verified stored tokens (debug):', JSON.parse(retrievedTokenString));
    }
    console.log('[handleOAuthCallback] Tokens received and processed successfully. User ID:', userId );
    new Notification({ title: 'Authentication Successful!', body: 'You are now signed in.' }).show();
    if(win && !win.isVisible() && !win.isMinimized()) win.show();
    if(win) win.focus();

  } catch (error: any) {
    console.error('[handleOAuthCallback] ##### ERROR exchanging OTC or storing tokens #####:', error.isAxiosError ? error.toJSON() : error);
    if (error.response) {
      console.error('[handleOAuthCallback] OTC Exchange Error response data:', error.response.data);
    }
    new Notification({ title: 'Auth Error', body: 'Failed to complete sign in. Check logs.' }).show();
  }
}

async function getStoredJwt(): Promise<string | null> {
  try {
    const jwt = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_JWT);
    if (jwt) {
      // TODO: Add JWT expiry check here if possible (decode JWT, check 'exp' claim)
      // For now, we assume if it exists, it might be valid or refresh handled by API calls / re-auth
      console.log('[main.ts] JWT retrieved from keychain.');
      return jwt;
    }
    console.log('[main.ts] No JWT found in keychain.');
    return null;
  } catch (error) {
    console.error('[main.ts] Error retrieving JWT from keychain:', error);
    return null;
  }
}

app.whenReady().then(async () => {
  console.log('[AppEvent] App is ready.');
  await createWindow();
  
  try {
    tray = new Tray(getTrayIcon()); 
    console.log('[AppEvent] Tray object created successfully.');

    if (process.platform === 'darwin' && tray && typeof tray.setTitle === 'function') {
        tray.setTitle("Test"); 
        setTimeout(() => tray!.setTitle(""), 2000); 
    }

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Sign In with PageLifeline',
        click: () => {
          if (authWindow && !authWindow.isDestroyed()) {
            authWindow.focus();
            return;
          }
          const authPageUrl = "https://www.pagelifeline.app/electron-auth";
          console.log(`[SignInClick] Opening auth window with URL: ${authPageUrl}`);
          authWindow = new BrowserWindow({
            width: 420, height: 640, show: true,
            webPreferences: { 
              preload: path.join(__dirname, 'preload.js'), // Critical for IPC
              contextIsolation: true, 
              nodeIntegration: false 
            }, 
          });
          authWindow.loadURL(authPageUrl);
          authWindow.on('closed', () => { authWindow = null; });
        }
      },
      { label: 'Restore latest good snapshot', click: restoreLatest },
      { type: 'separator' },
      { label: 'Show Main Window', click: () => { 
          if (!win || win.isDestroyed()) { 
              createWindow().then(() => win?.show()); 
          } else { 
              win.show(); win.focus(); 
          }
        }
      },
      { label: 'Quit PageLifeline', click: () => app.quit() },
    ]);
    tray.setToolTip('PageLifeline Desktop');
    tray.setContextMenu(contextMenu);
    console.log('[AppEvent] Tray tooltip and context menu set.');

    // if (process.platform === 'darwin') {
    //   app.dock.hide();
    //   console.log('[main.ts] app.dock.hide() called for macOS.');
    // }

  } catch (e) {
    console.error('[AppEvent] FAILED TO CREATE TRAY OR SET CONTEXT MENU:', e);
  }

  // Initial URL check
  let initialUrlToProcess: string | undefined = undefined;
  if (process.platform === 'darwin') {
    initialUrlToProcess = process.argv.find(arg => arg.startsWith(`${APP_PROTOCOL}://`));
    console.log(`[AppEvent] macOS initial argv check. Found URL: ${initialUrlToProcess}`);
  } else {
    initialUrlToProcess = process.argv.find(arg => arg.startsWith(`${APP_PROTOCOL}://`)) || deeplinkingUrl;
    console.log(`[AppEvent] Win/Linux initial argv/deeplink check. Found URL: ${initialUrlToProcess}`);
  }

  if (initialUrlToProcess) {
    console.log(`[AppEvent] Processing initial deeplink URL on ready: ${initialUrlToProcess}`);
    handleOAuthCallback(initialUrlToProcess);
    deeplinkingUrl = undefined; 
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

// IPC Handlers for Clerk Auth
ipcMain.on('clerk-auth-success', async (event, { sessionId, token }) => {
  console.log(`[IPC Main] clerk-auth-success received. Session: ${sessionId}, Token (first 10): ${token?.substring(0,10)}...`);
  if (token) {
    try {
      await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_JWT, token);
      console.log('[IPC Main] JWT securely stored in keychain.');
      new Notification({
        title: "PageLifeline: Signed In",
        body: "You have successfully signed in to the desktop app.",
      }).show();
      // TODO: Update tray menu (e.g., change "Sign In" to "Sign Out", enable features)
    } catch (keytarError) {
      console.error('[IPC Main] Failed to store JWT with keytar:', keytarError);
      new Notification({
        title: "PageLifeline: Sign In Error",
        body: "Could not securely save your session. Please try again.",
      }).show();
    }
  } else {
    console.warn('[IPC Main] clerk-auth-success received, but no token provided.');
  }
  if (authWindow && !authWindow.isDestroyed()) {
    authWindow.close();
  }
});

ipcMain.on('clerk-auth-error', (event, { error }) => {
  console.error('[IPC Main] clerk-auth-error received:', error);
  new Notification({
    title: "PageLifeline: Sign In Failed",
    body: error || "An unknown error occurred during sign-in.",
  }).show();
  if (authWindow && !authWindow.isDestroyed()) {
    authWindow.close();
  }
});