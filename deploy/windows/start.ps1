<#
.SYNOPSIS
    Bring IMPOC up: PostgreSQL -> pm2 (backend + built frontend) -> browser.

.DESCRIPTION
    Runs at every Windows login via the shortcut setup.ps1 places in the Startup
    folder, and can be run by hand any time the app seems down:

        .\deploy\windows\start.cmd

    Steps:
      1. Wait for the PostgreSQL service to be running.
      2. pm2 resurrect (falls back to starting ecosystem.config.cjs).
      3. Wait until http://localhost:<port>/ answers.
      4. Open the app in Edge/Chrome as an app window (unless --no-browser).

.PARAMETER NoBrowser
    Start the services only; do not open the web page.
#>
[CmdletBinding()]
param(
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Continue'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$Backend  = Join-Path $RepoRoot 'backend'
$LogFile  = Join-Path $Backend 'logs\start.log'
New-Item -ItemType Directory -Force -Path (Split-Path $LogFile) | Out-Null

function Log($msg) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg"
    Write-Host $line
    Add-Content -Path $LogFile -Value $line
}

# ---------------------------------------------------------------------------
# Admin check & self-elevation
# ---------------------------------------------------------------------------
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
           ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Log 'Requesting Administrator privileges...'
    try {
        $passedArgs = @()
        if ($NoBrowser) { $passedArgs += '-NoBrowser' }
        if ($args) { foreach ($a in $args) { $passedArgs += "`"$a`"" } }
        $argList = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$PSCommandPath`"") + $passedArgs
        $proc = Start-Process -FilePath "powershell.exe" -WorkingDirectory $PSScriptRoot -ArgumentList $argList -Verb RunAs -PassThru -Wait
        exit $proc.ExitCode
    } catch {
        Log 'ERROR: Administrator privileges are required to manage services. Please approve the elevation prompt.'
        exit 1
    }
}

# Port from backend\.env (default 3000)
$Port = 3000
$envPath = Join-Path $Backend '.env'
if (Test-Path $envPath) {
    $m = Select-String -Path $envPath -Pattern '^PORT=(\d+)' | Select-Object -First 1
    if ($m) { $Port = [int]$m.Matches[0].Groups[1].Value }
}
$Url = "http://localhost:$Port"

# Make sure npm global tools (pm2) are on PATH even in a fresh login shell.
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
            [Environment]::GetEnvironmentVariable('Path', 'User')

Log '--- IMPOC start ---'

# 1. PostgreSQL --------------------------------------------------------------
$pg = Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($pg) {
    if ($pg.Status -ne 'Running') {
        Log "Starting PostgreSQL service $($pg.Name)"
        Start-Service $pg.Name -ErrorAction SilentlyContinue
    }
    $tries = 0
    while ((Get-Service $pg.Name).Status -ne 'Running' -and $tries -lt 30) {
        Start-Sleep -Seconds 2; $tries++
    }
    Log "PostgreSQL: $((Get-Service $pg.Name).Status)"
} else {
    Log 'WARNING: PostgreSQL service not found'
}

# 2. pm2 ---------------------------------------------------------------------
if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
    Log 'ERROR: pm2 not found on PATH. Run deploy\windows\setup.ps1 first.'
    exit 1
}

Push-Location $Backend
pm2 resurrect 2>&1 | Out-Null
$running = (pm2 jlist 2>$null | ConvertFrom-Json) |
           Where-Object { $_.name -eq 'impoc' -and $_.pm2_env.status -eq 'online' }
if (-not $running) {
    Log 'No saved pm2 process online - starting from ecosystem.config.cjs'
    pm2 start ecosystem.config.cjs 2>&1 | Out-Null
    pm2 save --force 2>&1 | Out-Null
}
Pop-Location
Log 'pm2: impoc requested'

# 3. Wait for the web server -------------------------------------------------
$up = $false
for ($i = 0; $i -lt 45; $i++) {
    try {
        $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
        if ($r.StatusCode -eq 200) { $up = $true; break }
    } catch { }
    Start-Sleep -Seconds 2
}
if ($up) { Log "Web app is up at $Url" } else { Log "WARNING: $Url did not answer in 90s - check 'pm2 logs impoc'" }

# 4. Browser -----------------------------------------------------------------
if ($NoBrowser) { Log 'Browser skipped (--no-browser)'; exit 0 }

$edge   = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
$chrome = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chrome)) { $chrome = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe" }

if (Test-Path $chrome) {
    Log 'Opening Chrome'
    Start-Process $chrome -ArgumentList "--app=$Url", '--start-maximized'
} elseif (Test-Path $edge) {
    Log 'Opening Edge'
    Start-Process $edge -ArgumentList "--app=$Url", '--start-maximized'
} else {
    Log 'Opening default browser'
    Start-Process $Url
}
Log '--- done ---'
