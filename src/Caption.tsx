import React, { useMemo } from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CAPTION, Scene, THEME } from "./config";
import { FONT_FAMILY } from "./fonts";
import { clamp, ease, useStage, withAlpha } from "./stage";

/* ------------------------------------------------------------------ */
/* Text measurement + wrapping                                         */
/* ------------------------------------------------------------------ */

const LETTER_SPACING_EM = -0.015;

let measureCtx: CanvasRenderingContext2D | null = null;
const widthCache = new Map<string, number>();

/**
 * Real glyph measurement instead of an average-character-width guess.
 * Vietnamese mixes narrow ("i", "l") and wide ("M", "Ư") glyphs, so the old
 * `length * 0.545` estimate either overflowed the frame or shrank the type for
 * no reason. Measured once per (text, size) and cached.
 */
const measureWidth = (text: string, fontSize: number): number => {
  const key = `${fontSize}|${text}`;
  const cached = widthCache.get(key);
  if (cached !== undefined) return cached;

  let width: number;
  if (typeof document === "undefined") {
    width = text.length * fontSize * 0.545;
  } else {
    if (!measureCtx) {
      measureCtx = document.createElement("canvas").getContext("2d");
    }
    if (measureCtx) {
      measureCtx.font = `900 ${fontSize}px ${FONT_FAMILY}`;
      width = measureCtx.measureText(text).width;
      width += LETTER_SPACING_EM * fontSize * Math.max(0, text.length - 1);
    } else {
      width = text.length * fontSize * 0.545;
    }
  }

  widthCache.set(key, width);
  return width;
};

const splitWords = (text: string) => text.trim().split(/\s+/).filter(Boolean);

const wrapToWidth = (words: string[], fontSize: number, usable: number): string[][] => {
  const out: string[][] = [];
  let cur: string[] = [];
  for (const w of words) {
    const candidate = cur.length ? `${cur.join(" ")} ${w}` : w;
    if (cur.length && measureWidth(candidate, fontSize) > usable) {
      out.push(cur);
      cur = [w];
    } else {
      cur.push(w);
    }
  }
  if (cur.length) out.push(cur);
  return out;
};

