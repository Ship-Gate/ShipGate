# Live Firewall

**Runs automatically on save** for `.ts` and `.js` files.

The firewall blocks:
- **Ghost routes** — API paths not in your truthpack
- **Ghost env** — Environment variables not declared
- **Ghost imports** — Modules that don't resolve

Toggle in settings: `shipgate.firewall.enabled` and `shipgate.firewall.runOnSave`

[Open Settings](command:workbench.action.openSettings?%5B%22shipgate%22%5D)
