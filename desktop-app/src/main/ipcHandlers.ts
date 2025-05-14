import { ipcMain, Notification } from 'electron';
import axios from 'axios';
import path from 'node:path';
import { EventSourcePolyfill as EventSource } from 'event-source-polyfill';
import * as authService from './auth';
import * as windowManager from './windowManager';

// These functions are still in main.ts and are used by some IPC handlers.
// They need to be passed or imported if this module is to be fully independent.
// For now, we assume they can be called if main.ts passes them or if we solve this dependency later.
let _mainHandleSignOut: () => Promise<void>;
let _legacyRestoreFn: (snapshotId?: string, isRetry?: boolean) => Promise<any>;
let _API_BASE_URL: string;

// Keep track of active SSE connections to close them if needed
const activeSseConnections: { [key: string]: EventSource } = {};

function initDependencies(
    apiBaseUrl: string,
    handleSignOut: () => Promise<void>,
    legacyRestoreCallback: (snapshotId?: string, isRetry?: boolean) => Promise<any>
) {
    _API_BASE_URL = apiBaseUrl;
    _mainHandleSignOut = handleSignOut;
    _legacyRestoreFn = legacyRestoreCallback;
}

function closeSseConnection(restoreJobId: string) {
    if (activeSseConnections[restoreJobId]) {
        console.log(`[IPCHandlers-Core] Closing SSE connection for restoreJobId: ${restoreJobId}`);
        activeSseConnections[restoreJobId].close();
        delete activeSseConnections[restoreJobId];
    }
}

// Exportable function containing the core logic for restoring the latest good snapshot
export async function performRestoreLatestGood(): Promise<{ success: boolean; message: string; snapshotId?: string; restoreJobId?: string; errorDetails?: any }> {
    console.log('[IPCHandlers-Core] Attempting to restore latest good snapshot.');
    const accessToken = await authService.getStoredAccessToken(_mainHandleSignOut); 
    if (!accessToken) {
        new Notification({ title: 'Authentication Required', body: 'Please sign in to restore.'}).show();
        return { success: false, message: 'Authentication required.' };
    }
    try {
        const backendResponse = await axios.post(
            `${_API_BASE_URL}/api/restore/latest-good`,
            {},
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        const backendData = backendResponse.data;

        if (backendData?.success && backendData.restoreJobId) {
            new Notification({ 
                title: 'PageLifeline: Restore Initiated', 
                body: backendData.message || 'Restore of latest good snapshot started.' 
            }).show();

            const restoreJobId = backendData.restoreJobId;
            const mainWindow = windowManager.getMainWindow();

            // Close any existing SSE connection for this job ID (e.g., if retried quickly)
            closeSseConnection(restoreJobId);

            const sseUrl = `${_API_BASE_URL}/api/restore-status/${restoreJobId}`;
            console.log(`[IPCHandlers-Core] Opening SSE connection to: ${sseUrl}`);
            
            // Use EventSource with Authorization header (eventsource package might need polyfill for headers or specific options)
            // For `eventsource` package, headers are typically passed in an `eventSourceInitDict` as the second argument.
            const es = new EventSource(sseUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
            activeSseConnections[restoreJobId] = es;

            es.onopen = () => {
                console.log(`[IPCHandlers-SSE] Connection opened for restoreJobId: ${restoreJobId}`);
                mainWindow?.webContents.send('restore-progress-update', { type: 'sse_connected', restoreJobId });
            };

            es.onmessage = (event: any) => {
                try {
                    const progressData = JSON.parse(event.data as string); // event.data is string for MessageEvent
                    console.log(`[IPCHandlers-SSE] Message for ${restoreJobId}:`, progressData);
                    mainWindow?.webContents.send('restore-progress-update', { type: 'progress', restoreJobId, data: progressData });
                    
                    if (progressData.status === 'completed' || progressData.status === 'error') {
                        closeSseConnection(restoreJobId);
                        if(progressData.status === 'completed' && progressData.restoredPageUrl) {
                            mainWindow?.webContents.send('restore-progress-update', { type: 'completed_with_url', restoreJobId, url: progressData.restoredPageUrl, message: progressData.message });
                        }
                    }
                } catch (parseError) {
                    console.error(`[IPCHandlers-SSE] Error parsing SSE message data for ${restoreJobId}:`, parseError, "Raw data:", event.data);
                }
            };

            es.onerror = (errorEvent: any) => {
                console.error(`[IPCHandlers-SSE] Error for ${restoreJobId}:`, errorEvent);
                mainWindow?.webContents.send('restore-progress-update', { type: 'sse_error', restoreJobId, error: 'SSE connection error' });
                closeSseConnection(restoreJobId);
            };

        } else {
            new Notification({ 
                title: 'PageLifeline: Restore Failed', 
                body: backendData?.message || 'Could not initiate restore of latest good snapshot.' 
            }).show();
        }
        return backendData; 
    } catch (error: any) {
        console.error('[IPCHandlers-Core] Error calling /api/restore/latest-good:', error.response?.data || error.message);
        let friendlyMessage = 'Failed to initiate latest good restore.';
        if (error.response?.data?.message) {
            friendlyMessage = error.response.data.message;
        } else if (error.isAxiosError && !error.response) {
            friendlyMessage = 'Network error. Please check your connection.';
        }
        new Notification({ title: 'PageLifeline: Error', body: friendlyMessage }).show();
        return { 
            success: false, 
            message: friendlyMessage,
            errorDetails: error.response?.data 
        };
    }
}

function registerAuthEventHandlers() {
    ipcMain.on('clerk-auth-success', async (event, { sessionId, token }) => {
        console.log(`[IPCHandlers] clerk-auth-success. Session: ${sessionId}`);
        if (token) {
            try {
                const tokensToStore = {
                    accessToken: token,
                    refreshToken: null,
                    idToken: null,
                    userId: sessionId,
                    expiresIn: 3600,
                    obtainedAt: Date.now()
                };
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
        const result = await _legacyRestoreFn(snapshotId);
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

    ipcMain.handle('restore-latest-good', async () => {
        console.log('[IPCHandlers] IPC \'restore-latest-good\' received. Calling core logic.');
        return await performRestoreLatestGood();
    });
}

export function registerAllIpcHandlers(
    apiBaseUrl: string,
    handleSignOut: () => Promise<void>,
    legacyRestoreCallback: (snapshotId?: string, isRetry?: boolean) => Promise<any>
) {
    initDependencies(apiBaseUrl, handleSignOut, legacyRestoreCallback);
    console.log('[IPCHandlers] Registering all IPC handlers...');
    registerAuthEventHandlers();
    registerSnapshotAndRestoreHandlers();
    console.log('[IPCHandlers] All IPC handlers registered.');
} 