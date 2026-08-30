@echo off
title EduCore ERP Database Restore Utility
cls
echo ====================================================
echo             EduCore ERP Restore Utility
echo ====================================================
echo.

set BACKUP_FILE=%~1
set OPTION_ARG=%~2

if "%BACKUP_FILE%"=="" (
    echo [INFO] No backup file specified on command line.
    echo [INFO] Recent backups found in backups\ directory:
    echo.
    dir /b /o-d backups\*.* 2>nul
    echo.
    set /p BACKUP_FILE="Enter backup filename or full path: "
)

if not exist "%BACKUP_FILE%" (
    echo [ERROR] Backup file "%BACKUP_FILE%" does not exist!
    pause
    exit /b 1
)

echo.
echo ====================================================
echo  [WARNING] CRITICAL DATA OVERWRITE NOTICE
echo ====================================================
echo  This action will REPLACEMENT AND OVERWRITE all live data
echo  in your current EduCore ERP database with:
echo  "%BACKUP_FILE%"
echo ====================================================
echo.
if /i "%OPTION_ARG%"=="--force" set CONFIRM=Y
if /i "%OPTION_ARG%"=="-y" set CONFIRM=Y

if "%CONFIRM%"=="" (
    set /p CONFIRM="Are you sure you want to restore and overwrite live data? (Y/N): "
)

if /i not "%CONFIRM%"=="Y" (
    echo [CANCELLED] Restore operation cancelled by user.
    pause
    exit /b 0
)

echo.
echo [INFO] Restoring database from "%BACKUP_FILE%"...

where docker >nul 2>&1
if errorlevel 1 goto restore_sqlite

docker ps 2>nul | findstr /i "postgres" >nul 2>&1
if errorlevel 1 goto restore_sqlite

echo [INFO] Restoring to Docker Postgres container...
docker exec -i siddardhahighschool-db-1 psql -U educore_user -d educore < "%BACKUP_FILE%" 2>nul
if errorlevel 1 (
    docker exec -i educore-db-1 psql -U educore_user -d educore < "%BACKUP_FILE%" 2>nul
)
echo [SUCCESS] Docker Postgres database restored successfully!
goto finish

:restore_sqlite
set DB_TARGET=
if exist "backend\educore.db" set DB_TARGET=backend\educore.db
if exist "educore.db" set DB_TARGET=educore.db
if "%DB_TARGET%"=="" set DB_TARGET=backend\educore.db

echo [INFO] Restoring to local SQLite database (%DB_TARGET%)...
copy /y "%BACKUP_FILE%" "%DB_TARGET%" >nul
if errorlevel 1 (
    echo [ERROR] Failed to restore SQLite database file.
    pause
    exit /b 1
)
echo [SUCCESS] SQLite database restored successfully!
goto finish

:finish
echo ====================================================
echo  Restore completed successfully!
echo ====================================================
if /i not "%OPTION_ARG%"=="--force" if /i not "%OPTION_ARG%"=="-y" pause
