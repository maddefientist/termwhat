#!/bin/bash

set -e

REPO_URL="https://github.com/maddefientist/termwhat"
INSTALL_DIR="${HOME}/.termwhat"

echo "🚀 termwhat installer"
echo ""

# Check Node.js version
if ! command -v node &> /dev/null; then
  echo "❌ Error: Node.js is not installed"
  echo "Install Node.js 20+ from https://nodejs.org/"
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "❌ Error: Node.js 20 or higher required. Found: $(node -v)"
  echo "Install from https://nodejs.org/"
  exit 1
fi

echo "✓ Node.js $(node -v) detected"
echo ""

# Check if we're in the repo directory
if [ -f "package.json" ] && grep -q "termwhat" package.json 2>/dev/null; then
  echo "📍 Installing from current directory..."
  WORK_DIR="$(pwd)"
else
  # Check if git is available
  if command -v git &> /dev/null; then
    echo "📦 Cloning from GitHub..."
    rm -rf "$INSTALL_DIR"
    git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
    WORK_DIR="$INSTALL_DIR"
  else
    echo "📦 Downloading from GitHub (git not found)..."
    rm -rf "$INSTALL_DIR"
    mkdir -p "$INSTALL_DIR"

    # Download tarball
    TARBALL_URL="$REPO_URL/archive/refs/heads/main.tar.gz"
    if command -v curl &> /dev/null; then
      curl -fsSL "$TARBALL_URL" | tar -xz -C "$INSTALL_DIR" --strip-components=1
    elif command -v wget &> /dev/null; then
      wget -qO- "$TARBALL_URL" | tar -xz -C "$INSTALL_DIR" --strip-components=1
    else
      echo "❌ Error: Neither curl nor wget found"
      echo "Install git, curl, or wget to continue"
      exit 1
    fi

    WORK_DIR="$INSTALL_DIR"
  fi
fi

cd "$WORK_DIR"

# Install dependencies
echo "📦 Installing dependencies..."
npm install --silent

# Build
echo "🔨 Building..."
npm run build --silent

# Install globally
echo "🔗 Installing globally..."
npm link --silent

echo ""
echo "✅ Installation complete!"
echo ""
echo "Usage:"
echo "  termwhat                                  # Interactive mode"
echo "  termwhat command to kill process on port 3000"
echo "  termwhat how do I find large files"
echo "  termwhat setup                            # Configure Ollama URL"
echo "  termwhat --doctor                         # Test connection"
echo ""
echo "On first run, you'll be asked for your Ollama URL."
echo "Make sure Ollama is running: ollama serve"
echo ""
