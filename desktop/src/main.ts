/**
 * Moltbot Desktop - Main Process
 * 
 * This file handles:
 * - Creating the main application window
 * - Starting/stopping the gateway server
 * - System tray integration
 * - IPC communication with renderer
 */

import { app, BrowserWindow, Tray, Menu, ipcMain, shell, dialog, nativeImage } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import http from "node:http";
import { spawn, ChildProcess } from "node:child_process";
import Store from "electron-store";

// Config store for user preferences
const store = new Store();

// Get paths
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.argv.includes("--dev");

// App constants
const GATEWAY_PORT = 18789;
const GATEWAY_HOST = "127.0.0.1";
const CONTROL_UI_URL = `http://${GATEWAY_HOST}:${GATEWAY_PORT}`;

// State
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let gatewayProcess: ChildProcess | null = null;
let isQuitting = false;

/**
 * Resolve the path to the moltbot entry point
 */
function resolveMoltbotPath(): string {
  // Possible locations for the moltbot entry point
  const candidates = [
    // Packaged app: extra resources
    path.join(process.resourcesPath, "dist", "index.js"),
    // Development: parent directory dist
    path.join(__dirname, "..", "..", "dist", "index.js"),
    // Development: parent directory moltbot.mjs
    path.join(__dirname, "..", "..", "moltbot.mjs"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error("Could not find moltbot entry point. Make sure to run 'pnpm build' in the project root first.");
}

/**
 * Resolve the path to the control-ui directory
 */
function resolveControlUiPath(): string {
  const candidates = [
    // Packaged app: extra resources
    path.join(process.resourcesPath, "dist", "control-ui"),
    // Development: parent directory
    path.join(__dirname, "..", "..", "dist", "control-ui"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "index.html"))) {
      return candidate;
    }
  }

  return "";
}

/**
 * Wait for the gateway to be ready
 */
function waitForGateway(timeout = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const tryConnect = () => {
      const req = http.get(`${CONTROL_UI_URL}/health`, { timeout: 1000 }, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      });
      
      req.on("error", retry);
      req.on("timeout", () => {
        req.destroy();
        retry();
      });
    };
    
    const retry = () => {
      if (Date.now() - startTime > timeout) {
        reject(new Error("Gateway startup timeout - the gateway did not respond within 30 seconds"));
        return;
      }
      setTimeout(tryConnect, 500);
    };
    
    tryConnect();
  });
}

/**
 * Start the gateway server as a child process
 */
async function startGateway(): Promise<void> {
  if (gatewayProcess) {
    console.log("[main] Gateway already running");
    return;
  }

  try {
    const moltbotPath = resolveMoltbotPath();
    console.log(`[main] Starting gateway from: ${moltbotPath}`);

    // Set environment variables
    const env = {
      ...process.env,
      CLAWDBOT_CONTROL_UI_BASE_PATH: "./",
      NODE_ENV: isDev ? "development" : "production",
    };

    // Spawn the gateway process
    gatewayProcess = spawn("node", [moltbotPath, "gateway", "--port", String(GATEWAY_PORT), "--verbose"], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    // Handle gateway output
    gatewayProcess.stdout?.on("data", (data) => {
      console.log(`[gateway] ${data.toString().trim()}`);
    });

    gatewayProcess.stderr?.on("data", (data) => {
      console.error(`[gateway] ${data.toString().trim()}`);
    });

    gatewayProcess.on("close", (code) => {
      console.log(`[main] Gateway process exited with code ${code}`);
      gatewayProcess = null;
      
      if (!isQuitting && mainWindow) {
        // Show error dialog if gateway crashed unexpectedly
        dialog.showErrorBox(
          "Gateway Error",
          `The Moltbot gateway has stopped unexpectedly (exit code: ${code}). The app will now restart.`
        );
        restartGateway();
      }
    });

    // Wait for gateway to be ready
    await waitForGateway();
    console.log("[main] Gateway is ready");

  } catch (error) {
    console.error("[main] Failed to start gateway:", error);
    dialog.showErrorBox(
      "Failed to Start Gateway",
      `Could not start the Moltbot gateway: ${error instanceof Error ? error.message : String(error)}`
    );
    app.quit();
  }
}

/**
 * Stop the gateway server
 */
async function stopGateway(): Promise<void> {
  if (!gatewayProcess) {
    return;
  }

  console.log("[main] Stopping gateway...");
  
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.log("[main] Gateway kill timeout, forcing...");
      gatewayProcess?.kill("SIGKILL");
      resolve();
    }, 5000);

    gatewayProcess?.on("close", () => {
      clearTimeout(timeout);
      gatewayProcess = null;
      resolve();
    });

    gatewayProcess?.kill("SIGTERM");
  });
}

