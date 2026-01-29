/**
 * Moltbot Desktop - Main Process
 */

import { app, BrowserWindow, Tray, Menu, ipcMain, shell, dialog, nativeImage } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import http from "node:http";
import { spawn } from "node:child_process";
import Store from "electron-store";

const store = new Store();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.argv.includes("--dev");

const GATEWAY_PORT = 18789;
const GATEWAY_HOST = "127.0.0.1";
const CONTROL_UI_URL = `http://${GATEWAY_HOST}:${GATEWAY_PORT}`;

let mainWindow = null;
let tray = null;
let gatewayProcess = null;
let isQuitting = false;

function resolveMoltbotPath() {
  const candidates = [
    path.join(process.resourcesPath, "dist", "index.js"),
    path.join(__dirname, "..", "..", "dist", "index.js"),
    path.join(__dirname, "..", "..", "moltbot.mjs"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error("Could not find moltbot entry point");
}

function waitForGateway(timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const tryConnect = () => {
      const req = http.get(`${CONTROL_UI_URL}/health`, { timeout: 1000 }, (res) => {
        if (res.statusCode === 200) resolve();
        else retry();
      });
      req.on("error", retry);
      req.on("timeout", () => { req.destroy(); retry(); });
    };
    const retry = () => {
      if (Date.now() - startTime > timeout) {
        reject(new Error("Gateway startup timeout"));
        return;
      }
      setTimeout(tryConnect, 500);
    };
    tryConnect();
  });
}

async function startGateway() {
  if (gatewayProcess) return;
  try {
    const moltbotPath = resolveMoltbotPath();
    const env = { ...process.env, CLAWDBOT_CONTROL_UI_BASE_PATH: "./", NODE_ENV: isDev ? "development" : "production" };
    gatewayProcess = spawn("node", [moltbotPath, "gateway", "--port", String(GATEWAY_PORT), "--verbose"], { env, stdio: ["ignore", "pipe", "pipe"] });
    gatewayProcess.stdout?.on("data", (data) => console.log(`[gateway] ${data.toString().trim()}`));
    gatewayProcess.stderr?.on("data", (data) => console.error(`[gateway] ${data.toString().trim()}`));
    gatewayProcess.on("close", (code) => {
      gatewayProcess = null;
      if (!isQuitting && mainWindow) {
        dialog.showErrorBox("Gateway Error", `Gateway stopped unexpectedly (exit code: ${code})`);
        restartGateway();
      }
    });
    await waitForGateway();
  } catch (error) {
    dialog.showErrorBox("Failed to Start Gateway", String(error));
    app.quit();
  }
}

async function stopGateway() {
  if (!gatewayProcess) return;
  return new Promise((resolve) => {
    const timeout = setTimeout(() => { gatewayProcess?.kill("SIGKILL"); resolve(); }, 5000);
    gatewayProcess?.on("close", () => { clearTimeout(timeout); gatewayProcess = null; resolve(); });
    gatewayProcess?.kill("SIGTERM");
  });
}

async function restartGateway() {
  await stopGateway();
  await startGateway();
  updateTrayMenu();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: store.get("window.width", 1400),
    height: store.get("window.height", 900),
    x: store.get("window.x"),
    y: store.get("window.y"),
    minWidth: 800, minHeight: 600,
    title: "Moltbot",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.loadURL(CONTROL_UI_URL);
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    if (isDev) mainWindow?.webContents.openDevTools();
  });
  mainWindow.on("closed", () => { mainWindow = null; });
  mainWindow.on("close", () => {
    if (mainWindow && !isQuitting) {
      const bounds = mainWindow.getBounds();
      store.set("window", bounds);
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
}

function getIconPath() {
  const platform = process.platform;
  const iconName = platform === "win32" ? "icon.ico" : platform === "darwin" ? "icon.icns" : "icon.png";
  const candidates = [
    path.join(process.resourcesPath, "assets", iconName),
    path.join(__dirname, "..", "assets", iconName),
    path.join(__dirname, "..", "..", "assets", "icon.png"),
  ];
  for (const candidate of candidates) if (fs.existsSync(candidate)) return candidate;
  return "";
}

function createTray() {
  const iconPath = getIconPath();
  if (!iconPath) return;
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  icon.setTemplateImage(process.platform === "darwin");
  tray = new Tray(icon);
  tray.setToolTip("Moltbot");
  tray.setIgnoreDoubleClickEvents(true);
  updateTrayMenu();
  tray.on("click", () => {
    if (process.platform !== "darwin") {
      if (mainWindow?.isVisible()) mainWindow.hide();
      else { mainWindow?.show(); mainWindow?.focus(); }
    }
  });
}

function updateTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    { label: "Open Moltbot", click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } else createMainWindow(); } },
    { type: "separator" },
    { label: "Gateway Status", enabled: false },
    { label: gatewayProcess ? "● Running" : "○ Stopped", enabled: false },
    { type: "separator" },
    { label: "Restart Gateway", click: async () => { await restartGateway(); } },
    { type: "separator" },
    { label: "Quit", click: () => { isQuitting = true; app.quit(); } },
  ]);
  tray?.setContextMenu(contextMenu);
}

function setupIpcHandlers() {
  ipcMain.handle("app:getVersion", () => app.getVersion());
  ipcMain.handle("gateway:getStatus", () => ({ running: gatewayProcess !== null, port: GATEWAY_PORT, url: CONTROL_UI_URL }));
  ipcMain.handle("gateway:restart", async () => { await restartGateway(); return { success: true }; });
  ipcMain.handle("shell:openExternal", (_, url) => shell.openExternal(url));
  ipcMain.handle("dialog:showSaveDialog", async (_, options) => mainWindow ? dialog.showSaveDialog(mainWindow, options) : { canceled: true });
  ipcMain.handle("dialog:showOpenDialog", async (_, options) => mainWindow ? dialog.showOpenDialog(mainWindow, options) : { canceled: true });
}

app.whenReady().then(async () => {
  await startGateway();
  createMainWindow();
  createTray();
  setupIpcHandlers();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("before-quit", async () => { isQuitting = true; await stopGateway(); });
app.on("quit", () => stopGateway());

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) app.quit();
else app.on("second-instance", () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });
app.on("web-contents-created", (_, contents) => { contents.on("new-window", (event) => event.preventDefault()); });
