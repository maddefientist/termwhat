#!/bin/bash
echo "🔍 Running validation checklist..."
echo ""

checks_passed=0
checks_total=0

# Check 1: Build succeeds
echo -n "✓ npm run build succeeds: "
checks_total=$((checks_total + 1))
if npm run build > /dev/null 2>&1; then
  echo "PASS"
  checks_passed=$((checks_passed + 1))
else
  echo "FAIL"
fi

# Check 2: --help works
echo -n "✓ termwhat --help shows options: "
checks_total=$((checks_total + 1))
if node dist/index.js --help > /dev/null 2>&1; then
  echo "PASS"
  checks_passed=$((checks_passed + 1))
else
  echo "FAIL"
fi

# Check 3: --version matches package.json
echo -n "✓ termwhat --version returns package.json version: "
checks_total=$((checks_total + 1))
EXPECTED_VERSION=$(node -p "require('./package.json').version")
ACTUAL_VERSION=$(node dist/index.js --version 2>/dev/null)
if [[ "$ACTUAL_VERSION" == "$EXPECTED_VERSION" ]]; then
  echo "PASS ($ACTUAL_VERSION)"
  checks_passed=$((checks_passed + 1))
else
  echo "FAIL (expected $EXPECTED_VERSION, got $ACTUAL_VERSION)"
fi

# Check 4: Core source + providers layout exists
echo -n "✓ All source files exist: "
checks_total=$((checks_total + 1))
required_files=(
  "src/index.ts"
  "src/prompt.ts"
  "src/render.ts"
  "src/repl.ts"
  "src/doctor.ts"
  "src/clipboard.ts"
  "src/types.ts"
  "src/config.ts"
  "src/providers/index.ts"
  "src/providers/base.ts"
  "src/providers/factory.ts"
  "src/providers/ollama.ts"
  "src/providers/openai.ts"
  "src/providers/anthropic.ts"
  "src/providers/openrouter.ts"
)
all_exist=true
for file in "${required_files[@]}"; do
  if [ ! -f "$file" ]; then
    all_exist=false
    echo ""
    echo "  missing: $file"
    break
  fi
done
# Legacy file must be gone
if [ -f "src/ollama.ts" ]; then
  all_exist=false
  echo ""
  echo "  unexpected legacy file: src/ollama.ts"
fi
if [ "$all_exist" = true ]; then
  echo "PASS"
  checks_passed=$((checks_passed + 1))
else
  echo "FAIL"
fi

# Check 5: Docker files exist
echo -n "✓ Docker files exist: "
checks_total=$((checks_total + 1))
if [ -f "Dockerfile" ] && [ -f "docker-compose.yml" ] && [ -f ".dockerignore" ]; then
  echo "PASS"
  checks_passed=$((checks_passed + 1))
else
  echo "FAIL"
fi

# Check 6: Documentation exists
echo -n "✓ Documentation exists: "
checks_total=$((checks_total + 1))
if [ -f "README.md" ] && [ -f "PROJECT.md" ]; then
  echo "PASS"
  checks_passed=$((checks_passed + 1))
else
  echo "FAIL"
fi

echo ""
echo "Results: $checks_passed/$checks_total checks passed"
echo ""

if [ $checks_passed -eq $checks_total ]; then
  echo "✅ All validation checks passed!"
  exit 0
else
  echo "⚠️  Some checks failed"
  exit 1
fi
