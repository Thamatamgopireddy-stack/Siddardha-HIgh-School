@echo off
title Siddardha High school Launcher
cls
echo ====================================================
echo             Siddardha High school Launcher
echo ====================================================
echo.

:: 1. Check if Frontend needs to be built
if not exist "frontend\dist\index.html" (
    echo [INFO] Frontend build not found. Compiling frontend...
    
    rem Check if Node.js is installed
    where node >nul 2>&1
    if %errorlevel% neq 0 (
        echo [WARNING] Node.js is not installed on this system.
        echo [WARNING] Please install Node.js v20+ or compile the frontend manually.
        echo.
        goto run_backend
    )
    
    echo [INFO] Installing frontend dependencies...
    cd frontend
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install frontend dependencies.
        cd ..
        pause
        exit /b %errorlevel%
    )
    
    echo [INFO] Building frontend production assets...
    call npm run build
    if %errorlevel% neq 0 (
        echo [ERROR] Frontend build failed.
        cd ..
        pause
        exit /b %errorlevel%
    )
    cd ..
    echo [SUCCESS] Frontend compilation complete!
    echo.
) else (
    echo [INFO] Found existing frontend build.
)

:run_backend
:: 2. Activate Python Virtual Environment
set VENV_PATH=

if exist "%~dp0backend\venv\Scripts\activate.bat" (
    set VENV_PATH=%~dp0backend\venv
) else if exist "%~dp0.venv\Scripts\activate.bat" (
    set VENV_PATH=%~dp0.venv
) else if exist "%~dp0backend\.venv\Scripts\activate.bat" (
    set VENV_PATH=%~dp0backend\.venv
)

if not "%VENV_PATH%"=="" (
    echo [INFO] Activating virtual environment: %VENV_PATH%
    call "%VENV_PATH%\Scripts\activate.bat"
) else (
    echo [WARNING] No virtual environment found. Running with global python...
)

:: 3. Find and display local IP addresses for intranet access
echo ====================================================
echo  LOCAL NETWORK (INTRANET) ACCESS URLS:
echo ====================================================
echo  * On this host: http://localhost:8000
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /i "ipv4"') do (
    for /f "tokens=1" %%B in ("%%A") do (
        echo  * On school network: http://%%B:8000
    )
)
echo ====================================================
echo.

:: 4. Launch browser in 2 seconds in the background
echo [INFO] Launching browser automatically in 2 seconds...
start "" cmd /c "timeout /t 2 >nul && start http://localhost:8000"

:: 5. Run the backend server on 0.0.0.0 (all interfaces)
echo [INFO] Starting Siddardha High School server...
echo [INFO] Press Ctrl+C to stop the server.
echo.

cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
if %errorlevel% neq 0 (
    echo [ERROR] Server crashed or failed to start.
    cd ..
    pause
    exit /b %errorlevel%
)

cd ..
pause

