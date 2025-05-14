"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  send: (channel, payload) => electron.ipcRenderer.send(channel, payload),
  receive: (channel, func) => {
    const listener = (_event, ...args) => func(...args);
    electron.ipcRenderer.on(channel, listener);
    return () => {
      electron.ipcRenderer.removeListener(channel, listener);
    };
  },
  getSnapshots: () => electron.ipcRenderer.invoke("get-snapshots"),
  createTestSnapshot: () => electron.ipcRenderer.invoke("create-test-snapshot"),
  getSnapshotDownloadUrl: (snapshotId) => electron.ipcRenderer.invoke("get-snapshot-download-url", snapshotId),
  // Specific listener for user sign-out
  onUserSignedOut: (callback) => {
    const listener = () => callback();
    electron.ipcRenderer.on("user-signed-out", listener);
    return () => {
      electron.ipcRenderer.removeListener("user-signed-out", listener);
    };
  },
  // Added for AuthContext to check initial status
  getAuthStatus: () => electron.ipcRenderer.invoke("get-auth-status"),
  // Added for renderer to trigger sign-in flow
  requestSignIn: () => electron.ipcRenderer.send("request-sign-in"),
  restoreLatestGood: () => electron.ipcRenderer.invoke("restore-latest-good"),
  // Listener for restore progress updates
  onRestoreProgressUpdate: (callback) => {
    const listener = (_event, eventData) => callback(eventData);
    electron.ipcRenderer.on("restore-progress-update", listener);
    return () => {
      electron.ipcRenderer.removeListener("restore-progress-update", listener);
    };
  },
  // Updater related methods
  onUpdaterEvent: (callback) => {
    const listener = (_event, eventData) => callback(eventData);
    electron.ipcRenderer.on("updater-event", listener);
    return () => electron.ipcRenderer.removeListener("updater-event", listener);
  },
  sendUpdaterDownload: () => electron.ipcRenderer.send("updater-download-update"),
  sendUpdaterQuitAndInstall: () => electron.ipcRenderer.send("updater-quit-and-install")
});
