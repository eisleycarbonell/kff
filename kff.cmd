@echo off
setlocal EnableExtensions
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

if "%~1"=="" goto menu

set "CMD=%~1"
shift

set "ARGS="
:collect_args
if "%~1"=="" goto dispatch
set "ARGS=%ARGS% %1"
shift
goto collect_args

:dispatch
if /i "%CMD%"=="install" goto cmd_install
if /i "%CMD%"=="dev" goto cmd_dev
if /i "%CMD%"=="test" goto cmd_test
if /i "%CMD%"=="seed" goto cmd_seed
if /i "%CMD%"=="rebuild" goto cmd_rebuild
if /i "%CMD%"=="fresh-start" goto cmd_fresh_start
if /i "%CMD%"=="demo-user" goto cmd_demo_user
if /i "%CMD%"=="verify" goto cmd_verify
if /i "%CMD%"=="check-docs" goto cmd_check_docs
if /i "%CMD%"=="help" goto cmd_help
if /i "%CMD%"=="-h" goto cmd_help
if /i "%CMD%"=="--help" goto cmd_help

echo Unknown command: %CMD%
echo.
goto cmd_help

:menu
cls
echo ============================================================
echo   KFF (Kusina Filipino Food) - Workspace Launcher
echo ============================================================
echo   [1] Start dev servers (backend :3001 + frontend :3000)
echo   [2] Build and start testing backend (seeds empty DB)
echo   [3] Load sample data into empty test DB
echo   [4] Rebuild test database (DELETES test records)
echo   [5] Create demo admin user (demo@spice.local)
echo   [6] Install dependencies (backend + frontend)
echo   [7] Verify both apps (doc check, typecheck, lint, tests)
echo   [8] Check docs and clean app-repo separation
echo   [9] Fresh start: rebuild empty DB (no sample data) + start backend
echo   [0] Exit
echo ============================================================
set "CHOICE="
set /p "CHOICE=Select an option (0-9): "

if "%CHOICE%"=="1" (call :cmd_dev & goto menu_pause)
if "%CHOICE%"=="2" (call :cmd_test_interactive & goto menu_pause)
if "%CHOICE%"=="3" (call :cmd_seed_interactive & goto menu_pause)
if "%CHOICE%"=="4" (call :cmd_rebuild_interactive & goto menu_pause)
if "%CHOICE%"=="5" (call :cmd_demo_user & goto menu_pause)
if "%CHOICE%"=="6" (call :cmd_install & goto menu_pause)
if "%CHOICE%"=="7" (call :cmd_verify & goto menu_pause)
if "%CHOICE%"=="8" (call :cmd_check_docs & goto menu_pause)
if "%CHOICE%"=="9" (call :cmd_fresh_start_interactive & goto menu_pause)
if "%CHOICE%"=="0" exit /b 0
echo Invalid choice.
:menu_pause
echo.
pause
goto menu

:cmd_help
echo Usage: kff ^<command^> [options]
echo.
echo Commands:
echo   install     Install dependencies in backend/ and frontend/
echo   dev         Start backend (:3001) and frontend (:3000) dev servers
echo   test        Build and start testing backend (backend\start-test-backend.cmd)
echo   seed        Load demo data into empty DB (backend\load-sample-data.cmd)
echo   rebuild     Delete KFF data and recreate schema (backend\rebuild-test-database.cmd)
echo   fresh-start Rebuild empty DB with NO sample data and start backend (backend\fresh-start.cmd)
echo   demo-user   Create demo administrator login (demo@spice.local)
echo   verify      Run doc/link check, backend typecheck/tests, frontend tsc/lint/tests
echo   check-docs  Verify Markdown links and confirm no AI/docs live in backend/ or frontend/
echo   help        Show this help
echo.
echo Run with no arguments to open the interactive menu.
exit /b 0

:ensure_node
where node >nul 2>nul
if errorlevel 1 (
    echo Error: Node.js 24+ is required and was not found on PATH.
    exit /b 1
)
exit /b 0

:ensure_app_deps
set "APP_DIR=%~1"
if exist "%APP_DIR%\node_modules\" exit /b 0
echo Installing dependencies in %APP_DIR%...
pushd "%APP_DIR%"
if exist "package-lock.json" (
    call npm ci
) else (
    call npm install
)
set "DEP_EXIT=%ERRORLEVEL%"
popd
exit /b %DEP_EXIT%

