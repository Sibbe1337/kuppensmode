import { app, Tray, Menu, nativeImage, NativeImage, ipcMain, Notification } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import * as authService from './auth';
import * as windowManager from './windowManager';

// handleSignOut is tricky. It lives in main.ts due to Notification and IPC calls.
// For trayManager to call it, main.ts would have to pass it to trayManager.init().
// Or, trayManager could emit an event that main.ts listens to.
// For now, let's assume main.ts passes a pre-bound handleSignOut function.
let _handleSignOut: () => Promise<void>;
// _restoreLatest callback is no longer strictly needed for the "latest good" tray item,
// as that action will now be handled by a dedicated IPC call.
// However, keeping it in initTray in case other specific restore options are added to the tray later.
let _legacyRestoreLatestWithId: (snapshotId?: string) => Promise<void>; 
let _triggerRestoreLatestGood: () => void;
let tray: Tray | null = null;

function getTrayIconPath(): string {
    let iconPath: string;
    // For macOS, it uses trayTemplate.png. For others, icon.png.
    const iconFileName = process.platform === 'darwin' ? 'trayTemplate.png' : 'icon.png'; 

    if (app.isPackaged) {
        const base = path.dirname(app.getPath('exe'));
        let platformSpecificIconName = iconFileName;
        
        // For Windows packaged app, prefer .ico if named icon.ico
        if (process.platform === 'win32') {
            const icoPath = path.join(base, 'assets', 'icon.ico');
            if (fs.existsSync(icoPath)) {
                platformSpecificIconName = 'icon.ico'; // Use icon.ico if present
            }
            // If icon.ico isn't there, it will fall back to icon.png via iconFileName
        }
        
        iconPath = path.join(base, 'assets', platformSpecificIconName);
        if (!fs.existsSync(iconPath)) {
            // Fallback to resourcesPath
            iconPath = path.join(process.resourcesPath, 'assets', platformSpecificIconName);
             // If windows .ico was preferred but not found, try .png in resources
            if (process.platform === 'win32' && platformSpecificIconName === 'icon.ico' && !fs.existsSync(iconPath)) {
                 const pngPathInResources = path.join(process.resourcesPath, 'assets', 'icon.png');
                 if (fs.existsSync(pngPathInResources)) iconPath = pngPathInResources;
            }
        }
    } else {
        // Development: assumes assets are at project_root/desktop-app/assets/
        // __dirname in src/main/trayManager.ts (compiled to dist/main/trayManager.js)
        // ../../assets goes from dist/main -> dist -> desktop-app -> assets
        iconPath = path.join(__dirname, '../../assets', iconFileName);
        // For dev Windows, also check for .ico first
        if (process.platform === 'win32') {
            const icoDevPath = path.join(__dirname, '../../assets', 'icon.ico');
            if (fs.existsSync(icoDevPath)) {
                iconPath = icoDevPath;
            }
        }
        console.log(`[TrayManager-Dev] Attempting icon path: ${iconPath}`);
    }
    return iconPath;
}

function loadNativeImage(iconPath: string): NativeImage {
    if (!fs.existsSync(iconPath)) {
        console.error(`[TrayManager] Icon file NOT FOUND at: ${iconPath}`);
        if (process.platform === 'darwin') {
            const systemIcon = nativeImage.createFromNamedImage('NSActionTemplate', [-1,-1,-1,-1]);
            if (systemIcon && !systemIcon.isEmpty()) return systemIcon;
        }
        return nativeImage.createEmpty(); 
    }
    try {
        const img = nativeImage.createFromPath(iconPath);
        if (img.isEmpty()) throw new Error('Icon is empty after loading.');
        if (process.platform === 'darwin') img.setTemplateImage(true);
        return img;
    } catch (e) {
        console.error(`[TrayManager] CRITICAL ERROR creating NativeImage from ${iconPath}:`, e);
        return nativeImage.createEmpty();
    }
}

export async function updateTrayMenu() {
    if (!tray) {
        console.warn('[TrayManager] Attempted to update tray menu, but tray object is null.');
        return;
    }
    if (!_handleSignOut) {
        console.error('[TrayManager] Sign out function not initialized for tray.');
        // Attempt to build a minimal menu anyway or return
        const minimalMenu = Menu.buildFromTemplate([
            { label: 'Quit PageLifeline', click: () => app.quit() }
        ]);
        tray.setContextMenu(minimalMenu);
        return;
    }

    const accessToken = await authService.getStoredAccessToken(_handleSignOut); 
    let menuTemplate: Electron.MenuItemConstructorOptions[];

    if (accessToken) {
        menuTemplate = [
            { 
              label: 'Restore Latest Good Snapshot',
              click: async () => {
                try {
                  console.log('[TrayManager] Restore Latest Good Snapshot clicked. Invoking IPC handler...');
                  ipcMain.emit('trigger-restore-latest-good');
                  await _triggerRestoreLatestGood();
                  new Notification({ title: 'Restore Initiated', body: 'Restore of latest good snapshot started.' }).show();
                } catch (err: any) {
                  console.error('[TrayManager] Error restoring latest good snapshot:', err);
                  new Notification({ title: 'Restore Failed', body: err?.message || 'Failed to start restore.' }).show();
                }
              }
            }, 
            { label: 'Show Main Window', click: windowManager.ensureMainWindowVisibleAndFocused },
            { type: 'separator' },
            { label: 'Sign Out', click: _handleSignOut },
            { label: 'Quit PageLifeline', click: () => app.quit() },
        ];
    } else {
        menuTemplate = [
            {
                label: 'Sign In with PageLifeline',
                click: () => {
                    const authPageUrl = "https://www.pagelifeline.app/electron-auth";
                    const preloadPath = path.join(__dirname, '../preload.js'); 
                    windowManager.showAuthWindow(authPageUrl, preloadPath);
                }
            },
            // { label: 'Restore latest good snapshot', enabled: false, click: _legacyRestoreLatestWithId }, // Keep if needed for other restore types 
            { label: 'Restore Latest Good Snapshot', enabled: false }, // Disabled when signed out
            { type: 'separator' },
            { label: 'Show Main Window', click: windowManager.ensureMainWindowVisibleAndFocused },
            { label: 'Quit PageLifeline', click: () => app.quit() },
        ];
    }
    const currentContextMenu = Menu.buildFromTemplate(menuTemplate);
    tray.setContextMenu(currentContextMenu);
    console.log('[TrayManager] Tray context menu updated. Signed in status:', !!accessToken);
}

export async function initTray(
    handleSignOutCallback: () => Promise<void>,
    // restoreLatestCallback: () => Promise<void>, // No longer passing the old restoreLatest directly for this item
    triggerRestoreLatestGoodCallback: () => void // New callback for this specific action
) {
    _handleSignOut = handleSignOutCallback;
    // _legacyRestoreLatestWithId = restoreLatestCallback; // Store if needed for other menu items
    _triggerRestoreLatestGood = triggerRestoreLatestGoodCallback;

    try {
        const iconPath = getTrayIconPath();
        const image = loadNativeImage(iconPath);
        tray = new Tray(image);
        
        console.log('[TrayManager] Tray object created successfully from:', iconPath);
        await updateTrayMenu(); 
        tray.setToolTip('PageLifeline Desktop');
        console.log('[TrayManager] Tray tooltip and context menu set.');

    } catch (e) {
        console.error('[TrayManager] FAILED TO CREATE TRAY OR SET CONTEXT MENU:', e);
        tray = null; 
    }
} 