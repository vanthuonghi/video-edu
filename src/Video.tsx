import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Background } from "./Background";
import { Caption } from "./Caption";
import { BRAND, CFG, CHROME, hasTimings, Scene, THEME } from "./config";
import { fontsReady } from "./fonts";
import { clamp, ease, useStage, withAlpha } from "./stage";
import { VisualLayer } from "./visuals";

void fontsReady;

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

/**
 * Portrait-first split: the motion graphic owns the upper half, the spoken
 * sentence sits in the lower third. Ratios (not pixels) keep it intact on
 * 4:5, 1:1 and 16:9.
 */
const VISUAL_TOP = 0.1;
const VISUAL_BOTTOM = 0.55;
const CAPTION_TOP = 0.585;
const CAPTION_BOTTOM = 0.9;

/* ------------------------------------------------------------------ */
/* Brand / counter / progress                                          */
/* ------------------------------------------------------------------ */

const Chrome: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const stage = useStage();
  const scenes = CFG.scenes;
  const timed = hasTimings(scenes);
  const ms = (frame / fps) * 1000;
  const totalMs = CFG.totalMs || (durationInFrames / fps) * 1000;

  let index = 0;
  if (timed) {
    const found = scenes.findIndex((s) => ms >= s.startMs && ms < s.endMs);
    index = found >= 0 ? found : ms < scenes[0].startMs ? 0 : scenes.length - 1;
  }

  const top = Math.round(height * 0.035);
  const chip: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: Math.round(10 * stage.scale),
    padding: `${Math.round(8 * stage.scale)}px ${Math.round(16 * stage.scale)}px`,
    borderRadius: 999,
    backgroundColor: withAlpha(THEME.text, 0.07),
    border: `1px solid ${withAlpha(THEME.text, 0.14)}`,
    backdropFilter: "blur(6px)",
  };

  return (
    <>
      {CHROME.brand && (
        <div style={{ position: "absolute", top, left: stage.padX, ...chip }}>
          <div
            style={{
              width: Math.round(10 * stage.scale),
              height: Math.round(10 * stage.scale),
              borderRadius: "50%",
              background: THEME.accent,
              boxShadow: `0 0 ${Math.round(14 * stage.scale)}px ${THEME.accent}`,
            }}
          />
          <div
            style={{
              fontSize: Math.round(25 * stage.scale),
              fontWeight: 700,
              letterSpacing: "0.02em",
              color: withAlpha(THEME.text, 0.9),
            }}
          >
            {BRAND}
          </div>
        </div>
      )}

      {CHROME.counter && (
        <div style={{ position: "absolute", top, right: stage.padX, ...chip }}>
          <div
            style={{
              fontSize: Math.round(22 * stage.scale),
              fontWeight: 800,
              letterSpacing: "0.08em",
              color: withAlpha(THEME.text, 0.72),
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {String(index + 1).padStart(2, "0")}
            <span style={{ opacity: 0.45 }}> / {String(scenes.length).padStart(2, "0")}</span>
          </div>
        </div>
      )}

      {CHROME.progress && (
        <div
          style={{
            position: "absolute",
            left: stage.padX,
            right: stage.padX,
            bottom: Math.round(height * 0.035),
            display: "flex",
            gap: Math.round(5 * stage.scale),
            height: Math.max(3, Math.round(5 * stage.scale)),
          }}
        >
          {timed ? (
            scenes.map((s, i) => {
              const fill =
                i < index
                  ? 1
                  : i > index
                    ? 0
                    : clamp((ms - s.startMs) / Math.max(1, s.endMs - s.startMs), 0, 1);
              return (
                <div
                  key={i}
                  style={{
                    flex: Math.max(1, s.endMs - s.startMs),
                    borderRadius: 99,
                    background: withAlpha(THEME.text, 0.16),
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${fill * 100}%`,
                      height: "100%",
                      borderRadius: 99,
                      background: `linear-gradient(90deg, ${THEME.accent}, ${THEME.muted})`,
                    }}
                  />
                </div>
              );
            })
          ) : (
            <div
              style={{
                flex: 1,
                borderRadius: 99,
                background: withAlpha(THEME.text, 0.16),
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${clamp(ms / Math.max(1, totalMs), 0, 1) * 100}%`,
                  height: "100%",
                  background: THEME.accent,
                }}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
};

/* ------------------------------------------------------------------ */
/* Call to action pill                                                 */
/* ------------------------------------------------------------------ */

const CtaBadge: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stage = useStage();
  const enter = spring({ frame, fps, delay: 8, config: { damping: 12, stiffness: 140 } });
  const period = Math.max(1, Math.round(fps * 2.6));
  const sweep = (frame % period) / period;
  const sheen = interpolate(sweep, [0, 1], [-140, 220]);

  return (
    <div
      style={{
        alignSelf: "center",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        gap: Math.round(14 * stage.scale),
        padding: `${Math.round(18 * stage.scale)}px ${Math.round(36 * stage.scale)}px`,
        borderRadius: 999,
        background: `linear-gradient(135deg, ${THEME.accent}, ${THEME.muted})`,
        boxShadow: `0 ${Math.round(14 * stage.scale)}px ${Math.round(46 * stage.scale)}px ${withAlpha(
          THEME.accent,
          0.4,
        )}`,
        opacity: Math.min(1, enter * 1.4),
        transform: `scale(${0.85 + 0.15 * enter})`,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          width: "35%",
          left: `${sheen}%`,
          background:
            "linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0) 100%)",
        }}
      />
      <div style={{ fontSize: Math.round(26 * stage.scale), color: THEME.bg[0] }}>▶</div>
      <div
        style={{
          fontSize: Math.round(28 * stage.scale),
          fontWeight: 900,
          color: THEME.bg[0],
          whiteSpace: "nowrap",
        }}
      >
        Theo dõi {BRAND}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* One scene                                                           */
/* ------------------------------------------------------------------ */

const SceneLayer: React.FC<{ scene: Scene; index: number; total: number }> = ({
  scene,
  index,
  total,
}) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const stage = useStage();
  const lengthMs = Math.max(400, scene.endMs - scene.startMs);
  const lengthFrames = Math.max(1, Math.round((lengthMs / 1000) * fps));

  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 130, mass: 0.8 } });
  const outFrames = Math.min(9, Math.max(3, Math.round(lengthFrames * 0.12)));
  const exit = total > 1 && index < total - 1 ? ease(frame, lengthFrames - outFrames, lengthFrames) : 0;

  // Scene-level transition: only neighbouring scenes overlap, so fading the
  // whole layer is enough and keeps every frame cheap to render.
  const isFirst = index === 0;
  const opacity = (isFirst ? Math.min(1, frame / 6) : enter) * (1 - exit);
  const slide = isFirst ? 0 : (1 - enter) * Math.round(46 * stage.scale);

  const visualTop = Math.round(height * VISUAL_TOP);
  const visualHeight = Math.round(height * (VISUAL_BOTTOM - VISUAL_TOP));
  const captionTop = Math.round(height * CAPTION_TOP);
  const captionHeight = Math.round(height * (CAPTION_BOTTOM - CAPTION_TOP));

  return (
    <AbsoluteFill style={{ opacity, transform: `translateY(${slide}px)` }}>
      <div
        style={{
          position: "absolute",
          left: stage.padX,
          right: stage.padX,
          top: visualTop,
          height: visualHeight,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <VisualLayer scene={scene} />
      </div>

      <div
        style={{
          position: "absolute",
          left: stage.padX,
          right: stage.padX,
          top: captionTop,
          height: captionHeight,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: Math.round(22 * stage.scale),
        }}
      >
        {scene.kind === "cta" && <CtaBadge />}
        <Caption scene={scene} height={captionHeight} />
      </div>

      {/* Slight camera push keeps a still moment from looking frozen. */}
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          boxShadow: `inset 0 0 ${Math.round(120 * stage.scale)}px ${withAlpha(
            THEME.bg[0] ?? "#000",
            0.35 + 0.1 * clamp(frame / Math.max(1, lengthFrames), 0, 1),
          )}`,
        }}
      />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Root composition                                                    */
/* ------------------------------------------------------------------ */

export const Video: React.FC = () => {
  const { fps } = useVideoConfig();
  const scenes = CFG.scenes;

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.bg[0] ?? "#000" }}>
      {CFG.hasAudio !== false && <Audio src={staticFile("voiceover.mp3")} />}
      <Background />
      {scenes.map((scene, i) => {
        const from = Math.round((scene.startMs / 1000) * fps);
        const to = Math.round((scene.endMs / 1000) * fps);
        return (
          <Sequence
            key={`${i}-${scene.startMs}`}
            from={from}
            durationInFrames={Math.max(1, to - from)}
            name={`Scene ${i + 1}`}
          >
            <SceneLayer scene={scene} index={i} total={scenes.length} />
          </Sequence>
        );
      })}
      <Chrome />
    </AbsoluteFill>
  );
};
