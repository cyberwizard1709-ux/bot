/**
 * Moltbot Desktop - Preload Script
 */

import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("moltbotDesktop", {
  app: {
    getVersion: () => ipcRenderer.invoke("app:getVersion"),
  },
  gateway: {
    getStatus: () => ipcRenderer.invoke("gateway:getStatus"),
    restart: () => ipcRenderer.invoke("gateway:restart"),
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),
  },
  dialog: {
    showSaveDialog: (options) => ipcRenderer.invoke("dialog:showSaveDialog", options),
    showOpenDialog: (options) => ipcRenderer.invoke("dialog:showOpenDialog", options),
  },
  platform: process.platform,
});

console.log("[preload] Moltbot Desktop API exposed");
