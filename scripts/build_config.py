#!/usr/bin/env python3
"""Turn a brief (or a topic) into src/video-config.json.

This is the single entry point used by GitHub Actions, by the web UI dispatch
and by the CLI, so the config schema lives in exactly one place.

    python3 scripts/build_config.py --topic "cách học từ vựng" --scenes 8
    python3 scripts/build_config.py --brief brief.json --theme warm --format 4:5
    python3 scripts/build_config.py --from-env        # workflow_dispatch inputs
"""
import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "src" / "video-config.json"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from script_writer import write_scenes  # noqa: E402

THEMES = {
    "neon": {
        "id": "neon",
        "bg": ["#000814", "#001028", "#000814"],
        "text": "#eaf6ff",
        "accent": "#00d4ff",
        "muted": "#ff2e88",
    },
    "warm": {
        "id": "warm",
        "bg": ["#1a0f08", "#2a1a0e", "#120a06"],
        "text": "#fff3e0",
        "accent": "#ffb347",
        "muted": "#ff7043",
    },
    "paper": {
        "id": "paper",
        "bg": ["#f7f3ea", "#efe9dc", "#f7f3ea"],
        "text": "#16202a",
        "accent": "#e8543f",
        "muted": "#2a9d8f",
    },
}

FORMATS = {
    "9:16": (1080, 1920),
    "4:5": (1080, 1350),
    "1:1": (1080, 1080),
    "16:9": (1920, 1080),
}

MUSIC_PRESETS = {
    "neon": "music/bed-neon.mp3",
    "warm": "music/bed-warm.mp3",
    "paper": "music/bed-warm.mp3",
    "none": "",
}

VOICES = {
    "nu": "vi-VN-HoaiMyNeural",
    "nam": "vi-VN-NamMinhNeural",
}

DEFAULTS = {
    "brand": "Văn Hỉ Official",
    "voice": VOICES["nu"],
    "theme": "neon",
    "format": "9:16",
    "caption": "karaoke",
    "scenes": 8,
}


def _read_brief(value):
    """Accept inline JSON or a path (also the @path convention)."""
    if not value:
        return {}
    text = value
    if text.startswith("@"):
        text = Path(text[1:]).read_text(encoding="utf-8")
    elif Path(text).is_file():
        text = Path(text).read_text(encoding="utf-8")
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"brief is not valid JSON: {exc}")
    if not isinstance(parsed, dict):
        raise SystemExit("brief must be a JSON object")
    return parsed


def _clean_scene(scene, index, total):
    text = str(scene.get("text", "")).strip()
    if not text:
        raise SystemExit(f"scene {index + 1} has no text")
    kind = scene.get("kind") if scene.get("kind") in ("hook", "body", "cta") else "body"
    if index == 0:
        kind = "hook"
    if index == total - 1 and total > 1:
        kind = "cta"
    out = {
        "text": text,
        "highlight": str(scene.get("highlight", "")).strip(),
        "kind": kind,
        "startMs": 0,
        "endMs": 0,
    }
    visual = scene.get("visual")
    if visual:
        out["visual"] = visual
    return out


