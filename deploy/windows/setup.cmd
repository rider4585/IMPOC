@echo off
setlocal
set SCRIPT_DIR=%~dp0
if "%SCRIPT_DIR:~-1%"=="\" set SCRIPT_DIR=%SCRIPT_DIR:~0,-1%
cd /d "%SCRIPT_DIR%"

REM Check for Administrator privileges; request elevation if not elevated.
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting administrative privileges...
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { Start-Process -FilePath '%comspec%' -WorkingDirectory '%SCRIPT_DIR%' -ArgumentList ('/c `\"`\"' + '%~f0' + '`\" %*`\"') -Verb RunAs } catch { exit 1 }"
    if errorlevel 1 (
        echo.
        echo [ERROR] Administrator privileges are required.
        echo Please approve the User Account Control (UAC) prompt to continue.
        pause
    )
    exit /b %errorlevel%
)

REM One-time production setup. Running with Administrator privileges.
set IMPOC_CMD_WRAPPER=1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1" %*
pause
