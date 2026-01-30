#!/bin/bash

# iUM Frontend (Next.js) Startup Script
# Usage: ./run.sh or bash run.sh

cd "$(dirname "$0")"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Run the development server
echo "Starting iUM Frontend at http://localhost:3000"
echo ""
npm run dev
