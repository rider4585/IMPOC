#!/usr/bin/env bash
# install-skills.sh — copy framework skills into a Munder Difflin agent
#
#   ./bin/install-skills.sh <agent-id> <skill> [skill ...]
#   ./bin/install-skills.sh --list
#   ./bin/install-skills.sh --agents
#   ./bin/install-skills.sh --installed <agent-id>
#   ./bin/install-skills.sh --dry-run <agent-id> <skill> ...
#
# Skills land in:
#   <harnessHome>/hive/agents/<agent-id>/.claude/skills/<skill>/SKILL.md
#
# This script only ever writes inside that skills directory. It does not touch
# roster.json, identity.md, memory.md, inboxes, or anything else in the hive.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_SRC="$REPO_ROOT/skills"

CONFIG_MAC="$HOME/Library/Application Support/munder-difflin/config.json"
CONFIG_XDG="${XDG_CONFIG_HOME:-$HOME/.config}/munder-difflin/config.json"

die() { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }
info() { printf '\033[36m%s\033[0m\n' "$*"; }
ok()   { printf '\033[32m✓\033[0m %s\n' "$*"; }

# --- locate the hive ---------------------------------------------------------
find_harness_home() {
  if [[ -n "${MUNDER_HARNESS_HOME:-}" ]]; then
    printf '%s' "$MUNDER_HARNESS_HOME"; return
  fi
  local cfg=""
  [[ -f "$CONFIG_MAC" ]] && cfg="$CONFIG_MAC"
  [[ -z "$cfg" && -f "$CONFIG_XDG" ]] && cfg="$CONFIG_XDG"
  [[ -z "$cfg" ]] && die "config.json not found. Set MUNDER_HARNESS_HOME to your hive root."

  python3 - "$cfg" <<'PY'
import json, sys
try:
    with open(sys.argv[1]) as f:
        print(json.load(f).get("harnessHome", ""), end="")
except Exception:
    print("", end="")
PY
}

# --- skill lookup ------------------------------------------------------------
skill_path() {           # skill_path <name> -> path to its SKILL.md, or empty
  local name="$1" p
  for p in "$SKILLS_SRC"/*/"$name"/SKILL.md; do
    [[ -f "$p" ]] && { printf '%s' "$p"; return; }
  done
}

list_skills() {
  local d n
  for d in "$SKILLS_SRC"/*/; do
    n=$(find "$d" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
    printf '\n\033[1m%s\033[0m (%s)\n' "$(basename "$d")" "$n"
    find "$d" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort | sed 's/^/  /'
  done
  printf '\n\033[1mTotal:\033[0m %s skills\n' \
    "$(find "$SKILLS_SRC" -name SKILL.md | wc -l | tr -d ' ')"
}

# --- argument handling -------------------------------------------------------
DRY_RUN=false
case "${1:-}" in
  ""|-h|--help)
    sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    exit 0 ;;
  --list)     list_skills; exit 0 ;;
  --dry-run)  DRY_RUN=true; shift ;;
esac

HARNESS_HOME="$(find_harness_home)"
[[ -z "$HARNESS_HOME" ]] && die "could not determine harnessHome. Set MUNDER_HARNESS_HOME."
[[ -d "$HARNESS_HOME" ]] || die "harness home does not exist: $HARNESS_HOME"

AGENTS_DIR="$HARNESS_HOME/hive/agents"
[[ -d "$AGENTS_DIR" ]] || die "hive agents directory not found: $AGENTS_DIR"

if [[ "${1:-}" == "--agents" ]]; then
  info "Agents in $AGENTS_DIR"
  find "$AGENTS_DIR" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort | sed 's/^/  /'
  exit 0
fi

if [[ "${1:-}" == "--installed" ]]; then
  [[ -n "${2:-}" ]] || die "usage: --installed <agent-id>"
  d="$AGENTS_DIR/$2/.claude/skills"
  [[ -d "$d" ]] || { echo "no skills installed for $2"; exit 0; }
  info "Skills installed for $2"
  find "$d" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort | sed 's/^/  /'
  exit 0
fi

AGENT_ID="${1:-}"; shift || true
[[ -n "$AGENT_ID" ]] || die "usage: install-skills.sh <agent-id> <skill> [skill ...]"
[[ $# -gt 0 ]] || die "no skills given. Use --list to see available skills."

AGENT_DIR="$AGENTS_DIR/$AGENT_ID"
if [[ ! -d "$AGENT_DIR" ]]; then
  printf '\033[33mwarning:\033[0m agent "%s" not found in the hive.\n' "$AGENT_ID"
  printf '         It must exist in roster.json and have started once.\n'
  printf '         Known agents: %s\n' \
    "$(find "$AGENTS_DIR" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort | paste -sd, -)"
  die "aborting — nothing written."
fi

TARGET="$AGENT_DIR/.claude/skills"

# --- verify every skill exists BEFORE writing anything -----------------------
declare -a SRCS=() NAMES=() MISSING=()
for name in "$@"; do
  p="$(skill_path "$name")"
  if [[ -z "$p" ]]; then MISSING+=("$name"); else SRCS+=("$p"); NAMES+=("$name"); fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  printf '\033[31munknown skills:\033[0m %s\n' "${MISSING[*]}"
  die "nothing written. Use --list to see available skills."
fi

# --- install -----------------------------------------------------------------
info "Agent:  $AGENT_ID"
info "Target: $TARGET"
$DRY_RUN && info "(dry run — no files written)"
echo

installed=0 updated=0
for i in "${!NAMES[@]}"; do
  name="${NAMES[$i]}"; src="${SRCS[$i]}"; dest="$TARGET/$name/SKILL.md"
  if [[ -f "$dest" ]]; then
    if cmp -s "$src" "$dest"; then
      printf '  \033[90m= %s (unchanged)\033[0m\n' "$name"; continue
    fi
    status="updated"; ((updated++))
  else
    status="installed"; ((installed++))
  fi
  if ! $DRY_RUN; then
    mkdir -p "$TARGET/$name"
    cp "$src" "$dest"
  fi
  ok "$name ($status)"
done

echo
printf 'Done: %d installed, %d updated, %d total requested.\n' \
  "$installed" "$updated" "${#NAMES[@]}"

if ! $DRY_RUN && (( installed + updated > 0 )); then
  printf '\n\033[33mRestart the agent\033[0m so Claude Code picks up the new skills.\n'
fi