const splitPhrases = (text: string): string[][] => {
  const out: string[][] = [];
  let cur: string[] = [];
  for (const w of splitWords(text)) {
    cur.push(w);
    if (/[:;,!?]$/.test(w)) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
};

const MAX_LINES = 3;
const MIN_FONT_SIZE = 34;

/** Base size from sentence length, then step down until it fits 3 lines. */
const baseSizeFor = (n: number): number => {
  if (n <= 16) return 86;
  if (n <= 26) return 78;
  if (n <= 38) return 68;
  if (n <= 54) return 60;
  if (n <= 72) return 53;
  return 47;
};

const countLines = (blocks: string[][], fontSize: number, usable: number) =>
  blocks.reduce((n, block) => n + wrapToWidth(block, fontSize, usable).length, 0);

const layoutScene = (
  text: string,
  base: number,
  usable: number,
): { lines: string[][]; fontSize: number } => {
  const phrases = splitPhrases(text);
  const blocks = phrases.length ? phrases : [splitWords(text)];

  let fontSize = MIN_FONT_SIZE;
  for (let candidate = Math.max(MIN_FONT_SIZE, Math.round(base)); candidate >= MIN_FONT_SIZE; candidate -= 3) {
    if (countLines(blocks, candidate, usable) <= MAX_LINES) {
      fontSize = candidate;
      break;
    }
  }

  const lines: string[][] = [];
  for (const block of blocks) lines.push(...wrapToWidth(block, fontSize, usable));
  return { lines, fontSize };
};

/* ------------------------------------------------------------------ */
/* Highlight + word helpers                                            */
/* ------------------------------------------------------------------ */

const stripMarks = (w: string) => w.replace(/[.,!?;:…"'()]/g, "").toLowerCase();

/**
 * Word indexes covered by every occurrence of the highlight phrase. Matching
 * the whole phrase (not single words) keeps "độ" inside "chế độ" from lighting
 * up when the highlight is "giảm độ sáng".
 */
const highlightIndexes = (text: string, highlight?: string): Set<number> => {
  const words = splitWords(text).map(stripMarks);
  const phrase = splitWords(highlight || "").map(stripMarks).filter(Boolean);
  const out = new Set<number>();
  if (!phrase.length) return out;
  for (let i = 0; i + phrase.length <= words.length; i++) {
    let match = true;
    for (let j = 0; j < phrase.length; j++) {
      if (words[i + j] !== phrase[j]) {
        match = false;
        break;
      }
    }
    if (match) for (let j = 0; j < phrase.length; j++) out.add(i + j);
  }
  return out;
};

const LineRows: React.FC<{
  lines: string[][];
  renderWord: (word: string, index: number) => React.ReactNode;
}> = ({ lines, renderWord }) => {
  let k = 0;
  return (
    <>
      {lines.map((line, li) => (
        <div key={li} style={{ whiteSpace: "nowrap" }}>
          {line.map((word, wi) => {
            const node = renderWord(word, k);
            k += 1;
            return <React.Fragment key={wi}>{node}</React.Fragment>;
          })}
        </div>
      ))}
    </>
  );
};

const wordSpan = (word: string, style: React.CSSProperties) => (
  <span
    style={{
      display: "inline-block",
      marginRight: "0.24em",
      position: "relative",
      ...style,
    }}
  >
    {word}
  </span>
);

/* ------------------------------------------------------------------ */
/* Caption effects                                                     */
/* ------------------------------------------------------------------ */

type Props = { scene: Scene; fontSize: number };

const Karaoke: React.FC<Props> = ({ scene, fontSize }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stage = useStage();
  const { lines, fontSize: fs } = useMemo(
    () => layoutScene(scene.text, fontSize, stage.usable),
    [scene.text, fontSize, stage.usable],
  );
  const hi = highlightIndexes(scene.text, scene.highlight);
  const nowMs = (frame / fps) * 1000 + scene.startMs;
  const words = scene.words || [];

  return (
    <LineRows
      lines={lines}
      renderWord={(word, i) => {
        const w = words[i];
        const p = w
          ? clamp((nowMs - w.s) / Math.max(90, w.e - w.s), 0, 1)
          : clamp((frame - i * 4) / 12, 0, 1);
        const active = p > 0 && p < 1;
        const lit = hi.has(i) && p > 0.55;
        return wordSpan(word, {
          color: lit ? THEME.accent : withAlpha(THEME.text, 0.3 + 0.7 * p),
          transform: `scale(${1 + 0.05 * Math.sin(p * Math.PI)})`,
          textShadow: active ? `0 0 24px ${withAlpha(THEME.accent, 0.45)}` : undefined,
        });
      }}
    />
  );
};

const WordRise: React.FC<Props> = ({ scene, fontSize }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stage = useStage();
  const { lines, fontSize: fs } = useMemo(
    () => layoutScene(scene.text, fontSize, stage.usable),
    [scene.text, fontSize, stage.usable],
  );
  const hi = highlightIndexes(scene.text, scene.highlight);

  return (
    <LineRows
      lines={lines}
      renderWord={(word, i) => {
        const enter = spring({
          frame,
          fps,
          delay: i * 3,
          config: { damping: 14, stiffness: 130, mass: 0.7 },
        });
        return wordSpan(word, {
          opacity: enter,
          transform: `translateY(${(1 - enter) * 34}px)`,
          color: hi.has(i) ? THEME.accent : undefined,
        });
      }}
    />
  );
};

const LineMask: React.FC<Props> = ({ scene, fontSize }) => {
  const frame = useCurrentFrame();
  const stage = useStage();
  const { lines, fontSize: fs } = useMemo(
    () => layoutScene(scene.text, fontSize, stage.usable),
    [scene.text, fontSize, stage.usable],
  );
  const hi = highlightIndexes(scene.text, scene.highlight);
  const p = ease(frame, 0, 18);

  return (
    <div
      style={{
        clipPath: `inset(0% 0% ${(1 - p) * 100}% 0%)`,
        transform: `translateY(${(1 - p) * 24}px)`,
      }}
    >
      <LineRows
        lines={lines}
        renderWord={(word, i) =>
          wordSpan(word, { color: hi.has(i) ? THEME.accent : undefined })
        }
      />
    </div>
  );
};

const EFFECTS = {
  karaoke: Karaoke,
  "word-rise": WordRise,
  "line-mask": LineMask,
};

/**
 * Caption block. The parent positions it in the lower third; this component
 * only lays the sentence out and animates the words.
 */
export const Caption: React.FC<{
  scene: Scene;
  /** Available height in px; the type is capped so 3 lines always fit. */
  height: number;
  baseSize?: number;
}> = ({ scene, height, baseSize }) => {
  const stage = useStage();
  const Effect = EFFECTS[CAPTION] ?? Karaoke;
  const capped = Math.min(baseSizeFor(scene.text.length), height / 3.7);
  const fontSize = Math.max(MIN_FONT_SIZE * stage.scale, capped * stage.scale);

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        textAlign: "center",
        fontSize,
        fontWeight: 900,
        lineHeight: 1.2,
        letterSpacing: `${LETTER_SPACING_EM}em`,
        color: THEME.text,
        fontFamily: FONT_FAMILY,
        textShadow: "0 4px 20px rgba(0,0,0,0.5)",
        WebkitTextStroke: `1px ${withAlpha(THEME.bg[0] ?? "#000", 0.35)}`,
        paintOrder: "stroke fill",
      }}
    >
      <div style={{ maxWidth: stage.usable }}>
        <Effect scene={scene} fontSize={fontSize} />
      </div>
    </div>
  );
};
