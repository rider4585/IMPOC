<#
.SYNOPSIS
    Restore the IMPOC database from a backup (R-60). Use with care.

.DESCRIPTION
    Run from an Administrator PowerShell:

        .\deploy\windows\restore-db.ps1                 # pick from local backups
        .\deploy\windows\restore-db.ps1 -FromCloud      # list + download from Google Drive first
        .\deploy\windows\restore-db.ps1 -File C:\IMPOC-backups\local\impoc-2026-09-14_1300.dump

    Steps:
      1. Show the available dumps and let you pick one (newest first).
      2. Ask you to type the database name to confirm - this REPLACES the live data.
      3. Take a safety dump of the current database first (pre-restore-*.dump).
      4. Stop the app (pm2), drop + recreate the database, pg_restore, run
         migrations (in case the dump predates the current code), start the app.
    If anything fails before step 4's drop, nothing has changed. If the restore
    itself fails, the safety dump from step 3 is the way back.
#>
[CmdletBinding()]
param(
    [string]$File,
    [switch]$FromCloud
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\backup-common.ps1')

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$Backend  = Join-Path $RepoRoot 'backend'
function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Fail($msg) { Write-Host "`nERROR: $msg" -ForegroundColor Red; exit 1 }

$dirs = Initialize-BackupDirs
$envVars = Read-DotEnv (Join-Path $Backend '.env')
if (-not $envVars['DB_NAME']) { Fail 'backend\.env not found - nothing to restore into.' }
$dbName = $envVars['DB_NAME']

# 1. choose a dump ---------------------------------------------------------------
if (-not $File) {
    if ($FromCloud) {
        $rclone = Find-Rclone
        if (-not $rclone -or -not (Test-RcloneRemote $rclone $script:RcloneRemote)) { Fail 'rclone / gdrive-crypt is not set up on this laptop.' }
        Step 'Cloud backups (newest first)'
        $listing = cmd /c "`"$rclone`" lsf `"$($script:RcloneRemote):`" -R --files-only --include `"*.dump`" 2>&1"
        if ($LASTEXITCODE -ne 0) { Fail "could not list the cloud: $listing" }
        $cloudFiles = @("$listing" -split "`r?`n" | Where-Object { $_ -match '\.dump$' } | Sort-Object -Descending)
        if ($cloudFiles.Count -eq 0) { Fail 'no cloud backups found.' }
        for ($i = 0; $i -lt $cloudFiles.Count; $i++) { Write-Host ("  [{0}] {1}" -f ($i + 1), $cloudFiles[$i]) }
        $pick = Read-Host 'Number to download'
        $chosen = $cloudFiles[[int]$pick - 1]
        if (-not $chosen) { Fail 'invalid choice.' }
        $File = Join-Path $dirs.cloud (Split-Path $chosen -Leaf)
        Step "Downloading $chosen"
        $dl = cmd /c "`"$rclone`" copyto `"$($script:RcloneRemote):$chosen`" `"$File`" --checksum --stats 0 2>&1"
        if ($LASTEXITCODE -ne 0) { Fail "download failed: $dl" }
    } else {
        Step 'Local backups (newest first)'
        $localFiles = @(Get-ChildItem $dirs.local, $dirs.preUpdate -Filter '*.dump' -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending)
        if ($localFiles.Count -eq 0) { Fail 'no local backups found. Try -FromCloud.' }
        for ($i = 0; $i -lt $localFiles.Count; $i++) {
            Write-Host ("  [{0}] {1}   {2:yyyy-MM-dd HH:mm}   {3} KB" -f ($i + 1), $localFiles[$i].Name, $localFiles[$i].LastWriteTime, [math]::Round($localFiles[$i].Length / 1KB))
        }
        $pick = Read-Host 'Number to restore'
        $chosen = $localFiles[[int]$pick - 1]
        if (-not $chosen) { Fail 'invalid choice.' }
        $File = $chosen.FullName
    }
}
if (-not (Test-Path $File)) { Fail "file not found: $File" }

$pgRestore = Find-PgTool 'pg_restore'; $psql = Find-PgTool 'psql'
if (-not $pgRestore -or -not $psql) { Fail 'pg_restore / psql not found.' }
$check = cmd /c "`"$pgRestore`" --list `"$File`" 2>&1"
if ($LASTEXITCODE -ne 0) { Fail "this file is not a valid backup: $check" }

# 2. confirm ---------------------------------------------------------------------
Write-Host "`nThis will REPLACE all data in database '$dbName' with:`n  $File" -ForegroundColor Yellow
$typed = Read-Host "Type the database name ($dbName) to continue"
if ($typed -ne $dbName) { Fail 'cancelled - nothing changed.' }

# 3. safety dump -----------------------------------------------------------------
Step 'Safety copy of the current database'
$safety = Invoke-VerifiedDump $envVars $dirs.preUpdate ("pre-restore-{0}.dump" -f (Get-Date -Format 'yyyy-MM-dd_HHmm'))
Write-Host "    saved $safety"

# 4. restore ---------------------------------------------------------------------
Step 'Stopping the app'
cmd /c "pm2 stop impoc >nul 2>&1" | Out-Null

$env:PGPASSWORD = $envVars['DB_PASSWORD']
$conn = "-U `"$($envVars['DB_USER'])`" -h `"$($envVars['DB_HOST'])`" -p $($envVars['DB_PORT'])"
try {
    Step "Recreating database '$dbName'"
    cmd /c "`"$psql`" $conn -d postgres -c `"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$dbName' AND pid <> pg_backend_pid();`" >nul 2>&1" | Out-Null
    $drop = cmd /c "`"$psql`" $conn -d postgres -c `"DROP DATABASE IF EXISTS \`"$dbName\`";`" 2>&1"
    if ($LASTEXITCODE -ne 0) { throw "drop failed: $drop" }
    $create = cmd /c "`"$psql`" $conn -d postgres -c `"CREATE DATABASE \`"$dbName\`";`" 2>&1"
    if ($LASTEXITCODE -ne 0) { throw "create failed: $create" }

    Step "Restoring $File"
    $res = cmd /c "`"$pgRestore`" $conn -d `"$dbName`" --no-owner --no-privileges --exit-on-error `"$File`" 2>&1"
    if ($LASTEXITCODE -ne 0) { throw "pg_restore failed: $res" }

    Step 'Applying any newer migrations'
    Push-Location $Backend
    cmd /c "npm run db:migrate"
    $mig = $LASTEXITCODE
    Pop-Location
    if ($mig -ne 0) { throw 'migrations failed after restore.' }
} catch {
    Write-Host "`nRESTORE FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Your data from before this attempt is in: $safety" -ForegroundColor Yellow
    Write-Host "Restore it with: .\deploy\windows\restore-db.ps1 -File `"$safety`"" -ForegroundColor Yellow
    cmd /c "pm2 start impoc >nul 2>&1" | Out-Null
    exit 1
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

Step 'Starting the app'
cmd /c "pm2 start impoc >nul 2>&1" | Out-Null
Write-BackupLog 'restore' "restored $File (safety copy $safety)"
Write-Host "`nRestore complete. Open the app and check a recent sale." -ForegroundColor Green
