import rawConfig from "./video-config.json";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type Word = { t: string; s: number; e: number };

export type SceneKind = "hook" | "body" | "cta";

export type CaptionEffect = "karaoke" | "word-rise" | "line-mask";

export type BarValue = { label: string; value: number };

export type PhoneMessage = { from: "them" | "me"; text: string };

/**
 * The moving picture of a scene. Every variant is drawn with SVG/CSS so a
 * render needs no downloads, no stock footage and no image API key.
 */
export type Visual =
  | { type: "icons"; icons: string[]; label?: string }
  | { type: "bars"; values: BarValue[]; unit?: string; title?: string }
  | { type: "steps"; steps: string[]; title?: string }
  | { type: "phone"; messages: PhoneMessage[]; title?: string }
  | { type: "compare"; before: string; after: string; title?: string }
  | { type: "counter"; value: string; label?: string; unit?: string }
  | { type: "list"; items: string[]; title?: string }
  | { type: "photo"; image: string; caption?: string };

export const VISUAL_TYPES = [
  "icons",
  "bars",
  "steps",
  "phone",
  "compare",
  "counter",
  "list",
  "photo",
] as const;

export type VisualType = (typeof VISUAL_TYPES)[number];

export type Scene = {
  text: string;
  highlight?: string;
  kind?: SceneKind;
  /** "auto" (or nothing) picks an icon scene from the sentence keywords. */
  visual?: Visual | "auto";
  startMs: number;
  endMs: number;
  words?: Word[];
  /** "whisper" when the timings were measured from the audio. */
  alignSource?: "whisper" | "estimate";
};

export type Theme = {
  id: string;
  bg: string[];
  text: string;
  accent: string;
  muted: string;
};

export type ChromeConfig = {
  brand?: boolean;
  counter?: boolean;
  progress?: boolean;
};

export type MusicConfig = {
  track?: string;
  gainDb?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
};

export type VideoConfig = {
  topic?: string;
  theme: Theme;
  brand: string;
  voice?: string;
  width?: number;
  height?: number;
  fps?: number;
  caption?: { effect?: CaptionEffect };
  chrome?: ChromeConfig;
  music?: MusicConfig;
  scenes: Scene[];
  totalMs: number;
  hasAudio?: boolean;
};

/* ------------------------------------------------------------------ */
/* Normalised config                                                   */
/* ------------------------------------------------------------------ */

export const CFG = rawConfig as unknown as VideoConfig;
export const THEME: Theme = CFG.theme;
export const BRAND = CFG.brand || "Video Edu";
export const SCENES: Scene[] = CFG.scenes;
export const CAPTION: CaptionEffect = CFG.caption?.effect ?? "karaoke";

export const CHROME: Required<ChromeConfig> = {
  brand: true,
  counter: true,
  progress: true,
  ...CFG.chrome,
};

export const MUSIC: MusicConfig = {
  gainDb: -20,
  fadeInMs: 900,
  fadeOutMs: 1800,
  ...CFG.music,
};

/** True when prepare.py has written real timings into the config. */
export const hasTimings = (scenes: Scene[]): boolean =>
  scenes.length > 0 &&
  scenes.every(
    (s) =>
      Number.isFinite(s.startMs) &&
      Number.isFinite(s.endMs) &&
      s.endMs > s.startMs,
  );
