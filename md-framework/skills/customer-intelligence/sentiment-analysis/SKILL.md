---
name: sentiment-analysis
version: 1.0.0
description: |
  Classify the tone of customer text and track it over time — labelling,
  aspect-level sentiment, and the limits of the method. Use when there is a
  volume of written feedback or reviews to make sense of, or when asked "is
  sentiment improving".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Sentiment Analysis

Classifying feedback as positive, negative, or neutral. Useful for spotting
direction across many items; weak at telling you what to do about any one of
them.

> **Before running anything:** load `project-database` and confirm there is
> enough text to justify this. Below roughly 50 items, read them all — analysis
> adds nothing a careful reading does not, and adds error.

### Overall sentiment is nearly useless on its own

"Sentiment is 72% positive" prompts no action. **Aspect-level** sentiment does:

```
Product quality   88% positive
Price             41% positive     ← this is the finding
Staff             94% positive
Availability      35% positive     ← and this
Checkout speed    67% positive
```

Always break sentiment down by the categories used in `feedback-analysis`. The
aggregate hides exactly the thing worth knowing.

```sql
SELECT category,
       count(*)                                        AS items,
       count(*) FILTER (WHERE sentiment='positive')    AS positive,
       count(*) FILTER (WHERE sentiment='negative')    AS negative,
       round(100.0 * count(*) FILTER (WHERE sentiment='positive') / count(*), 1) AS pct_positive
FROM feedback
WHERE shop_id=$1 AND created_at >= now() - interval '90 days'
GROUP BY 1 ORDER BY pct_positive;
```

### Classify consistently

Whether labelling by hand or with a model, the rules must be fixed and written
down:

- **Positive** — expresses satisfaction
- **Negative** — expresses dissatisfaction
- **Neutral** — factual, a question, or no clear tone
- **Mixed** — both, about different aspects. Split it by aspect rather than
  averaging to neutral

Averaging a mixed item to "neutral" destroys the signal — "the staff were lovely
but you never have milk" is positive on service and negative on availability, and
both matter.

### Where the method fails

Be honest about these; they are common in short retail feedback:

| Problem | Example |
|---|---|
| Sarcasm | "Great, another empty shelf" |
| Negation and scope | "Not bad at all" |
| Comparatives | "Better than last time" — improving, still poor |
| Domain terms | "Sick deal" — positive |
| Mixed languages and transliteration | Common in Indian retail feedback |
| Short text | "ok" — genuinely ambiguous |
| Rating/text mismatch | 5 stars with a complaint |

**Spot-check a sample by hand** against whatever classification you used. If
agreement is poor, report the sentiment figures as indicative only, or abandon
them and work from the categorised themes instead.

### Track direction, not level

The absolute percentage depends on who chose to write, which changes. The
**trend** is the useful part, if the collection method has stayed the same.

```sql
SELECT date_trunc('month', created_at)::date AS month, category,
       round(100.0 * count(*) FILTER (WHERE sentiment='positive') / count(*), 1) AS pct_positive,
       count(*) AS n
FROM feedback WHERE shop_id=$1 AND created_at >= now() - interval '12 months'
GROUP BY 1,2 HAVING count(*) >= 10
ORDER BY 1,2;
```

Report `n` with every figure, and suppress months with too few items rather than
showing a percentage of five.

**A change in collection method invalidates the trend.** If a feedback prompt was
added at the till in March, sentiment before and after are not comparable.

### Corroborate against behaviour

Sentiment is a stated signal; behaviour is a revealed one. Where they disagree,
trust behaviour.

- Negative sentiment about availability → check stockout data
- Negative sentiment about price → check whether volume actually fell
- Positive sentiment but falling retention → the feedback set is not
  representative

See `feedback-analysis` and `customer-retention`.

### Privacy

Feedback text often contains personal details, and sometimes names staff.

- Do not export raw feedback text into external tools without a decision
- Redact personal identifiers in reports
- Never publish a customer's words with identifying detail attached
- Complaints naming staff are an HR matter handled privately, not a data point in
  a dashboard

### Reporting

```markdown
## Sentiment — 90 days (n = 84)

Availability   35% positive (n=23)  ↓ from 58% ← worst, and worsening
Price          41% positive (n=17)  → stable
Checkout       67% positive (n=12)  ↑ from 45%
Staff          94% positive (n=32)  → stable

Availability sentiment matches the stockout data: the three products named
most often had 10+ zero-stock days. Checkout improvement follows the second
till added in July.

Caveat: 84 items from ~2,400 transactions (3.5%), skewed to strong opinions.
Hand-checked 20 items; classification agreed on 17.
```

State the sample size, the skew, and the accuracy check. Without those the
percentages look more authoritative than they are.

### Checklist

- [ ] Enough volume to justify the method; otherwise read the items
- [ ] Aspect-level sentiment, not just an aggregate
- [ ] Mixed items split by aspect rather than averaged
- [ ] Classification rules written down and applied consistently
- [ ] Sample hand-checked; agreement reported
- [ ] Trend reported over level, with `n` shown
- [ ] Low-volume periods suppressed rather than shown as percentages
- [ ] Collection-method changes noted as breaking the trend
- [ ] Findings corroborated against behavioural data
- [ ] Personal identifiers redacted; staff complaints handled privately

## References

- **Bing Liu, _Sentiment Analysis and Opinion Mining_** — aspect-based
  sentiment, and the documented difficulty of sarcasm and negation
- **Nielsen Norman Group — limits of self-reported data**
  <https://www.nngroup.com/articles/first-rule-of-usability-dont-listen-to-users/>
- **PostgreSQL 16 documentation — `FILTER` and aggregate functions**
  <https://www.postgresql.org/docs/16/functions-aggregate.html>

**Not sourced — written for this framework:** the failure-mode table for short
retail feedback, the mandatory hand-check, the suppress-small-n rule, the
collection-change caveat, and the reporting format.
