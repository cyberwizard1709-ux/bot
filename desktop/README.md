# Moltbot Desktop

A cross-platform desktop application for Moltbot - your personal AI assistant.

## Features

- **Integrated Gateway**: Runs the Moltbot gateway server locally in the background
- **Control UI**: Embeds the web-based Control UI in a native window
- **System Tray**: Runs in the background with system tray integration
- **Cross-Platform**: Supports macOS, Windows, and Linux

## Prerequisites

- Node.js ≥22
- pnpm (recommended) or npm

## Setup

1. Install dependencies:
```bash
cd desktop
pnpm install
```

2. Build the main project first (required for the gateway and UI):
```bash
cd ..
pnpm install
pnpm build
pnpm ui:build
```

## Development

Run the desktop app in development mode:

```bash
cd desktop
pnpm dev
```

This will:
1. Compile TypeScript files
2. Start the Electron app with hot reload
3. Launch the gateway server in the background
4. Open the Control UI in a window

## Building

### Build for Current Platform

```bash
pnpm build
```

### Platform-Specific Builds

**macOS:**
```bash
pnpm build:mac
```

**Windows:**
```bash
pnpm build:win
```

**Linux:**
```bash
pnpm build:linux
```

### Output

Built applications will be in the `release/` directory.

## Project Structure

```
desktop/
├── src/
│   ├── main.ts       # Main process (window, gateway, tray)
│   └── preload.ts    # Preload script for secure IPC
├── assets/           # Icons and images
├── dist/             # Compiled TypeScript (generated)
├── release/          # Built applications (generated)
├── package.json      # Electron dependencies and build config
└── tsconfig.json     # TypeScript configuration
```

## Architecture

The desktop app consists of three main components:

1. **Main Process** (`main.ts`): 
   - Manages application lifecycle
   - Starts/stops the gateway server as a child process
   - Creates and manages browser windows
   - Handles system tray integration

2. **Renderer Process** (Control UI):
   - The existing web-based Control UI
   - Runs in a sandboxed browser window
   - Communicates with main process via IPC

3. **Preload Script** (`preload.ts`):
   - Secure bridge between main and renderer
   - Exposes only whitelisted APIs to the UI

## Configuration

The desktop app stores user preferences in Electron's standard locations:
- Window position and size
- Other app settings (future)

## GitHub Releases

To publish desktop apps to GitHub releases:

### Automated Release (Recommended)

1. Create and push a version tag:
```bash
git tag v2026.1.29
git push origin v2026.1.29
```

2. The `desktop-release.yml` workflow will:
   - Build the desktop app for all platforms (macOS, Windows, Linux)
   - Create a draft release on GitHub
   - Upload all artifacts (.dmg, .exe, .AppImage, etc.)

3. Review and publish the draft release on GitHub

### Manual Build for Release

```bash
# Build all platforms locally
pnpm desktop:build

# Or build specific platform
pnpm desktop:build:mac
pnpm desktop:build:win
pnpm desktop:build:linux
```

### Release Assets

When a release is published, the following assets will be available:

| Platform | Assets |
|----------|--------|
| macOS | `Moltbot-vX.X.X-x64.dmg`, `Moltbot-vX.X.X-arm64.dmg`, `Moltbot-vX.X.X-mac.zip` |
| Windows | `Moltbot-vX.X.X.exe` (installer), `Moltbot-vX.X.X-portable.exe` |
| Linux | `Moltbot-vX.X.X.AppImage`, `moltbot_X.X.X_amd64.deb` |

## Code Signing (Optional)

For production releases, you should configure code signing:

### macOS
Set these secrets in your GitHub repository:
- `MACOS_CERTIFICATE`: Base64-encoded .p12 certificate
- `MACOS_CERTIFICATE_PASSWORD`: Certificate password
- `MACOS_NOTARIZATION_APPLE_ID`: Apple ID for notarization
- `MACOS_NOTARIZATION_TEAM_ID`: Apple Team ID
- `MACOS_NOTARIZATION_PASSWORD`: App-specific password

### Windows
Set this secret in your GitHub repository:
- `WINDOWS_CERTIFICATE`: Base64-encoded .pfx certificate
- `WINDOWS_CERTIFICATE_PASSWORD`: Certificate password

Without code signing, the apps will still work but users will see security warnings.

## Troubleshooting

### Gateway won't start
- Check that the main project is built: `pnpm build` in project root
- Check that the UI is built: `pnpm ui:build` in project root
- Check the console for error messages

### App won't build
- Ensure all dependencies are installed in both project root and desktop folder
- Ensure you're using Node.js ≥22

### Control UI not loading
- Verify the gateway is running by visiting http://127.0.0.1:18789 in a browser
- Check that `dist/control-ui/index.html` exists in the main project

### macOS "App is damaged" warning
If you see "Moltbot is damaged and can't be opened" on macOS, run:
```bash
xattr -cr /Applications/Moltbot.app
```

This happens because the app is not signed with an Apple Developer certificate.

## License

MIT - Same as Moltbot
