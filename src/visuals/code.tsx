import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { Scene, THEME, Visual, Word } from "../config";
import { FONT_FAMILY } from "../fonts";
import { ease, withAlpha } from "../stage";
import { Title, Panel } from "./ui";

/**
 * A code block whose active line follows the narration. `cues[i]` is the
 * spoken phrase that introduces line i; while that phrase is being read the
 * line is lit. Without usable cues the scene duration is split between lines
 * by length, so the highlight still moves instead of freezing.
 */
const MONO = "'SF Mono', Menlo, Consolas, 'DejaVu Sans Mono', monospace";

const KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for", "while", "import",
  "from", "export", "class", "def", "lambda", "with", "as", "try", "except", "finally",
  "yield", "async", "await", "new", "true", "false", "null", "undefined", "this",
  "in", "not", "and", "or", "None", "True", "False", "print", "raise", "pass", "break",
]);

type Token = { text: string; kind: "plain" | "keyword" | "string" | "number" | "comment" | "punct" };

const TOKEN_RE =
  /(#[^\n]*|\/\/[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(\d[\d_.]*)\b|\b([A-Za-z_$][\w$]*)\b|(\s+)|([^\w\s]+)/g;

const tokenize = (line: string): Token[] => {
  const out: Token[] = [];
  let last = 0;
  TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN_RE.exec(line))) {
    if (match.index > last) out.push({ text: line.slice(last, match.index), kind: "plain" });
    const [text, comment, str, num, word, space, punct] = match;
    if (comment) out.push({ text, kind: "comment" });
    else if (str) out.push({ text, kind: "string" });
    else if (num) out.push({ text, kind: "number" });
    else if (word) out.push({ text, kind: KEYWORDS.has(word) ? "keyword" : "plain" });
    else if (space) out.push({ text, kind: "plain" });
    else if (punct) out.push({ text, kind: "punct" });
    last = match.index + text.length;
  }
  if (last < line.length) out.push({ text: line.slice(last), kind: "plain" });
  return out;
};

const TOKEN_COLOR: Record<Token["kind"], string> = {
  plain: THEME.text,
  keyword: THEME.accent,
  string: withAlpha(THEME.muted, 0.95),
  number: THEME.accent,
  comment: withAlpha(THEME.text, 0.42),
  punct: withAlpha(THEME.text, 0.72),
};

const normalizeWords = (text: string): string[] =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

/** Start time (ms, absolute) of the first spot where `cue` is spoken. */
const cueStart = (words: Word[], cue: string): number | null => {
  const want = normalizeWords(cue);
  if (!want.length || !words.length) return null;
  const spoken = words.map((w) => normalizeWords(w.t)[0] ?? "");
  for (let i = 0; i + want.length <= spoken.length; i++) {
    let hit = true;
    for (let j = 0; j < want.length; j++) {
      if (spoken[i + j] !== want[j]) {
        hit = false;
        break;
      }
    }
    if (hit) return words[i].s;
  }
  return null;
};

/**
 * One timestamp per line. Cue timings win; the gaps between them and the tail
 * after the last cue are filled by interpolation so the highlight never jumps
 * back to line 1 mid-sentence.
 */
const lineTimes = (lines: string[], cues: string[], scene: Scene): number[] => {
  const words = scene.words ?? [];
  const duration = Math.max(500, scene.endMs - scene.startMs);
  const found = lines.map((_, i) => (cues[i] ? cueStart(words, cues[i]) : null));
  const known = found
    .map((t, i) => ({ t, i }))
    .filter((p): p is { t: number; i: number } => p.t !== null)
    .sort((a, b) => a.t - b.t);

  const times = new Array<number>(lines.length).fill(scene.startMs);

  if (!known.length) {
    // No cues (or none found): give each line screen time proportional to its
    // length so a long statement is lit longer than a closing brace.
    const weights = lines.map((l) => Math.max(8, l.trim().length));
    const sum = weights.reduce((a, b) => a + b, 0);
    let acc = 0;
    lines.forEach((_, i) => {
      times[i] = scene.startMs + (acc / sum) * duration * 0.82;
      acc += weights[i];
    });
    return times;
  }

  let prev = { t: scene.startMs, i: 0 };
  known.forEach((point) => {
    const span = point.i - prev.i;
    for (let j = 1; j < span; j++) {
      times[prev.i + j] = prev.t + ((point.t - prev.t) * j) / span;
    }
    times[point.i] = point.t;
    prev = point;
  });

  const last = known[known.length - 1];
  const rest = lines.length - 1 - last.i;
  for (let j = 1; j <= rest; j++) {
    times[last.i + j] = last.t + ((scene.endMs - last.t) * j) / (rest + 1);
  }
  return times;
};

export const CodeBlock: React.FC<{
  visual: Extract<Visual, { type: "code" }>;
  scene: Scene;
  scale: number;
}> = ({ visual, scene, scale }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nowMs = scene.startMs + (frame / fps) * 1000;
  const times = lineTimes(visual.lines, visual.cues ?? [], scene);
  let active = 0;
  times.forEach((t, i) => {
    if (nowMs >= t) active = i;
  });
  const fontSize = Math.round(28 * scale);
  const lineHeight = 1.62;

  return (
    <Panel scale={scale} style={{ maxWidth: Math.round(930 * scale) }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: Math.round(18 * scale),
          fontFamily: FONT_FAMILY,
        }}
      >
        <Title text={visual.title} scale={scale} />
        {visual.language ? (
          <div
            style={{
              marginBottom: Math.round(24 * scale),
              padding: `${Math.round(6 * scale)}px ${Math.round(16 * scale)}px`,
              borderRadius: 999,
              border: `1px solid ${withAlpha(THEME.accent, 0.45)}`,
              background: withAlpha(THEME.accent, 0.12),
              fontSize: Math.round(22 * scale),
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: THEME.accent,
            }}
          >
            {visual.language}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: Math.round(4 * scale) }}>
        {visual.lines.map((line, i) => {
          const isActive = i === active;
          const enter = ease(frame, i * 2, i * 2 + 12);
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "stretch",
                borderRadius: Math.round(12 * scale),
                background: isActive ? withAlpha(THEME.accent, 0.14) : "transparent",
                border: `1px solid ${isActive ? withAlpha(THEME.accent, 0.35) : "transparent"}`,
                opacity: enter * (isActive ? 1 : 0.5),
                transition: "none",
              }}
            >
              <div
                style={{
                  width: Math.round(6 * scale),
                  flexShrink: 0,
                  borderRadius: 99,
                  background: isActive ? THEME.accent : "transparent",
                  boxShadow: isActive
                    ? `0 0 ${Math.round(16 * scale)}px ${withAlpha(THEME.accent, 0.6)}`
                    : undefined,
                }}
              />
              <div
                style={{
                  width: Math.round(52 * scale),
                  flexShrink: 0,
                  paddingTop: Math.round(10 * scale),
                  textAlign: "right",
                  paddingRight: Math.round(16 * scale),
                  fontFamily: MONO,
                  fontSize: Math.round(fontSize * 0.78),
                  lineHeight,
                  color: withAlpha(THEME.text, isActive ? 0.55 : 0.3),
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {i + 1}
              </div>
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: `${Math.round(10 * scale)}px ${Math.round(14 * scale)}px`,
                  fontFamily: MONO,
                  fontSize,
                  lineHeight,
                  whiteSpace: "pre",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  color: THEME.text,
                }}
              >
                {tokenize(line).map((token, k) => (
                  <span key={k} style={{ color: TOKEN_COLOR[token.kind] }}>
                    {token.text}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
};
