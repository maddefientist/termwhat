#!/bin/bash

set -e

echo "Installing termwhat..."
echo ""

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "Error: Node.js 20 or higher required. Found: $(node -v)"
  exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build TypeScript
echo "🔨 Building project..."
npm run build

echo ""
echo "✓ Build complete!"
echo ""

# Ask if user wants global install
read -p "Install globally so you can use 'termwhat' from anywhere? [Y/n] " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
  echo "🔗 Installing globally..."
  npm link
  echo ""
  echo "✓ Global install complete!"
  echo ""
  echo "Usage:"
  echo "  termwhat                           # Interactive REPL mode"
  echo "  termwhat command to kill port 3000 # One-shot query"
  echo "  termwhat setup                     # Configure settings"
  echo "  termwhat --doctor                  # Check connectivity"
  echo ""
  echo "On first run, termwhat will ask for your Ollama URL."
else
  echo ""
  echo "Local install only. Usage:"
  echo "  npm start                          # Interactive REPL mode"
  echo "  npm start \"your question\"          # One-shot query"
  echo "  npm run dev                        # Development mode"
  echo ""
  echo "To install globally later:"
  echo "  npm link"
fi

echo ""
