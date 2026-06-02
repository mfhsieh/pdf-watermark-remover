#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

mkdir -p tmp

cat \
  js/utils.js \
  js/config.js \
  js/state.js \
  js/ui.js \
  js/ui-modals.js \
  js/pdf-scanner.js \
  js/pdf-cleaner.js \
  js/app.js \
  > tmp/all.js