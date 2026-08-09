#!/usr/bin/env bash
# Build script for Render deployment
set -o errexit

echo "=== Building Frontend Assets ==="
if [ -d "frontend" ]; then
  cd frontend
  npm install
  npm run build
  cd ..
elif [ -d "../frontend" ]; then
  cd ../frontend
  npm install
  npm run build
  cd ../backend
fi

echo "=== Installing Backend Python Dependencies ==="
if [ -f "requirements.txt" ]; then
  pip install -r requirements.txt
elif [ -f "backend/requirements.txt" ]; then
  pip install -r backend/requirements.txt
fi

echo "=== Build Complete ==="
