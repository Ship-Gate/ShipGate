# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e9]:
    - heading "The 3 Biggest Lies AI Tells" [level=1] [ref=e10]
    - paragraph [ref=e11]: And how ISL catches every single one
    - generic [ref=e12]:
      - button "Pause" [active] [ref=e13] [cursor=pointer]:
        - img [ref=e14]
        - text: Pause
      - button "Skip" [ref=e17] [cursor=pointer]:
        - img [ref=e18]
        - text: Skip
      - button "Restart" [ref=e20] [cursor=pointer]:
        - img [ref=e21]
        - text: Restart
      - button "Toggle Voice" [ref=e24] [cursor=pointer]:
        - img [ref=e25]
    - generic [ref=e29]:
      - text: ElevenLabs API key not set. Voice narration disabled.
      - button "Add key" [ref=e30] [cursor=pointer]
    - generic [ref=e31]: "Step 2 / 5 — Lie 1: Money"
    - generic [ref=e34]:
      - paragraph [ref=e36]: "“Lie number one. The AI says: this handles transfers correctly. Here's the code it generated.”"
      - generic [ref=e38]:
        - generic [ref=e39]:
          - generic [ref=e40]: AI-Generated Transfer
          - button [ref=e41] [cursor=pointer]:
            - img [ref=e42]
        - code [ref=e46]:
          - generic [ref=e47]: "export function transfer(fromId: string, toId: string, amount: number) {"
          - generic [ref=e48]: const from = accounts.get(fromId);
          - generic [ref=e49]: const to = accounts.get(toId);
          - generic [ref=e50]: if (!from || !to) throw new Error('Account not found');
          - generic [ref=e52]: from.balance -= amount; // No check!
          - generic [ref=e53]: to.balance += amount;
          - generic [ref=e54]: "return { success: true };"
          - generic [ref=e55]: "}"
```