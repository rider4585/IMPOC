---
name: information-architecture
version: 1.0.0
description: |
  Organise content and navigation so people can find things — grouping,
  labelling, navigation structure, search, and disclosure. Use when adding a
  section, when features are hard to find, when navigation has grown unwieldy,
  or when asked "where should this live".
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
---

## Information Architecture

How content is organised, labelled, and navigated. Bad IA shows up as "I know it
exists but I can't find it" — and as features that are built, paid for, and never
used.

### Organise by task, not by database

The most common mistake is exposing the data model as the menu.

```
❌ mirrors the schema                ✅ mirrors the work
   Products                            Sell        (till, held sales, returns)
   Categories                          Stock       (levels, adjustments, transfers)
   Stock                               Catalogue   (products, categories, pricing)
   Stock Movements                     Reports     (sales, inventory, staff)
   Sales                               Settings
   Sale Lines
   Payments
```

Users think in tasks — "I need to adjust stock" — not in entities. Group by what
someone is trying to do.

### Label in the user's words

Use the vocabulary of the shop, not the codebase. "Stock take", not "inventory
reconciliation session". "Void", not "transaction reversal".

Test labels rather than debating them: give people a task and ask which menu item
they would choose. If they hesitate or pick wrong, the label is wrong — the label
is not "obvious", it is either understood or not.

Be consistent. If it is "Stock" in the menu it is "Stock" in the page title,
the breadcrumb, and the message text.

### Keep it shallow

Depth costs more than breadth. Each level is a decision and a chance to go wrong.

**Two levels for most things, three at the outside.** Anything reached in four
clicks may as well not exist.

Frequency drives placement:

| Frequency | Placement |
|---|---|
| Every sale | On the till screen itself — zero navigation |
| Many times a day | Top-level navigation |
| Daily | One level down |
| Weekly | Two levels down |
| Rare (year end) | Deep, but findable via search |

The till is not a menu item you visit — it is the default screen. Design
navigation around that rather than treating selling as one section among many.

### Group by relatedness

Around **five to nine** items per level. More than that and the group stops being
scannable; fewer, and the grouping may be unnecessary.

Group things that are used together, not things that are technically similar.
"Stock adjustments" belongs with stock, not with "all forms".

### Navigation patterns

| Pattern | Good for |
|---|---|
| Persistent sidebar | Desktop back-office with several sections |
| Top bar | Few sections, or a wide till screen |
| Bottom bar | Phone — thumb-reachable, 3–5 items |
| Contextual actions | Operations on the current object |
| Search | Large catalogues, and expert shortcuts |

**Always show where you are.** An active state in the navigation, and a
breadcrumb once past two levels.

### Search is navigation for experts

In a system with thousands of products, search is the primary way to find things —
not a fallback.

- Search **products** by name, SKU, and barcode, all in one field
- Return results fast enough to type through
- Show enough per result to choose: name, SKU, price, stock
- Handle no-results as a real state, with a next action
- Make it reachable by keyboard from anywhere

For a till, scanning is the fastest path and search is the fallback when a
barcode will not read. The fallback must be **fast**, not merely present — see
`ui-design`.

### Progressive disclosure

Show what is needed; keep the rest one interaction away.

- Summary first, detail on demand
- Advanced filters collapsed by default
- Rarely used settings in a secondary section
- Table row detail in an expandable row or side panel, not another page

This is what keeps dense screens usable — see the dashboard guidance in
`ui-design`.

### Test the structure

**Card sorting** — give people the list of features and let them group and name
the piles. Where they agree, you have your structure; where they scatter, the
concept itself is unclear.

**Tree testing** — give the navigation labels alone, no screens, and ask people
to find things. It isolates whether the *structure* works from whether the
*design* works, and it is fast.

### Retail specifics

- **The till is the home screen** for cashiers; the dashboard is home for owners.
  Landing page depends on role.
- **Role-based navigation** — hide what a cashier cannot use. A menu full of
  denied options is noise, though hiding is presentation, never access control
  (see `authorization`).
- **Reports need their own structure** — by question ("what sold?", "what is not
  moving?"), not by table.
- **Settings grow relentlessly.** Group them early — shop, tax, users, devices,
  integrations — or they become an unnavigable list.

### Checklist

- [ ] Organised by task, not by data model
- [ ] Labels use shop vocabulary and are consistent everywhere
- [ ] Labels tested, not debated
- [ ] Maximum two to three levels deep
- [ ] Placement matches frequency of use
- [ ] Five to nine items per group
- [ ] Current location always visible
- [ ] Search covers name, SKU, and barcode, and is fast
- [ ] No-results is a designed state
- [ ] Progressive disclosure used for detail and advanced options
- [ ] Structure validated by card sorting or tree testing
- [ ] Landing page appropriate to role
- [ ] Navigation filtered by role, with real authorisation server-side
- [ ] Reports organised by question
- [ ] Settings grouped before they sprawl

## References

- **Rosenfeld, Morville & Arango, _Information Architecture_** — organisation,
  labelling, navigation, and search systems
- **Nielsen Norman Group — Card Sorting and Tree Testing**
  <https://www.nngroup.com/articles/card-sorting-definition/>
- **Nielsen Norman Group — Progressive Disclosure**
  <https://www.nngroup.com/articles/progressive-disclosure/>
- **Cluster — Information Hierarchy in Dashboards** — grouping and disclosure in
  dense data screens <https://clusterdesign.io/information-hierarchy-in-dashboards/>
- **Agente Studio — POS design principles** — multiple lookup paths and reducing
  navigation for frequent actions
  <https://agentestudio.com/blog/design-principles-pos-interface>

**Not sourced — written for this framework:** the task-vs-schema menu comparison,
the frequency-to-placement table, the till-as-home-screen rule, and the retail
settings and reports guidance.
