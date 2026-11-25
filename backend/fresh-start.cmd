@echo off
setlocal EnableExtensions
set "KFF_NO_START="
set "KFF_IS_HELP="
for %%A in (%*) do (
    if /i "%%~A"=="--help" set "KFF_IS_HELP=1"
    if /i "%%~A"=="-h" set "KFF_IS_HELP=1"
    if /i "%%~A"=="--no-start" set "KFF_NO_START=1"
)

if defined KFF_IS_HELP goto run_direct

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
set "KFF_SAMPLE_DATA_ON_START="
set "KFF_ALLOW_TEST_DATA="
set "KFF_ALLOW_FRESH_REBUILD=true"
call npm run db:fresh-start -- %*
set "KFF_SCRIPT_EXIT=%ERRORLEVEL%"

if defined KFF_IS_HELP goto finish
if not "%KFF_SCRIPT_EXIT%"=="0" goto finish
if defined KFF_NO_START goto finish

echo Building clean backend (no sample data)...
call npm run build
if errorlevel 1 (
    set "KFF_SCRIPT_EXIT=1"
    goto finish
)

echo Starting clean backend...
call npm start
set "KFF_SCRIPT_EXIT=%ERRORLEVEL%"

:finish
if not defined KFF_NO_PAUSE pause
exit /b %KFF_SCRIPT_EXIT%
