<#
.SYNOPSIS
    One-time production setup of IMPOC (Shree Fashion Store) on a Windows laptop.

.DESCRIPTION
    Run once, as Administrator, from a PowerShell window:

        Set-ExecutionPolicy -Scope Process Bypass -Force
        .\deploy\windows\setup.ps1

    What it does:
      1. Checks Git, Node 20+, PostgreSQL (psql) are installed.
      2. Creates the database (if missing).
      3. Writes backend\.env with fresh random JWT secrets (keeps an existing one).
      4. Installs backend deps, runs migrations + seeds.
      5. Builds the frontend (served by the backend on the same port).
      6. Installs pm2, starts the app, saves the process list.
      7. Opens the Windows Firewall port, sets PostgreSQL to start automatically.
      8. Puts start.cmd in the Startup folder so pm2 + the web page come up on login.
      9. (R-60) Creates C:\IMPOC-backups and two daily Windows scheduled tasks that
         take a verified database backup (times asked, 24h format).
     10. (R-60) Installs rclone and signs in to Google Drive once, so
         backup-cloud.cmd can upload encrypted copies (skip with -SkipCloud).

    Safe to re-run: every step is idempotent, and steps 9-10 only ever add;
    if they fail the app, database, .env, pm2 and firewall are untouched.

.PARAMETER Port
    Port the app listens on. Default 3000.

.PARAMETER DbName
    PostgreSQL database name. Default impoc.

.PARAMETER NoBrowser
    Do not register the auto-open of the web page at login (pm2 still starts).

.PARAMETER BackupTimes
    Two daily local-backup times in 24h HH:mm, e.g. '13:00,18:00'. Asked
    interactively when omitted.

.PARAMETER SkipCloud
    Do not install / configure rclone + Google Drive (local backups still run).
#>
[CmdletBinding()]
param(
    [int]$Port = 3000,
    [string]$DbName = 'impoc',
    [switch]$NoBrowser,
    [string]$BackupTimes,
    [switch]$SkipCloud
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$Backend  = Join-Path $RepoRoot 'backend'
$Frontend = Join-Path $RepoRoot 'frontend'

function Step($msg)  { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Ok($msg)    { Write-Host "    OK  $msg" -ForegroundColor Green }
function Warn($msg)  { Write-Host "    !!  $msg" -ForegroundColor Yellow }
function Fail($msg)  { Write-Host "`nERROR: $msg" -ForegroundColor Red; exit 1 }

function Refresh-Path {
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                [Environment]::GetEnvironmentVariable('Path', 'User')
}

function New-Secret([int]$bytes = 48) {
    $buf = New-Object byte[] $bytes
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
    # base64url so the value is safe in a .env line
    return [Convert]::ToBase64String($buf).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Write-Utf8NoBom([string]$path, [string]$text) {
    [IO.File]::WriteAllText($path, $text, (New-Object Text.UTF8Encoding($false)))
}

# ---------------------------------------------------------------------------
# 0. Admin check
# ---------------------------------------------------------------------------
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
           ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Fail 'Please run this script from an Administrator PowerShell (needed for the firewall rule).' }

# ---------------------------------------------------------------------------
# 1. Prerequisites
# ---------------------------------------------------------------------------
Step 'Checking installed software'
Refresh-Path

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Fail 'Git is not installed. Install from https://git-scm.com/download/win and re-run.'
}
Ok "git $(git --version)"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fail 'Node.js is not installed. Install Node 20 LTS from https://nodejs.org and re-run.'
}
$nodeVer = (node -v).TrimStart('v')
$nodeMajor, $nodeMinor = $nodeVer.Split('.')[0..1] | ForEach-Object { [int]$_ }
if ($nodeMajor -lt 20 -or ($nodeMajor -eq 20 -and $nodeMinor -lt 19)) {
    Fail "Node $nodeVer is too old. Vite needs Node 20.19+ (or 22.12+)."
}
Ok "node v$nodeVer"

# psql: on PATH, or in the default install folder
$psql = Get-Command psql -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if (-not $psql) {
    $psql = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue |
            Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $psql) {
    Fail 'PostgreSQL (psql.exe) not found. Install PostgreSQL 16/17 from https://www.postgresql.org/download/windows/ (tick "Command Line Tools") and re-run.'
}
Ok "psql at $psql"

