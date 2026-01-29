#!/bin/bash

set -e

echo "Installing termwhat..."

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "Error: Node.js 20 or higher required. Found: $(node -v)"
  exit 1
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Build TypeScript
echo "Building project..."
npm run build

# Create symlink for global usage (optional)
echo ""
echo "Build complete!"
echo ""
echo "Usage:"
echo "  npm start                    # Start in REPL mode"
echo "  npm start \"your question\"    # One-shot query"
echo "  npm run dev                  # Development mode with tsx"
echo ""
echo "To install globally:"
echo "  npm link"
echo ""
echo "Or run directly:"
echo "  node dist/index.js"
echo ""
