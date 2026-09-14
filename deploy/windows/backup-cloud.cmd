@echo off
REM Upload an encrypted copy of the database to Google Drive (date-wise folders). Double-click to run.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0backup-cloud.ps1" %*
pause
