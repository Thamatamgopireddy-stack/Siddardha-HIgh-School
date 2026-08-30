@echo off
title EduCore ERP Database Backup Utility
cls
echo ====================================================
echo             EduCore ERP Backup Utility
echo ====================================================
echo.

:: 1. Create backups directory if missing
if not exist "backups" (
    echo [INFO] Creating backups directory...
    mkdir backups
)

:: 2. Generate timestamp string (YYYYMMDD_HHMMSS)
for /f %%A in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set TIMESTAMP=%%A
if "%TIMESTAMP%"=="" set TIMESTAMP=backup_snapshot

echo [INFO] Backup timestamp: %TIMESTAMP%

:: 3. Check for Docker Postgres container
where docker >nul 2>&1
if errorlevel 1 goto check_sqlite

docker ps 2>nul | findstr /i "postgres" >nul 2>&1
if errorlevel 1 goto check_sqlite

echo [INFO] Detected running Docker Postgres container...
set BACKUP_FILE=backups\educore_pg_backup_%TIMESTAMP%.sql
echo [INFO] Dumping Postgres database to %BACKUP_FILE%...
docker exec -t siddardhahighschool-db-1 pg_dump -U educore_user -d educore > "%BACKUP_FILE%" 2>nul
if errorlevel 1 (
    docker exec -t educore-db-1 pg_dump -U educore_user -d educore > "%BACKUP_FILE%" 2>nul
)
echo [SUCCESS] Docker Postgres backup completed: %BACKUP_FILE%
goto finish

:check_sqlite
set DB_SRC=
if exist "backend\educore.db" set DB_SRC=backend\educore.db
if exist "educore.db" set DB_SRC=educore.db

if "%DB_SRC%"=="" goto no_db_found

echo [INFO] Detected local SQLite database file (%DB_SRC%)...
set BACKUP_FILE=backups\educore_backup_%TIMESTAMP%.db
echo [INFO] Creating snapshot copy: %BACKUP_FILE%...
copy /y "%DB_SRC%" "%BACKUP_FILE%" >nul
if errorlevel 1 (
    echo [ERROR] Failed to copy SQLite database.
    goto end
)
echo [SUCCESS] SQLite backup created successfully: %BACKUP_FILE%
goto finish

:no_db_found
echo [ERROR] Could not detect running Docker Postgres container or backend\educore.db file.
pause
exit /b 1

:finish
echo ====================================================
echo  Backup finished successfully!
echo ====================================================

:end
if not "%1"=="--silent" pause
