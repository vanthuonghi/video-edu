import React, { useLayoutEffect, useMemo, useRef } from "react";
import { staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Scene, THEME, Visual } from "../config";
import { FONT_FAMILY } from "../fonts";

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
 */

const BASE_CSS = `
  :host { display: block; width: 100%; height: 100%; }
  #hv-root {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    font-family: ${FONT_FAMILY};
    color: ${THEME.text};
    overflow: hidden;
  }
  #hv-root *, #hv-root *::before, #hv-root *::after { box-sizing: border-box; }
  #hv-root img { max-width: 100%; }
`;

/** `{{asset:images/x.png}}` -> the staticFile URL Remotion serves. */
const resolveAssets = (markup: string): string =>
  markup.replace(/\{\{\s*asset:\s*([^}]+?)\s*\}\}/g, (_match, path: string) => staticFile(path));

const FUNCTION_FORM = /^function\s*\(\s*[\w$]+\s*,\s*[\w$]+\s*\)\s*\{([\s\S]*)\}$/;

type Anim = (t: number, el: Element) => void;

/**
 * Accepts either a bare body (`el.style...`) or a `function(t, el){...}`
 * expression copied from a video-html episode. Helpers are passed in, so a
 * fragment never has to redefine ease/span/lock.
 */
const compile = (source: string): Anim | null => {
  const code = source.trim();
  if (!code) return null;
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

    return (t, el) =>
      fn(
        t,
        el,
        (x) => (x < 0 ? 0 : x > 1 ? 1 : x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
        (value, a, b) => (value - a) / (b - a),
        (x, a, b) => Math.max(a, Math.min(b, x)),
        (x, a, b) => Math.max(a, Math.min(b, x)),
        (id) => el.querySelector(`#${id}`),
      );
  } catch (error) {
    console.warn("html visual: anim failed to compile", error);
    return null;
  }
};

export const HtmlVisual: React.FC<{
  visual: Extract<Visual, { type: "html" }>;
  scene: Scene;
  scale: number;
}> = ({ visual, scene, scale }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const host = useRef<HTMLDivElement>(null);
  const anim = useMemo(() => compile(visual.anim || ""), [visual.anim]);
  const signature = useMemo(
    () => `${visual.html}\u0000${visual.css || ""}`,
    [visual.html, visual.css],
  );

  useLayoutEffect(() => {
    const node = host.current;
    if (!node) return;
    const root = node.shadowRoot ?? node.attachShadow({ mode: "open" });

    // Rebuild only when the markup changes; every frame just re-runs anim.
    if (node.getAttribute("data-signature") !== signature) {
      root.innerHTML = "";
      const style = document.createElement("style");
      style.textContent = `${BASE_CSS}\n${visual.css || ""}`;
      const wrapper = document.createElement("div");
      wrapper.id = "hv-root";
      wrapper.innerHTML = resolveAssets(visual.html);
      root.append(style, wrapper);
      node.setAttribute("data-signature", signature);
    }

    const surface = root.querySelector("#hv-root");
    if (!surface) return;
    try {
      // Scene-relative seconds: t=0 is the first frame of this scene.
      anim?.(frame / fps, surface);
    } catch (error) {
      console.warn("html visual: anim threw", error);
    }
  }, [anim, frame, fps, signature, visual.html, visual.css]);

  void scene;
  void scale;

  return (
    <div
      ref={host}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
      }}
    />
  );
};
