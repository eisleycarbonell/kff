@echo off
setlocal
cd /d "%~dp0backend"
set "KFF_ALLOW_TEST_DATA=true"
echo KFF testing only - this rebuild deletes all application records.
call npm run db:rebuild -- %*
set "KFF_SCRIPT_EXIT=%ERRORLEVEL%"
if not defined KFF_NO_PAUSE pause
exit /b %KFF_SCRIPT_EXIT%
