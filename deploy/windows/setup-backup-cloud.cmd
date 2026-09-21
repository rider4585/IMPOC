@echo off
REM Set up or update the CLOUD IMPOC backups (no full setup needed). Safe to re-run.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-backup-cloud.ps1" %*
if errorlevel 1 pause