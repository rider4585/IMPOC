---
name: project-architecture
version: 1.0.0
description: |
  Reverse-engineer and document the architecture of an unfamiliar (greyfield)
  codebase: entry points, module graph, layering, external dependencies, and
  deployment topology. Produces docs/project-knowledge/architecture.md with every
  claim cited to a file path and marked verified/inferred/assumed.
  Use when asked to "map the architecture", "how is this project structured",
  "document the system", "onboard onto this codebase", or when starting Phase 0
  discovery on a project with no architecture documentation.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Project Architecture Discovery

Document the system as it **actually is**, not as it should be. You are reading a
running system; your opinions about it belong in a separate review.

### Confidence marking (mandatory)

Tag every statement:

- `[verified]` — you read it in code. Cite `path/to/file.ts:42`.
- `[inferred]` — deduced from a consistent pattern. Say what pattern.
- `[assumed]` — you are guessing. It goes in **Open Questions**, never in the body as fact.

An unmarked claim is a defect. If you cannot cite it, you did not verify it.

### Method

1. **Establish the perimeter.** Read `package.json`, `tsconfig.json`, `docker-compose.yml`,
   `Dockerfile`, CI config, and any `.env.example`. These name the runtimes, the
   services, and the external systems before you read a line of application code.

2. **Find the entry points.** Every process has one. Look for `main`, `index`,
   `server`, `app`, `bootstrap`, and the `scripts` block in `package.json`.
   ```bash
   ls -1 src/{main,index,server,app}.* 2>/dev/null
   grep -n '"scripts"' -A 20 package.json
   ```
   List each executable: what starts it, what port it binds, what it serves.

3. **Map the module graph.** Enumerate top-level source directories and classify
   each by the business capability it owns — not by technical layer. A directory
   you can only describe as "utils" or "common" is a finding, not a module.

4. **Trace one request end to end.** Pick a single real endpoint and follow it:
   route → middleware → controller → service → data access → response. Write the
   chain down with file paths. This one trace reveals the layering convention more
   reliably than reading twenty files.

5. **Identify data ownership.** For each module, which tables does it *write*?
   Cross-module writes to the same table are the most important architectural
   fact you can record — note every one you find.

6. **Catalogue external dependencies.** Databases, caches, queues, payment
   providers, mail, storage, third-party APIs. For each: what calls it, what
   happens when it is down, and whether that failure path exists in code.

7. **Record the deployment topology.** How it builds, where it runs, what
   environment variables it requires, and how many instances. If you cannot
   determine this from the repo, it is an Open Question — do not guess.

### Output

Write `docs/project-knowledge/architecture.md`, following arc42 section ordering:

```markdown
# Architecture

## 1. Context            — the system, its users, and neighbouring systems
## 2. Runtimes           — each deployable process, its entry point and port
## 3. Modules            — capability, owner, key paths, tables written
## 4. Request Trace      — one endpoint, end to end, with file:line
## 5. Data Ownership     — table → owning module (flag shared writers)
## 6. External Systems   — dependency, caller, failure behaviour
## 7. Deployment         — build, runtime, configuration
## 8. Observations       — surprises, risks, inconsistencies
## Open Questions        — every [assumed] item, as a question for the human
```

### Finishing

- Append durable facts to `$AGENT_DIR/memory.md` so future sessions inherit them.
- `propose` the Open Questions to `god` in one batch — do not trickle them out
  individually.
- If this document already exists and the code contradicts it, **the code wins**.
  Correct the document and note the drift.

## References

- **arc42** architecture documentation template — section structure (§1–§7 above)
  <https://arc42.org/overview>
- **C4 model**, Simon Brown — context/container/component levels informing steps 1–3
  <https://c4model.com>
- **Michael Feathers, _Working Effectively with Legacy Code_** — the single-trace
  characterization technique in step 4
- **Munder Difflin `PROTOCOL.md`** (hive root) — `memory.md` write-back and the
  `propose`-to-god handoff in *Finishing*

**Not sourced — added deliberately:** the `verified / inferred / assumed`
confidence marking. This is a greyfield safety rail, not a published standard.
