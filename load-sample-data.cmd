@echo off
setlocal
cd /d "%~dp0backend"
set "KFF_ALLOW_TEST_DATA=true"
echo KFF testing only - load samples into an empty database.
call npm run db:seed -- %*
set "KFF_SCRIPT_EXIT=%ERRORLEVEL%"
if not defined KFF_NO_PAUSE pause
exit /b %KFF_SCRIPT_EXIT%
