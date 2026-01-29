#!/usr/bin/env node
/**
 * Moltbot Desktop Electron Launcher
 * 
 * This script launches the Electron desktop app from the main project.
 * It ensures the project is built before starting the desktop app.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopDir = path.join(__dirname, "desktop");

// Check if desktop dependencies are installed
const desktopNodeModules = path.join(desktopDir, "node_modules");
if (!fs.existsSync(desktopNodeModules)) {
  console.log("[desktop-launcher] Installing desktop dependencies...");
  const install = spawn("pnpm", ["install"], {
    cwd: desktopDir,
    stdio: "inherit",
    shell: true,
  });
  
  install.on("close", (code) => {
    if (code === 0) {
      startDesktop();
    } else {
      console.error("[desktop-launcher] Failed to install dependencies");
      process.exit(1);
    }
  });
} else {
  startDesktop();
}

function startDesktop() {
  // Check if the main project is built
  const distPath = path.join(__dirname, "dist", "index.js");
  const isDev = process.argv.includes("--dev") || !fs.existsSync(distPath);
  
  if (isDev) {
    console.log("[desktop-launcher] Running in development mode...");
  }
  
  // Start the desktop app
  const electronArgs = isDev ? ["--dev"] : [];
  const electron = spawn("pnpm", ["exec", "electron", ".", ...electronArgs], {
    cwd: desktopDir,
    stdio: "inherit",
    shell: true,
  });
  
  electron.on("close", (code) => {
    process.exit(code ?? 0);
  });
}