def build(brief):
    theme_name = brief.get("theme") or DEFAULTS["theme"]
    if isinstance(theme_name, dict):
        theme = theme_name
    elif theme_name in THEMES:
        theme = THEMES[theme_name]
    else:
        raise SystemExit(f"unknown theme {theme_name!r} (use neon, warm or paper)")

    fmt = brief.get("format") or DEFAULTS["format"]
    if fmt not in FORMATS:
        raise SystemExit(f"unknown format {fmt!r} (use {', '.join(FORMATS)})")
    width, height = FORMATS[fmt]

    music = brief.get("music", theme.get("id", "neon"))
    if isinstance(music, dict):
        music_cfg = music
    else:
        name = str(music or "").strip()
        track = name if name.endswith(".mp3") else MUSIC_PRESETS.get(name, "")
        music_cfg = {"track": track, "gainDb": -20} if track else {}

    topic = str(brief.get("topic") or "").strip()
    raw_scenes = brief.get("scenes") or []
    if not raw_scenes:
        if not topic:
            raise SystemExit("need either scenes[] or a topic")
        raw_scenes = write_scenes(topic, int(brief.get("scenes_count") or DEFAULTS["scenes"]))
    if len(raw_scenes) < 2:
        raise SystemExit("need at least 2 scenes")

    scenes = [_clean_scene(s, i, len(raw_scenes)) for i, s in enumerate(raw_scenes)]

    voice = str(brief.get("voice") or DEFAULTS["voice"])
    voice = VOICES.get(voice, voice)

    return {
        "topic": topic,
        "theme": theme,
        "brand": str(brief.get("brand") or DEFAULTS["brand"]),
        "voice": voice,
        "width": int(brief.get("width") or width),
        "height": int(brief.get("height") or height),
        "fps": int(brief.get("fps") or 30),
        "caption": {"effect": brief.get("caption") or DEFAULTS["caption"]},
        "chrome": {"brand": True, "counter": True, "progress": True},
        "music": music_cfg,
        "scenes": scenes,
        # Overwritten by prepare.py once the voice exists; Root.tsx needs a
        # non-zero value for Remotion Studio before that.
        "totalMs": max(4000, 3000 * len(scenes)),
        "hasAudio": False,
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--brief", help="JSON string, @file or path to a .json brief")
    ap.add_argument("--from-env", action="store_true",
                    help="read workflow_dispatch inputs from env vars")
    ap.add_argument("--topic")
    ap.add_argument("--scenes", type=int)
    ap.add_argument("--theme")
    ap.add_argument("--voice")
    ap.add_argument("--format")
    ap.add_argument("--brand")
    ap.add_argument("--caption")
    ap.add_argument("--music")
    ap.add_argument("--out", default=str(CONFIG))
    ap.add_argument("--print", action="store_true", help="print a one-line summary")
    args = ap.parse_args()

    brief = {}
    if args.from_env:
        brief = _read_brief(os.environ.get("BRIEF_JSON", ""))
        for key, env in (
            ("topic", "TOPIC"),
            ("theme", "THEME"),
            ("voice", "VOICE"),
            ("format", "FORMAT"),
            ("brand", "BRAND"),
            ("caption", "CAPTION"),
            ("music", "MUSIC"),
        ):
            value = os.environ.get(env, "").strip()
            if value:
                brief[key] = value
        if os.environ.get("SCENES", "").strip(): 
            brief["scenes_count"] = int(os.environ["SCENES"])

    # On a plain `git push` there are no inputs: reuse the committed config so
    # pushing an edited src/video-config.json renders exactly that content.
    if not brief.get("scenes") and not brief.get("topic") and CONFIG.exists():
        try:
            current = json.loads(CONFIG.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            current = {}
        if current.get("scenes"):
            base = {
                k: current[k]
                for k in ("topic", "theme", "voice", "brand", "width", "height",
                          "fps", "caption", "music")
                if current.get(k)
            }
            base["scenes"] = [
                {"text": s.get("text", ""), "highlight": s.get("highlight", ""),
                 "kind": s.get("kind"), "visual": s.get("visual")}
                for s in current["scenes"] if s.get("text")
            ]
            brief = {**base, **brief}

    file_brief = _read_brief(args.brief)
    brief = {**brief, **file_brief}

    for key in ("topic", "theme", "voice", "format", "brand", "caption", "music"):
        value = getattr(args, key, None)
        if value:
            brief[key] = value
    if args.scenes:
        brief["scenes_count"] = args.scenes

    # An explicitly chosen format/theme wins over the values inherited from the
    # committed config (those carry width/height and a music track with them).
    if brief.get("format"):
        brief.pop("width", None)
        brief.pop("height", None)
    if brief.get("theme"):
        brief.pop("music", None)

    cfg = build(brief)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")

    if args.print:
        print(f"{len(cfg['scenes'])} scenes · {cfg['width']}x{cfg['height']} · "
              f"theme {cfg['theme'].get('id')} · voice {cfg['voice']} · "
              f"music {cfg['music'].get('track') or 'none'}")


if __name__ == "__main__":
    main()
