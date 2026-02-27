# Discord Server Setup Plan

## Server Name
ShipGate

## Server Icon
Terminal cursor icon with a green checkmark. Dark background.

---

## Channel Structure

### INFO
| Channel | Description |
|---------|-------------|
| #welcome | First thing new members see. One-screen onboarding. |
| #rules | Community rules. Short. |
| #announcements | Releases, breaking changes, launch events. Read-only. |
| #changelog | Auto-posted from GitHub releases. |

### COMMUNITY
| Channel | Description |
|---------|-------------|
| #general | Main discussion. All things shipgate. |
| #show-your-ship | Share projects verified with shipgate. Post your Ship Scores. |
| #isl-help | Questions about ISL syntax, spec design, best practices. |
| #bug-reports | Found a bug? Post here with reproduction steps. |
| #feature-requests | What should shipgate do next? Vote with reactions. |

### DEVELOPMENT
| Channel | Description |
|---------|-------------|
| #contributing | How to contribute. PR guidelines. Good first issues. |
| #architecture | Deep discussions about ISL design, policy engine, verification. |
| #integrations | Cursor MCP, GitHub Actions, CI pipelines, VS Code. |

### SUPPORT
| Channel | Description |
|---------|-------------|
| #getting-started | Help with installation, init, first scan. |
| #ci-setup | GitHub Actions, GitLab CI, other CI systems. |
| #troubleshooting | Something broke? Paste the error. Get help. |

---

## Onboarding Flow

### #welcome (pinned message)

```
Welcome to ShipGate.

shipgate is a behavioral CI gate for AI-generated code. It checks that your implementation
satisfies a behavioral contract — not just that it compiles.

Get started in 60 seconds:

  npm install -g shipgate
  shipgate init
  shipgate verify src/

Links:
  GitHub:  https://github.com/Ship-Gate/ShipGate
  Docs:    https://shipgate.dev/docs
  npm:     https://www.npmjs.com/package/shipgate

Head to #general to introduce yourself, or #getting-started if you need help.
```

### #rules

```
1. Be helpful. Answer questions you can. Ask questions you need to.
2. No spam. No self-promotion unrelated to shipgate or ISL.
3. Post errors with context — command you ran, output you got, what you expected.
4. Treat "Show HN"-style critique as a gift. Disagree technically, not personally.
5. Ship code. Ship feedback. Ship specs.
```

### #getting-started (pinned message)

```
Start here:

1. Install:       npm install -g shipgate
2. Initialize:    shipgate init
3. Verify:        shipgate verify src/
4. Gate:          shipgate gate specs/ --impl src/ --ci

Full docs: https://shipgate.dev/docs
CLI reference: https://shipgate.dev/docs/cli
ISL quickstart: https://shipgate.dev/docs/isl

If you're stuck, post here with:
- Your OS and Node version
- The command you ran
- The full error output
```

---

## Seed Conversation Starters for #general

1. "Just ran `shipgate scan` on a production Next.js app. It found 4 ghost routes and 2 env vars that were accessed but never configured. I've been deploying this for 3 months."

2. "Anyone using the `--lang python` flag with the vibe pipeline? Curious what the FastAPI output looks like compared to the TypeScript/Next.js one."

3. "Question for the ISL veterans: how granular do you go with postconditions? Do you specify every field of the return object, or just the key invariants?"

4. "Just set up the MCP server in Cursor. It blocked an AI suggestion that was referencing a route that didn't exist in my ISL spec. Took 30 seconds to configure."

5. "Ship Score question: I'm at 68 and getting NO_SHIP. The violations list shows 3 GHOST_ROUTE warnings from test fixtures that aren't real routes. How do I exclude those?"

---

## Bot Commands

| Command | Response |
|---------|----------|
| `!docs` | Link to https://shipgate.dev/docs |
| `!install` | `npm install -g shipgate` |
| `!isl` | Link to ISL language reference |
| `!ci` | Link to CI setup guide |
| `!score` | Link to Ship Score documentation |
| `!policy` | Link to policy rules list |
| `!mcp` | Link to MCP/Cursor setup guide |
| `!report` | "Post the full terminal output of `shipgate verify --verbose .` and we can help." |

---

## Growth Tactic

### Founding Member Role
First 100 members get a "Founding Member" role with:
- Purple name in chat
- Access to #founders-only channel (direct line to maintainers, early feature previews)
- Name in the CONTRIBUTORS.md "Early Adopters" section
- Priority response on bug reports and feature requests

### How to earn it
- Join the Discord during launch week, OR
- Submit a bug report or feature request on GitHub, OR
- Post a `shipgate scan` result or Ship Score screenshot in #show-your-ship

### Growth loop
Every `shipgate verify` run ends with:
```
Join the community: https://discord.gg/shipgate
```
This is a non-intrusive, one-line footer in verbose output only.
