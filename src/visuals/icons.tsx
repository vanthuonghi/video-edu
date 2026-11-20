import React from "react";

/**
 * Stroke-only icon set drawn on a 24x24 grid. Icons are the cheapest way to
 * put a real picture on screen: they are inline SVG, so they stay crisp at any
 * frame size, need no downloads and can be animated stroke by stroke.
 */
export const ICON_PATHS = {
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7.5V12l3 1.8",
  bolt: "M13 2 5 13h6l-1 9 8-11h-6l1-9z",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z",
  chart: "M4 20V10M10 20V4M16 20v-7M21 20H3",
  check: "M4 12.5 9 17.5 20 6.5",
  book: "M5 3h14v18H5zM9 7h6M9 11h6M9 15h4",
  target: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10M12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2",
  rocket: "M12 2c3 2 5 5.7 5 9.2L14.5 14h-5L7 11.2C7 7.7 9 4 12 2zM9.5 14 6 17.5M14.5 14 18 17.5M12 8.5v.01",
  coin: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 8v8M9.5 10.5h5M9.5 14.5h5",
  spark: "M12 3v4M12 17v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M3 12h4M17 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8",
  bell: "M12 3a5 5 0 0 0-5 5v4l-2 3h14l-2-3V8a5 5 0 0 0-5-5zM10 19a2 2 0 0 0 4 0",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M16.5 16.5 21 21",
  gear: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1",
  star: "M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3z",
  shield: "M12 3l7 3v5c0 4.5-3 7.5-7 10-4-2.5-7-5.5-7-10V6l7-3z",
  users: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M2 20c0-3 2.7-5 6-5s6 2 6 5M16 5.5a3 3 0 0 1 0 5.5M17 15c2.5.5 5 2.5 5 5",
  calendar: "M4 6h16v15H4zM4 10h16M8 3v4M16 3v4",
  play: "M8 5l11 7-11 7V5z",
  phone: "M7 2h10v20H7zM10 5h4M10 19h4",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  heart: "M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9z",
  eye: "M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  arrowUp: "M12 20V5M6 11l6-6 6 6",
  doc: "M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h4",
} as const;

export type IconName = keyof typeof ICON_PATHS;

export const ICON_NAMES = Object.keys(ICON_PATHS) as IconName[];

export const isIconName = (name: string): name is IconName =>
  Object.prototype.hasOwnProperty.call(ICON_PATHS, name);

export const Icon: React.FC<{
  name: string;
  size: number;
  color: string;
  /** 0..1 stroke reveal. */
  progress?: number;
  strokeWidth?: number;
}> = ({ name, size, color, progress = 1, strokeWidth = 1.7 }) => {
  const d = isIconName(name) ? ICON_PATHS[name] : ICON_PATHS.spark;
  const p = Math.min(1, Math.max(0, progress));
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* pathLength=1 lets every icon share the same dash reveal. */}
      <path d={d} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
    </svg>
  );
};
