# Quickstart

Getting the framework running in your Munder Difflin hive.

> **Prefer to delegate it?** Clone the repo and tell your god agent:
> *"Read `BOOTSTRAP.md` in the framework repo and work through it."*
>
> [`BOOTSTRAP.md`](BOOTSTRAP.md) is written for a stock agent with no framework
> skills. It does what it can — installing skills, reading the playbook — then
> reports precisely what still needs you. Steps 1 and 5 below are always yours:
> enabling spawning and creating agents are UI actions no agent can perform.

---

## Prerequisites

| Requirement | Check |
|---|---|
| Munder Difflin installed and onboarded | The app opens and shows a floor |
| A hive with at least one agent | `./bin/install-skills.sh --agents` |
| `python3` on PATH | Used to read `config.json` |

The install script finds your hive from
`~/Library/Application Support/munder-difflin/config.json`. Override with
`MUNDER_HARNESS_HOME` if needed.

---

## Step 1 — Enable spawning

**Settings → Autonomy & Budgets → enable `orchestratorMaySpawn`.**

It is **off by default**. Until it is on, Michael cannot spawn workers — spawn
requests sit in `spawn-requests/` without failing, which looks like nothing
happening.

This is a token-spend control, so it is yours to enable deliberately. Nothing
here changes it for you.

While you are there, check `maxConcurrentWorkers` (default 4). Plans should not
assume more parallelism than this.

---

## Step 2 — Verify the script sees your hive

```bash
./bin/install-skills.sh --agents
```

You should see your existing agent IDs. Note they carry generated suffixes when
created through the UI:

```
god
jim-mt5tofsm
pam-mt5znwg6
```

**Use the real ID, not the clean name from `agents/*.md`.** The roster entries in
this repo show the shape; the harness assigns the actual id.

---

## Step 3 — Set up Michael first

Michael is the orchestrator and usually already exists as `god`.

```bash
./bin/install-skills.sh god \
  requirements-analysis task-decomposition dependency-analysis \
  change-impact-analysis implementation-plan technical-debt \
  project-roadmap project-business-rules
```

Restart the agent so Claude Code picks up the skills, then tell Michael:

> Read GOD-PLAYBOOK.md in the framework repo, then PROTOCOL.md in the hive root.
> Confirm you understand Phase 0 and the escalation list before doing anything
> else.

`GOD-PLAYBOOK.md` is the routing authority. Everything else follows from it.

---

## Step 4 — Run Phase 0 before anything else

**This is blocking.** Until the ten `project-*` knowledge documents exist, every
engineering agent stays read-only.

Create `architect` and `feature-planner` (roster entries are in
`agents/management/`), install their skills, and have them produce
`docs/project-knowledge/` in the IMPOC repo.

Michael has the full sequence in `GOD-PLAYBOOK.md` §2. In short:

1. Read the repository first — every claim cites a file path
2. Mark each statement `[verified]`, `[inferred]`, or `[assumed]`
3. **Batch every `[assumed]` question and ask you once**
4. Do not proceed until documents 4–8 have **zero `[assumed]` items** on money,
   stock, or access rules

Expect to answer a batch of questions about pricing, discounts, void and refund
rules, and permissions. That conversation **is** Phase 0 — it cannot be
reconstructed from the code.

---

## Step 5 — Add agents as you need them

Create the agent in the UI (or add to `roster.json`) using the entry in
`agents/<category>/<name>.md`, then install its skills — each file lists the
exact command.

```bash
./bin/install-skills.sh backend-engineer-abc123 \
  nodejs javascript express sequelize rest-api error-handling \
  authentication authorization logging configuration backend-testing \
  input-validation transactions concurrency query-optimization \
  project-api project-database project-business-rules
```

**Spawn lazily.** Create agents when the work needs them, not up front. Idle
agents burn tokens and add noise to the floor.

---

## Useful commands

```bash
./bin/install-skills.sh --list                 # all 170 skills by category
./bin/install-skills.sh --agents               # agents in your hive
./bin/install-skills.sh --installed god        # what an agent already has
./bin/install-skills.sh --dry-run god adr      # preview without writing
```

The script only ever writes inside an agent's `.claude/skills/` directory. It
never touches `roster.json`, `identity.md`, `memory.md`, inboxes, or anything
else in the hive.

---

## How much to install

Every installed skill consumes context on every session. An agent with sixty
skills reads worse than one with twelve.

Install what the agent's file lists. Add more only when a specific gap appears —
and remove skills that turn out not to be used.

---

## Verifying it worked

```bash
./bin/install-skills.sh --installed god
```

Then ask the agent directly:

> What skills do you have available? List them.

If a skill does not appear, the agent has not been restarted since installation.

---

## When something is not working

| Symptom | Cause |
|---|---|
| Spawn requests sit in `spawn-requests/` | `orchestratorMaySpawn` is off — Step 1 |
| Agent does not know about a skill | Not restarted since install |
| `agent "x" not found in the hive` | Use the real suffixed id from `--agents` |
| `could not determine harnessHome` | Set `MUNDER_HARNESS_HOME` |
| Agent invents business rules | Phase 0 incomplete — it is blocking for a reason |
| Two agents reply forever | An `inform`/`done` was replied to. Only `request`, `query`, `propose` expect replies |
| Circuit breaker message in an inbox | That agent **is** the problem it caught. `constrain` means read-only until Michael signs off |

---

## Adapting to another project

The `main` branch is generic greyfield. For a different domain:

1. Branch
2. Replace the domain skills — `project-inventory-rules`, `project-pos-rules`,
   `project-pricing-rules` — with that domain's equivalents
3. Replace or drop the retail-specific categories (`business-analytics`,
   `retail`, `marketing`, `customer-intelligence`)
4. Keep everything else — security, database, engineering, architecture,
   planning, QA, and performance are domain-independent

The universal `project-*` discovery skills work on any codebase unchanged.

---

## Adding your own skills

Use `templates/skill-template.md`. Two rules:

- **The directory name must equal the frontmatter `name`** — flat namespace, so
  check the name is not already taken
- **Verify your grep commands against the real codebase.** This project is
  vanilla JS: globs are `*.js` and `*.jsx`, never `*.ts`

And follow the citation convention: cite sources specifically, and label what is
original. It is what makes the rest trustworthy.
