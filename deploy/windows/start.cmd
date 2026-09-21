@echo off
REM Starts IMPOC (PostgreSQL -> pm2 -> browser). Double-click, or runs at login.
REM Pass --no-browser to start the services only.
set ARGS=
if /I "%~1"=="--no-browser" set ARGS=-NoBrowser
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File "%~dp0start.ps1" %ARGS%
