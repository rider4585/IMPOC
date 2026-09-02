<!-- bmad:context -->
<!-- Verified 2026-08-19. No VCS in this repo yet (not a git repository) — re-verify against the initial commit SHA once one exists. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## IMPOC

Inventory, POS, and rental management for SHREE Fashion Store — a women's clothing and imitation-jewellery shop that both sells and rents. Node/Express + Sequelize/Postgres API in `backend/`, React 19 + Vite SPA in `frontend/`. Every physical item ("unit") carries its own unique Code 128 barcode, and scanning it drives intake, sale, rental, and return. No root `package.json` — the two sides build and run independently.

## Policy

- Never commit `.env` — it holds real DB credentials and JWT secrets. No `.gitignore` exists yet; add one covering `.env` and `node_modules` before this becomes a git repo.

## Where things are

- Backend API: `backend/AGENTS.md`
- Frontend SPA: `frontend/AGENTS.md`

## Conventions that differ from defaults

- Store money as integer paise, never floats or decimals.
- Snapshot prices onto the row recording the event — a unit copies its prices at intake, a sale or rental line copies the transacted price at checkout. Editing a source record must never alter history.
- Never UPDATE a completed sale, rental, or expense; record a reversing row instead.
- Derive overdue status and maximum rental period from dates and deposit; never store them.
- Online-only by design — do not add service workers, offline queues, or sync layers.

<!-- /bmad:context -->

## Token discipline (read before running a story)

Measured on Story 1.2 (24 Aug 2026): 328 API calls, 22.9M input tokens, ~₹2,590,
to produce one 10-line migration file. Output was 1.2% of that. The cost is not
what gets written — it is how many times we hit send, because every call re-reads
the whole conversation.

Every API call starts at ~41,000 tokens in the main chat and ~34,000 in a
subagent, before doing any work. On Story 1.2 that boot-up load, re-read, was 53%
of the entire bill. You cannot shrink it. So the only lever is **fewer calls**.

### Batch every shell command

One shell call cost an average of 63,000 tokens on Story 1.2, and 98,000 in the
main chat. Four `cat`s in a row cost four times what one `cat` printing four
files costs, for an identical result.

- Combine reads: `cat a.js; echo ---; cat b.js` — not two calls.
- Combine a check with its fix: run the grep and the `sed` in one call.
- Never iterate on a throwaway script across calls. Write it once, run it once.
  On Story 1.2 four consecutive tries at one temp script cost ~440,000 tokens.
- Run independent tool calls in the same message when the harness allows it.

### Verification is ONE script, ONE table

Do not walk an I/O matrix row by row across separate calls. Write a single
script that runs every row, then prints one table. Story 1.2 ran ~20 round trips
for 13 matrix rows plus 9 acceptance checks; one script would have been ~4.

    cd backend && cat > /tmp/verify.mjs <<'JS'
    ... every check, each printing "ROW n | expected | observed | PASS/FAIL"
    JS
    node /tmp/verify.mjs; rm /tmp/verify.mjs

Paste the printed table into the spec's Verification section as-is.

### Review the spec, not the code

On Story 1.2 the three review agents ran after the migration was written. They
found a real spec bug (`CREATE SEQUENCE IF NOT EXISTS` would silently adopt a
wrong sequence). The file was then deleted, rewritten, and re-reviewed:
4.9M tokens, 21% of the story, for zero extra quality.

Run the review lenses against the spec BEFORE spawning the implement agent. The
same bug surfaces at the same depth, without the rewrite round.

### Size the helper agents to the job

Each subagent boots at ~34,000 tokens. On Story 1.2 the two edge-case agents made
4 calls each and spent 94% of their tokens just starting up.

- One new file with no callers and nothing importing it is zero blast radius —
  take `bmad-build`'s `step-oneshot` route, or run one review lens, not three.
- Do not spawn an agent for work that is two shell commands.
- Give an agent the facts it needs in the prompt. Making it rediscover context
  costs more than pasting it.

### Keep the spec inside 1,600 tokens

BMad's own SCOPE STANDARD is 900–1,600. The Story 1.2 spec reached 21 KB
(~5,300 tokens), was rewritten in full three times, and rode along in every
downstream agent's context. When `bmad-build` warns that the spec is over the
limit, cut it — do not wave it through.
