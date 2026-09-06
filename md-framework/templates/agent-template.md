# Agent Template

Copy this to `agents/<category>/<name>.md`. The formats below match what the
Munder Difflin harness actually reads — verified from a live install, not
invented.

> ⚠️ **Verified against Munder Difflin v0.4.5 on 2026-09-06. This is a snapshot,
> not a contract.**
>
> Before relying on any format here, check it against the live install — the
> harness ships `PROTOCOL.md` and `COMMANDS.md` in the hive root, and those
> update with the app:
>
> ```bash
> cat "$HARNESS_HOME/hive/PROTOCOL.md"
> cat "$HARNESS_HOME/roster.json" | head -30
> ls "$HARNESS_HOME/hive/agents/<some-agent>/"
> ```
>
> **If they disagree, the harness wins.** Translate this framework's content into
> the harness's current format rather than forcing the shape written below, and
> update this template so the next person is not misled.

> **Key constraint:** `agents/<id>/identity.md` in the hive is **written by the
> harness and is read-only**. You cannot hand-author an agent's persona there.
> The harness builds it from the roster entry's `name`, `description` (which
> becomes the `role` line), and `capabilities`.
>
> An agent's expertise therefore comes from two places: **the skills installed
> into its `.claude/skills/`**, and **the `objective` given at spawn time**.
> Write those carefully; they are the whole agent.

---

## Roster entry

Add to `<harnessHome>/roster.json` under `agents`, or create through the UI.

```json
{
  "id": "agent-id",
  "name": "DisplayName",
  "character": "office-cast-name",
  "accent": "sky",
  "description": "one line — becomes the role in identity.md",
  "project": "IMPOC",
  "tmuxTarget": "",
  "cwd": "/absolute/path/to/repo",
  "status": "idle",
  "action": "awaiting",
  "progress": 0,
  "currentStation": "desk",
  "ptyId": "pty-agent-id",
  "command": "claude --model claude-sonnet-5",
  "provider": "claude",
  "model": "claude-sonnet-5",
  "archived": false
}
```

**Fields that matter:**

| Field | Note |
|---|---|
| `description` | Becomes the agent's `role`. Keep it precise — the agent reads it |
| `character` | An Office cast name sets the avatar. Unrecognised values fall back rather than failing |
| `accent` | Desk colour only |
| `cwd` | The repository the agent works in |
| `provider` / `model` | Must match the `command` |

## Spawn request

For an ephemeral worker, write one JSON file to
`<hive>/spawn-requests/<id>.json`. Required: `objective` and `cwd`.

```json
{
  "objective": "What this worker must accomplish. Be specific — this is the agent's brief and it substitutes for a persona file.",
  "cwd": "/absolute/path/to/repo",
  "name": "DisplayName",
  "command": "claude --model claude-sonnet-5",
  "provider": "claude",
  "model": "claude-sonnet-5",
  "isolate": true,
  "tokenCap": 0,
  "character": "office-cast-name",
  "accent": "sky"
}
```

`isolate: true` gives the worker its own git worktree. The harness moves the
request to `.done/` on success or `.failed/` with a reason.

**This route requires `orchestratorMaySpawn` to be enabled** in
Settings → Autonomy & Budgets. It is off by default. While off, requests wait in
the directory rather than failing.

## Skills

List the skills to install into this agent's `.claude/skills/`. Install with:

```bash
./bin/install-skills.sh <agent-id> <skill> [skill ...]
```

| Skill | Why this agent needs it |
|-------|-------------------------|
| `skill-name` | reason |

Keep the list tight. Every installed skill consumes context on every session; an
agent with sixty skills reads worse than one with twelve.

## Objective text

The reusable brief for spawning this agent. Written in second person, concrete,
and bounded.

```
You are <role> for the IMPOC project (inventory management and point of sale).

<What you own, in one or two sentences.>

<The two or three operating rules that matter most for this role.>

<What you produce, and where it goes.>

Read your inbox and memory.md first (see PROTOCOL.md). Report findings to god
via your outbox. Do not <the boundary this agent must not cross>.
```

## Handoffs

| To | When | Message `act` |
|----|------|---------------|
| `god` | Escalation or completion | `inform` / `propose` |
| `other-agent` | Work continues elsewhere | `request` |

Valid `act` verbs are fixed: `request`, `inform`, `propose`, `query`, `agree`,
`refuse`, `done`. Only `request`, `query`, and `propose` expect a reply.

## Definition of done

- [ ] Verifiable condition
