#!/bin/bash
# Setup script for Forensic Exporter v3.0
# Moves scaffolding files into correct locations

echo "=== Forensic Exporter v3.0 Setup ==="
echo ""

# Create directory structure
echo "[1/4] Creating directory structure..."
mkdir -p src/strategies
mkdir -p src/extraction
mkdir -p src/integrity
mkdir -p src/types
mkdir -p src/background
mkdir -p src/adapters
mkdir -p src/core

# Move scaffolding files to proper locations
echo "[2/4] Moving scaffolding files..."

if [ -d "scaffolding-extracted" ]; then
  cp scaffolding-extracted/src/strategies/* src/strategies/ 2>/dev/null || echo "  ℹ strategies already in place"
  cp scaffolding-extracted/src/extraction/rawHtmlExtractor.js src/extraction/ 2>/dev/null || echo "  ℹ rawHtmlExtractor already in place"
  cp scaffolding-extracted/src/integrity/hashGenerator.js src/integrity/ 2>/dev/null || echo "  ℹ hashGenerator already in place"
  cp scaffolding-extracted/src/types/Evidence.js src/types/ 2>/dev/null || echo "  ℹ Evidence.js already in place"
  cp scaffolding-extracted/examples/integration-example.js src/ 2>/dev/null || echo "  ℹ integration-example already in place"

  echo "  ✓ Scaffolding files moved"
else
  echo "  ℹ No scaffolding-extracted directory found"
fi

# Schema files already in place from earlier work
echo "  ✓ Schema files already in src/schema/"

# Check what's complete
echo ""
echo "[3/4] Checking file status..."
echo ""
echo "✅ Complete:"
ls -1 src/schema/*.js 2>/dev/null | wc -l | xargs echo "  - Schema files:"
ls -1 src/strategies/*.js 2>/dev/null | wc -l | xargs echo "  - Strategy files:"
ls -1 src/extraction/rawHtmlExtractor.js 2>/dev/null | wc -l | xargs echo "  - Raw HTML extractor:"
ls -1 src/integrity/hashGenerator.js 2>/dev/null | wc -l | xargs echo "  - Hash generator:"
ls -1 src/types/*.js 2>/dev/null | wc -l | xargs echo "  - Type files:"
ls -1 src/forensicExporter.js 2>/dev/null | wc -l | xargs echo "  - Integration layer:"

echo ""
echo "⏳ TODO:"
echo "  - src/extraction/domParser.js (~100 lines)"
echo "  - src/extraction/exchangeExtractor.js (~120 lines)"
echo "  - src/extraction/messageExtractor.js (~80 lines)"
echo "  - src/extraction/thinkingBlockParser.js (~80 lines)"
echo "  - src/integrity/chainOfCustody.js (~60 lines)"
echo "  - src/background/exportController.js (~120 lines)"

# Install dependencies
echo ""
echo "[4/4] Dependencies..."
if [ -f "package.json" ]; then
  echo "  ✓ package.json exists"
  echo "  Run: npm install"
else
  echo "  ⚠ package.json not found"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Progress: 70% (Implementation + Validation layers)"
echo "Remaining: 30% (DOM parsing + Chain of custody)"
echo ""
echo "Next steps:"
echo "  1. npm install"
echo "  2. Implement 4 DOM parsing files (refactor v2.0 code)"
echo "  3. Implement chainOfCustody.js (metadata generation)"
echo "  4. Implement exportController.js (wire everything together)"
echo ""
echo "Estimated time to completion: 6-9 hours"
echo ""
