// src/theme.ts
export const T = {
  bg0: "#06060a",
  bg1: "#0c0c14",
  bg2: "#12121e",
  bg3: "#1a1a2a",
  border: "rgba(255,255,255,0.06)",

  text0: "#ffffff",
  text1: "#c8c8d4",
  text2: "#8888a0",
  text3: "#555566",

  ship: "#00e68a",
  shipBg: "rgba(0,230,138,0.06)",

  warn: "#ffb547",
  warnBg: "rgba(255,181,71,0.06)",

  noship: "#ff5c6a",
  noshipBg: "rgba(255,92,106,0.06)",

  accent: "#6366f1",
  accentBg: "rgba(99,102,241,0.06)",
} as const;

export type ThemeTokens = typeof T;
