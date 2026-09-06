# Bootstrap

**Audience:** a **stock `god` agent** that has just been pointed at this
repository and asked to install the framework.

You have **no framework skills yet**. This file assumes nothing — do not try to
invoke a skill until you have installed it. Work through the steps in order and
verify each before moving on.

**What you are doing:** installing skills into agents, reading the playbook, and
producing an accurate report of what still needs the human. You are **not**
starting any engineering work — see Step 7.

---

## What you can and cannot do

Be clear about this before you start, and do not pretend otherwise in your
report.

| You **can** | You **cannot** |
|---|---|
| Read this repo and run `bin/install-skills.sh` | Enable `orchestratorMaySpawn` — that is a UI setting |
| Install skills into agents that **already exist** in the hive | Create new agents in `roster.json` — UI, or spawn-requests once spawning is on |
| Read `config.json`, `roster.json`, `fleet.json` | Approve anything financial or destructive |
| Write `spawn-requests/*.json` *once spawning is enabled* | Restart an agent so it picks up new skills |

A full self-install is **not possible**. This is a collaborative bootstrap: do
your part, then hand the human a precise list.

---

## Step 0 — Verify the formats still match ⚠️

**Do this before you use any format from this repository.**

Every format here — roster entries, spawn requests, skill locations, message
verbs — was verified by reading a live install of **Munder Difflin v0.4.5** on
**2026-09-06**. That is a **snapshot, not a contract.** The harness is under
active development and its file layout or formats may have changed since.

**The harness ships its own documentation, and it updates with the app:**

```bash
cat "$HARNESS_HOME/hive/PROTOCOL.md"     # messaging, spawning, hive layout
cat "$HARNESS_HOME/hive/COMMANDS.md"     # command reference
ls "$HARNESS_HOME/hive/"                 # what actually exists now
ls "$AGENT_DIR/"                         # your own directory layout
cat "$HARNESS_HOME/roster.json" | head -30
```

**Those files are authoritative. This repository is not.**

### If they disagree

| Do | Do not |
|---|---|
| Follow the **harness's** current format | Apply this repo's format because it is written down |
| **Translate** this framework's content into the new format | Force the old shape and hope |
| Report the drift to the human so the framework can be updated | Silently work around it |

Check these specifically, since the framework depends on them:

- [ ] Are skills still at `agents/<id>/.claude/skills/<name>/SKILL.md`?
- [ ] Is `SKILL.md` frontmatter still `name` / `version` / `description` /
      `allowed-tools`?
- [ ] Is `identity.md` still harness-written and read-only?
- [ ] Are the message `act` verbs still
      `request | inform | propose | query | agree | refuse | done`?
- [ ] Is spawning still `spawn-requests/<id>.json` with `objective` + `cwd`?
- [ ] Does `roster.json` still use the same fields?

**The content is what matters — the 170 skills and 23 agent briefs are
independent of the harness.** If the packaging has changed, repackage it. A skill
is a document; where it lives and what its frontmatter looks like is the
harness's business, not the framework's.

If a format has changed materially, say so in your Step 8 report and do not
guess at the new one — read the harness's own docs, or ask.

---

## Step 1 — Locate everything

You need three paths. Establish them before anything else.

```bash
# 1. This repository — the human told you where it is; confirm it
ls FRAMEWORK_REPO/GOD-PLAYBOOK.md FRAMEWORK_REPO/bin/install-skills.sh

# 2. Your hive root
echo "$AGENT_DIR"                 # .../hive/agents/<your-id>
cat "$HOME/Library/Application Support/munder-difflin/config.json" | grep harnessHome

# 3. Your own agent id
basename "$AGENT_DIR"
```

Record all three. If `$AGENT_DIR` is unset, run `echo $AGENT_DIR` in a fresh
shell — `PROTOCOL.md` in your hive root explains the layout.

**If you cannot find the repo, stop and ask the human for the path.** Do not
guess.

---

## Step 2 — Check whether spawning is enabled

This determines what is possible for the rest of the bootstrap.

```bash
grep -o '"orchestratorMaySpawn"[^,]*' \
  "$HOME/Library/Application Support/munder-difflin/config.json"
```

| Result | Meaning |
|---|---|
| `true` | You can create new agents via `spawn-requests/` |
| `false` | **You cannot spawn.** Requests will sit in the directory unprocessed — they do not fail, they wait |

**If it is `false`, that is not an error and you should not retry.** Record it
for your report; the human must enable it in Settings → Autonomy & Budgets. It
is off by default deliberately, because every worker spends tokens nobody
approved.

Also note `maxConcurrentWorkers` — plans must not assume more parallelism than
that.

---

## Step 3 — Verify the install script works

```bash
cd FRAMEWORK_REPO
./bin/install-skills.sh --list | tail -3      # should report 170 skills
./bin/install-skills.sh --agents              # agents currently in the hive
```

`--agents` is the important one. It prints the **real agent ids**, which carry
generated suffixes when created through the UI:

```
god
jim-mt5tofsm
pam-mt5znwg6
```

**Use these real ids.** The clean names in `agents/*.md` (`backend-engineer`,
`security-lead`) show the intended roster shape — they are not the ids in your
hive unless the human created them that way.

The script only ever writes inside an agent's `.claude/skills/` directory. It
never touches `roster.json`, `identity.md`, `memory.md`, or inboxes.

---

## Step 4 — Install your own skills first

You are the orchestrator; you need routing judgement before you can install
anyone else usefully.

