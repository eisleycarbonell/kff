@echo off
setlocal
cd /d "%~dp0backend"
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
