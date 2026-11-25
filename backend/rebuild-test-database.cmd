@echo off
setlocal
if /i "%~1"=="--help" goto run_direct
if /i "%~1"=="-h" goto run_direct

where node >nul 2>nul
if errorlevel 1 (
    echo Error: Node.js 24+ is required and was not found on PATH.
    set "KFF_SCRIPT_EXIT=1"
    goto finish
)

cd /d "%~dp0"
if not exist "node_modules\" (
    echo Installing backend dependencies...
    if exist "package-lock.json" (
        call npm ci
    ) else (
        call npm install
    )
    if errorlevel 1 (
        set "KFF_SCRIPT_EXIT=1"
        goto finish
    )
)

if not exist ".env" (
    echo Error: Missing .env. Copy .env.example to .env and configure DATABASE_URL.
    set "KFF_SCRIPT_EXIT=1"
    goto finish
)

:run_direct
cd /d "%~dp0"
set "KFF_ALLOW_TEST_DATA=true"
echo KFF testing only - this rebuild deletes all application records.
call npm run db:rebuild -- %*
set "KFF_SCRIPT_EXIT=%ERRORLEVEL%"

:finish
if not defined KFF_NO_PAUSE pause
exit /b %KFF_SCRIPT_EXIT%
