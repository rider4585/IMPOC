---
name: ux-research
version: 1.0.0
description: |
  Learn what users actually do and need — choosing a method, observing real work,
  usability testing, and turning findings into design decisions. Use before
  designing a significant feature, when a feature is not being used, or when
  asked "what do users actually need here".
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
---

## UX Research

Research replaces assumption with evidence. In a retail system the highest-value
research is not a survey — it is **watching one shift**.

Staff adapt around software constantly, and their workarounds are the most
honest specification available: a laminated card next to the till, a notebook of
prices, a habit of voiding and re-scanning. Each one marks a design failure with
its cause attached.

### Pick the method by question

| Question | Method |
|---|---|
| What do they actually do? | **Observation** — watch a shift |
| Why do they do it that way? | Contextual interview, during or right after |
| Can they use this design? | Usability test, 5 users |
| Which of two designs works better? | Comparative usability test |
| How often does this happen? | Analytics or a data query |
| What do they say they want? | Interview — treat as a signal, not a spec |

**Never take a stated preference as a requirement.** People report what they
think they should say, and cannot reliably predict their own behaviour. What they
*do* is the data; what they say is a lead to investigate.

### Observation is the highest-value method here

Sit at the counter during a busy period and record what happens, without helping.

Look specifically for:

- **Workarounds** — anything on paper, any note taped to the terminal
- **Hesitations** — where the operator pauses to think
- **Repeated actions** — the same tap sequence over and over
- **Errors and recoveries** — what goes wrong, and how they fix it
- **Interruptions** — a phone call, a question, a queue mid-sale
- **Environment** — lighting, noise, counter space, one-handed moments
- **Speed pressure** — how behaviour changes when a queue forms

Record what happened, not your interpretation. "Voided and re-scanned three times
in an hour" is data; "the void flow is confusing" is a hypothesis to test.

Two hours of this typically outperforms weeks of speculation.

### Usability testing

Five participants find most of the problems in a given design, so run small tests
often rather than one large one late.

**Do:**
- Give a **task**, not instructions: "a customer wants to return one of these two
  items" — not "click Refund"
- Ask them to think aloud
- Stay quiet; silence is where you learn
- Watch what they do before what they say
- Test on the real device, in a realistic setting

**Do not:**
- Lead — "was that easy?" invites agreement
- Explain when they get stuck; the sticking point is the finding
- Test only the happy path — errors and edge cases are where friction lives
- Treat participants as the problem when they struggle

### Analytics answer frequency, not why

Use data to size a problem observation has revealed:

```sql
-- How often are sales voided, and by whom?
SELECT u.role, count(*) AS voids, count(*) FILTER (WHERE a.reason IS NULL) AS no_reason
FROM audit_log a JOIN "user" u ON u.id = a.actor_id
WHERE a.action = 'void' AND a.created_at > now() - interval '30 days'
GROUP BY u.role ORDER BY voids DESC;

-- Products repeatedly adjusted — a data quality or process problem
SELECT product_id, count(*) FROM stock_movement
WHERE type = 'adjustment' AND created_at > now() - interval '90 days'
GROUP BY 1 HAVING count(*) > 5 ORDER BY 2 DESC;
```

A high void rate is a question, not an answer. Observation tells you whether it is
a confusing flow, a scanner problem, or a legitimate business pattern.

### Understand the roles separately

Cashier, manager, and owner use this system for different purposes, under
different pressure, with different expertise. Research the role whose task you are
designing for — a report designed from a cashier's needs will not serve an owner,
and vice versa.

### Turn findings into decisions

A finding that does not change a decision was not worth gathering.

```markdown
## Finding: operators void and re-scan to correct a quantity

**Evidence** Observed 3× in 90 minutes (2 operators); confirmed in audit data —
             void rate 4.2% of sales, 68% with no reason recorded
**Why**      Line quantity cannot be edited after the next item is scanned
**Impact**   Inflated void rate obscures genuine voids; the audit trail for
             real corrections is unusable
**Decision** Allow inline quantity editing on any line until payment
**Confidence** High — direct observation plus supporting data
```

Route findings that change requirements back to `requirements-analysis`, and
those that reveal audit-trail damage to `michael` — an unusable audit trail is a
control failure, not just friction.

### Checklist

- [ ] Question stated before the method is chosen
- [ ] Method matched to the question
- [ ] Observation used before speculation
- [ ] Workarounds catalogued
- [ ] Behaviour recorded separately from interpretation
- [ ] Stated preferences treated as leads, not requirements
- [ ] Usability tests use tasks, not instructions
- [ ] Tested on the real device in a realistic setting
- [ ] Error paths tested, not only the happy path
- [ ] Analytics used to size, not to explain
- [ ] Roles researched separately
- [ ] Every finding paired with a decision and a confidence level
- [ ] Findings affecting requirements or audit routed onward

## References

- **Nielsen Norman Group — Why You Only Need to Test with 5 Users**
  <https://www.nngroup.com/articles/why-you-only-need-to-test-with-5-users/>
- **Nielsen Norman Group — Usability Testing 101; Field Studies**
  <https://www.nngroup.com/articles/usability-testing-101/>
- **Steve Krug, _Rocket Surgery Made Easy_** — lightweight, frequent testing
- **Erika Hall, _Just Enough Research_** — method selection and the limits of
  stated preference
- **Beyer & Holtzblatt, _Contextual Design_** — observing work in its real
  setting

**Not sourced — written for this framework:** the retail observation checklist,
workarounds-as-specification, the analytics queries, the role separation, and the
finding template with routing.
