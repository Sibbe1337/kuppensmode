import { BrowserWindow } from 'electron';
import path from 'node:path';

// These are declared by Electron Forge, need to ensure they are available or handled.
// If this file is outside the direct scope where these are injected, we might need a way to pass them.
// For now, assume they are accessible or we adapt if errors occur.
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;
// declare const AUTH_WINDOW_PRELOAD_VITE_DEV_SERVER_URL: string; // If auth window also uses Vite
// declare const AUTH_WINDOW_PRELOAD_VITE_NAME: string; // If auth window also uses Vite

let mainWindow: BrowserWindow | null = null;
let authWindow: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false, 
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'), // Adjusted path assuming this file is in src/main/
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)); // Adjusted path
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  return mainWindow; // Return the created window
}

export async function ensureMainWindowVisibleAndFocused() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    console.log('[WindowManager] Main window doesn\'t exist or was destroyed. Creating new one.');
    await createMainWindow(); 
  }

  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      console.log('[WindowManager] Main window is minimized. Restoring.');
      mainWindow.restore();
    }
    if (!mainWindow.isVisible()) {
        console.log('[WindowManager] Main window is not visible. Showing.');
        mainWindow.show(); 
    }
    console.log('[WindowManager] Focusing main window.');
    mainWindow.focus();
  } else {
    console.error('[WindowManager] CRITICAL: Main window still null after attempting to create it.');
  }
}

export function showAuthWindow(authPageUrl: string, preloadPath: string) {
  if (authWindow && !authWindow.isDestroyed()) {
    authWindow.focus();
    return;
  }
  
  console.log(`[WindowManager] Opening auth window with URL: ${authPageUrl}`);
  console.log('[WindowManager] Attempting to load preload script for auth window from:', preloadPath);

  authWindow = new BrowserWindow({
    width: 420, 
    height: 640, 
    show: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    },
  });
  authWindow.loadURL(authPageUrl);
  authWindow.on('closed', () => {
    authWindow = null;
  });
}

export function closeAuthWindow() {
    if (authWindow && !authWindow.isDestroyed()) {
        authWindow.close();
        authWindow = null;
    }
} 