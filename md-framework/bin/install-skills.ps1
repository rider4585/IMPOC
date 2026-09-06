#!/usr/bin/env pwsh
# install-skills.ps1 â€” copy framework skills into a Munder Difflin agent
#
#   ./bin/install-skills.ps1 <agent-id> <skill> [skill ...]
#   ./bin/install-skills.ps1 --list
#   ./bin/install-skills.ps1 --agents
#   ./bin/install-skills.ps1 --installed <agent-id>
#   ./bin/install-skills.ps1 --dry-run <agent-id> <skill> ...
#
# Skills land in:
#   <harnessHome>/hive/agents/<agent-id>/.claude/skills/<skill>/SKILL.md
#
# This script only ever writes inside that skills directory. It does not touch
# roster.json, identity.md, memory.md, inboxes, or anything else in the hive.
#
# Windows/opencode port of bin/install-skills.sh (bash). Same interface, same
# skill set, same target layout.

$ErrorActionPreference = 'Stop'

$REPO_ROOT = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$SKILLS_SRC = Join-Path $REPO_ROOT 'skills'

$CONFIG_PATHS = @(
  $env:CONFIG_MAC,
  $(if ($env:XDG_CONFIG_HOME) { Join-Path $env:XDG_CONFIG_HOME 'munder-difflin\config.json' }),
  "$env:APPDATA\munder-difflin\config.json"
) | Where-Object { $_ -and (Test-Path $_) }

function Write-Info  { Write-Host $args -ForegroundColor Cyan }
function Write-Ok    { Write-Host ("OK {0}" -f $args) -ForegroundColor Green }
function Write-Warn  { Write-Host $args -ForegroundColor Yellow }
function Write-ErrorLine { Write-Host $args -ForegroundColor Red }

# --- locate the hive ---------------------------------------------------------
function Find-HarnessHome {
  if ($env:MUNDER_HARNESS_HOME) { return $env:MUNDER_HARNESS_HOME }
  foreach ($p in $CONFIG_PATHS) {
    try {
      $cfg = Get-Content $p -Raw | ConvertFrom-Json
      if ($cfg.harnessHome) { return $cfg.harnessHome }
    } catch {}
  }
  throw "config.json not found. Set MUNDER_HARNESS_HOME to your hive root."
}

# --- skill lookup ------------------------------------------------------------
function Find-SkillPath {
  param([string]$Name)
  foreach ($cat in Get-ChildItem $SKILLS_SRC -Directory) {
    $p = Join-Path $cat.FullName "$Name\SKILL.md"
    if (Test-Path $p) { return $p }
  }
  return $null
}

function Show-SkillList {
  $total = 0
  foreach ($cat in Get-ChildItem $SKILLS_SRC -Directory) {
    $n = (Get-ChildItem $cat.FullName -Directory).Count
    $names = (Get-ChildItem $cat.FullName -Directory | Select-Object -ExpandProperty Name | Sort-Object) -join '  '
    Write-Host ""
    Write-Host ("{0} ({1})" -f $cat.Name, $n) -ForegroundColor White
    Write-Host "  $names"
    $total += $n
  }
  Write-Host ""
  Write-Host ("Total: {0} skills" -f $total) -ForegroundColor White
}

# --- argument handling -------------------------------------------------------
$DRY_RUN = $false

if ($args.Count -eq 0 -or $args[0] -eq '-h' -or $args[0] -eq '--help') {
  Get-Content $PSCommandPath | Select-Object -Skip 1 -First 21 | ForEach-Object { $_ -replace '^# ?', '' }
  exit 0
}

if ($args[0] -eq '--list') { Show-SkillList; exit 0 }

if ($args[0] -eq '--dry-run') { $DRY_RUN = $true; $script:Args = $args[1..($args.Count-1)] }
else { $script:Args = $args }

if ($script:Args.Count -eq 0) {
  Write-ErrorLine "nothing to do."
  exit 1
}

$HARNESS_HOME = Find-HarnessHome
if (-not $HARNESS_HOME) { Write-ErrorLine "could not determine harnessHome. Set MUNDER_HARNESS_HOME."; exit 1 }
if (-not (Test-Path $HARNESS_HOME)) { Write-ErrorLine "harness home does not exist: $HARNESS_HOME"; exit 1 }

