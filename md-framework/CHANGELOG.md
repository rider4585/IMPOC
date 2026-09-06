# Changelog

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [Semantic Versioning](https://semver.org/).

## [1.0.0] — 2026-09-06

First complete release. 170 skills, 23 agents, orchestrator playbook, and
install tooling.

### Added

**Skills (170)** across fifteen categories: project-knowledge (10), security
(29), postgresql (15), qa-testing (15), business-analytics (14), react-frontend
(13), nodejs-backend (11), architecture (10), uiux (9), planning (8),
customer-intelligence (8), retail (8), design-system (7), marketing (7),
performance (6).

**Agents (23)** across six categories, each with a roster entry, spawn objective,
and curated skill manifest. Every skill is assigned to at least one agent.

**`GOD-PLAYBOOK.md`** — orchestrator routing authority written against the live
hive protocol: `board.md` scribe rules, `tasks.json`, outbox verb set,
`spawn-requests/`, `fleet.json`, and the circuit breaker.

**`bin/install-skills.sh`** — installs skills into an agent's `.claude/skills/`.
Resolves the hive from `config.json`; writes only inside the target skills
directory.

**`README.md`**, **`QUICKSTART.md`**, and templates for both file types.

### Formats

Verified against a live Munder Difflin install rather than assumed:

- `identity.md` is harness-written and read-only; agent expertise lives in
  installed skills plus the spawn `objective`
- Skills use Claude Code's native `SKILL.md` in a flat namespace, so shared
  skills exist once rather than being duplicated per category
- Messages use the fixed `act` verb set; only `request`, `query`, and `propose`
  expect replies

### Conventions

- Every skill cites sources specifically and ends with a
  "Not sourced — written for this framework" note naming what is original
- Skills are stack-agnostic in principle with the current stack as the worked
  example, so adopting Tailwind or shadcn/ui extends rather than invalidates them
- Business skills require `project-database` to be loaded before their SQL is run

### Fixed during development

- Corrected 84 grep globs from `*.ts`/`*.tsx` to `*.js`/`*.jsx` — as written they
  would not have matched a single file in IMPOC
- Replaced Prisma examples with Sequelize, and NestJS/class-validator references
  with Express 5 and Zod, after verifying the stack from `package.json`
- Generalised `project-design-system` token discovery to cover CSS custom
  properties, utility frameworks, and component libraries
