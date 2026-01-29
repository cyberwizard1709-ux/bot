#!/bin/bash
# Build script for Moltbot Desktop
# This script builds the main project and then the desktop app

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DESKTOP_DIR="$PROJECT_ROOT/desktop"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[build]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[warn]${NC} $1"
}

error() {
    echo -e "${RED}[error]${NC} $1"
}

# Check Node.js version
check_node_version() {
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 22 ]; then
        error "Node.js version must be >= 22 (found $(node -v))"
        exit 1
    fi
    
    log "Node.js version: $(node -v)"
}

# Build main project
build_main_project() {
    log "Building main project..."
    cd "$PROJECT_ROOT"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        log "Installing main project dependencies..."
        pnpm install
    fi
    
    # Build TypeScript
    log "Building TypeScript..."
    pnpm build
    
    # Build UI
    log "Building Control UI..."
    pnpm ui:build
    
    log "Main project build complete"
}

# Build desktop app
build_desktop() {
    log "Building desktop app..."
    cd "$DESKTOP_DIR"
    
    # Install desktop dependencies
    if [ ! -d "node_modules" ]; then
        log "Installing desktop dependencies..."
        pnpm install
    fi
    
    # Build TypeScript
    log "Compiling desktop TypeScript..."
    pnpm build:ts
    
    log "Desktop build complete"
}

# Package desktop app
package_desktop() {
    local platform=${1:-"current"}
    
    log "Packaging desktop app for $platform..."
    cd "$DESKTOP_DIR"
    
    case "$platform" in
        mac|macos|darwin)
            pnpm build:mac
            ;;
        win|windows|win32)
            pnpm build:win
            ;;
        linux)
            pnpm build:linux
            ;;
        current|all)
            pnpm build
            ;;
        *)
            error "Unknown platform: $platform"
            echo "Supported platforms: mac, win, linux, all"
            exit 1
            ;;
    esac
    
    log "Packaging complete! Check the release/ directory"
}

# Main
main() {
    local command=${1:-"all"}
    local platform=${2:-"current"}
    
    log "Moltbot Desktop Builder"
    log "Project root: $PROJECT_ROOT"
    
    check_node_version
    
    case "$command" in
        main)
            build_main_project
            ;;
        desktop)
            build_desktop
            ;;
        package)
            build_desktop
            package_desktop "$platform"
            ;;
        all|*)
            build_main_project
            build_desktop
            package_desktop "$platform"
            ;;
    esac
    
    log "Build process complete!"
}

main "$@"
