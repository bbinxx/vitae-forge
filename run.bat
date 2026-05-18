@echo off
REM ── RESUME ULTIMATE CONTROL CENTER ───────────────────────────────────────────
REM Unified Entry Point for Building, Deploying, and Managing Resumes (Windows)
REM ─────────────────────────────────────────────────────────────────────────────

cd /d "%~dp0"

REM Setup Virtual Environment
IF NOT EXIST "venv" (
    echo [INFO] Creating virtual environment...
    python -m venv venv
)
call venv\Scripts\activate.bat
REM Quietly ensure dependencies are up-to-date
pip install -q -r requirements.txt

REM Run Manager
python src\manager.py