$pgService = Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $pgService) { Fail 'PostgreSQL Windows service not found.' }
if ($pgService.Status -ne 'Running') { Start-Service $pgService.Name }
Set-Service -Name $pgService.Name -StartupType Automatic
Ok "PostgreSQL service '$($pgService.Name)' running and set to start automatically"

# ---------------------------------------------------------------------------
# 2. Ask the questions we cannot guess
# ---------------------------------------------------------------------------
Step 'A few questions'

$envPath = Join-Path $Backend '.env'
$haveEnv = Test-Path $envPath

$pgPassword = Read-Host 'PostgreSQL password for user "postgres"' -AsSecureString
$pgPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($pgPassword))
if (-not $pgPasswordPlain) { Fail 'PostgreSQL password is required.' }

# Best-guess LAN IP: first non-loopback IPv4 with a default gateway.
$guessIp = (Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } |
            Select-Object -First 1).IPv4Address.IPAddress
if (-not $guessIp) { $guessIp = 'localhost' }

$hostInput = Read-Host "Address staff will type in the browser [default: $guessIp]"
if (-not $hostInput) { $hostInput = $guessIp }
$appUrl = "http://${hostInput}:$Port"

if (-not $haveEnv) {
    $adminPassword = Read-Host 'Admin login password to seed (min 8 chars)'
    if ($adminPassword.Length -lt 8) { Fail 'Admin password must be at least 8 characters.' }
    $storeName    = Read-Host 'Store name [Shree Fashion Store]'
    if (-not $storeName) { $storeName = 'Shree Fashion Store' }
    $storeAddress = Read-Host 'Store address (prints on receipts, may be blank)'
    $storePhone   = Read-Host 'Store phone (prints on receipts, may be blank)'
}

# ---------------------------------------------------------------------------
# 3. Database
# ---------------------------------------------------------------------------
Step "Creating database '$DbName' (if missing)"
$env:PGPASSWORD = $pgPasswordPlain
$exists = & $psql -U postgres -h localhost -tAc "SELECT 1 FROM pg_database WHERE datname='$DbName'" 2>&1
if ($LASTEXITCODE -ne 0) { Fail "Could not connect to PostgreSQL: $exists" }
if ("$exists".Trim() -eq '1') {
    Ok "database '$DbName' already exists"
} else {
    & $psql -U postgres -h localhost -c "CREATE DATABASE `"$DbName`";" | Out-Null
    Ok "database '$DbName' created"
}

# ---------------------------------------------------------------------------
# 4. backend\.env
# ---------------------------------------------------------------------------
Step 'Backend environment file'
if ($haveEnv) {
    Warn "backend\.env already exists - keeping it. Delete it and re-run if you want it regenerated."
    # Keep FRONTEND_ORIGIN in sync with the URL the user just confirmed.
    $envText = Get-Content $envPath -Raw
    $envText = [regex]::Replace($envText, '(?m)^FRONTEND_ORIGIN=.*$', "FRONTEND_ORIGIN=$appUrl")
    Write-Utf8NoBom $envPath $envText
    Ok "FRONTEND_ORIGIN set to $appUrl"
} else {
    $envText = @"
# Generated by deploy\windows\setup.ps1 on $(Get-Date -Format 'yyyy-MM-dd HH:mm')
# Production laptop - do NOT commit this file.
NODE_ENV=production

DB_HOST=localhost
DB_PORT=5432
DB_NAME=$DbName
DB_USER=postgres
DB_PASSWORD=$pgPasswordPlain

PORT=$Port

# The exact URL staff type in the browser.
FRONTEND_ORIGIN=$appUrl

JWT_ACCESS_SECRET=$(New-Secret)
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=$(New-Secret)
JWT_REFRESH_EXPIRES_IN=7d
JWT_ISSUER=shree-fashion-api
JWT_AUDIENCE=shree-fashion-client

SEED_ADMIN_PASSWORD=$adminPassword
STORE_NAME=$storeName
STORE_ADDRESS=$storeAddress
STORE_PHONE=$storePhone

# Trusted shop LAN over plain HTTP: the refresh cookie must not carry the
# Secure flag or browsers would drop it. Set to true only behind HTTPS.
COOKIE_SECURE=false
"@
    Write-Utf8NoBom $envPath $envText
    Ok "backend\.env written with fresh JWT secrets"
}

# ---------------------------------------------------------------------------
# 5. Backend install + migrate + seed
# ---------------------------------------------------------------------------
Step 'Installing backend dependencies'
Push-Location $Backend
npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail 'npm install (backend) failed. If the error mentions argon2 / node-gyp, install "Visual Studio Build Tools" (Desktop development with C++) and Python 3, then re-run.' }

Step 'Running database migrations'
npm run db:migrate
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail 'Migrations failed.' }

Step 'Seeding roles, permissions and admin user'
npm run db:seed
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail 'Seeding failed.' }
New-Item -ItemType Directory -Force -Path (Join-Path $Backend 'logs') | Out-Null
Pop-Location
Ok 'backend ready'

# ---------------------------------------------------------------------------
# 6. Frontend build
# ---------------------------------------------------------------------------
Step 'Building the frontend'
Push-Location $Frontend
if (-not (Test-Path '.env.production')) {
    Write-Utf8NoBom (Join-Path $Frontend '.env.production') "VITE_API_BASE_URL=/api`n"
}
npm install --legacy-peer-deps --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail 'npm install (frontend) failed.' }
npm run build
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail 'Frontend build failed.' }
Pop-Location
Ok 'frontend\dist built (served by the backend)'

