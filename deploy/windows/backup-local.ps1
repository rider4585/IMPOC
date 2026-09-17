<#
.SYNOPSIS
    Local IMPOC database backup (R-60 v2). Runs twice a day at 14:00 and 21:00
    via Task Scheduler (tasks "IMPOC local backup 1/2"); can be double-clicked
    (backup-local.cmd) any time.

.DESCRIPTION
    1. pg_dump the database (compressed custom format) to
       C:\IMPOC-backups\local\impoc-YYYY-MM-DD_HHmm.dump
    2. Verify the file with pg_restore --list before it counts.
    3. Delete local dumps older than 14 days.
    4. Record the outcome in C:\IMPOC-backups\last-status.json and the monthly log.

    A per-kind lock (C:\IMPOC-backups\local.lock, 10 min) stops a scheduled
    run and the every-logon catch-up from dumping twice at the same moment.
    When run with -SlotTime and the slot is already current (last-status.json),
    it logs "skipped" and exits 0 instead of dumping again; -Force overrides that.

    Never stops the app; pg_dump takes a consistent snapshot while sales continue.
    Exit code 0 = a verified backup exists (or nothing was due); 1 = failed
    (the previous backups are untouched).

.PARAMETER Label
    File name prefix tag, e.g. 'local' (default) or 'manual'.

.PARAMETER SlotTime
    The 'HH:mm' slot this run represents (set by the scheduled task). When the
    slot is already backed up and -Force is not given, the run is skipped.

.PARAMETER Force
    Take a fresh dump even if the -SlotTime slot is already backed up.
#>
[CmdletBinding()]
param(
    [string]$Label = 'local',    # file name prefix tag, e.g. 'manual'
    [string]$SlotTime,           # 24h 'HH:mm' slot this run represents
    [switch]$Force               # ignore the already-backed-up skip
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\backup-common.ps1')

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$Backend  = Join-Path $RepoRoot 'backend'

$acquired = $false
try {
    $acquired = Enter-BackupLock 'local'
    if (-not $acquired) {
        Write-BackupLog 'local' 'skipped: another backup is already running'
        exit 0
    }

    if ($SlotTime -and -not $Force -and (Test-BackupCurrent 'local' (Get-SlotDateTime $SlotTime))) {
        Write-BackupLog 'local' "skipped: already backed up for slot $SlotTime"
        exit 0
    }

    $dirs = Initialize-BackupDirs
    $envVars = Read-DotEnv (Join-Path $Backend '.env')
    if (-not $envVars['DB_NAME']) { throw "backend\.env not found or has no DB_NAME - run setup.cmd first." }

    $name = "impoc-{0}.dump" -f (Get-Date -Format 'yyyy-MM-dd_HHmm')
    if ($Label -ne 'local') { $name = "$Label-$name" }

    $file = Invoke-VerifiedDump $envVars $dirs.local $name
    $sizeKb = [math]::Round((Get-Item $file).Length / 1KB)
    $pruned = Remove-OldDumps $dirs.local $script:LocalRetentionDays

    Write-BackupStatus 'local' $true $file "verified, $sizeKb KB"
    Write-BackupLog 'local' "OK  $file ($sizeKb KB); pruned $pruned old dump(s)"
    exit 0
} catch {
    $msg = $_.Exception.Message
    try { Write-BackupStatus 'local' $false '' $msg } catch { }
    Write-BackupLog 'local' "FAILED  $msg"
    exit 1
} finally {
    if ($acquired) { Exit-BackupLock 'local' }
}