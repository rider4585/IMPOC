# Skill Template

Copy the block below to `skills/<category>/<skill-name>/SKILL.md`.

The format is **Claude Code's native `SKILL.md`**, which is what Munder Difflin
installs into `agents/<id>/.claude/skills/<skill-name>/SKILL.md`. Verified
against the skills shipped with the harness.

> ⚠️ **Verified against Munder Difflin v0.4.5 on 2026-09-06. This is a snapshot,
> not a contract.**
>
> Confirm the location and frontmatter against a skill the harness itself ships
> before adding new ones:
>
> ```bash
> ls "$HARNESS_HOME/hive/agents/god/.claude/skills/"
> head -20 "$HARNESS_HOME/hive/agents/god/.claude/skills/md-hive-sync/SKILL.md"
> ```
>
> **If the location or frontmatter has changed, the harness wins.** The *content*
> of a skill is independent of its packaging — repackage it and update this
> template. Do not keep writing files the harness can no longer load.

> **The directory name must equal the `name` in the frontmatter.** Skill names
> live in a flat namespace, so a name used twice collides — check before adding.

---

```markdown
---
name: skill-name
version: 1.0.0
description: |
  What capability this grants, in one or two sentences. Then the trigger
  phrases: "Use when asked to X", "Use when Y happens", or "Use before Z".
  The description is how the agent decides whether to load this skill, so
  write the triggers concretely — vague descriptions never fire.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Skill Name

One paragraph: what this is for and the single most important idea in it.

> **Before running anything:** any prerequisite skill to load first, or context
> the agent must have. Omit if there is none.

### Method

The executable procedure. Numbered where order matters.

1. **Step** — what to do and what to look at
2. **Step** — with a concrete command or query where it helps

```bash
grep -rn "pattern" src/ --include=*.js
```

### <Domain section>

The substance of the skill — tables, code examples, decision rules. This is
where the value is. Prefer:

- A table when the reader is choosing between options
- A code example when there is a right and a wrong way
- A rule with its rationale, not a rule alone

### Caveats

What makes this analysis or technique wrong, and what to disclose.

### Checklist

- [ ] Verifiable item
- [ ] Verifiable item

## References

- **Source** — what specifically came from it
  <https://example.com>

**Not sourced — written for this framework:** the parts that are original, named
explicitly.
```

---

## Conventions this framework follows

**Frontmatter**
- `name` matches the directory exactly
- `version` starts at `1.0.0`; bump on meaningful change
- `description` uses a block scalar and states trigger phrases
- `allowed-tools` lists only what the skill actually needs

**Body**
- Stack-agnostic principles first; the current stack as a worked example
- Tables where the reader is choosing; code where there is a right way
- Real commands that would match this codebase — verify globs against actual
  file extensions before shipping
- A `Caveats` section wherever the method can mislead
- A `Checklist` that is verifiable, not aspirational

**References — required**
- Every skill cites its sources specifically ("§4 Access Control", not just
  "OWASP")
- Every skill ends with a **"Not sourced — written for this framework"** note
  naming what is original

That last convention is the important one. It lets a reader tell established
practice from this framework's opinions, and it is why nothing here should be
taken on trust without the citation.

## Before adding a skill

- [ ] Name is unique across all categories (flat namespace)
- [ ] Directory name equals frontmatter `name`
- [ ] Description states concrete triggers
- [ ] Commands verified against the real codebase's file extensions
- [ ] Sources cited specifically
- [ ] Original content labelled
- [ ] Cross-references point at skills that exist