/**
 * Restart the gateway server
 */
async function restartGateway(): Promise<void> {
  await stopGateway();
  await startGateway();
  updateTrayMenu();
}

/**
 * Create the main application window
 */
function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: store.get("window.width", 1400) as number,
    height: store.get("window.height", 900) as number,
    x: store.get("window.x") as number | undefined,
    y: store.get("window.y") as number | undefined,
    minWidth: 800,
    minHeight: 600,
    title: "Moltbot",
    icon: getIconPath(),
    show: false, // Show only when ready
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Load the control UI from the gateway
  mainWindow.loadURL(CONTROL_UI_URL);

  // Show window when ready
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    
    // Open DevTools in development
    if (isDev) {
      mainWindow?.webContents.openDevTools();
    }
  });

  // Handle window closed
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Save window position and size
  mainWindow.on("close", () => {
    if (mainWindow && !isQuitting) {
      const bounds = mainWindow.getBounds();
      store.set("window", bounds);
    }
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

/**
 * Get the path to the app icon
 */
function getIconPath(): string {
  const platform = process.platform;
  const iconName = platform === "win32" ? "icon.ico" : platform === "darwin" ? "icon.icns" : "icon.png";
  
  const candidates = [
    path.join(process.resourcesPath, "assets", iconName),
    path.join(__dirname, "..", "assets", iconName),
    path.join(__dirname, "..", "..", "assets", "icon.png"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return "";
}

/**
 * Create the system tray
 */
function createTray(): void {
  const iconPath = getIconPath();
  
  if (!iconPath) {
    console.warn("[main] Could not find tray icon");
    return;
  }

  // Create tray icon (resize for tray)
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  icon.setTemplateImage(process.platform === "darwin");

  tray = new Tray(icon);
  tray.setToolTip("Moltbot");
  tray.setIgnoreDoubleClickEvents(true);

  updateTrayMenu();

  // Show window on tray click (Windows/Linux)
  tray.on("click", () => {
    if (process.platform !== "darwin") {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      } else {
        createMainWindow();
      }
    }
  });
}

/**
 * Update the tray context menu
 */
function updateTrayMenu(): void {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open Moltbot",
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        } else {
          createMainWindow();
        }
      },
    },
    { type: "separator" },
    {
      label: "Gateway Status",
      enabled: false,
    },
    {
      label: gatewayProcess ? "● Running" : "○ Stopped",
      enabled: false,
    },
    { type: "separator" },
    {
      label: "Restart Gateway",
      click: async () => {
        await restartGateway();
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray?.setContextMenu(contextMenu);
}

/**
 * IPC handlers
 */
function setupIpcHandlers(): void {
  // Get app version
  ipcMain.handle("app:getVersion", () => {
    return app.getVersion();
  });

  // Get gateway status
  ipcMain.handle("gateway:getStatus", () => {
    return {
      running: gatewayProcess !== null,
      port: GATEWAY_PORT,
      url: CONTROL_UI_URL,
    };
  });

  // Restart gateway
  ipcMain.handle("gateway:restart", async () => {
    await restartGateway();
    return { success: true };
  });

  // Open external link
  ipcMain.handle("shell:openExternal", (_, url: string) => {
    shell.openExternal(url);
  });

  // Show save dialog
  ipcMain.handle("dialog:showSaveDialog", async (_, options) => {
    if (!mainWindow) return { canceled: true };
    return dialog.showSaveDialog(mainWindow, options);
  });

  // Show open dialog
  ipcMain.handle("dialog:showOpenDialog", async (_, options) => {
    if (!mainWindow) return { canceled: true };
    return dialog.showOpenDialog(mainWindow, options);
  });
}

/**
 * App event handlers
 */
app.whenReady().then(async () => {
  console.log("[main] App ready, starting gateway...");
  
  // Start the gateway first
  await startGateway();
  
  // Create UI
  createMainWindow();
  createTray();
  setupIpcHandlers();

  app.on("activate", () => {
    // On macOS, recreate window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // On macOS, keep app running in background unless explicitly quit
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async () => {
  isQuitting = true;
  await stopGateway();
});

app.on("quit", () => {
  stopGateway();
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    // Focus existing window if user tries to open another instance
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// Security: Prevent new window creation
app.on("web-contents-created", (_, contents) => {
  contents.on("new-window", (event) => {
    event.preventDefault();
  });
});
