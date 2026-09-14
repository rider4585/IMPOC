<#
.SYNOPSIS
    Upload an encrypted copy of the IMPOC database to Google Drive (R-60).
    Double-click backup-cloud.cmd whenever you want an off-site copy.

.DESCRIPTION
    1. Takes a fresh, verified local backup first (so the cloud copy is current).
    2. Uploads it with rclone to the ENCRYPTED remote "gdrive-crypt", into a
       date-wise folder:   IMPOC-backups / 2026 / 09 / 14 / impoc-2026-09-14_1830.dump
       plus backend\.env under  config /  (it holds the app secrets).
       Files are encrypted on this laptop before they leave it; Google only
       ever sees scrambled names and contents.
    3. Verifies the upload (rclone --checksum) and deletes cloud copies older
       than 90 days.
    4. Records the outcome in C:\IMPOC-backups\last-status.json.

    Needs the one-time rclone setup done by setup.ps1 (Google sign-in). If the
    Google login token has expired, run:  rclone config reconnect gdrive:
#>
[CmdletBinding()]
param(
    [switch]$SkipLocalDump      # upload the newest existing local dump instead of taking a new one
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\backup-common.ps1')

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$Backend  = Join-Path $RepoRoot 'backend'

function Invoke-Rclone([string]$rclone, [string]$args) {
    # rclone writes progress/notices to stderr; route through cmd so only the exit code matters.
    $out = cmd /c "`"$rclone`" $args 2>&1"
    return @{ code = $LASTEXITCODE; out = "$out" }
}

try {
    $dirs = Initialize-BackupDirs
    $rclone = Find-Rclone
    if (-not $rclone) { throw 'rclone is not installed. Re-run setup.cmd (it installs rclone and signs in to Google).' }
    if (-not (Test-RcloneRemote $rclone $script:RcloneRemote)) {
        throw "rclone remote '$($script:RcloneRemote)' is not configured. Re-run setup.cmd and complete the Google sign-in step."
    }

    # 1. fresh verified dump (or the newest existing one)
    if ($SkipLocalDump) {
        $dump = Get-ChildItem $dirs.local -Filter '*.dump' -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if (-not $dump) { throw 'No local backup found to upload. Run backup-local.cmd first.' }
        $dumpPath = $dump.FullName
    } else {
        $envVars = Read-DotEnv (Join-Path $Backend '.env')
        $dumpPath = Invoke-VerifiedDump $envVars $dirs.local ("impoc-{0}.dump" -f (Get-Date -Format 'yyyy-MM-dd_HHmm'))
        Write-BackupLog 'cloud' "fresh local dump $dumpPath"
    }

    # 2. date-wise folder on the remote: YYYY/MM/DD
    $stamp = Get-Item $dumpPath | Select-Object -ExpandProperty LastWriteTime
    $folder = "{0}/{1}/{2}" -f $stamp.ToString('yyyy'), $stamp.ToString('MM'), $stamp.ToString('dd')
    $dest = "$($script:RcloneRemote):$folder"

    $r = Invoke-Rclone $rclone "copy `"$dumpPath`" `"$dest`" --checksum --retries 3 --low-level-retries 10 --stats 0"
    if ($r.code -ne 0) { throw "upload failed: $($r.out)" }

    # 3. app secrets alongside (small, encrypted like everything else)
    $envFile = Join-Path $Backend '.env'
    if (Test-Path $envFile) {
        $r2 = Invoke-Rclone $rclone "copyto `"$envFile`" `"$($script:RcloneRemote):config/backend.env`" --checksum --stats 0"
        if ($r2.code -ne 0) { Write-BackupLog 'cloud' "warning: .env upload failed: $($r2.out)" }
    }

    # 4. confirm the file is really there, then prune old cloud copies
    $ls = Invoke-Rclone $rclone "lsl `"$dest/$(Split-Path $dumpPath -Leaf)`""
    if ($ls.code -ne 0 -or -not ("$($ls.out)" -match [regex]::Escape((Split-Path $dumpPath -Leaf)))) {
        throw "upload could not be confirmed on the remote: $($ls.out)"
    }
    $prune = Invoke-Rclone $rclone "delete `"$($script:RcloneRemote):`" --min-age $($script:CloudRetentionDays)d --include `"*.dump`" --stats 0"
    if ($prune.code -ne 0) { Write-BackupLog 'cloud' "warning: prune failed: $($prune.out)" }
    Invoke-Rclone $rclone "rmdirs `"$($script:RcloneRemote):`" --leave-root --stats 0" | Out-Null

    $sizeKb = [math]::Round((Get-Item $dumpPath).Length / 1KB)
    Write-BackupStatus 'cloud' $true "$folder/$(Split-Path $dumpPath -Leaf)" "uploaded, $sizeKb KB"
    Write-BackupLog 'cloud' "OK  uploaded $(Split-Path $dumpPath -Leaf) to $dest ($sizeKb KB)"
    Write-Host "`nCloud backup done: Google Drive > $($script:RcloneFolder) > $folder" -ForegroundColor Green
    exit 0
} catch {
    $msg = $_.Exception.Message
    try { Write-BackupStatus 'cloud' $false '' $msg } catch { }
    Write-BackupLog 'cloud' "FAILED  $msg"
    Write-Host "`nCloud backup FAILED: $msg" -ForegroundColor Red
    if ($msg -match 'token|oauth|401|unauthori') {
        Write-Host 'The Google sign-in has probably expired. Run:  rclone config reconnect gdrive:' -ForegroundColor Yellow
    }
    exit 1
}
