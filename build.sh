#!/usr/bin/env bash
# Build script for Render deployment
set -o errexit

echo "=== Building Frontend Assets ==="
ORIGINAL_DIR=$(pwd)

if [ -d "Properties/frontend" ]; then
  cd Properties/frontend
elif [ -d "../frontend" ]; then
  cd ../frontend
elif [ -d "frontend" ]; then
  cd frontend
else
  echo "ERROR: Frontend directory not found from $(pwd)!"
  exit 1
fi

echo "Installing frontend dependencies..."
npm install --include=dev

echo "Building frontend dist..."
npm run build

cd "$ORIGINAL_DIR"

echo "=== Installing Backend Python Dependencies ==="
if [ -f "Properties/backend/requirements.txt" ]; then
  pip install -r Properties/backend/requirements.txt
elif [ -f "requirements.txt" ]; then
  pip install -r requirements.txt
elif [ -f "../requirements.txt" ]; then
  pip install -r ../requirements.txt
fi

echo "=== Build Complete ==="
