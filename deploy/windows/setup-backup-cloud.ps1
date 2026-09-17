<#
.SYNOPSIS
    Set up (or update) the CLOUD IMPOC backups only - no full setup.cmd needed.

.DESCRIPTION
    For the laptop that already ran setup.cmd and does not want to re-run it:
    run this (or double-click setup-backup-cloud.cmd) to configure rclone +
    Google Drive (one-time sign-in), register the two daily cloud upload tasks
    at the standard slots (14:00, 21:00 - matching backup-common.ps1), make
    sure the every-logon catch-up task exists, and upload the first encrypted
    copy right away.

    Idempotent: re-running it keeps the existing Google connection, replaces
    the tasks (Register-ScheduledTask -Force) and takes another backup.

.EXAMPLE
    .\deploy\windows\setup-backup-cloud.ps1
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\backup-setup.ps1')

Step 'Cloud backups (rclone + Google Drive, twice daily)'

try {
    Install-BackupCatchUpTask | Out-Null
    $summary = Install-CloudBackupTasks $script:BackupSlotTimes
    Write-Host @"

=====================================================================
  Cloud backups are set up.
  $summary

  Files are encrypted on this laptop before upload; Google only ever sees
  scrambled names and contents. If the Google login expires, run:
  rclone config reconnect gdrive:
=====================================================================
"@ -ForegroundColor Green
} catch {
    Warn "Cloud backup setup failed: $($_.Exception.Message)"
    Warn 'Local backups still run. Fix the cause and re-run this script.'
    exit 1
}