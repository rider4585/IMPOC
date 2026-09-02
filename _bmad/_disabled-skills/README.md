# Disabled BMad skills

These 20 skills are BMad v6 deprecation shims. Every one is either a thin
forwarder to its replacement, or (for `bmad-create-story` and `bmad-dev-story`)
a full workflow that `bmad-build` has replaced.

They were moved out of `.claude/skills/` on 2026-08-24 to cut token cost. Every
skill in `.claude/skills/` is listed in the system prompt of every API call, in
every session and every subagent. These 20 added ~465 tokens to each call. Story
1.2 made 328 calls, so they cost ~150,000 tokens for that one story while doing
nothing.

Nothing calls these directories. The only references from live skills are in
comments and prose (`bmad-prd/SKILL.md`, `bmad-sprint-planning/scripts/sprint_plan.py`,
three `customize.toml` files).

**These are the only copies on disk.** `_bmad/bmm/v6-shims/` and
`_bmad/core/v6-shims/` hold a README only — not the skill sources. Do not delete
this folder unless you are sure you will never want them back.

To restore one:

    mv _bmad/_disabled-skills/<name> .claude/skills/<name>

A BMad reinstall or update will likely put them back in `.claude/skills/`. If it
does, re-run the move.
