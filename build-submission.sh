#!/usr/bin/env bash
set -e

echo "Building Reality Check AI dashboard..."
cd dashboard && npm run build
cd ..

echo "Build complete. Extension is ready in extension/"
