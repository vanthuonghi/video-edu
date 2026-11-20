import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { THEME, Visual } from "../config";
import { FONT_FAMILY } from "../fonts";
import { ease, withAlpha } from "../stage";
import { Panel, Title } from "./ui";

/**
 * A vocabulary card: the word, its pronunciation, what it means, and one
 * sentence that uses it. Unlike the icon scenes this picture carries the
 * lesson itself, which is the point of a word-learning video.
 */
const sizeFor = (word: string): number => {
  if (word.length <= 10) return 100;
  if (word.length <= 16) return 84;
  if (word.length <= 24) return 68;
  if (word.length <= 34) return 56;
  return 48;
};

export const WordCard: React.FC<{
  visual: Extract<Visual, { type: "wordcard" }>;
  scale: number;
}> = ({ visual, scale }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const wordIn = spring({ frame, fps, config: { damping: 14, stiffness: 110 } });
  const phoneticIn = ease(frame, 7, 20);
  const divider = ease(frame, 10, 30);
  const meaningIn = spring({ frame, fps, delay: 14, config: { damping: 16, stiffness: 120 } });
  const exampleIn = ease(frame, 22, 36);
  const wordSize = Math.round(sizeFor(visual.word) * scale);

  return (
    <Panel scale={scale} style={{ maxWidth: Math.round(900 * scale) }}>
      <Title text={visual.title} scale={scale} />

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: Math.round(18 * scale),
          opacity: Math.min(1, wordIn * 1.5),
          transform: `translateY(${(1 - wordIn) * Math.round(26 * scale)}px)`,
        }}
      >
        <div
          style={{
            width: Math.max(4, Math.round(8 * scale)),
            alignSelf: "stretch",
            borderRadius: 99,
            background: `linear-gradient(180deg, ${THEME.accent}, ${withAlpha(THEME.accent, 0.15)})`,
          }}
        />
        <div
          style={{
            fontSize: wordSize,
            fontWeight: 900,
            lineHeight: 1.02,
            letterSpacing: "-0.02em",
            color: THEME.accent,
            textShadow: `0 0 ${Math.round(34 * scale)}px ${withAlpha(THEME.accent, 0.35)}`,
          }}
        >
          {visual.word}
        </div>
      </div>

      {visual.phonetic ? (
        <div
          style={{
            marginTop: Math.round(10 * scale),
            marginLeft: Math.round(26 * scale),
            fontSize: Math.round(38 * scale),
            fontWeight: 600,
            letterSpacing: "0.02em",
            color: withAlpha(THEME.text, 0.62),
            opacity: phoneticIn,
            transform: `translateX(${(1 - phoneticIn) * Math.round(-14 * scale)}px)`,
          }}
        >
          {visual.phonetic}
        </div>
      ) : null}

      <div
        style={{
          height: Math.max(1, Math.round(2 * scale)),
          width: `${divider * 100}%`,
          margin: `${Math.round(20 * scale)}px 0`,
          background: `linear-gradient(90deg, ${withAlpha(THEME.accent, 0.6)}, ${withAlpha(
            THEME.text,
            0.05,
          )})`,
        }}
      />

      <div
        style={{
          fontSize: Math.round(46 * scale),
          fontWeight: 700,
          lineHeight: 1.32,
          color: THEME.text,
          opacity: Math.min(1, meaningIn * 1.4),
          transform: `translateY(${(1 - meaningIn) * Math.round(18 * scale)}px)`,
        }}
      >
        {visual.meaning}
      </div>

      {visual.example ? (
        <div
          style={{
            marginTop: Math.round(22 * scale),
            paddingLeft: Math.round(20 * scale),
            borderLeft: `${Math.max(2, Math.round(4 * scale))}px solid ${withAlpha(
              THEME.muted,
              0.8,
            )}`,
            fontSize: Math.round(34 * scale),
            fontStyle: "italic",
            lineHeight: 1.4,
            color: withAlpha(THEME.text, 0.78),
            opacity: exampleIn,
            transform: `translateY(${(1 - exampleIn) * Math.round(14 * scale)}px)`,
          }}
        >
          {visual.example}
        </div>
      ) : null}
    </Panel>
  );
};
