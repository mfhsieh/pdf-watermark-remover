#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Read version from package.json
VERSION=$(node -p "require('./package.json').version" 2>/dev/null)

if [ -z "$VERSION" ]; then
  echo "Failed to read version from package.json"
  exit 1
fi

echo "Syncing version v$VERSION to index.html..."

# Update index.html version-badge
sed -i -E "s/<span class=\"version-badge\">v[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?<\/span>/<span class=\"version-badge\">v$VERSION<\/span>/g" index.html

echo "Version synced successfully."
