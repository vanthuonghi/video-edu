import React, { useLayoutEffect, useMemo, useRef } from "react";
import { staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Scene, THEME, Visual } from "../config";
import { FONT_FAMILY } from "../fonts";
import { clamp, useStage, VISUAL_BOTTOM, VISUAL_TOP } from "../stage";

/**
 * Escape hatch for designs the eleven built-in visuals cannot express.
 *
 * The contract is deliberately the same one video-html uses for its
 * frame-capture pipeline: `anim(t, el)` is a pure function of scene time that
 * recomputes every style from `t` and never remembers the previous frame. That
 * is exactly what Remotion needs, so a scene written for `chup-nhanh.py` can
 * run here unchanged.
 *
 * Isolation: the fragment is mounted in a shadow root, so its `h1`/`.card`
 * rules cannot leak into the caption or the chrome.
 *
 * Sizing: a fragment is authored in `px` on the 1080x720 visual band. Every
 * `Npx` is rewritten to `calc(N * var(--u))`, and `--u` is measured from the
 * band that actually exists this frame — 1.0 on 9:16, ~0.7 on 1:1/16:9, and
 * the full frame when `full: true`. One fragment therefore fits 4:5, 1:1 and
 * 16:9 without being rewritten per format.
 */

/** Reference canvas a fragment's px values are authored against. */
const DESIGN_W = 1080;
const DESIGN_H = 720;

const BASE_CSS = `
  :host { display: block; width: 100%; height: 100%; }
  #hv-root {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    font-family: ${FONT_FAMILY};
    font-size: calc(16 * var(--u, 1px));
    color: ${THEME.text};
    overflow: hidden;
  }
  #hv-root *, #hv-root *::before, #hv-root *::after { box-sizing: border-box; }
  #hv-root img { max-width: 100%; }
`;

/** `{{asset:images/x.png}}` -> the staticFile URL Remotion serves. */
const resolveAssets = (markup: string): string =>
  markup.replace(/\{\{\s*asset:\s*([^}]+?)\s*\}\}/g, (_match, path: string) => staticFile(path));

/* ------------------------------------------------------------------ */
/* px -> --u                                                           */
/* ------------------------------------------------------------------ */

const PX = /(-?\d*\.?\d+)px\b/g;

/**
 * Queries and string literals must survive untouched: `calc()` is not allowed
 * inside `@media (...)`, and a `px` inside `url()` or `content:"..."` is data,
 * not a length. They are swapped out for tokens first.
 */
const NOT_A_LENGTH = /@media[^{]*|@supports[^{]*|url\([^)]*\)|"[^"]*"|'[^']*'/g;

const scalePx = (text: string): string =>
  text.replace(PX, (_match, n: string) => `calc(${n} * var(--u, 1px))`);

const scaleCss = (css: string): string => {
  const kept: string[] = [];
  const masked = css.replace(NOT_A_LENGTH, (match) => {
    kept.push(match);
    return `\u0001${kept.length - 1}\u0001`;
  });
  return scalePx(masked).replace(/\u0001(\d+)\u0001/g, (_match, i: string) => kept[Number(i)] ?? "");
};

/** Inline styles in the markup are lengths too: `<i style="width:40px">`. */
const scaleInlineStyles = (markup: string): string =>
  markup.replace(
    /style\s*=\s*(?:"([^"]*)"|'([^']*)')/gi,
    (_match, double: string | undefined, single: string | undefined) =>
      `style="${scaleCss(double ?? single ?? "")}"`,
  );

const FUNCTION_FORM = /^function\s*\(\s*[\w$]+\s*,\s*[\w$]+\s*\)\s*\{([\s\S]*)\}$/;

type Anim = (t: number, el: Element) => void;

/**
 * Accepts either a bare body (`el.style...`) or a `function(t, el){...}`
 * expression copied from a video-html episode. Helpers are passed in, so a
 * fragment never has to redefine ease/span/lock.
 */
type Compiled = { fn: Anim | null; error: string | null };

