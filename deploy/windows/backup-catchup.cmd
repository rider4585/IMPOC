@echo off
REM Catch up on any missed backup slots (runs at every logon via Task Scheduler).
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0backup-catchup.ps1" %*