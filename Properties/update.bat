@echo off
title Siddardha High School Auto-Updater
cls
echo ====================================================
echo             Siddardha High School Auto-Updater
echo ====================================================
echo.

:: 1. Pull latest code from GitHub
echo [INFO] Fetching latest changes from Git...
git pull
if %errorlevel% neq 0 (
    echo [WARNING] git pull failed. Make sure Git is installed and you have internet access.
    echo [WARNING] Continuing with local rebuild...
)
echo.

:: 2. Update Python dependencies
echo [INFO] Updating Backend dependencies...
set VENV_PATH=
if exist "backend\venv\Scripts\activate.bat" (
    set VENV_PATH=backend\venv
) else if exist ".venv\Scripts\activate.bat" (
    set VENV_PATH=.venv
) else if exist "backend\.venv\Scripts\activate.bat" (
    set VENV_PATH=backend\.venv
)

if not "%VENV_PATH%"=="" (
    echo [INFO] Activating virtual environment: %VENV_PATH%
    call %VENV_PATH%\Scripts\activate.bat
    python -m pip install --upgrade pip
    pip install -r backend\requirements.txt
) else (
    echo [WARNING] No virtual environment found. Installing packages globally...
    pip install -r backend\requirements.txt
)
echo [SUCCESS] Backend dependencies updated!
echo.

:: 3. Rebuild frontend production assets
echo [INFO] Checking Node.js for frontend compilation...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Node.js is not installed. Skipping frontend rebuild.
    echo [WARNING] If the UI code has changed, install Node.js (v20+) and run compilation.
    goto finish
)

echo [INFO] Rebuilding frontend...
cd frontend
call npm install
call npm run build
cd ..
echo [SUCCESS] Frontend rebuilt successfully!
echo.

:finish
echo ====================================================
echo  Siddardha High School is up to date!
echo  Run "run.bat" to start the server.
echo ====================================================
pause
