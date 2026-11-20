import { interpolate, useVideoConfig } from "remotion";

/*
 * Every size in this project is authored on a 1080x1920 reference frame and
 * multiplied by `scale` (width / 1080). Changing width/height in
 * video-config.json therefore keeps the same optical sizes on 4:5, 1:1 or 16:9
 * instead of inheriting 9:16 padding.
 */
export const BASE_WIDTH = 1080;

/*
 * Vertical split of a scene, as fractions of the frame height: the visual owns
 * the band between VISUAL_TOP and VISUAL_BOTTOM, the spoken sentence sits below.
 * Kept here because both the layout and the html visual (which sizes itself
 * against the band) need the same numbers.
 */
export const VISUAL_TOP = 0.085;
export const VISUAL_BOTTOM = 0.56;

export const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi);

export const ease = (f: number, from: number, to: number, a = 0, b = 1) =>
  interpolate(f, [from, to], [a, b], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

/** `#00d4ff` + 0.34 -> `rgba(0, 212, 255, 0.34)`. */
export const withAlpha = (hex: string, alpha: number): string => {
  const h = (hex || "").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (full.length !== 6) return hex;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return hex;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

export type Stage = {
  /** 1 on the 1080x1920 reference frame. */
  scale: number;
  width: number;
  height: number;
  padX: number;
  usable: number;
};

export const useStage = (): Stage => {
  const { width, height } = useVideoConfig();
  // Portrait formats are authored at 1080 wide; landscape ones are scaled from
  // a 1920-wide frame so type and graphics stay proportional to the height.
  const scale = height >= width ? width / BASE_WIDTH : width / 1920;
  const padX = Math.round(width * 0.075);
  return { scale, width, height, padX, usable: width - padX * 2 };
};