# ---------------------------------------------------------------------------
# 7. pm2
# ---------------------------------------------------------------------------
Step 'Installing pm2 and starting the app'
if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
    npm install -g pm2 --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { Fail 'npm install -g pm2 failed.' }
    Refresh-Path
}
Push-Location $Backend
# pm2 prints "[PM2][ERROR] Process or Namespace impoc not found" to stderr on a
# first install; with $ErrorActionPreference = 'Stop' PowerShell turns that
# into a terminating error even under 2>$null. So: only delete when the
# process exists, and route pm2's stderr through cmd so it never trips Stop.
$existing = cmd /c "pm2 jlist 2>nul"
$hasImpoc = $false
if ($existing) {
    try { $hasImpoc = @($existing | ConvertFrom-Json | Where-Object { $_.name -eq 'impoc' }).Count -gt 0 } catch { $hasImpoc = $false }
}
if ($hasImpoc) { cmd /c "pm2 delete impoc >nul 2>&1" | Out-Null }
cmd /c "pm2 start ecosystem.config.cjs"
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail 'pm2 start failed. Run "pm2 logs impoc" to see why.' }
cmd /c "pm2 save --force >nul 2>&1" | Out-Null
Pop-Location
Ok 'pm2 process "impoc" running and saved'

# ---------------------------------------------------------------------------
# 8. Firewall
# ---------------------------------------------------------------------------
Step "Opening firewall port $Port for other devices on the shop Wi-Fi"
$ruleName = "IMPOC app (TCP $Port)"
if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP `
        -LocalPort $Port -Action Allow -Profile Private,Domain | Out-Null
    Ok 'firewall rule created (Private networks only)'
} else {
    Ok 'firewall rule already present'
}

# ---------------------------------------------------------------------------
# 9. Start on login (pm2 + browser)
# ---------------------------------------------------------------------------
Step 'Registering start-on-login'
$startupDir = [Environment]::GetFolderPath('Startup')
$startCmd   = Join-Path $PSScriptRoot 'start.cmd'
$shortcut   = Join-Path $startupDir 'IMPOC.lnk'

$wsh = New-Object -ComObject WScript.Shell
$lnk = $wsh.CreateShortcut($shortcut)
$lnk.TargetPath = $startCmd
if ($NoBrowser) { $lnk.Arguments = '--no-browser' }
$lnk.WorkingDirectory = $PSScriptRoot
$lnk.Description = 'Start IMPOC (pm2 + web page)'
$lnk.Save()
Ok "shortcut placed in $startupDir"

# ---------------------------------------------------------------------------
# 10. Local database backups - twice a day (R-60)
#     Additive + idempotent. Any failure here is a warning: the app keeps running.
# ---------------------------------------------------------------------------
Step 'Local database backups (twice daily)'
$backupSummary = 'not configured'
try {
    . (Join-Path $PSScriptRoot 'lib\backup-common.ps1')
    $dirs = Initialize-BackupDirs
    Ok "backup folder $($dirs.root)"

    function Test-Hm([string]$t) { return $t -match '^([01]\d|2[0-3]):[0-5]\d$' }
    $times = @()
    if ($BackupTimes) { $times = $BackupTimes -split '\s*,\s*' }
    while ($times.Count -ne 2 -or ($times | Where-Object { -not (Test-Hm $_) })) {
        $answer = Read-Host 'Two backup times during shop hours, 24h format, e.g. 13:00,18:00 [default: 13:00,18:00]'
        if (-not $answer) { $answer = '13:00,18:00' }
        $times = @($answer -split '\s*,\s*')
        if ($times.Count -ne 2 -or ($times | Where-Object { -not (Test-Hm $_) })) { Warn 'Please enter exactly two times as HH:mm,HH:mm (24h).' }
    }

    $backupScript = Join-Path $PSScriptRoot 'backup-local.ps1'
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' `
        -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$backupScript`"" `
        -WorkingDirectory $PSScriptRoot
    # StartWhenAvailable: a laptop that was off at the scheduled time backs up at the next boot.
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30) `
        -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

    for ($i = 0; $i -lt 2; $i++) {
        $taskName = "IMPOC database backup $($i + 1)"
        $trigger = New-ScheduledTaskTrigger -Daily -At $times[$i]
        # -Force replaces an existing task with the same name (re-runs / new times)
        Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
        Ok "task '$taskName' at $($times[$i]) daily"
    }

    # Prove it works right now: one verified backup.
    Write-Host '    taking a first backup...'
    cmd /c "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$backupScript`" -Label setup"
    if ($LASTEXITCODE -eq 0) { Ok 'first backup verified' } else { Warn 'first backup failed - see C:\IMPOC-backups\logs' }
    $backupSummary = "$($times[0]) and $($times[1]) daily -> $($dirs.local)"
} catch {
    Warn "Local backup setup failed: $($_.Exception.Message)"
    Warn 'The app is unaffected. Fix the cause and re-run setup.cmd, or run backup-local.cmd by hand.'
}

