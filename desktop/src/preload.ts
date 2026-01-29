/**
 * Moltbot Desktop - Preload Script
 * 
 * This script runs in the renderer process and exposes a secure API
 * for communication with the main process via IPC.
 */

import { contextBridge, ipcRenderer } from "electron";

// Type definitions for the exposed API
export interface MoltbotDesktopAPI {
  // App info
  app: {
    getVersion: () => Promise<string>;
  };
  
  // Gateway management
  gateway: {
    getStatus: () => Promise<{
      running: boolean;
      port: number;
      url: string;
    }>;
    restart: () => Promise<{ success: boolean }>;
  };
  
  // Shell operations
  shell: {
    openExternal: (url: string) => Promise<void>;
  };
  
  // Dialog operations
  dialog: {
    showSaveDialog: (options: {
      title?: string;
      defaultPath?: string;
      filters?: Array<{ name: string; extensions: string[] }>;
    }) => Promise<{
      canceled: boolean;
      filePath?: string;
    }>;
    showOpenDialog: (options: {
      title?: string;
      defaultPath?: string;
      filters?: Array<{ name: string; extensions: string[] }>;
      properties?: string[];
    }) => Promise<{
      canceled: boolean;
      filePaths?: string[];
    }>;
  };
  
  // Platform info
  platform: NodeJS.Platform;
}

/**
 * Expose the API to the renderer process
 * All methods are wrapped to only allow specific IPC channels
 */
contextBridge.exposeInMainWorld("moltbotDesktop", {
  // App info
  app: {
    getVersion: () => ipcRenderer.invoke("app:getVersion"),
  },
  
  // Gateway management
  gateway: {
    getStatus: () => ipcRenderer.invoke("gateway:getStatus"),
    restart: () => ipcRenderer.invoke("gateway:restart"),
  },
  
  // Shell operations
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke("shell:openExternal", url),
  },
  
  // Dialog operations
  dialog: {
    showSaveDialog: (options: Parameters<MoltbotDesktopAPI["dialog"]["showSaveDialog"]>[0]) =>
      ipcRenderer.invoke("dialog:showSaveDialog", options),
    showOpenDialog: (options: Parameters<MoltbotDesktopAPI["dialog"]["showOpenDialog"]>[0]) =>
      ipcRenderer.invoke("dialog:showOpenDialog", options),
  },
  
  // Platform info (read-only)
  platform: process.platform,
} as MoltbotDesktopAPI);

// Log that preload script has run
console.log("[preload] Moltbot Desktop API exposed");
