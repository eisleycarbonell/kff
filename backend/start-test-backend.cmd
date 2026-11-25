@echo off
setlocal
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

echo Building the testing backend. Samples load only if the database is empty.
call npm run build
if errorlevel 1 goto failed
call npm run start:test
set "KFF_SCRIPT_EXIT=%ERRORLEVEL%"
goto finish

:failed
set "KFF_SCRIPT_EXIT=1"

:finish
if not defined KFF_NO_PAUSE pause
exit /b %KFF_SCRIPT_EXIT%
