<#
    Shared backup helpers (R-60 v2). Dot-source from the other scripts:

        . (Join-Path $PSScriptRoot 'lib\backup-common.ps1')

    Everything here is deliberately conservative: a failed backup must never
    touch an existing good backup, the live database, or the running app.

    R-60 v2 adds: the slot times (single source of truth), a skip-if-current
    check driven by last-status.json, and a per-kind lock so a scheduled run
    and the every-logon catch-up can never dump twice at the same instant.
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

# Single source of truth for the daily backup slots (24h HH:mm). Both the
# scheduled tasks and the every-logon catch-up are driven from this list.
$script:BackupSlotTimes = @('14:00', '21:00')

# Today at the given 24h 'HH:mm' time. Throws when the string is malformed.
function Get-SlotDateTime([string]$hhmm) {
    $parsed = [datetime]::ParseExact($hhmm, 'HH:mm', [Globalization.CultureInfo]::InvariantCulture)
    $today  = (Get-Date).Date
    return $today.AddHours($parsed.Hour).AddMinutes($parsed.Minute)
}

<#
    True when last-status.json says kind ('local'|'cloud') last succeeded at or
    after the given slot. For the 14:00 slot, a 14:00:05 backup counts, a
    13:59 one does not. No status file / no entry -> false (not current).
#>
function Test-BackupCurrent([string]$kind, [datetime]$slot) {
    $dirs = Get-BackupDirs
    if (-not (Test-Path $dirs.status)) { return $false }
    $status = $null
    try { $status = Get-Content $dirs.status -Raw | ConvertFrom-Json } catch { return $false }
    if (-not $status -or -not $status.$kind) { return $false }
    $entry = $status.$kind
    if (-not $entry.ok -or -not $entry.at) { return $false }
    try { $at = [datetime]::Parse([string]$entry.at) } catch { return $false }
    return ($at -ge $slot)
}

<#
    The latest slot today that has already passed AND was not backed up yet,
    or $null when nothing is missed (now before the first slot, or every
    passed slot is current). Drives backup-catchup at the next power-on.
#>
function Get-MissedSlot([string]$kind) {
    $now   = Get-Date
    $slots = @()
    foreach ($t in $script:BackupSlotTimes) {
        $dt = Get-SlotDateTime $t
        if ($dt -le $now) { $slots += $dt }
    }
    if ($slots.Count -eq 0) { return $null }
    foreach ($s in @($slots | Sort-Object -Descending)) {
        if (-not (Test-BackupCurrent $kind $s)) { return $s }
    }
    return $null
}

<#
    Per-kind lock so two overlapping runs - e.g. a StartWhenAvailable scheduled
    task and the every-logon catch-up - cannot dump twice at once. Lock file
    C:\IMPOC-backups\<kind>.lock holds our pid + timestamp. Returns $true when
    WE now hold the lock; $false when a lock younger than 10 minutes exists
    (another run is in flight). A stale lock older than 10 minutes is taken
    over silently.
#>
function Enter-BackupLock([string]$kind) {
    # The lock lives in the backup root, which may not exist on a first run
    # (e.g. a scheduled task firing before any setup); create it first so the
    # lock write below can never be the reason a backup is skipped.
    New-Item -ItemType Directory -Force -Path $script:BackupRoot | Out-Null
    $lockFile = Join-Path $script:BackupRoot "$kind.lock"
    if (Test-Path $lockFile) {
        $item = Get-Item $lockFile -ErrorAction SilentlyContinue
        $age = if ($item) { (Get-Date) - $item.LastWriteTime } else { (New-TimeSpan) }
        if ($age -lt (New-TimeSpan -Minutes 10)) { return $false }
    }
    try {
        "pid=$PID ts=$((Get-Date).ToString('o'))" | Set-Content -Path $lockFile -Encoding UTF8
    } catch { return $false }
    return $true
}

# Remove OUR lock only - never the lock of another backup still running.
function Exit-BackupLock([string]$kind) {
    $lockFile = Join-Path $script:BackupRoot "$kind.lock"
    if (-not (Test-Path $lockFile)) { return }
    $content = Get-Content $lockFile -Raw -ErrorAction SilentlyContinue
    if ("$content" -match "pid=$PID") { Remove-Item -Force $lockFile -ErrorAction SilentlyContinue }
}

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
    Windows PowerShell 5.1-safe (ConvertFrom-Json -AsHashtable is pwsh-only).
#>
function Write-BackupStatus([string]$kind, [bool]$ok, [string]$file, [string]$message) {
    $dirs = Get-BackupDirs
    $status = @{}
    if (Test-Path $dirs.status) {
        try {
            $existing = Get-Content $dirs.status -Raw | ConvertFrom-Json
            foreach ($k in @($existing.PSObject.Properties.Name)) {
                $status[$k] = @{
                    ok      = [bool]$existing.$k.ok
                    at      = [string]$existing.$k.at
                    file    = [string]$existing.$k.file
                    message = [string]$existing.$k.message
                }
            }
        } catch { $status = @{} }
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
