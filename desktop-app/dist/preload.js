"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  send: (channel, payload) => electron.ipcRenderer.send(channel, payload),
  receive: (channel, func) => {
    electron.ipcRenderer.on(channel, (_event, ...args) => func(...args));
  },
  getSnapshots: () => electron.ipcRenderer.invoke("get-snapshots"),
  createTestSnapshot: () => electron.ipcRenderer.invoke("create-test-snapshot"),
  getSnapshotDownloadUrl: (snapshotId) => electron.ipcRenderer.invoke("get-snapshot-download-url", snapshotId)
});
