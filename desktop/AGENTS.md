# Moltbot Desktop - Agent Documentation

## Overview

Moltbot Desktop is an Electron-based cross-platform desktop application that wraps the Moltbot Gateway server and Control UI.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Main Process                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │    Window    │  │ System Tray  │  │ Gateway Process  │  │
│  │  Management  │  │  Integration │  │   (Node.js)      │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │ IPC
┌──────────────────────────▼──────────────────────────────────┐
│                 Electron Renderer Process                    │
│                  (Moltbot Control UI)                        │
│              Loaded from http://127.0.0.1:18789             │
└─────────────────────────────────────────────────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `src/main.ts` | Main Electron process - window, tray, gateway management |
| `src/preload.ts` | Preload script - secure IPC bridge |
| `package.json` | Dependencies and Electron Builder config |
| `electron-builder.yml` | Detailed build configuration |
| `scripts/build.sh` | Build automation script |

## Development

### Prerequisites

- Node.js ≥22
- pnpm
- Main project built (`pnpm build` and `pnpm ui:build` in project root)

### Running in Development

```bash
# From project root
pnpm desktop:dev

# Or from desktop directory
cd desktop
pnpm dev
```

### Building

```bash
# Build for all platforms
pnpm desktop:build

# Platform-specific builds
pnpm desktop:build:mac
pnpm desktop:build:win
pnpm desktop:build:linux
```

## Gateway Integration

The desktop app manages the Moltbot Gateway as a child process:

1. **Startup**: On app launch, the gateway is started via `node dist/index.js gateway --port 18789`
2. **Health Check**: The app waits for the `/health` endpoint to respond
3. **Window Load**: The Control UI is loaded from `http://127.0.0.1:18789`
4. **Shutdown**: On app quit, the gateway process is gracefully terminated

## IPC API

The preload script exposes these APIs to the renderer:

```typescript
window.moltbotDesktop: {
  // App info
  app: {
    getVersion: () => Promise<string>;
  };
  
  // Gateway management
  gateway: {
    getStatus: () => Promise<{ running: boolean; port: number; url: string }>;
    restart: () => Promise<{ success: boolean }>;
  };
  
  // Shell operations
  shell: {
    openExternal: (url: string) => Promise<void>;
  };
  
  // Dialog operations
  dialog: {
    showSaveDialog: (options) => Promise<{ canceled: boolean; filePath?: string }>;
    showOpenDialog: (options) => Promise<{ canceled: boolean; filePaths?: string[] }>;
  };
  
  // Platform info
  platform: NodeJS.Platform;
}
```

## Build Outputs

| Platform | Output |
|----------|--------|
| macOS | `release/Moltbot-x.x.x.dmg`, `release/Moltbot-x.x.x-mac.zip` |
| Windows | `release/Moltbot-x.x.x.exe` (installer), `release/Moltbot-x.x.x-portable.exe` |
| Linux | `release/Moltbot-x.x.x.AppImage`, `release/moltbot_x.x.x_amd64.deb` |

## Security Considerations

1. **Context Isolation**: Enabled - preload script is the only bridge to Node.js APIs
2. **Sandbox**: Renderer process runs in a sandbox
3. **CSP**: Control UI should have appropriate Content Security Policy
4. **External Links**: Opened in system browser, not in Electron
5. **Single Instance**: App enforces single instance lock

## Common Issues

### Gateway not starting
- Verify main project is built: `pnpm build` and `pnpm ui:build` in project root
- Check that `dist/index.js` exists
- Check console for error messages

### Control UI not loading
- Verify gateway is running: `curl http://127.0.0.1:18789/health`
- Check that `dist/control-ui/index.html` exists

### Build failures
- Ensure all dependencies are installed in both project root and desktop folder
- For macOS code signing, ensure proper certificates are installed
- For Windows, no special requirements for unsigned builds

## Future Enhancements

Potential improvements for the desktop app:

1. **Auto-updater**: Integrate electron-updater for automatic updates
2. **Native notifications**: Use Electron's notification API
3. **Global shortcuts**: Register keyboard shortcuts (e.g., quick open)
4. **Protocol handler**: Register `moltbot://` protocol
5. **Native menu**: Add proper macOS app menu
6. **Offline mode**: Better handling when gateway is not responding
