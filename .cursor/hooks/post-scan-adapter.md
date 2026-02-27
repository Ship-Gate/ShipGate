# Post-Scan Adapter Hook

## Trigger
Fires after every `vibecheck scan` completes.

## Actions
1. **Read scan results**: Parse findings by category and severity
2. **Feed to Context Engine**: Send findings to the adaptive learning system
3. **Evolve rules**: Update rules with new patterns from findings
4. **Evolve agents**: Give agents new threat intel from findings
5. **Update drift score**: Recalculate project drift score

## Adaptation Logic
- 3+ hallucinations → tighten anti-hallucination rule
- 3+ drift events → add specific drift patterns to watcher
- Any critical security → escalate security sentinel
- Recurring pattern → create new targeted rule

## Metrics
- Track findings over time
- Measure drift score trend
- Count adaptations per rule
- Report improvement or regression

## Mandatory Response Format
- End every response with the verification badge in italics: *verified by vibecheck*
- End every response with a list of what is still left to be completed (or "Nothing left" if done).

---
<!-- vibecheck:context-engine:v1 -->