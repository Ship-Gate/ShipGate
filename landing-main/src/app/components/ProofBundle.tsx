// src/components/ProofBundle.tsx
import { useState } from "react";
import { T } from "../theme";
import { useBreakpoint } from "../hooks/useBreakpoint";

type ClaimStatus = "PROVEN" | "PARTIAL" | "UNVERIFIED";

export function ProofBundle() {
  const [expanded, setExpanded] = useState(1);
  const { mobile } = useBreakpoint();

  const claims = [
    { name: "Import Integrity", status: "PROVEN" as ClaimStatus, confidence: "100%", detail: "847/847 imports resolve to existing modules. 0 hallucinated packages.", control: "CC7.1" },
    { name: "Auth Coverage", status: "PROVEN" as ClaimStatus, confidence: "100%", detail: "23/23 protected endpoints have auth middleware chain verified.", control: "CC6.1" },
    { name: "Input Validation", status: "PROVEN" as ClaimStatus, confidence: "100%", detail: "19/19 endpoints validate request bodies via Zod .parse().", control: "CC6.6" },
    { name: "SQL Injection", status: "PROVEN" as ClaimStatus, confidence: "98%", detail: "0 raw SQL queries. All DB access via Prisma ORM (parameterized).", control: "CC6.6" },
    { name: "Secret Exposure", status: "PROVEN" as ClaimStatus, confidence: "100%", detail: "0 hardcoded secrets. .env in .gitignore. Clean client bundle.", control: "CC6.7" },
    { name: "Type Safety", status: "PARTIAL" as ClaimStatus, confidence: "94%", detail: "247/263 functions fully typed. 16 functions use implicit 'any'.", control: "CC8.1" },
    { name: "Error Handling", status: "PARTIAL" as ClaimStatus, confidence: "87%", detail: "20/23 route handlers have error boundaries. 3 missing try/catch.", control: "CC7.4" },
    { name: "Business Logic", status: "UNVERIFIED" as ClaimStatus, confidence: "—", detail: "Behavioral correctness cannot be statically proven. Requires runtime tests.", control: "—" },
  ];

  const colorByStatus = (s: ClaimStatus) => (s === "PROVEN" ? T.ship : s === "PARTIAL" ? T.warn : T.noship);
  const iconByStatus = (s: ClaimStatus) => (s === "PROVEN" ? "✓" : s === "PARTIAL" ? "◐" : "✗");

  return (
    <div className="soft-card">
      <div
        style={{
          padding: "14px 20px",
          borderBottom: `1px solid ${T.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: "'JetBrains Mono', monospace",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.ship, boxShadow: `0 0 8px ${T.ship}60`, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: T.text0, fontWeight: 600 }}>Proof Bundle</span>
          <span style={{ fontSize: 11, color: T.text3 }}>v1.0</span>
        </div>
        <span style={{ fontSize: 10, color: T.text3, display: mobile ? "none" : "inline" }}>HMAC-SHA256 signed</span>
      </div>

      <div style={{ padding: "8px 0", position: "relative", zIndex: 1 }}>
        {claims.map((c, i) => {
          const col = colorByStatus(c.status);
          const open = expanded === i;

          return (
            <div key={c.name}>
              <button
                type="button"
                onClick={() => setExpanded(open ? -1 : i)}
                aria-expanded={open}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: mobile ? 8 : 12,
                  padding: mobile ? "9px 12px" : "9px 20px",
                  cursor: "pointer",
                  background: open ? "rgba(255,255,255,0.015)" : "transparent",
                  transition: "background 0.15s",
                  width: "100%",
                  border: "none",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 700,
                    color: col,
                    background: `${col}12`,
                    border: `1px solid ${col}25`,
                    flexShrink: 0,
                  }}
                >
                  {iconByStatus(c.status)}
                </span>

                <span
                  style={{
                    flex: 1,
                    fontSize: mobile ? 11 : 13,
                    color: T.text1,
                    fontFamily: "'JetBrains Mono', monospace",
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.name}
                </span>

                <span
                  style={{
                    fontSize: 10,
                    padding: "2px 8px",
                    borderRadius: 3,
                    fontWeight: 600,
                    color: col,
                    background: `${col}10`,
                    border: `1px solid ${col}18`,
                    fontFamily: "'JetBrains Mono', monospace",
                    flexShrink: 0,
                  }}
                >
                  {c.status}
                </span>

                <span
                  style={{
                    fontSize: 11,
                    color: T.text3,
                    fontFamily: "'JetBrains Mono', monospace",
                    width: 36,
                    textAlign: "right",
                    flexShrink: 0,
                    display: mobile ? "none" : "block",
                  }}
                >
                  {c.confidence}
                </span>
              </button>

              {open && (
                <div
                  style={{
                    padding: mobile ? "6px 12px 14px 40px" : "6px 20px 14px 52px",
                    fontSize: 12,
                    color: T.text2,
                    lineHeight: 1.6,
                    borderBottom: `1px solid ${T.border}`,
                  }}
                >
                  <div>{c.detail}</div>

                  {c.control !== "—" && (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 8,
                        padding: "3px 10px",
                        borderRadius: 4,
                        fontSize: 10,
                        background: T.accentBg,
                        color: T.accent,
                        border: `1px solid ${T.accent}20`,
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 600,
                      }}
                    >
                      SOC 2 — {c.control}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
