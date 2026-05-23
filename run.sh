#!/bin/bash
# Resume Studio — Start Script (Linux / macOS)
cd "$(dirname "$0")"

if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate
pip install -q -r requirements.txt

echo "🚀 Starting Resume Studio → http://127.0.0.1:5050"
python3 -m uvicorn src.app:app --host 127.0.0.1 --port 5050 --reload
