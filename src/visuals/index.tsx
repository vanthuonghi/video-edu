import React from "react";
import { Img, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Scene, THEME, Visual } from "../config";
import { ease, useStage, withAlpha } from "../stage";
import { Icon } from "./icons";
import { resolveVisual } from "./auto";

/* ------------------------------------------------------------------ */
/* Shared chrome for every visual                                      */
/* ------------------------------------------------------------------ */

const Panel: React.FC<{
  scale: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ scale, children, style }) => (
  <div
    style={{
      width: "100%",
      boxSizing: "border-box",
      borderRadius: Math.round(36 * scale),
      background: `linear-gradient(165deg, ${withAlpha(THEME.text, 0.1)}, ${withAlpha(
        THEME.text,
        0.028,
      )})`,
      border: `1px solid ${withAlpha(THEME.text, 0.13)}`,
      boxShadow: `0 ${Math.round(24 * scale)}px ${Math.round(64 * scale)}px rgba(0,0,0,0.42)`,
      padding: Math.round(34 * scale),
      ...style,
    }}
  >
    {children}
  </div>
);

const Title: React.FC<{ text?: string; scale: number }> = ({ text, scale }) =>
  text ? (
    <div
      style={{
        fontSize: Math.round(26 * scale),
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: withAlpha(THEME.text, 0.6),
        marginBottom: Math.round(24 * scale),
      }}
    >
      {text}
    </div>
  ) : null;

/* ------------------------------------------------------------------ */
/* 1. Icons — a drawn icon inside a live ring                          */
/* ------------------------------------------------------------------ */

