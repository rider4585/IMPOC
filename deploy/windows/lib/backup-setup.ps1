<#
    Shared backup SETUP helpers (R-60 v2). Dot-source from setup.ps1 and from
    the standalone scripts:

        . (Join-Path $PSScriptRoot 'backup-setup.ps1')

    Holds the three installers used everywhere so the full setup.ps1 and the
    two standalone scripts always agree:

        - Install-LocalBackupTasks   : the two daily "IMPOC local backup 1/2"
        - Install-BackupCatchUpTask  : the every-logon "IMPOC backup catch-up"
        - Install-CloudBackupTasks   : rclone + Google sign-in + the two daily
                                       "IMPOC cloud backup 1/2" + first upload

    Everything is additive and idempotent (Register-ScheduledTask -Force), and
    may be re-run any number of times. A cloud failure is always a warning,
    never a terminating error, so the app and the local backups are untouched.
    The calling script sets $ErrorActionPreference = 'Stop'.

    Console helpers (Step/Ok/Warn/Fail) and New-Secret / Write-Utf8NoBom /
    Refresh-Path are defined here only when the caller has not defined them
    yet, so dot-sourcing into setup.ps1 changes nothing it already owns.
#>

. (Join-Path $PSScriptRoot 'backup-common.ps1')

# --- folders / scripts this library drives -----------------------------------
$script:WinDir       = Resolve-Path (Join-Path $PSScriptRoot '..')                 # deploy\windows
$script:RepoRoot     = Resolve-Path (Join-Path $script:WinDir '..\..')             # repo root
$script:Backend      = Join-Path $script:RepoRoot 'backend'
$script:LocalScript  = Join-Path $script:WinDir 'backup-local.ps1'
$script:CloudScript  = Join-Path $script:WinDir 'backup-cloud.ps1'
$script:CatchUpScript = Join-Path $script:WinDir 'backup-catchup.ps1'

# --- console + helper functions (guarded: never clobber the caller's) --------
if (-not (Get-Command Step -ErrorAction SilentlyContinue)) { function Step($msg)  { Write-Host "`n==> $msg" -ForegroundColor Cyan } }
if (-not (Get-Command Ok -ErrorAction SilentlyContinue))   { function Ok($msg)    { Write-Host "    OK  $msg" -ForegroundColor Green } }
if (-not (Get-Command Warn -ErrorAction SilentlyContinue)) { function Warn($msg)  { Write-Host "    !!  $msg" -ForegroundColor Yellow } }
if (-not (Get-Command Fail -ErrorAction SilentlyContinue)) { function Fail($msg)  { Write-Host "`nERROR: $msg" -ForegroundColor Red; exit 1 } }

if (-not (Get-Command New-Secret -ErrorAction SilentlyContinue)) {
    function New-Secret([int]$bytes = 48) {
        $buf = New-Object byte[] $bytes
        [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
        # base64url so the value is safe in a .env line
        return [Convert]::ToBase64String($buf).TrimEnd('=').Replace('+', '-').Replace('/', '_')
    }
}

if (-not (Get-Command Write-Utf8NoBom -ErrorAction SilentlyContinue)) {
    function Write-Utf8NoBom([string]$path, [string]$text) {
        [IO.File]::WriteAllText($path, $text, (New-Object Text.UTF8Encoding($false)))
    }
}

if (-not (Get-Command Refresh-Path -ErrorAction SilentlyContinue)) {
    function Refresh-Path {
        $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                    [Environment]::GetEnvironmentVariable('Path', 'User')
    }
}

# A valid 24h 'HH:mm' backup time.
function Test-BackupTime([string]$t) { return $t -match '^([01]\d|2[0-3]):[0-5]\d$' }

# --- shared scheduled-task pieces --------------------------------------------
# optional $slotTime becomes "-SlotTime HH:mm" so a scheduled run knows which
# daily slot it represents (and can skip when last-status.json already covers it).
function New-BackupTaskAction([string]$scriptPath, [string]$slotTime) {
    $arg = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""
    if ($slotTime) { $arg = "$arg -SlotTime $slotTime" }
    return New-ScheduledTaskAction -Execute 'powershell.exe' `
        -Argument $arg `
        -WorkingDirectory $script:WinDir
}

# StartWhenAvailable: a laptop that was off at slot time backs up at the next boot.
function Get-BackupTaskSettings {
    return New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30) `
        -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
}

# Runs as the current interactive user (matters for the logon trigger + pm2).
function Get-BackupTaskPrincipal {
    return New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
}

# ---------------------------------------------------------------------------
# Register "IMPOC local backup 1/2" (Daily, one per slot) and take the first
# verified dump. Drops the R-60 v1 task names so re-runs never leave a
# duplicate pair. Returns a short summary string.
# ---------------------------------------------------------------------------
function Install-LocalBackupTasks([string[]]$times) {
    $dirs = Initialize-BackupDirs
    Ok "backup folder $($dirs.root)"

    # R-60 v1 registered "IMPOC database backup 1/2" (no -SlotTime). Remove the
    # old names so a setup re-run on an existing laptop ends with exactly two
    # local tasks, both slot-aware.
    foreach ($old in 'IMPOC database backup 1', 'IMPOC database backup 2') {
        Unregister-ScheduledTask -TaskName $old -Confirm:$false -ErrorAction SilentlyContinue
    }

    $settings  = Get-BackupTaskSettings
    $principal = Get-BackupTaskPrincipal

    for ($i = 0; $i -lt $times.Count; $i++) {
        $taskName = "IMPOC local backup $($i + 1)"
        $action   = New-BackupTaskAction $script:LocalScript $times[$i]
        $trigger  = New-ScheduledTaskTrigger -Daily -At $times[$i]
        Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
            -Settings $settings -Principal $principal -Force | Out-Null
        Ok "task '$taskName' at $($times[$i]) daily"
    }

    # Prove it works right now: one verified backup.
    Write-Host '    taking a first backup...'
    cmd /c "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$script:LocalScript`" -Label setup"
    if ($LASTEXITCODE -eq 0) { Ok 'first backup verified' } else { Warn 'first backup failed - see C:\IMPOC-backups\logs' }

    return "$($times -join ' and ') daily -> $($dirs.local)"
}

