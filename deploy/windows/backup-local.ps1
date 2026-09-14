<#
.SYNOPSIS
    Local IMPOC database backup (R-60). Runs twice a day via Task Scheduler;
    can be double-clicked (backup-local.cmd) any time.

.DESCRIPTION
    1. pg_dump the database (compressed custom format) to
       C:\IMPOC-backups\local\impoc-YYYY-MM-DD_HHmm.dump
    2. Verify the file with pg_restore --list before it counts.
    3. Delete local dumps older than 14 days.
    4. Record the outcome in C:\IMPOC-backups\last-status.json and the monthly log.

    Never stops the app; pg_dump takes a consistent snapshot while sales continue.
    Exit code 0 = a verified backup exists; 1 = failed (the previous backups are untouched).
#>
[CmdletBinding()]
param(
    [string]$Label = 'local'    # file name prefix tag, e.g. 'manual'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\backup-common.ps1')

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$Backend  = Join-Path $RepoRoot 'backend'

try {
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
}
