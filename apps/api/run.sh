#!/bin/bash

# iUM Backend API Startup Script
# Usage: ./run.sh or bash run.sh

cd "$(dirname "$0")"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies if requirements.txt changed
pip install -r requirements.txt -q

# Run the development server
echo "Starting iUM API server at http://localhost:8000"
echo "API docs available at http://localhost:8000/docs"
echo ""
uvicorn main:app --reload --port 8000
