@echo off
REM Resume Studio — Start Script (Windows)
cd /d "%~dp0"

IF NOT EXIST "venv" (
    echo 📦 Creating virtual environment...
    python -m venv venv
)

call venv\Scripts\activate.bat
pip install -q -r requirements.txt

echo 🚀 Starting Resume Studio ^-^> http://127.0.0.1:5050
python -m uvicorn src.app:app --host 127.0.0.1 --port 5050 --reload