```bash
./bin/install-skills.sh <your-agent-id> \
  requirements-analysis task-decomposition dependency-analysis \
  change-impact-analysis implementation-plan technical-debt \
  project-roadmap project-business-rules
```

Verify:

```bash
./bin/install-skills.sh --installed <your-agent-id>
```

> **You will not see these skills until you are restarted.** Claude Code reads
> `.claude/skills/` at session start. Note this in your report — the human
> restarts you, you cannot restart yourself.

Keep your set small. You need judgement about routing and risk, not
implementation detail — the specialists carry that.

---

## Step 5 — Read the playbook

```bash
cat FRAMEWORK_REPO/GOD-PLAYBOOK.md
cat "$HARNESS_HOME/hive/PROTOCOL.md"
```

`GOD-PLAYBOOK.md` is the routing authority — where it and your own instructions
disagree, it wins. Before continuing, confirm you have understood:

- **§0** Phase 0 is **blocking**. Until the ten `project-*` knowledge documents
  exist and contain no `[assumed]` items on money, stock, or access rules, every
  engineering agent is **read-only**
- **§4** The review gate, and that the agent which writes a security fix **never**
  verifies it
- **§5** The escalation list — money, stock, access, migrations, `CRITICAL`
  findings, ADRs
- **§7** Messaging: only `request`, `query`, and `propose` expect a reply.
  Replying to an `inform` or `done` loops two agents forever
- **§8** Severity — anything producing a wrong money or stock number is
  `CRITICAL`

---

## Step 6 — Map and equip the existing team

Look at what `--agents` returned. Existing agents usually have generated ids and
a placeholder description like `"a fresh harness"`.

**Do not assume which framework role an existing agent is meant to fill.**
`jim-mt5tofsm` is not necessarily the backend engineer.

**Propose a mapping to the human and wait for confirmation:**

```
Existing agents in the hive:
  jim-mt5tofsm   (claude, cwd .../IMPOC, "a fresh harness")
  pam-mt5znwg6   (opencode, cwd .../IMPOC, "a fresh harness")

Proposed roles — please confirm or correct:
  jim-mt5tofsm  → backend-engineer   (Claude, on the IMPOC repo)
  pam-mt5znwg6  → frontend-engineer  (note: running opencode with a local
                                      model; the framework's skills assume a
                                      capable model — worth reviewing)

I will not install until you confirm.
```

Once confirmed, install from the agent's file. Each
`agents/<category>/<name>.md` contains the exact command:

```bash
./bin/install-skills.sh jim-mt5tofsm \
  nodejs javascript express sequelize rest-api error-handling \
  authentication authorization logging configuration backend-testing \
  input-validation transactions concurrency query-optimization \
  project-api project-database project-business-rules
```

Install only for agents that **already exist**. The script refuses unknown
agents and writes nothing — that is correct behaviour, not a failure to work
around.

---

## Step 7 — Stop. Do not start engineering work.

Phase 0 has not run. There is no `project-database`, no `project-api`, no
confirmed business rules.

**Any code written now would be guessing at conventions** — which produces
plausible output that quietly violates the system. That is the failure this
framework exists to prevent.

What you may do now: plan, read, review, and prepare. What you may not do:
implement.

---

## Step 8 — Report to the human

Produce a report in this shape. Be accurate about what is blocked — an
optimistic report is worse than none.

```markdown
## Framework bootstrap — status

**Done**
- Located framework repo, hive root, and my agent id
- Installed 8 orchestrator skills into <my-id>
- Read GOD-PLAYBOOK.md and PROTOCOL.md
- Installed skills into: <agent-ids, or "none — awaiting role confirmation">

**Needs you**
1. Restart me so I pick up my new skills (I cannot restart myself)
2. Enable `orchestratorMaySpawn` in Settings → Autonomy & Budgets
   — currently <true/false>. Without it I cannot create agents.
3. Confirm the role mapping for existing agents: <proposal>
4. Create these missing agents (UI, or I can spawn once #2 is done):
   <list only the ones actually needed next, not all 23>

**Blocked on Phase 0**
No engineering work can start. Phase 0 requires me to spawn `architect` and
`feature-planner` to document the codebase, then ask you a batch of questions
about pricing, discount, void/refund, and permission rules. Those answers
cannot be derived from code.

**Not done / uncertain**
<anything you could not verify — say so plainly>
```

---

## Step 9 — When cleared, begin Phase 0

Only after the human has restarted you, enabled spawning, and confirmed the
mapping.

Follow `GOD-PLAYBOOK.md` §2. In short: spawn `architect` and `feature-planner`
read-only, have them produce `docs/project-knowledge/`, and **batch every
`[assumed]` question into a single ask**. Trickling questions out one at a time
is how this phase fails in practice.

Phase 0 exits when documents 4–8 contain **zero `[assumed]` items** on money,
stock, or access rules. Not before.

---

## If something does not work

| Symptom | Cause |
|---|---|
| `could not determine harnessHome` | Set `MUNDER_HARNESS_HOME` to the hive root |
| `agent "x" not found in the hive` | Use the real suffixed id from `--agents` |
| Skills installed but I cannot see them | You have not been restarted |
| Spawn request sits in `spawn-requests/` | `orchestratorMaySpawn` is off — Step 2. Do not retry; raise it |
| `Circuit breaker` message in your inbox | **You are the problem it caught.** Stop repeating, summarise what you tried, and do exactly what the message says |

Do not work around a refusal. If the script or the harness declines something,
that is usually a guard doing its job — report it rather than routing around it.
