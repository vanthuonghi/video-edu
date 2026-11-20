import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { THEME } from "./config";
import { withAlpha } from "./stage";

/**
 * Static turbulence tile: one 200x200 SVG Chrome paints once and tiles, far
 * cheaper than a per-frame CSS filter.
 */
const GRAIN_URL = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">' +
    '<filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/>' +
    '<feColorMatrix type="saturate" values="0"/></filter>' +
    '<rect width="200" height="200" filter="url(#g)" opacity="0.55"/></svg>',
)}")`;

/**
 * Background stack: theme gradient -> two drifting colour orbs -> vignette ->
 * film grain. Pure CSS/SVG, so it renders identically on the CI runner and
 * never competes with the graphics for attention.
 */
export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const scale = width / 1080;
  const t = frame / fps;

  const c0 = THEME.bg[0] ?? "#000000";
  const c1 = THEME.bg[1] ?? c0;
  const c2 = THEME.bg[2] ?? c1;

  const driftX = Math.sin(t / 7) * 70 * scale;
  const driftY = Math.cos(t / 9) * 50 * scale;

  return (
    <AbsoluteFill style={{ backgroundColor: c0, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `linear-gradient(155deg, ${c0} 0%, ${c1} 48%, ${c2} 100%)`,
        }}
      />

      <div
        style={{
          position: "absolute",
          width: Math.round(Math.max(width, height) * 1.1),
          height: Math.round(Math.max(width, height) * 1.1),
          borderRadius: "50%",
          left: "50%",
          top: "-30%",
          transform: `translate(-50%, 0) translate(${driftX}px, ${driftY}px)`,
          background: `radial-gradient(circle, ${withAlpha(THEME.accent, 0.30)} 0%, transparent 62%)`,
          mixBlendMode: "screen",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: Math.round(Math.max(width, height) * 0.9),
          height: Math.round(Math.max(width, height) * 0.9),
          borderRadius: "50%",
          right: "-30%",
          bottom: "-20%",
          transform: `translate(${-driftX * 0.6}px, ${-driftY * 0.6}px)`,
          background: `radial-gradient(circle, ${withAlpha(THEME.muted, 0.22)} 0%, transparent 64%)`,
          mixBlendMode: "screen",
          opacity: 0.9,
        }}
      />

      {/* Faint grid keeps empty areas from looking like a flat gradient. */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: `${Math.round(90 * scale)}px ${Math.round(90 * scale)}px`,
          opacity: 0.55,
          maskImage: "radial-gradient(70% 60% at 50% 40%, #000 0%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(70% 60% at 50% 40%, #000 0%, transparent 100%)",
        }}
      />

      <AbsoluteFill
        style={{
          background: `radial-gradient(120% 90% at 50% 45%, transparent 40%, rgba(0,0,0,${0.5}) 100%)`,
        }}
      />

      <AbsoluteFill
        style={{
          backgroundImage: GRAIN_URL,
          backgroundSize: `${Math.round(200 * scale)}px`,
          opacity: 0.05,
          mixBlendMode: "overlay",
        }}
      />

      {/* Bottom scrim: the caption sits here and must stay legible. */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, transparent 52%, ${withAlpha(THEME.bg[0] ?? "#000", 0.86)} 100%)`,
          opacity: interpolate(t, [0, 0.4], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />
    </AbsoluteFill>
  );
};
