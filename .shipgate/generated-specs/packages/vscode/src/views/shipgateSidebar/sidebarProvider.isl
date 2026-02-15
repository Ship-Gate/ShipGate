# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: SidebarState, ShipgateSidebarProvider
# dependencies: vscode, path

domain SidebarProvider {
  version: "1.0.0"

  type SidebarState = String
  type ShipgateSidebarProvider = String

  invariants exports_present {
    - true
  }
}