$AGENTS_DIR = Join-Path $HARNESS_HOME 'hive\agents'
if (-not (Test-Path $AGENTS_DIR)) { Write-ErrorLine "hive agents directory not found: $AGENTS_DIR"; exit 1 }

if ($script:Args[0] -eq '--agents') {
  Write-Info "Agents in $AGENTS_DIR"
  Get-ChildItem $AGENTS_DIR -Directory | Select-Object -ExpandProperty Name | Sort-Object
  exit 0
}

if ($script:Args[0] -eq '--installed') {
  if ($script:Args.Count -lt 2) { Write-ErrorLine "usage: --installed <agent-id>"; exit 1 }
  $d = Join-Path $AGENTS_DIR "$($script:Args[1])\.claude\skills"
  if (-not (Test-Path $d)) { Write-Host "no skills installed for $($script:Args[1])"; exit 0 }
  Write-Info "Skills installed for $($script:Args[1])"
  Get-ChildItem $d -Directory | Select-Object -ExpandProperty Name | Sort-Object
  exit 0
}

$AGENT_ID = $script:Args[0]
$REQUESTED = $script:Args[1..($script:Args.Count-1)]
if (-not $AGENT_ID) { Write-ErrorLine "usage: install-skills.ps1 <agent-id> <skill> [skill ...]"; exit 1 }
if ($REQUESTED.Count -eq 0) { Write-ErrorLine "no skills given. Use --list to see available skills."; exit 1 }

$AGENT_DIR = Join-Path $AGENTS_DIR $AGENT_ID
if (-not (Test-Path $AGENT_DIR)) {
  $known = (Get-ChildItem $AGENTS_DIR -Directory | Select-Object -ExpandProperty Name | Sort-Object) -join ', '
  Write-Warn "warning: agent `"$AGENT_ID`" not found in the hive."
  Write-Host ""
  Write-Host "         It must exist in roster.json and have started once."
  Write-Host "         Known agents: $known"
  Write-ErrorLine "aborting - nothing written."
  exit 1
}

$TARGET = Join-Path $AGENT_DIR '.claude\skills'

# --- verify every skill exists BEFORE writing anything -----------------------
$MISSING = @()
$SRCS = @()
$NAMES = @()
foreach ($name in $REQUESTED) {
  $p = Find-SkillPath $name
  if (-not $p) { $MISSING += $name } else { $SRCS += $p; $NAMES += $name }
}

if ($MISSING.Count -gt 0) {
  Write-ErrorLine "unknown skills: $($MISSING -join ', ')"
  Write-ErrorLine "nothing written. Use --list to see available skills."
  exit 1
}

# --- install ---------------------------------------------------------------
Write-Info "Agent:  $AGENT_ID"
Write-Info "Target: $TARGET"
if ($DRY_RUN) { Write-Info "(dry run - no files written)" }

$installed = 0; $updated = 0
for ($i = 0; $i -lt $NAMES.Count; $i++) {
  $name = $NAMES[$i]; $src = $SRCS[$i]
  $destDir = Join-Path $TARGET $name; $dest = Join-Path $destDir 'SKILL.md'
  $status = ''
  if (Test-Path $dest) {
    if ((Get-Content $src -Raw) -eq (Get-Content $dest -Raw)) {
      Write-Host "  = $name (unchanged)" -ForegroundColor DarkGray
      continue
    }
    $status = 'updated'; $updated++
  } else {
    $status = 'installed'; $installed++
  }
  if (-not $DRY_RUN) {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    Copy-Item -Path $src -Destination $dest -Force
  }
  Write-Ok "$name ($status)"
}

Write-Host ""
Write-Host ("Done: {0} installed, {1} updated, {2} total requested." -f $installed, $updated, $NAMES.Count)

if (-not $DRY_RUN -and ($installed + $updated) -gt 0) {
  Write-Host ""
  Write-Warn "Restart the agent so opencode picks up the new skills."
}
