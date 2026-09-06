# munder-difflin-agents

A production-grade agent and skill framework for the
[Munder Difflin](https://github.com/chaitanyagiri/munder-difflin) multi-agent
harness, built for **IMPOC** — an inventory management and point-of-sale system.

**170 skills · 23 agents · one orchestrator playbook**

---

## What this is

Munder Difflin ships with generic preconfigured agents. This replaces them with a
specialised team: security reviewers that know what a POS is, engineers that know
this stack, and analysts that know retail — each carrying a curated skill set.

It is written to be **reusable**. This branch (`MD_IMPOC`) is the retail /
point-of-sale implementation; a project in a different domain gets its own
branch, keeping the domain-independent skills and swapping the domain-specific
ones. `main` holds project information only.

## ⚠️ Formats are a snapshot, not a contract

Every harness-facing format in this repository — roster entries, spawn requests,
skill locations, message verbs — was verified against **Munder Difflin v0.4.5**
on **2026-09-06** by reading a live install.

**Munder Difflin is under active development.** If its file layout or formats
change, do not apply this repository as written. The harness ships its own
`PROTOCOL.md` and `COMMANDS.md` in the hive root, and **those update with the
app** — where they disagree with anything here, the harness wins.

The right response to drift is to **translate, not force**: the 170 skills and 23
agent briefs are documents, and their *content* is independent of how the harness
packages them. Repackage into the current format, then correct this repo.

`BOOTSTRAP.md` Step 0 makes an agent verify this before it uses any format, with
a specific checklist.

## Two constraints that shaped everything

Both were discovered by reading a live Munder Difflin install rather than
assuming — worth knowing before you extend this.

*(Verified at v0.4.5 — re-check them if the harness has moved on.)*

**1. `identity.md` is written by the harness and is read-only.**
You cannot hand-author an agent's persona. The harness builds it from the
`roster.json` entry's `name`, `description`, and `capabilities`. An agent's
expertise therefore comes from **the skills installed into its
`.claude/skills/`** plus **the `objective` given at spawn time**. That is why
this repo is mostly skills.

**2. Skills are Claude Code's native `SKILL.md` format**, in a **flat
namespace** — `agents/<id>/.claude/skills/<name>/SKILL.md`. Names must be
globally unique, which is why shared skills like `input-validation` and
`customer-segmentation` exist once and are referenced by several agents rather
than duplicated.

## Layout

```
munder-difflin-agents/
├── BOOTSTRAP.md             ← point a fresh god agent here to self-install
├── GOD-PLAYBOOK.md          ← Michael reads this every session
├── QUICKSTART.md            ← human setup guide
├── agents/<category>/*.md   ← 23 agents: roster entry, skills, objective
├── skills/<category>/<name>/SKILL.md   ← 170 skills
├── templates/               ← agent and skill templates
└── bin/install-skills.sh    ← installs skills into an agent
```

**Two ways in.** Follow [`QUICKSTART.md`](QUICKSTART.md) yourself, or clone the
repo and tell your god agent:

> Read `BOOTSTRAP.md` in the framework repo and work through it.

[`BOOTSTRAP.md`](BOOTSTRAP.md) is written for a **stock agent with no framework skills** — it
assumes nothing, and ends by reporting exactly what still needs you. A full
self-install is not possible: enabling spawning and creating agents are UI
actions.

## The team

| Category | Agents |
|---|---|
| **Management** | `michael` (CTO/orchestrator) · `architect` · `feature-planner` |
| **Security** | `security-lead` · `code-security-reviewer` · `api-security-reviewer` · `dependency-auditor` · `threat-modeler` · `security-verifier` |
| **Engineering** | `backend-engineer` · `postgres-specialist` · `frontend-engineer` · `frontend-reviewer` |
| **UI/UX** | `uiux-designer` · `design-system-guardian` |
| **Quality** | `qa-engineer` · `e2e-tester` · `performance-engineer` |
| **Business Intelligence** | `sales-analyst` · `inventory-analyst` · `customer-feedback-analyst` · `campaign-strategist` · `retail-strategist` |

Security is deliberately six agents. In a system that handles money, stock, and
staff access, review is not a single lane — and the agent that writes a fix never
verifies it.

## The skills

| Category | # | Covers |
|---|---|---|
| `project-knowledge` | 10 | Greyfield discovery — architecture, schema, API, business rules |
| `security` | 29 | OWASP Top 10, API Top 10, threat modeling, supply chain |
| `postgresql` | 15 | Schema, indexing, transactions, concurrency, safe migrations |
| `qa-testing` | 15 | Strategy, levels, Playwright, defect analysis |
| `business-analytics` | 14 | Sales, margin, turnover, velocity, forecasting |
| `react-frontend` | 13 | React 19, state, forms, routing, styling, testing |
| `nodejs-backend` | 11 | Express 5, Sequelize, auth, logging, config |
| `architecture` | 10 | Boundaries, contracts, scale, ADRs, debt |
| `uiux` | 9 | Research, flows, hierarchy, accessibility, review |
| `planning` | 8 | Requirements, slicing, acceptance criteria, impact |
| `customer-intelligence` | 8 | Feedback, segmentation, retention, preferences |
| `retail` | 8 | Pricing, discounting, merchandising, growth |
| `design-system` | 7 | Tokens, typography, colour, spacing, audit |
| `marketing` | 7 | Campaigns, offers, WhatsApp, ROI |
| `performance` | 6 | Frontend, backend, latency, caching, load |

`./bin/install-skills.sh --list` prints the full index.

## Conventions

Every skill:

- Cites its sources **specifically** — "OWASP ASVS 4.0 §V4", not "OWASP"
- Ends with a **"Not sourced — written for this framework"** note naming what is
  original

That second convention is the important one: it lets you tell established
practice from this framework's opinions, and nothing here asks to be taken on
trust without a citation.

Skills are written **stack-agnostically** with the current stack as the worked
example, so adopting Tailwind or shadcn/ui adds a row to a table rather than
invalidating the guidance.

## The rules that recur

These appear throughout because they are what a POS gets wrong expensively:

- **Money is integer minor units or decimal strings.** Never float, never
  `parseFloat` on a `DECIMAL`, never `quantity || 1`
- **Stock and money changes are atomic** — a guarded single-statement update
  inside a transaction, with an audit record written in the same transaction
- **Object-level authorisation in the query**, not after it. Foreign records
  return `404`, not `403`
- **Never cache anything gating a money or stock decision**
- **Nothing `[assumed]` about money, stock, or access reaches an engineer**
- **The agent that writes a fix never verifies it**
- **A till is a large touch screen** — wide viewport, mobile interaction rules

## Current stack

Verified from IMPOC's `package.json`, not assumed:

**Backend** — ESM, vanilla JS · Express 5 · Sequelize 6 · PostgreSQL · Zod 4 ·
argon2 · Jest + supertest
**Frontend** — ESM, vanilla JS · React 19 · react-router-dom 6 · axios · Vite 8 ·
Vitest + Testing Library · `@zxing` (barcode) · `@fontsource` fonts

No TypeScript. No Tailwind yet — planned, and the design-system skills are
written for that transition.

## Getting started

See **[QUICKSTART.md](QUICKSTART.md)**. The short version:

```bash
./bin/install-skills.sh --agents          # what's in your hive
./bin/install-skills.sh --list            # what's available
./bin/install-skills.sh god requirements-analysis task-decomposition
```

Then have Michael read `GOD-PLAYBOOK.md`.

**Before anything works:** enable `orchestratorMaySpawn` in
Settings → Autonomy & Budgets. It is off by default, and without it Michael
cannot spawn.

## Phase 0 is blocking

The framework assumes a **greyfield** reality. Until the ten `project-*`
knowledge skills have been run and contain no `[assumed]` items on money, stock,
or access rules, **every engineering agent is read-only**.

This is deliberate and it is the rule most likely to be argued with. Agents that
guess at conventions produce plausible code that quietly violates the system.

## Licence

Private. Not for redistribution.
