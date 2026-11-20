#!/usr/bin/env python3
"""Quality gate that runs after prepare.py and before the render.

Catches what actually ruins a short: a caption that cannot fit the frame, a
scene too short to read, unreadable colours, a missing asset, or a visual whose
parameters would render nothing. Hard errors exit 1 and block the render;
taste issues only warn.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "src" / "video-config.json"
PUBLIC = ROOT / "public"
MP3 = PUBLIC / "voiceover.mp3"

VISUAL_TYPES = ["icons", "bars", "steps", "phone", "compare", "counter", "list",
                "wordcard", "code", "formula", "photo"]
ICONS = ["clock", "bolt", "bulb", "chart", "check", "book", "target", "rocket", "coin",
         "spark", "bell", "search", "gear", "star", "shield", "users", "calendar",
         "play", "phone", "list", "heart", "eye", "arrowUp", "doc"]
CAPTION_EFFECTS = ["karaoke", "word-rise", "line-mask"]

MAX_CHARS = 88
MIN_SCENE_S = 0.7
MAX_SCENE_S = 14.0
MIN_TOTAL_S = 6.0
MAX_TOTAL_S = 180.0
MIN_CONTRAST = 3.0


def lum(hex_color):
    h = hex_color.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if len(h) < 6:
        return 0.0
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def contrast(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def phrase_in_text(text, phrase):
    """True when `phrase` appears as consecutive words of `text`."""
    clean = lambda t: [re.sub(r'[.,!?;:…"\'()]', "", w).lower() for w in t.split()]
    words, phrase_words = clean(text), [w for w in clean(phrase) if w]
    if not phrase_words:
        return False
    return any(
        words[i:i + len(phrase_words)] == phrase_words
        for i in range(max(0, len(words) - len(phrase_words) + 1))
    )


def check_visual(tag, visual, text, errors, warnings):
    if visual in (None, "", "auto"):
        return
    if not isinstance(visual, dict):
        errors.append(f"{tag}: visual must be an object or \"auto\"")
        return
    kind = visual.get("type")
    if kind not in VISUAL_TYPES:
        errors.append(f"{tag}: unknown visual type {kind!r} (use {', '.join(VISUAL_TYPES)})")
        return

    if kind == "icons":
        icons = visual.get("icons") or []
        if not isinstance(icons, list) or not icons:
            errors.append(f"{tag}: icons visual needs a non-empty icons[] list")
        for name in icons:
            if name not in ICONS:
                warnings.append(f"{tag}: unknown icon {name!r} (falls back to a spark icon)")
    elif kind == "bars":
        values = visual.get("values") or []
        if not values:
            errors.append(f"{tag}: bars visual needs values[]")
        elif len(values) > 6:
            warnings.append(f"{tag}: {len(values)} bars is cramped (max 6)")
        for v in values:
            if not isinstance(v.get("value"), (int, float)):
                errors.append(f"{tag}: bar {v.get('label')!r} needs a numeric value")
    elif kind == "steps":
        steps = visual.get("steps") or []
        if not steps:
            errors.append(f"{tag}: steps visual needs steps[]")
        if len(steps) > 4:
            errors.append(f"{tag}: at most 4 steps fit the frame")
    elif kind == "phone":
        messages = visual.get("messages") or []
        if not messages:
            errors.append(f"{tag}: phone visual needs messages[]")
        if len(messages) > 4:
            errors.append(f"{tag}: at most 4 chat bubbles fit the frame")
    elif kind == "compare":
        if not visual.get("before") or not visual.get("after"):
            errors.append(f"{tag}: compare visual needs before and after")
    elif kind == "counter":
        if not str(visual.get("value", "")).strip():
            errors.append(f"{tag}: counter visual needs a value")
    elif kind == "list":
        items = visual.get("items") or []
        if not items:
            errors.append(f"{tag}: list visual needs items[]")
        if len(items) > 4:
            errors.append(f"{tag}: at most 4 checklist items fit the frame")
    elif kind == "wordcard":
        word = str(visual.get("word") or "").strip()
        meaning = str(visual.get("meaning") or "").strip()
        if not word or not meaning:
            errors.append(f"{tag}: wordcard needs word and meaning")
        if len(word) > 34:
            warnings.append(f"{tag}: word {len(word)} chars is long for one card line")
        if len(meaning) > 110:
            warnings.append(f"{tag}: meaning {len(meaning)} chars will crowd the card")
        if len(str(visual.get("example") or "")) > 96:
            warnings.append(f"{tag}: example is long; keep it to one sentence")
    elif kind == "code":
        lines = visual.get("lines") or []
        if not isinstance(lines, list) or not lines:
            errors.append(f"{tag}: code visual needs a non-empty lines[]")
        else:
            if len(lines) > 8:
                warnings.append(f"{tag}: {len(lines)} code lines is cramped (max 8)")
            for line in lines:
                if len(str(line)) > 46:
                    warnings.append(f"{tag}: code line is {len(str(line))} chars and will clip")
        cues = visual.get("cues")
        if cues:
            if len(cues) != len(lines):
                errors.append(f"{tag}: cues[] needs one entry per code line")
            else:
                for cue in cues:
                    if cue and not phrase_in_text(text, str(cue)):
                        warnings.append(
                            f"{tag}: cue {cue!r} is not in the sentence (that line won't light in time)"
                        )
    elif kind == "formula":
        formula = str(visual.get("formula") or "").strip()
        if not formula:
            errors.append(f"{tag}: formula visual needs a formula")
        if len(formula) > 34:
            warnings.append(f"{tag}: formula {len(formula)} chars is long; split it into steps")
        steps = visual.get("steps") or []
        if len(steps) > 4:
            errors.append(f"{tag}: at most 4 formula steps fit the frame")
    elif kind == "photo":
        image = (visual.get("image") or "").strip()
        if not image:
            errors.append(f"{tag}: photo visual needs an image path")
        elif not (PUBLIC / image).exists():
            errors.append(f"{tag}: photo not found: public/{image}")


def main():
    cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
    theme = cfg["theme"]
    scenes = cfg["scenes"]
    errors, warnings = [], []

    if not MP3.exists() or MP3.stat().st_size < 5000:
        errors.append("voiceover.mp3 missing or empty")

    total = cfg.get("totalMs", 0) / 1000
    if total < MIN_TOTAL_S:
        errors.append(f"video too short: {total:.1f}s")
    if total > MAX_TOTAL_S:
        errors.append(f"video too long: {total:.1f}s")

    bg = theme["bg"][0] if theme.get("bg") else "#000000"
    ratio = contrast(theme["text"], bg)
    if ratio < 1.8:
        errors.append(f"text/background contrast {ratio:.1f}:1 is unreadable")
    elif ratio < MIN_CONTRAST:
        warnings.append(f"low text contrast {ratio:.1f}:1")

    caption = (cfg.get("caption") or {}).get("effect", "karaoke")
    if caption not in CAPTION_EFFECTS:
        errors.append(f"unknown caption effect {caption!r}")

    music = cfg.get("music") or {}
    track = (music.get("track") or "").strip()
    if track and not (PUBLIC / track).exists():
        errors.append(f"music track not found: public/{track}")

    for i, s in enumerate(scenes):
        tag = f"scene {i + 1}"
        dur = (s["endMs"] - s["startMs"]) / 1000
        n = len(s["text"])

        check_visual(tag, s.get("visual"), s["text"], errors, warnings)

        # The renderer matches highlight as a whole phrase, so a highlight that
        # is not literally in the sentence silently highlights nothing.
        hl = (s.get("highlight") or "").strip()
        if hl and not phrase_in_text(s["text"], hl):
            warnings.append(f"{tag}: highlight {hl!r} is not in the sentence (nothing lights up)")

        if dur < MIN_SCENE_S:
            errors.append(f"{tag}: {dur:.2f}s is too quick to read")
        if dur > MAX_SCENE_S:
            warnings.append(f"{tag}: {dur:.1f}s lingers")
        if n > MAX_CHARS:
            errors.append(f"{tag}: {n} chars won't fit the caption (max {MAX_CHARS})")
        elif n > 70:
            warnings.append(f"{tag}: {n} chars is dense")

        words = s.get("words") or []
        if not words:
            errors.append(f"{tag}: no word timings (the caption would freeze)")
            continue
        scene_start, scene_end = s["startMs"], s["endMs"]
        first, last = words[0]["s"], words[-1]["e"]
        if first < scene_start - 50 or first > scene_end:
            errors.append(f"{tag}: first word starts outside the scene ({first}ms)")
        if last > scene_end + 50:
            warnings.append(f"{tag}: last word ends after the scene ({last}ms)")
        covered = max(0, min(last, scene_end) - scene_start)
        if covered < (scene_end - scene_start) * 0.5:
            warnings.append(f"{tag}: word timings cover only {covered}ms of the scene")
        if any(cur["s"] < prev["s"] for prev, cur in zip(words, words[1:])):
            errors.append(f"{tag}: word timings are not monotonic")
        gaps = [cur["s"] - prev["e"] for prev, cur in zip(words, words[1:])]
        if gaps and max(gaps) > 1200:
            warnings.append(f"{tag}: {max(gaps)}ms silent gap inside the sentence")

    measured = sum(1 for s in scenes if s.get("alignSource") == "whisper")
    align = f", timings {measured}/{len(scenes)} measured" if measured else ""
    track_note = f", music {track}" if track else ", no music"
    print(f"Quality check: {len(scenes)} scenes, {total:.1f}s, contrast {ratio:.1f}:1"
          f"{align}{track_note}")

    for w in warnings:
        print(f"  warn  {w}")
    for e in errors:
        print(f"  ERROR {e}")
    if errors:
        print(f"FAILED ({len(errors)} errors)")
        return 1
    print("PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
