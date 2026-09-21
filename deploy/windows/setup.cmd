@echo off
REM One-time production setup. Right-click -> "Run as administrator".
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1" %*
pause
