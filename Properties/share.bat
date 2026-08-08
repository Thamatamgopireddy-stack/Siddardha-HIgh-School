@echo off
title Siddardha High School - Share Application to Client
cls
echo ====================================================
echo        Siddardha High School Public Sharing Tool
echo ====================================================
echo.
echo [INFO] Fetching public IP address for Tunnel Password...
for /f "tokens=*" %%A in ('curl -s https://api.ipify.org') do set PUBLIC_IP=%%A

echo.
echo ====================================================
echo  PUBLIC CLIENT REVIEW DETAILS:
echo ====================================================
echo  * Tunnel Password (if prompted by localtunnel): %PUBLIC_IP%
echo.
echo  Starting public secure tunnel on port 8000...
echo ====================================================
echo.

npx localtunnel --port 8000

pause