# ---------------------------------------------------------------------------
# 11. Cloud backups - rclone + Google Drive, encrypted (R-60)
#     Optional (-SkipCloud). Needs you at the keyboard once for the Google sign-in.
# ---------------------------------------------------------------------------
$cloudSummary = 'skipped'
if (-not $SkipCloud) {
    Step 'Cloud backups (rclone + Google Drive)'
    try {
        $rclone = Find-Rclone
        if (-not $rclone) {
            Write-Host '    installing rclone...'
            $installed = $false
            if (Get-Command winget -ErrorAction SilentlyContinue) {
                cmd /c "winget install --id Rclone.Rclone -e --accept-source-agreements --accept-package-agreements --silent >nul 2>&1"
                Refresh-Path
                $rclone = Find-Rclone
                $installed = [bool]$rclone
            }
            if (-not $installed) {
                # winget missing/blocked: download the official zip into C:\IMPOC\rclone
                $zip = Join-Path $env:TEMP 'rclone.zip'
                Invoke-WebRequest -Uri 'https://downloads.rclone.org/rclone-current-windows-amd64.zip' -OutFile $zip -UseBasicParsing
                $tmpDir = Join-Path $env:TEMP 'rclone-unzip'
                if (Test-Path $tmpDir) { Remove-Item -Recurse -Force $tmpDir }
                Expand-Archive -Path $zip -DestinationPath $tmpDir -Force
                New-Item -ItemType Directory -Force -Path $script:RcloneInstallDir | Out-Null
                Get-ChildItem $tmpDir -Recurse -Filter 'rclone.exe' | Select-Object -First 1 |
                    ForEach-Object { Copy-Item $_.FullName (Join-Path $script:RcloneInstallDir 'rclone.exe') -Force }
                $rclone = Find-Rclone
            }
            if (-not $rclone) { throw 'could not install rclone (no winget and download failed).' }
        }
        Ok "rclone at $rclone"

        # Base remote: Google Drive, scope drive.file = rclone can only see files it created.
        if (Test-RcloneRemote $rclone $script:RcloneBaseRemote) {
            Ok "Google Drive remote '$($script:RcloneBaseRemote)' already configured"
        } else {
            Write-Host ''
            Write-Host '    A browser window will open: sign in with the shop Google account and click Allow.' -ForegroundColor Yellow
            Write-Host '    (rclone only gets access to the files it creates, nothing else in your Drive.)' -ForegroundColor Yellow
            Read-Host '    Press Enter to continue'
            cmd /c "`"$rclone`" config create $($script:RcloneBaseRemote) drive scope drive.file"
            if ($LASTEXITCODE -ne 0 -or -not (Test-RcloneRemote $rclone $script:RcloneBaseRemote)) { throw 'Google Drive sign-in did not complete.' }
            Ok 'signed in to Google Drive'
        }

        # Encrypted remote on top: names + contents scrambled before upload.
        $passwordFile = Join-Path $dirs.root 'CLOUD-BACKUP-PASSWORD-SAVE-ME.txt'
        if (Test-RcloneRemote $rclone $script:RcloneRemote) {
            Ok "encrypted remote '$($script:RcloneRemote)' already configured"
        } else {
            $cryptPassword = New-Secret 24
            $cryptSalt     = New-Secret 24
            $obsPw   = (cmd /c "`"$rclone`" obscure `"$cryptPassword`"").Trim()
            $obsSalt = (cmd /c "`"$rclone`" obscure `"$cryptSalt`"").Trim()
            cmd /c "`"$rclone`" config create $($script:RcloneRemote) crypt remote `"$($script:RcloneBaseRemote):$($script:RcloneFolder)`" password `"$obsPw`" password2 `"$obsSalt`" >nul"
            if ($LASTEXITCODE -ne 0 -or -not (Test-RcloneRemote $rclone $script:RcloneRemote)) { throw 'could not create the encrypted remote.' }
            Write-Utf8NoBom $passwordFile @"
IMPOC cloud backup encryption - SAVE THIS IN YOUR PASSWORD MANAGER, THEN DELETE THIS FILE.
Without these two values the backups in Google Drive cannot be read on any other computer.

rclone remote : $($script:RcloneRemote)  (crypt over $($script:RcloneBaseRemote):$($script:RcloneFolder))
password      : $cryptPassword
salt          : $cryptSalt
created       : $(Get-Date -Format 'yyyy-MM-dd HH:mm')

To restore on a fresh laptop: install rclone, sign in to the same Google account
(rclone config create gdrive drive scope drive.file), then
rclone config create gdrive-crypt crypt remote gdrive:IMPOC-backups password <password> password2 <salt>
"@
            Write-Host ''
            Write-Host '    ============================================================' -ForegroundColor Magenta
            Write-Host '    CLOUD BACKUP ENCRYPTION - copy these now, shown only once' -ForegroundColor Magenta
            Write-Host "    password : $cryptPassword" -ForegroundColor Magenta
            Write-Host "    salt     : $cryptSalt" -ForegroundColor Magenta
            Write-Host "    (also written to $passwordFile - delete it once saved)" -ForegroundColor Magenta
            Write-Host '    ============================================================' -ForegroundColor Magenta
            Read-Host '    Press Enter after you have saved them'
        }

        # Connection test: create the folder and list it.
        cmd /c "`"$rclone`" mkdir `"$($script:RcloneRemote):`" >nul 2>&1"
        cmd /c "`"$rclone`" lsd `"$($script:RcloneBaseRemote):`" >nul 2>&1"
        if ($LASTEXITCODE -ne 0) { throw 'Google Drive is configured but a test listing failed (sign-in expired?). Run: rclone config reconnect gdrive:' }
        Ok "Google Drive folder '$($script:RcloneFolder)' ready (encrypted)"
        $cloudSummary = "double-click deploy\windows\backup-cloud.cmd  -> Google Drive > $($script:RcloneFolder) > YYYY\MM\DD"
    } catch {
        Warn "Cloud backup setup failed: $($_.Exception.Message)"
        Warn 'Local backups still run. Re-run setup.cmd later to finish the cloud part.'
        $cloudSummary = 'NOT configured (see warning above)'
    }
}

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
Write-Host @"

=====================================================================
  IMPOC is set up.

  App URL (this laptop) : http://localhost:$Port
  App URL (other devices): $appUrl
  Login                  : admin  /  the admin password you entered

  pm2 status   : pm2 status
  pm2 logs     : pm2 logs impoc
  Restart      : pm2 restart impoc

  Local backups : $backupSummary
  Cloud backups : $cloudSummary
  Restore       : .\deploy\windows\restore-db.ps1   (admin PowerShell)

  MANUAL STEP - so it starts without anyone touching the laptop:
    1. Turn on automatic sign-in:  run "netplwiz", untick
       "Users must enter a user name and password", enter the Windows password.
    2. Settings > System > Power: "Never" sleep when plugged in.
    3. Router: reserve $hostInput for this laptop so the URL never changes.

  Note: phone-camera barcode scanning needs HTTPS. It works on this
  laptop (localhost) but not from phones over plain http. See docs.
=====================================================================
"@ -ForegroundColor Green
