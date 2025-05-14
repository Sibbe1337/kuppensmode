import { ipcMain, Notification } from 'electron';
import axios from 'axios';
import path from 'node:path';
import * as authService from './auth';
import * as windowManager from './windowManager';

// These functions are still in main.ts and are used by some IPC handlers.
// They need to be passed or imported if this module is to be fully independent.
// For now, we assume they can be called if main.ts passes them or if we solve this dependency later.
let _mainHandleSignOut: () => Promise<void>;
let _mainRestoreLatest: (snapshotId?: string, isRetry?: boolean) => Promise<any>;
let _API_BASE_URL: string;

function initDependencies(
    apiBaseUrl: string,
    handleSignOut: () => Promise<void>,
    restoreLatest: (snapshotId?: string, isRetry?: boolean) => Promise<any> 
) {
    _API_BASE_URL = apiBaseUrl;
    _mainHandleSignOut = handleSignOut;
    _mainRestoreLatest = restoreLatest;
}

function registerAuthEventHandlers() {
    ipcMain.on('clerk-auth-success', async (event, { sessionId, token }) => {
        console.log(`[IPCHandlers] clerk-auth-success. Session: ${sessionId}`);
        if (token) {
            try {
                const tokensToStore = { accessToken: token, refreshToken: null, idToken: null, userId: sessionId, expiresIn: 3600, obtainedAt: Date.now() }; 
                await authService.storeTokenObject(tokensToStore);
                new Notification({ title: "PageLifeline: Signed In", body: "Successfully signed in." }).show();
                await windowManager.ensureMainWindowVisibleAndFocused();
                // trayManager.updateTrayMenu() would be called from main.ts or via an event if fully decoupled
                // For now, this IPC handler won't directly update tray; main.ts can do it after this event if needed.
                // Or, we pass trayManager.updateTrayMenu to initDependencies
            } catch (keytarError: any) {
                new Notification({ title: "PageLifeline: Sign In Error", body: keytarError.message || "Could not save session." }).show();
            }
        } 
        windowManager.closeAuthWindow();
    });

    ipcMain.on('clerk-auth-error', (event, { error }) => {
        console.error('[IPCHandlers] clerk-auth-error:', error);
        new Notification({ title: "PageLifeline: Sign In Failed", body: error || "Unknown sign-in error." }).show();
        windowManager.closeAuthWindow();
    });

    ipcMain.handle('get-auth-status', async () => {
        console.log('[IPCHandlers] get-auth-status request.');
        const tokenObject = await authService.getStoredTokenObject();
        if (tokenObject && tokenObject.accessToken) {
            return { isAuthenticated: true, userId: tokenObject.userId };
        }
        return { isAuthenticated: false, userId: null };
    });

    ipcMain.on('request-sign-in', () => {
        console.log('[IPCHandlers] request-sign-in.');
        const authPageUrl = "https://www.pagelifeline.app/electron-auth";
        const preloadPath = path.join(__dirname, '../preload.js');
        windowManager.showAuthWindow(authPageUrl, preloadPath);
    });
}

function registerSnapshotAndRestoreHandlers() {
    ipcMain.handle('get-snapshots', async (_event, isRetry = false) => {
        const accessToken = await authService.getStoredAccessToken(_mainHandleSignOut); 
        if (!accessToken) { /* ... update tray via callback if needed ... */ return []; }
        try {
            const response = await axios.get(`${_API_BASE_URL}/api/snapshots`, { headers: { 'Authorization': `Bearer ${accessToken}` }});
            return Array.isArray(response.data) ? response.data : [];
        } catch (e: any) {
            if (e.response && e.response.status === 401 && !isRetry) {
                const newAccessToken = await authService.attemptTokenRefresh(_mainHandleSignOut);
                if (newAccessToken) { 
                    const thisHandler = ipcMain.listeners('get-snapshots')[0] as (...args: any[]) => Promise<any>;
                    return thisHandler(_event, true); 
                }
                else { await _mainHandleSignOut(); }
            } else if (e.response && e.response.status === 401 && isRetry) { await _mainHandleSignOut(); }
            console.error('Failed to fetch snapshots:', e.message);
            return [];
        }
    });

    ipcMain.on('restore-latest', async (_event, payload) => {
        const snapshotId = payload?.snapshotId;
        const result = await _mainRestoreLatest(snapshotId);
        const mainWindow = windowManager.getMainWindow();
        if (mainWindow) {
            mainWindow.webContents.send('restore-result', result);
        }
    });

    ipcMain.handle('create-test-snapshot', async (_event, isRetry = false) => {
        const accessToken = await authService.getStoredAccessToken(_mainHandleSignOut);
        if (!accessToken) { /* ... */ return { success: false, error: 'No JWT' }; }
        try {
            return (await axios.post(`${_API_BASE_URL}/api/snapshots/create`, {}, { headers: { 'Authorization': `Bearer ${accessToken}` }})).data;
        } catch (e: any) {
            if (e.response && e.response.status === 401 && !isRetry) {
                const newAccessToken = await authService.attemptTokenRefresh(_mainHandleSignOut);
                if (newAccessToken) { 
                    const thisHandler = ipcMain.listeners('create-test-snapshot')[0] as (...args: any[]) => Promise<any>;
                    return thisHandler(_event, true);
                }
                else { await _mainHandleSignOut(); }
            } else if (e.response && e.response.status === 401 && isRetry) { await _mainHandleSignOut(); }
            return { success: false, error: (e as Error).message };
        }
    });

    ipcMain.handle('get-snapshot-download-url', async (_event, snapshotId: string, isRetry = false) => {
        const accessToken = await authService.getStoredAccessToken(_mainHandleSignOut);
        if (!accessToken) { /* ... */ return { success: false, error: 'No JWT' }; }
        try {
            return (await axios.get(`${_API_BASE_URL}/api/snapshots/${encodeURIComponent(snapshotId)}/download`, { headers: { 'Authorization': `Bearer ${accessToken}` }})).data;
        } catch (e: any) {
            if (e.response && e.response.status === 401 && !isRetry) {
                const newAccessToken = await authService.attemptTokenRefresh(_mainHandleSignOut);
                if (newAccessToken) { 
                    const thisHandler = ipcMain.listeners('get-snapshot-download-url')[0] as (...args: any[]) => Promise<any>;
                    return thisHandler(_event, snapshotId, true);
                }
                else { await _mainHandleSignOut(); }
            } else if (e.response && e.response.status === 401 && isRetry) { await _mainHandleSignOut(); }
            return { success: false, error: (e as Error).message };
        }
    });
}

export function registerAllIpcHandlers(
    apiBaseUrl: string,
    handleSignOut: () => Promise<void>,
    restoreLatest: (snapshotId?: string, isRetry?: boolean) => Promise<any> 
) {
    initDependencies(apiBaseUrl, handleSignOut, restoreLatest);
    console.log('[IPCHandlers] Registering all IPC handlers...');
    registerAuthEventHandlers();
    registerSnapshotAndRestoreHandlers();
    console.log('[IPCHandlers] All IPC handlers registered.');
} 