# ---------------------------------------------------------------------------
# Register ONE "IMPOC backup catch-up" task: at every logon it re-runs any
# slot that was missed while the laptop was off (see backup-catchup.ps1).
# ---------------------------------------------------------------------------
function Install-BackupCatchUpTask {
    $action    = New-BackupTaskAction $script:CatchUpScript
    $settings  = Get-BackupTaskSettings
    $principal = Get-BackupTaskPrincipal
    $trigger   = New-ScheduledTaskTrigger -AtLogOn
    Register-ScheduledTask -TaskName 'IMPOC backup catch-up' -Action $action -Trigger $trigger `
        -Settings $settings -Principal $principal -Force | Out-Null
    Ok "task 'IMPOC backup catch-up' at every logon"
    return 'IMPOC backup catch-up at every logon'
}

# ---------------------------------------------------------------------------
# Cloud: install + configure rclone (Google Drive, encrypted), register the
# two daily "IMPOC cloud backup 1/2" upload tasks and take the first upload.
# Keeps the R-60 v1 behaviour (winget -> zip fallback, drive.file scope,
# gdrive-crypt with a generated password/salt shown once in magenta and saved
# to CLOUD-BACKUP-PASSWORD-SAVE-ME.txt). Additive and idempotent; a failure
# here must only ever be a warning to the caller, never break the app.
# ---------------------------------------------------------------------------
function Install-CloudBackupTasks([string[]]$times) {
    $dirs = Initialize-BackupDirs

    # 1. rclone binary ------------------------------------------------------
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

    # 2. Base remote: Google Drive, scope drive.file = rclone can only see
    #    files it created.
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

    # 3. Encrypted remote on top: names + contents scrambled before upload.
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

    # 4. Connection test: create the folder and list it.
    cmd /c "`"$rclone`" mkdir `"$($script:RcloneRemote):`" >nul 2>&1"
    cmd /c "`"$rclone`" lsd `"$($script:RcloneBaseRemote):`" >nul 2>&1"
    if ($LASTEXITCODE -ne 0) { throw 'Google Drive is configured but a test listing failed (sign-in expired?). Run: rclone config reconnect gdrive:' }
    Ok "Google Drive folder '$($script:RcloneFolder)' ready (encrypted)"

    # 5. Two daily upload tasks, one per slot.
    $settings  = Get-BackupTaskSettings
    $principal = Get-BackupTaskPrincipal

    for ($i = 0; $i -lt $times.Count; $i++) {
        $taskName = "IMPOC cloud backup $($i + 1)"
        $action   = New-BackupTaskAction $script:CloudScript $times[$i]
        $trigger  = New-ScheduledTaskTrigger -Daily -At $times[$i]
        Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
            -Settings $settings -Principal $principal -Force | Out-Null
        Ok "task '$taskName' at $($times[$i]) daily"
    }

    # 6. First cloud upload now, to prove the whole chain works.
    Write-Host '    taking a first cloud backup...'
    cmd /c "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$script:CloudScript`""
    if ($LASTEXITCODE -eq 0) { Ok 'first cloud upload verified' } else { Warn 'first cloud backup failed - see C:\IMPOC-backups\logs' }

    return "$($times -join ' and ') daily -> Google Drive > $($script:RcloneFolder) > YYYY\MM\DD (encrypted)"
}