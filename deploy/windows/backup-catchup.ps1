<#
.SYNOPSIS
    Catch up on missed backup slots (R-60 v2). Runs at every logon via the
    scheduled task "IMPOC backup catch-up".

.DESCRIPTION
    Recruitment happens when the laptop was off at 14:00 / 21:00: the next
    time Windows signs in, this script checks last-status.json for the latest
    slot that has already passed without a successful backup and re-runs it
    immediately - local first, then cloud.

      - For 'local' the matching slot is backed up with backup-local.ps1
        -SlotTime HH:mm  (which also skips anything already current).
      - For 'cloud' the slot is uploaded with backup-cloud.ps1 -SlotTime HH:mm.
        If rclone / the Google remote is missing or not configured, a warning
        is logged and only the cloud part is skipped.

    A missed local slot is never left behind because of a cloud problem: each
    kind is handled on its own and the script always exits 0 (a scheduled
    task with no exit-code contract). The per-kind 10-minute locks in
    backup-common.ps1 de-duplicate against a StartWhenAvailable task firing
    for the same slot.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\backup-common.ps1')

$dirs = Initialize-BackupDirs
$localScript = Join-Path $PSScriptRoot 'backup-local.ps1'
$cloudScript = Join-Path $PSScriptRoot 'backup-cloud.ps1'

foreach ($kind in 'local', 'cloud') {
    $slot = Get-MissedSlot $kind
    if (-not $slot) {
        Write-BackupLog $kind 'caught up - no missed slot'
        continue
    }
    $hhmm = $slot.ToString('HH:mm')

    if ($kind -eq 'cloud') {
        $rclone = Find-Rclone
        if (-not $rclone) { Write-BackupLog 'cloud' "CATCH-UP $hhmm skipped: rclone is not installed or configured"; continue }
        if (-not (Test-RcloneRemote $rclone $script:RcloneRemote)) { Write-BackupLog 'cloud' "CATCH-UP $hhmm skipped: Google remote '$($script:RcloneRemote)' not configured"; continue }
    }

    Write-BackupLog $kind "CATCH-UP for missed slot $hhmm"
    $scriptPath = if ($kind -eq 'local') { $localScript } else { $cloudScript }
    cmd /c "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`" -SlotTime $hhmm"
    if ($LASTEXITCODE -eq 0) {
        Write-BackupLog $kind "catch-up run for $hhmm finished OK"
    } else {
        Write-BackupLog $kind "catch-up run for $hhmm failed (details above)"
    }
}

exit 0