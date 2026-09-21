<#
.SYNOPSIS
    Update IMPOC on the shop laptop: pull -> install -> migrate -> build -> restart.

.DESCRIPTION
    Double-click deploy\windows\update.cmd (no admin needed), or:

        .\deploy\windows\update.ps1 [-Branch main] [-SkipBackup]

    Steps:
      1. Refuse to run if there are local edits to tracked files (the laptop
         must only ever follow the public GitHub repo).
      2. git pull --ff-only. Stops early if nothing changed.
      3. Back up the database with pg_dump (before migrations touch it).
      4. npm install in backend, run migrations.
      5. npm install + build the frontend into dist.new, then swap it in,
         so a failed build leaves the running site untouched.
      6. pm2 restart impoc and wait for the web server to answer.

    On any failure the script stops with a message; the previous build and a
    fresh DB backup are still in place.

.PARAMETER Branch
    Branch to follow. Default: the branch currently checked out.

.PARAMETER SkipBackup
    Do not take a pg_dump before migrating.
#>
[CmdletBinding()]
param(
    [string]$Branch,
    [switch]$SkipBackup
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$Backend  = Join-Path $RepoRoot 'backend'
$Frontend = Join-Path $RepoRoot 'frontend'
$LogFile  = Join-Path $Backend 'logs\update.log'
New-Item -ItemType Directory -Force -Path (Split-Path $LogFile) | Out-Null

function Log($msg, $color = 'Gray') {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg"
    Write-Host $line -ForegroundColor $color
    Add-Content -Path $LogFile -Value $line
}
function Step($msg) { Log "==> $msg" 'Cyan' }
function Ok($msg)   { Log "    OK  $msg" 'Green' }
function Fail($msg) { Log "ERROR: $msg" 'Red'; Write-Host "`nUpdate stopped. Nothing else was changed." -ForegroundColor Red; exit 1 }

# ---------------------------------------------------------------------------
# Admin check & self-elevation
# ---------------------------------------------------------------------------
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
           ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Step 'Requesting Administrator privileges...'
    try {
        $passedArgs = @()
        foreach ($entry in $PSBoundParameters.GetEnumerator()) {
            if ($entry.Value -is [System.Management.Automation.SwitchParameter]) {
                if ($entry.Value.IsPresent) { $passedArgs += "-$($entry.Key)" }
            } else {
                $passedArgs += "-$($entry.Key)"
                $passedArgs += "`"$($entry.Value)`""
            }
        }
        if ($args) { foreach ($a in $args) { $passedArgs += "`"$a`"" } }
        $argList = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$PSCommandPath`"") + $passedArgs
        $proc = Start-Process -FilePath "powershell.exe" -WorkingDirectory $PSScriptRoot -ArgumentList $argList -Verb RunAs -PassThru -Wait
        exit $proc.ExitCode
    } catch {
        Fail 'Administrator privileges are required. Please approve the elevation prompt to continue.'
    }
}

function Read-DotEnv([string]$path) {
    $map = @{}
    if (Test-Path $path) {
        Get-Content $path | ForEach-Object {
            if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') { $map[$matches[1]] = $matches[2] }
        }
    }
    return $map
}

$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
            [Environment]::GetEnvironmentVariable('Path', 'User')

foreach ($tool in 'git', 'node', 'npm', 'pm2') {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { Fail "$tool not found on PATH. Run setup.cmd first." }
}

Log '--- IMPOC update ---'
Push-Location $RepoRoot

# 1. Clean working tree -------------------------------------------------------
Step 'Checking for local changes'
$dirty = git status --porcelain --untracked-files=no
if ($dirty) {
    Pop-Location
    Fail "Tracked files were edited on this laptop:`n$dirty`nThe shop laptop must only follow GitHub. Run 'git checkout -- .' to discard them, then re-run."
}
if (-not $Branch) { $Branch = (git rev-parse --abbrev-ref HEAD).Trim() }
Ok "clean tree on branch '$Branch'"

# 2. Pull ----------------------------------------------------------------------
Step "Pulling latest '$Branch' from GitHub"
$before = (git rev-parse HEAD).Trim()
git fetch origin $Branch --quiet
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail 'git fetch failed. Is the laptop online?' }
git checkout $Branch --quiet
git pull --ff-only origin $Branch
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail 'git pull failed (not a fast-forward). Fix the branch by hand.' }
$after = (git rev-parse HEAD).Trim()

if ($before -eq $after) {
    Ok 'already up to date - nothing to do'
    Pop-Location
    exit 0
}
Ok "updated $($before.Substring(0,7)) -> $($after.Substring(0,7))"
git --no-pager log --oneline "$before..$after" | ForEach-Object { Log "      $_" }

$changed = git diff --name-only $before $after
$backendChanged   = $changed | Where-Object { $_ -like 'backend/*' }
$frontendChanged  = $changed | Where-Object { $_ -like 'frontend/*' }
$migrationsChanged = $changed | Where-Object { $_ -like 'backend/database/migrations/*' }
Pop-Location

# 3. DB backup ----------------------------------------------------------------
$envVars = Read-DotEnv (Join-Path $Backend '.env')
if (-not $SkipBackup -and $migrationsChanged) {
    Step 'Backing up the database before migrating'
    # R-60: shared verified-dump helper; backups live outside the repo in C:\IMPOC-backups\pre-update
    . (Join-Path $PSScriptRoot 'lib\backup-common.ps1')
    try {
        $dirs = Initialize-BackupDirs
        $file = Invoke-VerifiedDump $envVars $dirs.preUpdate ("pre-update-{0}-{1}.dump" -f (Get-Date -Format 'yyyy-MM-dd_HHmm'), $after.Substring(0,7))
        Remove-OldDumps $dirs.preUpdate 60 | Out-Null
        Ok "saved $file"
    } catch {
        Fail "backup failed: $($_.Exception.Message). Use -SkipBackup to update anyway."
    }
}

# 4. Backend -------------------------------------------------------------------
if ($backendChanged) {
    Step 'Installing backend dependencies'
    Push-Location $Backend
    npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { Pop-Location; Fail 'npm install (backend) failed.' }

    Step 'Running database migrations'
    npm run db:migrate
    if ($LASTEXITCODE -ne 0) { Pop-Location; Fail 'Migrations failed. Restore the backup from the backups folder if needed.' }
    Pop-Location
    Ok 'backend ready'
} else {
    Ok 'backend unchanged - skipped install/migrate'
}

# 5. Frontend build ----------------------------------------------------------------
if ($frontendChanged) {
    Step 'Building the frontend'
    Push-Location $Frontend
    if (-not (Test-Path '.env.production')) {
        [IO.File]::WriteAllText((Join-Path $Frontend '.env.production'), "VITE_API_BASE_URL=/api`n",
            (New-Object Text.UTF8Encoding($false)))
    }
    npm install --legacy-peer-deps --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { Pop-Location; Fail 'npm install (frontend) failed.' }

    $distNew = Join-Path $Frontend 'dist.new'
    $distOld = Join-Path $Frontend 'dist.old'
    $dist    = Join-Path $Frontend 'dist'
    if (Test-Path $distNew) { Remove-Item $distNew -Recurse -Force }
    npx vite build --outDir dist.new
    if ($LASTEXITCODE -ne 0) { Pop-Location; Fail 'Frontend build failed. The old build is still being served.' }

    if (Test-Path $distOld) { Remove-Item $distOld -Recurse -Force }
    if (Test-Path $dist)    { Rename-Item $dist 'dist.old' }
    Rename-Item $distNew 'dist'
    if (Test-Path $distOld) { Remove-Item $distOld -Recurse -Force }
    Pop-Location
    Ok 'new frontend build in place'
} else {
    Ok 'frontend unchanged - skipped build'
}

# 6. Restart -----------------------------------------------------------------------
Step 'Restarting the server'
Push-Location $Backend
# pm2 writes "[PM2][ERROR] ..." to stderr when the process is missing; under
# $ErrorActionPreference = 'Stop' a redirected stderr line becomes a terminating
# error (Windows PowerShell 5.1). Run pm2 through cmd so only exit codes matter.
cmd /c "pm2 restart impoc --update-env >nul 2>&1"
if ($LASTEXITCODE -ne 0) {
    cmd /c "pm2 start ecosystem.config.cjs"
    if ($LASTEXITCODE -ne 0) { Pop-Location; Fail 'pm2 start failed. Run "pm2 logs impoc" to see why.' }
}
cmd /c "pm2 save --force >nul 2>&1" | Out-Null
Pop-Location

$port = if ($envVars['PORT']) { $envVars['PORT'] } else { 3000 }
$url  = "http://localhost:$port"
$up = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        if ((Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) { $up = $true; break }
    } catch { }
    Start-Sleep -Seconds 2
}
if ($up) {
    Ok "server answering at $url"
    Log "--- update complete: now at $($after.Substring(0,7)) ---" 'Green'
} else {
    Fail "server did not answer at $url within 60s. Check: pm2 logs impoc"
}
