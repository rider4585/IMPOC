@echo off
REM Update IMPOC from GitHub: pull -> install -> migrate -> build -> restart.
REM Double-click to run. No admin rights needed.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0update.ps1" %*
pause
