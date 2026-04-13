#!/bin/bash

# Ensure we are in the repository root
cd "$(dirname "$0")"

# Check if venv exists, create if not
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

echo "🚀 Starting Resume Studio..."
echo "👉 Open: http://127.0.0.1:5050"
echo ""

# Run uvicorn
uvicorn scripts.studio:app --host 127.0.0.1 --port 5050 --reload
