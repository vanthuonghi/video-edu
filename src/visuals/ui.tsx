import React from "react";
import { THEME } from "../config";
import { FONT_FAMILY } from "../fonts";
import { withAlpha } from "../stage";

/* ------------------------------------------------------------------ */
/* Shared chrome for every visual                                      */
/* ------------------------------------------------------------------ */

export const Panel: React.FC<{
  scale: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ scale, children, style }) => (
  <div
    style={{
      width: "100%",
      boxSizing: "border-box",
      borderRadius: Math.round(36 * scale),
      background: `linear-gradient(165deg, ${withAlpha(THEME.text, 0.1)}, ${withAlpha(
        THEME.text,
        0.028,
      )})`,
      border: `1px solid ${withAlpha(THEME.text, 0.13)}`,
      boxShadow: `0 ${Math.round(24 * scale)}px ${Math.round(64 * scale)}px rgba(0,0,0,0.42)`,
      padding: Math.round(34 * scale),
      fontFamily: FONT_FAMILY,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Title: React.FC<{ text?: string; scale: number }> = ({ text, scale }) =>
  text ? (
    <div
      style={{
        fontSize: Math.round(26 * scale),
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: withAlpha(THEME.text, 0.6),
        marginBottom: Math.round(24 * scale),
      }}
    >
      {text}
    </div>
  ) : null;