const compile = (source: string): Compiled => {
  const code = source.trim();
  if (!code) return { fn: null, error: null };
  const match = code.match(FUNCTION_FORM);
  const body = match ? match[1] : code;
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      "t",
      "el",
      "ease",
      "span",
      "lock",
      "clamp",
      "$",
      body,
    ) as (
      t: number,
      el: Element,
      ease: (x: number) => number,
      span: (t: number, a: number, b: number) => number,
      lock: (x: number, a: number, b: number) => number,
      clamp: (x: number, a: number, b: number) => number,
      $: (id: string) => Element | null,
    ) => void;

    return {
      fn: (t, el) =>
        fn(
          t,
          el,
          (x) => (x < 0 ? 0 : x > 1 ? 1 : x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
          (value, a, b) => (value - a) / (b - a),
          (x, a, b) => Math.max(a, Math.min(b, x)),
          (x, a, b) => Math.max(a, Math.min(b, x)),
          // video-html passes bare ids (`$('e1f')`); accept '#id' too so a
          // fragment copied from jQuery-style code still resolves.
          (id) => el.querySelector(id.trim().startsWith("#") ? id.trim() : `#${id.trim()}`),
        ),
      error: null,
    };
  } catch (error) {
    console.warn("html visual: anim failed to compile", error);
    return { fn: null, error: String(error) };
  }
};

/** A broken anim must be visible in the still, not silently static. */
const showError = (surface: Element, message: string) => {
  let box = surface.querySelector("#hv-error");
  if (!box) {
    box = document.createElement("pre");
    box.id = "hv-error";
    box.setAttribute(
      "style",
      "position:absolute;left:0;right:0;top:0;margin:0;padding:16px;background:#7a0d24;color:#fff;font:600 20px/1.35 monospace;white-space:pre-wrap;z-index:9",
    );
    surface.appendChild(box);
  }
  box.textContent = `html visual\n${message}`;
};

export const HtmlVisual: React.FC<{
  visual: Extract<Visual, { type: "html" }>;
  scene: Scene;
  scale: number;
}> = ({ visual, scene, scale }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const { padX } = useStage();
  const host = useRef<HTMLDivElement>(null);
  const compiled = useMemo(() => compile(visual.anim || ""), [visual.anim]);

  // The box this fragment really gets: the visual band, or the whole frame for
  // `full: true`. `--u` is 1.0 when that box is the 1080x720 reference.
  const boxW = visual.full ? width : width - padX * 2;
  const boxH = visual.full ? height : height * (VISUAL_BOTTOM - VISUAL_TOP);
  const unit = clamp(Math.min(boxW / DESIGN_W, boxH / DESIGN_H), 0.15, 4);

  const markup = useMemo(
    () => resolveAssets(scaleInlineStyles(visual.html)),
    [visual.html],
  );
  const css = useMemo(() => scaleCss(visual.css || ""), [visual.css]);
  const signature = useMemo(() => `${markup}\u0000${css}`, [markup, css]);

  useLayoutEffect(() => {
    const node = host.current;
    if (!node) return;
    const root = node.shadowRoot ?? node.attachShadow({ mode: "open" });

    // Rebuild only when the markup changes; every frame just re-runs anim.
    if (node.getAttribute("data-signature") !== signature) {
      root.innerHTML = "";
      const style = document.createElement("style");
      style.textContent = `${BASE_CSS}\n${css}`;
      const wrapper = document.createElement("div");
      wrapper.id = "hv-root";
      wrapper.innerHTML = markup;
      root.append(style, wrapper);
      node.setAttribute("data-signature", signature);
    }

    const surface = root.querySelector("#hv-root");
    if (!surface) return;
    if (compiled.error) showError(surface, compiled.error);
    try {
      // Scene-relative seconds: t=0 is the first frame of this scene.
      compiled.fn?.(frame / fps, surface);
    } catch (error) {
      console.warn("html visual: anim threw", error);
      showError(surface, String(error));
    }
  }, [compiled, css, frame, fps, markup, signature]);

  void scene;
  void scale;

  return (
    <div
      ref={host}
      style={
        {
          width: "100%",
          height: "100%",
          display: "block",
          // Custom property inherited into the shadow root; the fragment's
          // px values become `calc(N * var(--u))`.
          "--u": `${unit.toFixed(4)}px`,
        } as React.CSSProperties
      }
    />
  );
};
