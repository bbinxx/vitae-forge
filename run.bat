@echo off
REM Resume Studio — Start Script (Windows)
cd /d "%~dp0"

set VENV_DIR=venv
set VENV_PYTHON=%VENV_DIR%\Scripts\python.exe

REM Check for python
where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: python not found. Install from https://www.python.org
    exit /b 1
)

REM Detect stale venv
if exist "%VENV_DIR%\pyvenv.cfg" (
    for /f "tokens=2 delims= " %%v in ('findstr /r "^version" "%VENV_DIR%\pyvenv.cfg"') do set VENV_VER=%%v
    for /f "tokens=*" %%v in ('python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"') do set SYS_VER=%%v
    if not "%VENV_VER%"=="%SYS_VER%" (
        echo Venv was Python %VENV_VER% but system is %SYS_VER% — recreating...
        rmdir /s /q "%VENV_DIR%"
    )
)

REM Create venv if missing
if not exist "%VENV_DIR%" (
    echo Creating virtual environment...
    python -m venv %VENV_DIR%
)

echo Upgrading pip...
"%VENV_PYTHON%" -m pip install --upgrade pip --quiet

echo Installing dependencies...
"%VENV_PYTHON%" -m pip install -r requirements.txt

REM Load .env
if exist .env (
    echo Loading environment from .env...
    for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
        set "%%a=%%b"
    )
)

echo.
echo ========================================
echo   Resume Studio  -  http://127.0.0.1:5050
echo ========================================
echo.

"%VENV_PYTHON%" -m uvicorn src.app:app --host 127.0.0.1 --port 5050 --reload
