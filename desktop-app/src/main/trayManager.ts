import { app, Tray, Menu, nativeImage, NativeImage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import * as authService from './auth';
import * as windowManager from './windowManager';

// handleSignOut is tricky. It lives in main.ts due to Notification and IPC calls.
// For trayManager to call it, main.ts would have to pass it to trayManager.init().
// Or, trayManager could emit an event that main.ts listens to.
// For now, let's assume main.ts passes a pre-bound handleSignOut function.
let _handleSignOut: () => Promise<void>;
let _restoreLatest: () => Promise<void>; // Similar for restoreLatest

let tray: Tray | null = null;

function getTrayIconPath(): string {
    let iconPath: string;
    const iconFileName = process.platform === 'darwin' ? 'trayTemplate.png' : 'icon.png';

    if (app.isPackaged) {
        const base = path.dirname(app.getPath('exe'));
        let platformSpecificIconName = iconFileName;
        // Windows might prefer .ico
        if (process.platform === 'win32') platformSpecificIconName = 'icon.ico';
        
        iconPath = path.join(base, 'assets', platformSpecificIconName);
        // Fallback for macOS .app structure and Windows if not in exe/assets
        if (!fs.existsSync(iconPath)) {
            iconPath = path.join(process.resourcesPath, 'assets', platformSpecificIconName);
        }
        // If .ico wasn't found for win32 in either, try .png as a final fallback
        if (process.platform === 'win32' && !fs.existsSync(iconPath) && platformSpecificIconName === 'icon.ico') {
            iconPath = path.join(base, 'assets', 'icon.png');
            if (!fs.existsSync(iconPath)) {
                iconPath = path.join(process.resourcesPath, 'assets', 'icon.png');
            }
        }
    } else {
        // Development: path relative to project root, assuming this file is in src/main/
        iconPath = path.join(__dirname, '../../assets', iconFileName);
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
    if (!_handleSignOut || !_restoreLatest) {
        console.error('[TrayManager] Sign out or restore function not initialized for tray.');
        return;
    }

    const accessToken = await authService.getStoredAccessToken(_handleSignOut); // Pass the sign out callback
    let menuTemplate: Electron.MenuItemConstructorOptions[];

    if (accessToken) {
        menuTemplate = [
            { label: 'Restore latest good snapshot', click: _restoreLatest }, 
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
                    const preloadPath = path.join(__dirname, '../preload.js'); // Path relative to this file in src/main/
                    windowManager.showAuthWindow(authPageUrl, preloadPath);
                }
            },
            { label: 'Restore latest good snapshot', enabled: false, click: _restoreLatest }, 
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
    restoreLatestCallback: () => Promise<void>
) {
    _handleSignOut = handleSignOutCallback;
    _restoreLatest = restoreLatestCallback;

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
        tray = null; // Ensure tray is null if creation failed
    }
} 