const IconScene: React.FC<{
  visual: Extract<Visual, { type: "icons" }>;
  scale: number;
}> = ({ visual, scale }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame,
    fps,
    config: { damping: 13, stiffness: 110, mass: 0.9 },
  });
  const draw = ease(frame, 3, 30);
  const iconSize = Math.round(280 * scale);
  const ring = Math.round(430 * scale);
  const extras = visual.icons.slice(1, 3);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: Math.round(26 * scale),
      }}
    >
      <div
        style={{
          position: "relative",
          width: ring,
          height: ring,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${0.86 + 0.14 * enter})`,
          opacity: Math.min(1, enter * 1.5),
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: -ring * 0.28,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${withAlpha(THEME.accent, 0.28)} 0%, transparent 66%)`,
          }}
        />
        <svg
          width={ring * 1.3}
          height={ring * 1.3}
          viewBox="0 0 100 100"
          style={{ position: "absolute", transform: `rotate(${frame * 0.32}deg)` }}
        >
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke={withAlpha(THEME.accent, 0.38)}
            strokeWidth="0.7"
            strokeDasharray="2.5 5"
          />
        </svg>
        <svg
          width={ring * 1.12}
          height={ring * 1.12}
          viewBox="0 0 100 100"
          style={{ position: "absolute", transform: `rotate(${-frame * 0.6}deg)` }}
        >
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke={withAlpha(THEME.text, 0.16)}
            strokeWidth="0.6"
            strokeDasharray="14 10"
          />
        </svg>

        <div
          style={{
            position: "absolute",
            width: ring * 0.62,
            height: ring * 0.62,
            borderRadius: "50%",
            background: withAlpha(THEME.accent, 0.12),
            border: `1px solid ${withAlpha(THEME.accent, 0.35)}`,
          }}
        />
        <div
          style={{
            transform: `translateY(${Math.sin(frame / 16) * 5 * scale}px)`,
            filter: `drop-shadow(0 0 ${Math.round(18 * scale)}px ${withAlpha(THEME.accent, 0.45)})`,
          }}
        >
          <Icon
            name={visual.icons[0]}
            size={iconSize}
            color={THEME.accent}
            progress={draw}
            strokeWidth={1.35}
          />
        </div>
      </div>

      {visual.label && (
        <div
          style={{
            fontSize: Math.round(38 * scale),
            fontWeight: 800,
            color: THEME.text,
            textAlign: "center",
            opacity: ease(frame, 10, 24),
            transform: `translateY(${(1 - ease(frame, 10, 24)) * 12}px)`,
          }}
        >
          {visual.label}
        </div>
      )}

      {extras.length > 0 && (
        <div style={{ display: "flex", gap: Math.round(22 * scale) }}>
          {extras.map((name, i) => {
            const p = spring({
              frame,
              fps,
              delay: 14 + i * 5,
              config: { damping: 14, stiffness: 140 },
            });
            return (
              <div
                key={name}
                style={{
                  width: Math.round(84 * scale),
                  height: Math.round(84 * scale),
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: withAlpha(THEME.text, 0.07),
                  border: `1px solid ${withAlpha(THEME.text, 0.14)}`,
                  opacity: p,
                  transform: `scale(${0.7 + 0.3 * p})`,
                }}
              >
                <Icon name={name} size={Math.round(44 * scale)} color={THEME.text} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 2. Bars — a chart that grows with the sentence                      */
/* ------------------------------------------------------------------ */

const Bars: React.FC<{
  visual: Extract<Visual, { type: "bars" }>;
  scale: number;
}> = ({ visual, scale }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const values = visual.values;
  const max = Math.max(...values.map((v) => Math.abs(v.value)), 1);
  const chartH = Math.round(340 * scale);

  return (
    <Panel scale={scale} style={{ maxWidth: Math.round(860 * scale) }}>
      <Title text={visual.title} scale={scale} />
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: Math.round(20 * scale),
          height: chartH + Math.round(96 * scale),
        }}
      >
        {values.map((v, i) => {
          const grow = spring({
            frame,
            fps,
            delay: 6 + i * 4,
            config: { damping: 16, stiffness: 95, mass: 0.8 },
          });
          const h = Math.max(8 * scale, (Math.abs(v.value) / max) * chartH * grow);
          const isMax = Math.abs(v.value) === max;
          return (
            <div
              key={`${v.label}-${i}`}
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: Math.round(10 * scale),
              }}
            >
              <div
                style={{
                  fontSize: Math.round(26 * scale),
                  fontWeight: 800,
                  color: isMax ? THEME.accent : withAlpha(THEME.text, 0.75),
                  opacity: grow,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {v.value}
                {visual.unit ? ` ${visual.unit}` : ""}
              </div>
              <div
                style={{
                  width: "100%",
                  height: h,
                  borderRadius: Math.round(14 * scale),
                  background: isMax
                    ? `linear-gradient(180deg, ${THEME.accent}, ${withAlpha(THEME.accent, 0.3)})`
                    : withAlpha(THEME.text, 0.22),
                  boxShadow: isMax ? `0 0 ${Math.round(30 * scale)}px ${withAlpha(THEME.accent, 0.35)}` : undefined,
                }}
              />
              <div
                style={{
                  fontSize: Math.round(23 * scale),
                  lineHeight: 1.2,
                  color: withAlpha(THEME.text, 0.68),
                  textAlign: "center",
                  minHeight: Math.round(56 * scale),
                }}
              >
                {v.label}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
};

/* ------------------------------------------------------------------ */
/* 3. Steps — a numbered flow                                          */
/* ------------------------------------------------------------------ */

const Steps: React.FC<{
  visual: Extract<Visual, { type: "steps" }>;
  scale: number;
}> = ({ visual, scale }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div style={{ width: "100%", maxWidth: Math.round(920 * scale) }}>
      <Title text={visual.title} scale={scale} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: Math.round(18 * scale),
        }}
      >
        {visual.steps.map((step, i) => {
          const enter = spring({
            frame,
            fps,
            delay: 5 + i * 6,
            config: { damping: 16, stiffness: 110 },
          });
          const isFirst = i === 0;
          return (
            <div
              key={`${step}-${i}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: Math.round(24 * scale),
                padding: `${Math.round(20 * scale)}px ${Math.round(26 * scale)}px`,
                borderRadius: Math.round(24 * scale),
                background: isFirst
                  ? withAlpha(THEME.accent, 0.12)
                  : withAlpha(THEME.text, 0.06),
                border: `1px solid ${
                  isFirst ? withAlpha(THEME.accent, 0.45) : withAlpha(THEME.text, 0.12)
                }`,
                opacity: Math.min(1, enter * 1.3),
                transform: `translateX(${(1 - enter) * 90}px)`,
              }}
            >
              <div
                style={{
                  width: Math.round(70 * scale),
                  height: Math.round(70 * scale),
                  flexShrink: 0,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: Math.round(34 * scale),
                  fontWeight: 900,
                  color: isFirst ? THEME.bg[0] : THEME.text,
                  background: isFirst ? THEME.accent : withAlpha(THEME.text, 0.12),
                }}
              >
                {i + 1}
              </div>
              <div
                style={{
                  fontSize: Math.round(38 * scale),
                  fontWeight: 700,
                  lineHeight: 1.25,
                  color: THEME.text,
                }}
              >
                {step}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 4. Phone — a chat mock that types itself                            */
/* ------------------------------------------------------------------ */

const Phone: React.FC<{
  visual: Extract<Visual, { type: "phone" }>;
  scale: number;
}> = ({ visual, scale }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 16, stiffness: 110 } });
  const w = Math.round(500 * scale);
  const h = Math.round(690 * scale);
  const messages = visual.messages;

  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: Math.round(52 * scale),
        padding: Math.round(20 * scale),
        boxSizing: "border-box",
        background: `linear-gradient(170deg, ${withAlpha(THEME.text, 0.14)}, ${withAlpha(
          THEME.text,
          0.04,
        )})`,
        border: `2px solid ${withAlpha(THEME.text, 0.22)}`,
        boxShadow: `0 ${Math.round(30 * scale)}px ${Math.round(70 * scale)}px rgba(0,0,0,0.5)`,
        transform: `translateY(${(1 - enter) * 60}px) scale(${0.94 + 0.06 * enter})`,
        opacity: enter,
        display: "flex",
        flexDirection: "column",
        gap: Math.round(14 * scale),
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: Math.round(10 * scale),
          paddingBottom: Math.round(12 * scale),
          borderBottom: `1px solid ${withAlpha(THEME.text, 0.12)}`,
        }}
      >
        <div style={{ display: "flex", gap: Math.round(6 * scale) }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: Math.round(8 * scale),
                height: Math.round(8 * scale),
                borderRadius: "50%",
                background: withAlpha(THEME.text, 0.35),
              }}
            />
          ))}
        </div>
        <div
          style={{
            fontSize: Math.round(22 * scale),
            fontWeight: 700,
            color: withAlpha(THEME.text, 0.7),
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {visual.title || "Tin nhắn"}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          gap: Math.round(14 * scale),
        }}
      >
        {messages.map((m, i) => {
          const p = spring({
            frame,
            fps,
            delay: 12 + i * 9,
            config: { damping: 15, stiffness: 140 },
          });
          const mine = m.from === "me";
          return (
            <div
              key={`${m.text}-${i}`}
              style={{
                alignSelf: mine ? "flex-end" : "flex-start",
                maxWidth: "82%",
                padding: `${Math.round(16 * scale)}px ${Math.round(20 * scale)}px`,
                borderRadius: Math.round(22 * scale),
                borderBottomRightRadius: mine ? Math.round(6 * scale) : undefined,
                borderBottomLeftRadius: mine ? undefined : Math.round(6 * scale),
                background: mine ? THEME.accent : withAlpha(THEME.text, 0.12),
                color: mine ? THEME.bg[0] : THEME.text,
                fontSize: Math.round(26 * scale),
                fontWeight: mine ? 700 : 600,
                lineHeight: 1.3,
                opacity: p,
                transform: `translateY(${(1 - p) * 22}px) scale(${0.92 + 0.08 * p})`,
              }}
            >
              {m.text}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 5. Compare — before / after                                         */
/* ------------------------------------------------------------------ */

const Compare: React.FC<{
  visual: Extract<Visual, { type: "compare" }>;
  scale: number;
}> = ({ visual, scale }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const left = spring({ frame, fps, delay: 0, config: { damping: 16, stiffness: 110 } });
  const right = spring({ frame, fps, delay: 8, config: { damping: 16, stiffness: 110 } });
  const arrow = ease(frame, 12, 26);

  const card = (
    label: string,
    text: string,
    accent: string,
    mark: string,
    p: number,
    fromX: number,
  ) => (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        padding: `${Math.round(26 * scale)}px`,
        borderRadius: Math.round(28 * scale),
        background: withAlpha(accent, 0.1),
        border: `1.5px solid ${withAlpha(accent, 0.5)}`,
        display: "flex",
        flexDirection: "column",
        gap: Math.round(12 * scale),
        opacity: Math.min(1, p * 1.4),
        transform: `translateX(${(1 - p) * fromX}px)`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: Math.round(10 * scale),
          fontSize: Math.round(22 * scale),
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: accent,
        }}
      >
        <span style={{ fontSize: Math.round(28 * scale) }}>{mark}</span>
        {label}
      </div>
      <div
        style={{
          fontSize: Math.round(31 * scale),
          fontWeight: 700,
          lineHeight: 1.3,
          color: THEME.text,
        }}
      >
        {text}
      </div>
    </div>
  );

  return (
    <div style={{ width: "100%", maxWidth: Math.round(930 * scale) }}>
      <Title text={visual.title} scale={scale} />
      <div style={{ display: "flex", alignItems: "stretch", gap: Math.round(16 * scale) }}>
        {card("Trước", visual.before, THEME.muted, "✕", left, -80)}
        <div
          style={{
            width: Math.round(54 * scale),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: Math.round(40 * scale),
            color: THEME.accent,
            opacity: arrow,
            transform: `translateX(${(1 - arrow) * -10}px)`,
          }}
        >
          →
        </div>
        {card("Sau", visual.after, THEME.accent, "✓", right, 80)}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 6. Counter — one number that lands                                  */
/* ------------------------------------------------------------------ */

const Counter: React.FC<{
  visual: Extract<Visual, { type: "counter" }>;
  scale: number;
}> = ({ visual, scale }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const raw = String(visual.value);
  const numeric = Number(raw.replace(/[^0-9.,-]/g, "").replace(",", "."));
  const hasNumber = Number.isFinite(numeric) && raw.replace(/[^0-9]/g, "").length > 0;
  const shown = hasNumber
    ? Math.round(ease(frame, 4, 4 + Math.round(fps * 0.9), 0, numeric))
    : null;
  const enter = spring({ frame, fps, config: { damping: 12, stiffness: 120 } });
  const underline = ease(frame, 8, 30);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: Math.round(10 * scale),
        transform: `scale(${0.9 + 0.1 * enter})`,
        opacity: enter,
      }}
    >
      <div
        style={{
          fontSize: Math.round(190 * scale),
          fontWeight: 900,
          lineHeight: 0.95,
          letterSpacing: "-0.03em",
          color: THEME.accent,
          fontVariantNumeric: "tabular-nums",
          textShadow: `0 0 ${Math.round(60 * scale)}px ${withAlpha(THEME.accent, 0.45)}`,
        }}
      >
        {shown !== null ? shown : raw}
      </div>
      <div
        style={{
          height: Math.max(4, Math.round(7 * scale)),
          width: `${underline * 100}%`,
          maxWidth: Math.round(420 * scale),
          borderRadius: 99,
          background: `linear-gradient(90deg, transparent, ${THEME.accent}, transparent)`,
        }}
      />
      {(visual.unit || visual.label) && (
        <div
          style={{
            fontSize: Math.round(40 * scale),
            fontWeight: 700,
            color: withAlpha(THEME.text, 0.85),
            textAlign: "center",
            marginTop: Math.round(10 * scale),
          }}
        >
          {visual.unit}
          {visual.unit && visual.label ? " · " : ""}
          {visual.label}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 7. List — a checklist that ticks itself                             */
/* ------------------------------------------------------------------ */

const ListScene: React.FC<{
  visual: Extract<Visual, { type: "list" }>;
  scale: number;
}> = ({ visual, scale }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const items = visual.items;

  return (
    <div style={{ width: "100%", maxWidth: Math.round(920 * scale) }}>
      <Title text={visual.title} scale={scale} />
      <div style={{ display: "flex", flexDirection: "column", gap: Math.round(16 * scale) }}>
        {items.map((item, i) => {
          const p = spring({
            frame,
            fps,
            delay: 5 + i * 7,
            config: { damping: 16, stiffness: 120 },
          });
          const tick = ease(frame, 12 + i * 7, 24 + i * 7);
          return (
            <div
              key={`${item}-${i}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: Math.round(20 * scale),
                padding: `${Math.round(18 * scale)}px ${Math.round(22 * scale)}px`,
                borderRadius: Math.round(22 * scale),
                background: withAlpha(THEME.text, 0.055),
                border: `1px solid ${withAlpha(THEME.text, 0.11)}`,
                opacity: Math.min(1, p * 1.4),
                transform: `translateY(${(1 - p) * 24}px)`,
              }}
            >
              <div
                style={{
                  width: Math.round(48 * scale),
                  height: Math.round(48 * scale),
                  flexShrink: 0,
                  borderRadius: Math.round(12 * scale),
                  background: withAlpha(THEME.accent, 0.18),
                  border: `2px solid ${withAlpha(THEME.accent, 0.75)}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon
                  name="check"
                  size={Math.round(30 * scale)}
                  color={THEME.accent}
                  progress={tick}
                  strokeWidth={2.4}
                />
              </div>
              <div
                style={{
                  fontSize: Math.round(32 * scale),
                  fontWeight: 650,
                  lineHeight: 1.25,
                  color: THEME.text,
                }}
              >
                {item}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 8. Photo — optional still with Ken Burns                            */
/* ------------------------------------------------------------------ */

const Photo: React.FC<{
  visual: Extract<Visual, { type: "photo" }>;
  scale: number;
}> = ({ visual, scale }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = Math.min(1, frame / Math.max(1, durationInFrames));
  const enter = ease(frame, 0, 14);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: Math.round(34 * scale),
        overflow: "hidden",
        position: "relative",
        border: `2px solid ${withAlpha(THEME.accent, 0.5)}`,
        boxShadow: `0 ${Math.round(26 * scale)}px ${Math.round(70 * scale)}px rgba(0,0,0,0.5)`,
        opacity: enter,
        transform: `scale(${0.97 + 0.03 * enter})`,
      }}
    >
      <Img
        src={staticFile(visual.image)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${1.06 + progress * 0.1}) translateX(${progress * 2 - 1}%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, transparent 55%, ${withAlpha(THEME.bg[0] ?? "#000", 0.88)} 100%)`,
        }}
      />
      {visual.caption && (
        <div
          style={{
            position: "absolute",
            left: Math.round(26 * scale),
            right: Math.round(26 * scale),
            bottom: Math.round(24 * scale),
            fontSize: Math.round(26 * scale),
            fontWeight: 700,
            color: THEME.text,
          }}
        >
          {visual.caption}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Dispatch                                                            */
/* ------------------------------------------------------------------ */

export const VisualLayer: React.FC<{ scene: Scene }> = ({ scene }) => {
  const { scale } = useStage();
  const visual = resolveVisual(scene);

  switch (visual.type) {
    case "icons":
      return <IconScene visual={visual} scale={scale} />;
    case "bars":
      return <Bars visual={visual} scale={scale} />;
    case "steps":
      return <Steps visual={visual} scale={scale} />;
    case "phone":
      return <Phone visual={visual} scale={scale} />;
    case "compare":
      return <Compare visual={visual} scale={scale} />;
    case "counter":
      return <Counter visual={visual} scale={scale} />;
    case "list":
      return <ListScene visual={visual} scale={scale} />;
    case "photo":
      return <Photo visual={visual} scale={scale} />;
    default:
      return null;
  }
};
