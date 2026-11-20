#!/usr/bin/env python3
"""One command to make a video — built for agents and humans alike.

Local render:
    python3 scripts/create.py --topic "cách học từ vựng" --local

Hand it to GitHub (free CI render, no local Chrome/ffmpeg needed):
    python3 scripts/create.py --topic "cách học từ vựng" --push --wait \
        --download ~/Downloads/bai-hoc.mp4

A ready-made brief keeps full control of the scenes:
    python3 scripts/create.py --brief brief.json --push --wait

The script prints one JSON object on stdout at the end, so an agent (Hermes or
anything else) can parse the result; progress goes to stderr.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))

import build_config as builder  # noqa: E402


def log(message):
    print(message, file=sys.stderr, flush=True)


def run(cmd, cwd=ROOT, check=False):
    log("$ " + " ".join(cmd))
    proc = subprocess.run(cmd, cwd=str(cwd), text=True, capture_output=True)
    if proc.stdout.strip():
        log(proc.stdout.strip())
    if proc.returncode != 0:
        log(proc.stderr.strip()[-2000:])
        if check:
            raise SystemExit(f"command failed ({proc.returncode}): {' '.join(cmd)}")
    return proc


def git(*args, check=False):
    return run(["git", *args], check=check)


def config_from_args(args):
    brief = {}
    if args.brief:
        brief = builder._read_brief(args.brief)
    for key in ("topic", "theme", "voice", "format", "brand", "caption", "music"):
        value = getattr(args, key, None)
        if value:
            brief[key] = value
    if args.scenes:
        brief["scenes_count"] = args.scenes
    return builder.build(brief)


def write_config(cfg, out=ROOT / "src" / "video-config.json"):
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return out


def render_local():
    """Run the same three steps CI runs, then return the mp4 path."""
    run([sys.executable, "scripts/prepare.py"], check=True)
    gate = run([sys.executable, "scripts/check_quality.py"], check=True)
    if gate.returncode != 0:
        raise SystemExit("quality gate failed")
    run(["npm", "run", "build"], check=True)
    video = ROOT / "out" / "video.mp4"
    if not video.exists():
        raise SystemExit("render finished but out/video.mp4 is missing")
    return video


def push_config():
    git("add", "src/video-config.json")
    staged = subprocess.run(
        ["git", "diff", "--cached", "--quiet"], cwd=str(ROOT)
    ).returncode
    if staged != 0:
        git("commit", "-m", "feat: new video config", check=True)
        # Large pushes over HTTP/2 occasionally drop on GitHub; retry on HTTP/1.1.
        proc = git("push", "origin", "HEAD")
        if proc.returncode != 0:
            log("push failed, retrying with HTTP/1.1…")
            run(["git", "-c", "http.version=HTTP/1.1", "push", "origin", "HEAD"], check=True)
    else:
        log("config unchanged, no commit needed")


def latest_run_id():
    proc = run(["gh", "run", "list", "--limit", "1", "--json", "databaseId,status,conclusion"])
    if proc.returncode != 0:
        log("gh CLI not available or not authenticated")
        return None
    runs = json.loads(proc.stdout or "[]")
    return runs[0] if runs else None


def wait_for_render(timeout=1800):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        info = latest_run_id()
        if not info:
            time.sleep(10)
            continue
        state = f"{info['status']} {info.get('conclusion') or ''}".strip()
        if state != last:
            log(f"run {info['databaseId']}: {state}")
            last = state
        if info["status"] == "completed":
            if info.get("conclusion") == "success":
                return info["databaseId"]
            raise SystemExit(f"render failed: {info.get('conclusion')}")
        time.sleep(12)
    raise SystemExit("timed out waiting for the render")


def download_artifact(run_id, destination):
    destination = Path(destination).expanduser()
    destination.parent.mkdir(parents=True, exist_ok=True)
    tmp = ROOT / "out" / "_artifact"
    if tmp.exists():
        shutil.rmtree(tmp)
    run(["gh", "run", "download", str(run_id), "--name", "video-edu-video", "-D", str(tmp)],
        check=True)
    produced = tmp / "video.mp4"
    if not produced.exists():
        raise SystemExit("artifact downloaded but video.mp4 is missing")
    shutil.move(str(produced), str(destination))
    shutil.rmtree(tmp, ignore_errors=True)
    return destination


def repo_slug():
    proc = run(["gh", "repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"])
    if proc.returncode == 0 and proc.stdout.strip():
        return proc.stdout.strip()
    return ""


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--topic")
    ap.add_argument("--brief", help="JSON string, @file or path to a .json brief")
    ap.add_argument("--scenes", type=int, help="number of scenes when generating from a topic")
    ap.add_argument("--theme", choices=sorted(builder.THEMES))
    ap.add_argument("--voice", help="edge-tts voice, e.g. vi-VN-NamMinhNeural")
    ap.add_argument("--format", choices=sorted(builder.FORMATS))
    ap.add_argument("--brand")
    ap.add_argument("--caption", choices=["karaoke", "word-rise", "line-mask"])
    ap.add_argument("--music", help="neon | warm | paper | none | a path under public/")
    ap.add_argument("--local", action="store_true", help="render on this machine")
    ap.add_argument("--push", action="store_true", help="commit the config and render on GitHub")
    ap.add_argument("--wait", action="store_true", help="wait for the GitHub render")
    ap.add_argument("--download", help="save the rendered mp4 here")
    ap.add_argument("--keep-config", action="store_true",
                    help="do not restore the previous config if the render fails")
    args = ap.parse_args()

    if not args.local and not args.push:
        ap.error("choose --local or --push")

    cfg = config_from_args(args)
    write_config(cfg)
    log(f"config: {len(cfg['scenes'])} scenes, {cfg['width']}x{cfg['height']}, "
        f"theme {cfg['theme'].get('id')}, voice {cfg['voice']}")

    result = {
        "ok": False,
        "scenes": len(cfg["scenes"]),
        "width": cfg["width"],
        "height": cfg["height"],
        "voice": cfg["voice"],
        "video": "",
        "run": "",
    }

    if args.local:
        video = render_local()
        result.update(ok=True, video=str(video))
    else:
        push_config()
        result["repo"] = repo_slug()
        if args.wait or args.download:
            run_id = wait_for_render()
            result["run"] = f"https://github.com/{result['repo']}/actions/runs/{run_id}"
            log(f"run page: {result['run']}")
            if args.download:
                path = download_artifact(run_id, args.download)
                result.update(ok=True, video=str(path))
            else:
                result["ok"] = True
        else:
            result["ok"] = True

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
