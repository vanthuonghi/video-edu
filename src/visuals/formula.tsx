import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { THEME, Visual } from "../config";
import { FONT_FAMILY } from "../fonts";
import { useStage, withAlpha } from "../stage";
import { Panel, Title } from "./ui";

/**
 * A formula that builds itself up: the expression first, then each labelled
 * step, then the result. Expo notation is written `^{...}` / `_{...}` so a
 * config can say `A = P(1 + r)^{n}` without pulling in a typesetting library.
 */
const MATH_FONT = "'Georgia', 'DejaVu Serif', 'Times New Roman', serif";

const scriptMarkup = (text: string, scale: number): React.ReactNode[] => {
  const nodes: React.ReactNode[] = [];
  let buffer = "";
  let key = 0;

  const flush = () => {
    if (buffer) {
      nodes.push(<React.Fragment key={`t${key++}`}>{buffer}</React.Fragment>);
      buffer = "";
    }
  };

  for (let i = 0; i < text.length; i++) {
    const marker = text[i];
    if ((marker === "^" || marker === "_") && text[i + 1] === "{") {
      const end = text.indexOf("}", i + 2);
      if (end > i + 1) {
        flush();
        const inner = text.slice(i + 2, end);
        const style: React.CSSProperties = {
          fontSize: "0.58em",
          lineHeight: 1,
          display: "inline-block",
        };
        nodes.push(
          marker === "^" ? (
            <sup key={`s${key++}`} style={style}>
              {inner}
            </sup>
          ) : (
            <sub key={`s${key++}`} style={style}>
              {inner}
            </sub>
          ),
        );
        i = end;
        continue;
      }
    }
    buffer += marker;
  }
  flush();
  return nodes;
};

const expressionSize = (formula: string): number => {
  if (formula.length <= 14) return 92;
  if (formula.length <= 22) return 76;
  if (formula.length <= 32) return 62;
  return 52;
};

export const Formula: React.FC<{
  visual: Extract<Visual, { type: "formula" }>;
  scale: number;
}> = ({ visual, scale }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { usable } = useStage();
  const formulaIn = spring({ frame, fps, config: { damping: 15, stiffness: 105 } });
  const steps = visual.steps ?? [];
  const resultIn = spring({
    frame,
    fps,
    delay: 16 + steps.length * 7,
    config: { damping: 14, stiffness: 130 },
  });

  return (
    <Panel scale={scale} style={{ maxWidth: Math.round(920 * scale) }}>
      <Title text={visual.title} scale={scale} />

      <div
        style={{
          textAlign: "center",
          fontFamily: MATH_FONT,
          fontStyle: "italic",
          fontSize: Math.round(expressionSize(visual.formula) * scale),
          lineHeight: 1.1,
          color: THEME.text,
          opacity: Math.min(1, formulaIn * 1.5),
          transform: `scale(${0.94 + 0.06 * formulaIn})`,
          padding: `${Math.round(6 * scale)}px 0 ${Math.round(18 * scale)}px`,
          textShadow: `0 0 ${Math.round(40 * scale)}px ${withAlpha(THEME.accent, 0.25)}`,
        }}
      >
        {scriptMarkup(visual.formula, scale)}
      </div>

      {steps.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: Math.round(10 * scale),
            marginTop: Math.round(4 * scale),
          }}
        >
          {steps.map((step, i) => {
            const enter = spring({
              frame,
              fps,
              delay: 10 + i * 7,
              config: { damping: 16, stiffness: 140 },
            });
            return (
              <div
                key={`${step}-${i}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: Math.round(16 * scale),
                  padding: `${Math.round(12 * scale)}px ${Math.round(20 * scale)}px`,
                  borderRadius: Math.round(16 * scale),
                  background: withAlpha(THEME.text, 0.05),
                  border: `1px solid ${withAlpha(THEME.text, 0.1)}`,
                  opacity: Math.min(1, enter * 1.4),
                  transform: `translateX(${(1 - enter) * Math.round(-40 * scale)}px)`,
                }}
              >
                <div
                  style={{
                    width: Math.round(10 * scale),
                    height: Math.round(10 * scale),
                    flexShrink: 0,
                    borderRadius: "50%",
                    background: THEME.accent,
                  }}
                />
                <div
                  style={{
                    fontFamily: MATH_FONT,
                    fontSize: Math.round(40 * scale),
                    lineHeight: 1.25,
                    color: withAlpha(THEME.text, 0.86),
                  }}
                >
                  {scriptMarkup(step, scale)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {visual.result ? (
        <div
          style={{
            marginTop: Math.round(18 * scale),
            padding: `${Math.round(16 * scale)}px ${Math.round(22 * scale)}px`,
            borderRadius: Math.round(18 * scale),
            background: withAlpha(THEME.accent, 0.12),
            border: `${Math.max(1, Math.round(2 * scale))}px solid ${withAlpha(THEME.accent, 0.5)}`,
            boxShadow: `0 0 ${Math.round(30 * scale)}px ${withAlpha(THEME.accent, 0.22)}`,
            fontFamily: MATH_FONT,
            fontSize: Math.round(40 * scale),
            lineHeight: 1.25,
            color: THEME.accent,
            opacity: Math.min(1, resultIn * 1.4),
            transform: `translateY(${(1 - resultIn) * Math.round(20 * scale)}px)`,
          }}
        >
          {scriptMarkup(visual.result, scale)}
        </div>
      ) : null}
    </Panel>
  );
};
