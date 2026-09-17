<#
.SYNOPSIS
    Set up (or update) the LOCAL IMPOC backups only - no full setup.cmd needed.

.DESCRIPTION
    For the laptop that already ran setup.cmd and does not want to re-run it:
    run this (or double-click setup-backup-local.cmd) to register the two daily
    local backup tasks + the every-logon catch-up task, and take a first
    verified backup right away.

    Asks the two backup times (24h HH:mm, default 14:00,21:00 - or pass
    -BackupTimes '14:00,21:00'). Idempotent: re-running it replaces the task
    times (Register-ScheduledTask -Force) and never touches the app.

.EXAMPLE
    .\deploy\windows\setup-backup-local.ps1
    .\deploy\windows\setup-backup-local.ps1 -BackupTimes '09:30,20:00'
#>
[CmdletBinding()]
param(
    [string]$BackupTimes
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\backup-setup.ps1')

Step 'Local backups (twice daily) + catch-up'

$times = @()
if ($BackupTimes) { $times = @($BackupTimes -split '\s*,\s*') }
while ($times.Count -ne 2 -or ($times | Where-Object { -not (Test-BackupTime $_) })) {
    $answer = Read-Host 'Two local backup times (24h), e.g. 14:00,21:00 [default: 14:00,21:00]'
    if (-not $answer) { $answer = '14:00,21:00' }
    $times = @($answer -split '\s*,\s*')
    if ($times.Count -ne 2 -or ($times | Where-Object { -not (Test-BackupTime $_) })) { Warn 'Please enter exactly two times as HH:mm,HH:mm (24h).' }
}

try {
    Install-BackupCatchUpTask | Out-Null
    $summary = Install-LocalBackupTasks $times
    Write-Host @"

=====================================================================
  Local backups are set up.
  $summary

  If the laptop was off at a scheduled time, the backup runs by itself at
  the next login (task 'IMPOC backup catch-up').

  Cloud copy? Run setup-backup-cloud.cmd once (needs a Google account).
=====================================================================
"@ -ForegroundColor Green
} catch {
    Warn "Local backup setup failed: $($_.Exception.Message)"
    Warn 'The app is unaffected. Fix the cause and re-run this script.'
    exit 1
}