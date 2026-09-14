<#
    Shared backup helpers (R-60). Dot-source from the other scripts:

        . (Join-Path $PSScriptRoot 'lib\backup-common.ps1')

    Everything here is deliberately conservative: a failed backup must never
    touch an existing good backup, the live database, or the running app.
#>

# Backups live OUTSIDE the repo so git / update.ps1 never see them and a
# `git clean` can never delete them. Override with $env:IMPOC_BACKUP_ROOT.
$script:BackupRoot = if ($env:IMPOC_BACKUP_ROOT) { $env:IMPOC_BACKUP_ROOT } else { 'C:\IMPOC-backups' }

$script:LocalRetentionDays = 14
$script:CloudRetentionDays = 90
$script:RcloneRemote       = 'gdrive-crypt'     # encrypted remote (wraps gdrive:IMPOC-backups)
$script:RcloneBaseRemote   = 'gdrive'
$script:RcloneFolder       = 'IMPOC-backups'
$script:RcloneInstallDir   = 'C:\IMPOC\rclone'

function Get-BackupRoot { return $script:BackupRoot }

function Get-BackupDirs {
    return @{
        root       = $script:BackupRoot
        local      = Join-Path $script:BackupRoot 'local'
        preUpdate  = Join-Path $script:BackupRoot 'pre-update'
        cloud      = Join-Path $script:BackupRoot 'cloud-staging'
        logs       = Join-Path $script:BackupRoot 'logs'
        status     = Join-Path $script:BackupRoot 'last-status.json'
    }
}

function Initialize-BackupDirs {
    $dirs = Get-BackupDirs
    foreach ($d in $dirs.local, $dirs.preUpdate, $dirs.cloud, $dirs.logs) {
        New-Item -ItemType Directory -Force -Path $d | Out-Null
    }
    return $dirs
}

function Read-DotEnv([string]$path) {
    $map = @{}
    if (Test-Path $path) {
        Get-Content $path | ForEach-Object {
            if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') { $map[$matches[1]] = $matches[2].Trim() }
        }
    }
    return $map
}

# pg_dump / pg_restore / psql: on PATH, else the newest PostgreSQL install folder.
function Find-PgTool([string]$name) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source
    if ($cmd) { return $cmd }
    $found = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\$name.exe" -ErrorAction SilentlyContinue |
             Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
    return $found
}

function Write-BackupLog([string]$kind, [string]$msg) {
    $dirs = Get-BackupDirs
    try {
        New-Item -ItemType Directory -Force -Path $dirs.logs | Out-Null
        $line = "{0}  [{1}]  {2}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $kind, $msg
        Add-Content -Path (Join-Path $dirs.logs "backup-$(Get-Date -Format 'yyyy-MM').log") -Value $line
    } catch { }
    Write-Host $msg
}

<#
    last-status.json keeps the outcome of the most recent local and cloud
    runs so a person (or the app) can see at a glance whether backups are
    healthy. Updated atomically; one bad write never loses the other entry.
#>
function Write-BackupStatus([string]$kind, [bool]$ok, [string]$file, [string]$message) {
    $dirs = Get-BackupDirs
    $status = @{}
    if (Test-Path $dirs.status) {
        try { $status = Get-Content $dirs.status -Raw | ConvertFrom-Json -AsHashtable } catch { $status = @{} }
    }
    $status[$kind] = @{
        ok      = $ok
        at      = (Get-Date).ToString('o')
        file    = $file
        message = $message
    }
    $tmp = "$($dirs.status).tmp"
    ($status | ConvertTo-Json -Depth 4) | Set-Content -Path $tmp -Encoding UTF8
    Move-Item -Force $tmp $dirs.status
}

<#
    Take a verified pg_dump.
      - custom format (-Fc): compressed, restorable table-by-table
      - written to <name>.partial first, verified with `pg_restore --list`
        (a truncated/corrupt dump fails here, not on the day it is needed),
        then renamed - so a failed run never leaves a bad file behind
    Returns the final path; throws on any failure.
#>
function Invoke-VerifiedDump([hashtable]$envVars, [string]$targetDir, [string]$fileName) {
    $pgDump    = Find-PgTool 'pg_dump'
    $pgRestore = Find-PgTool 'pg_restore'
    if (-not $pgDump)    { throw 'pg_dump.exe not found (PostgreSQL command line tools).' }
    if (-not $pgRestore) { throw 'pg_restore.exe not found (PostgreSQL command line tools).' }
    foreach ($k in 'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD') {
        if (-not $envVars[$k]) { throw "backend\.env is missing $k" }
    }

    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    $final   = Join-Path $targetDir $fileName
    $partial = "$final.partial"
    if (Test-Path $partial) { Remove-Item -Force $partial }

    $env:PGPASSWORD = $envVars['DB_PASSWORD']
    try {
        # cmd /c so pg_dump's stderr can never become a terminating PowerShell error
        $out = cmd /c "`"$pgDump`" -U `"$($envVars['DB_USER'])`" -h `"$($envVars['DB_HOST'])`" -p $($envVars['DB_PORT']) -Fc --no-owner --no-privileges -f `"$partial`" `"$($envVars['DB_NAME'])`" 2>&1"
        if ($LASTEXITCODE -ne 0) { throw "pg_dump failed: $out" }
        if (-not (Test-Path $partial) -or (Get-Item $partial).Length -lt 1024) { throw 'pg_dump produced an empty file.' }

        $check = cmd /c "`"$pgRestore`" --list `"$partial`" 2>&1"
        if ($LASTEXITCODE -ne 0) { throw "dump failed verification (pg_restore --list): $check" }
        if (-not ("$check" -match 'TABLE DATA')) { throw 'dump verification found no table data.' }

        Move-Item -Force $partial $final
        return $final
    } catch {
        if (Test-Path $partial) { Remove-Item -Force $partial -ErrorAction SilentlyContinue }
        throw
    } finally {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }
}

# Delete dumps older than N days in a folder. Never touches anything else.
function Remove-OldDumps([string]$dir, [int]$days) {
    if (-not (Test-Path $dir)) { return 0 }
    $cutoff = (Get-Date).AddDays(-$days)
    $old = Get-ChildItem $dir -Filter '*.dump' -File -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt $cutoff }
    foreach ($f in $old) { Remove-Item -Force $f.FullName -ErrorAction SilentlyContinue }
    return @($old).Count
}

function Find-Rclone {
    $cmd = Get-Command rclone -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source
    if ($cmd) { return $cmd }
    $local = Join-Path $script:RcloneInstallDir 'rclone.exe'
    if (Test-Path $local) { return $local }
    return $null
}

# True when the encrypted remote exists in rclone.conf.
function Test-RcloneRemote([string]$rclone, [string]$remote) {
    if (-not $rclone) { return $false }
    $list = cmd /c "`"$rclone`" listremotes 2>&1"
    return ("$list" -split "`r?`n") -contains "${remote}:"
}
