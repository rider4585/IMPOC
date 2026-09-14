@echo off
REM Take a verified local database backup now (also runs twice daily via Task Scheduler).
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0backup-local.ps1" -Label manual %*
if errorlevel 1 pause