:cmd_install
call :ensure_node || exit /b 1
echo Installing backend dependencies...
pushd "%ROOT%\backend"
if exist "node_modules\" (
    call npm install
) else if exist "package-lock.json" (
    call npm ci
) else (
    call npm install
)
set "E1=%ERRORLEVEL%"
popd
if not "%E1%"=="0" exit /b %E1%

echo Installing frontend dependencies...
pushd "%ROOT%\frontend"
if exist "node_modules\" (
    call npm install
) else if exist "package-lock.json" (
    call npm ci
) else (
    call npm install
)
set "E2=%ERRORLEVEL%"
popd
exit /b %E2%

:cmd_dev
call :ensure_node || exit /b 1
call :ensure_app_deps "%ROOT%\backend" || exit /b 1
call :ensure_app_deps "%ROOT%\frontend" || exit /b 1
if not exist "%ROOT%\backend\.env" (
    echo Warning: backend\.env is missing. Copy backend\.env.example to backend\.env first.
)
if not exist "%ROOT%\frontend\.env" if not exist "%ROOT%\frontend\.env.local" (
    echo Warning: frontend\.env or frontend\.env.local is missing. Default API base URL will be used.
)
start "KFF Backend (3001)" cmd /k "cd /d ""%ROOT%\backend"" && npm run dev"
start "KFF Frontend (3000)" cmd /k "cd /d ""%ROOT%\frontend"" && npm run dev"
echo Launched backend (:3001) and frontend (:3000) in separate windows.
exit /b 0

:cmd_test
setlocal
set "KFF_NO_PAUSE=1"
call "%ROOT%\backend\start-test-backend.cmd"%ARGS%
exit /b %ERRORLEVEL%

:cmd_test_interactive
call "%ROOT%\backend\start-test-backend.cmd"
exit /b %ERRORLEVEL%

:cmd_seed
setlocal
set "KFF_NO_PAUSE=1"
call "%ROOT%\backend\load-sample-data.cmd"%ARGS%
exit /b %ERRORLEVEL%

:cmd_seed_interactive
call "%ROOT%\backend\load-sample-data.cmd"
exit /b %ERRORLEVEL%

:cmd_rebuild
setlocal
set "KFF_NO_PAUSE=1"
call "%ROOT%\backend\rebuild-test-database.cmd"%ARGS%
exit /b %ERRORLEVEL%

:cmd_rebuild_interactive
call "%ROOT%\backend\rebuild-test-database.cmd"
exit /b %ERRORLEVEL%

:cmd_fresh_start
setlocal
set "KFF_NO_PAUSE=1"
call "%ROOT%\backend\fresh-start.cmd"%ARGS%
exit /b %ERRORLEVEL%

:cmd_fresh_start_interactive
call "%ROOT%\backend\fresh-start.cmd"
exit /b %ERRORLEVEL%

:cmd_demo_user
call :ensure_node || exit /b 1
call :ensure_app_deps "%ROOT%\backend" || exit /b 1
if not exist "%ROOT%\backend\.env" (
    echo Error: Missing backend\.env. Copy backend\.env.example to backend\.env first.
    exit /b 1
)
pushd "%ROOT%\backend"
call npm run db:create-demo-user%ARGS%
set "E=%ERRORLEVEL%"
popd
exit /b %E%

:cmd_check_docs
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\check-docs.ps1"%ARGS%
exit /b %ERRORLEVEL%

:cmd_verify
call :ensure_node || exit /b 1
echo [1/4] Checking docs, Markdown links, and app-repo separation...
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\check-docs.ps1"
if errorlevel 1 exit /b 1

call :ensure_app_deps "%ROOT%\backend" || exit /b 1
echo [2/4] Verifying backend (typecheck + tests)...
pushd "%ROOT%\backend"
call npm run typecheck
if errorlevel 1 (popd & exit /b 1)
call npm test
if errorlevel 1 (popd & exit /b 1)
popd

call :ensure_app_deps "%ROOT%\frontend" || exit /b 1
echo [3/4] Verifying frontend (tsc + lint)...
pushd "%ROOT%\frontend"
call npx tsc --noEmit
if errorlevel 1 (popd & exit /b 1)
call npm run lint
if errorlevel 1 (popd & exit /b 1)

echo [4/4] Running frontend tests...
call npm test
if errorlevel 1 (popd & exit /b 1)
popd

echo All verification checks passed.
exit /b 0
