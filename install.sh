#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install Node.js 18+ (20 recommended), then run this script again."
  if [[ "$(uname -s)" == "Darwin" ]]; then
    echo "On macOS with Homebrew: brew install node@20"
  fi
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm was not found. Install Node.js/npm first."
  exit 1
fi

node_major=$(node -p "process.versions.node.split('.')[0]")
if [[ "$node_major" -lt 18 ]]; then
  echo "Node.js 18 or newer is required. Current: $(node -v)"
  exit 1
fi

echo "Installing Node dependencies..."
npm install --omit=dev

echo
echo "Starting read-only WhatsApp Self Audit..."
npm start
