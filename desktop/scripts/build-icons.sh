#!/bin/bash
# Script to generate desktop icons from the main project icon
# Requires ImageMagick

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DESKTOP_DIR="$PROJECT_ROOT/desktop"
ASSETS_DIR="$DESKTOP_DIR/assets"

# Source icon from main project
SOURCE_ICON="$PROJECT_ROOT/assets/icon.png"

if [ ! -f "$SOURCE_ICON" ]; then
    echo "Error: Source icon not found at $SOURCE_ICON"
    echo "Please add a 1024x1024 PNG icon to the main project's assets folder"
    exit 1
fi

echo "Generating desktop icons from $SOURCE_ICON..."

# Create assets directory if needed
mkdir -p "$ASSETS_DIR"

# macOS icon (icns)
if command -v iconutil &> /dev/null && command -v sips &> /dev/null; then
    echo "Generating macOS icon..."
    ICONSET_DIR="$ASSETS_DIR/icon.iconset"
    mkdir -p "$ICONSET_DIR"
    
    # Generate different sizes
    for size in 16 32 64 128 256 512 1024; do
        sips -z $size $size "$SOURCE_ICON" --out "$ICONSET_DIR/icon_${size}x${size}.png"
        if [ $size -lt 512 ]; then
            sips -z $((size*2)) $((size*2)) "$SOURCE_ICON" --out "$ICONSET_DIR/icon_${size}x${size}@2x.png"
        fi
    done
    
    iconutil -c icns "$ICONSET_DIR" -o "$ASSETS_DIR/icon.icns"
    rm -rf "$ICONSET_DIR"
    echo "Created $ASSETS_DIR/icon.icns"
else
    echo "Warning: iconutil/sips not available (macOS only), skipping .icns generation"
fi

# Windows icon (ico) - requires ImageMagick
if command -v convert &> /dev/null; then
    echo "Generating Windows icon..."
    convert "$SOURCE_ICON" -define icon:auto-resize=256,128,64,48,32,16 "$ASSETS_DIR/icon.ico"
    echo "Created $ASSETS_DIR/icon.ico"
else
    echo "Warning: ImageMagick not available, skipping .ico generation"
    echo "Install with: brew install imagemagick (macOS) or apt-get install imagemagick (Linux)"
fi

# Linux icon (just copy the PNG)
cp "$SOURCE_ICON" "$ASSETS_DIR/icon.png"
echo "Created $ASSETS_DIR/icon.png"

echo "Icon generation complete!"
