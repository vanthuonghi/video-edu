#!/usr/bin/env python3
"""Write a scene list for a topic.

Two paths, on purpose:

* If ``LLM_API_KEY`` is set, ask an OpenAI-compatible chat endpoint for the
  scenes. This is the "just type a topic" experience in the web UI and CLI.
* Otherwise use a deterministic Vietnamese lesson scaffold. The repo must never
  fail a render because a paid API key is missing, so the fallback is a real
  (if generic) lesson structure rather than an error.

Only the standard library is used; no extra dependency to install in CI.
"""
import json
import os
import re
import urllib.request

KINDS = ("hook", "body", "cta")

# One sentence per scene, each one a single idea, so edge-tts reads it with
# natural prosody and the caption never needs more than three lines.
FALLBACK_BODY = [
    ("Không phải bạn thiếu nỗ lực.", "nỗ lực",
     {"type": "compare", "before": "Học dồn một lúc", "after": "Học đều mỗi ngày"}),
    ("Vấn đề nằm ở cách chia nhỏ mục tiêu.", "chia nhỏ",
     {"type": "steps", "title": "Cách bắt đầu",
      "steps": ["Chọn một mục tiêu nhỏ", "Làm 10 phút mỗi ngày", "Ghi lại kết quả"]}),
    ("Mỗi ngày chỉ cần 10 phút là đủ.", "10 phút",
     {"type": "counter", "value": "10", "unit": "phút", "label": "mỗi ngày"}),
    ("Ôn lại sau 1 ngày, 3 ngày và 7 ngày.", "7 ngày",
     {"type": "steps", "title": "Lịch ôn tập",
      "steps": ["Sau 1 ngày", "Sau 3 ngày", "Sau 7 ngày"]}),
    ("Ghi lại tiến bộ để biết mình đang đi đúng.", "tiến bộ",
     {"type": "bars", "title": "Tiến bộ theo tuần", "unit": "buổi",
      "values": [{"label": "Tuần 1", "value": 3}, {"label": "Tuần 2", "value": 5},
                 {"label": "Tuần 3", "value": 6}]}),
    ("Đừng học thuộc, hãy tự giải thích lại.", "tự giải thích",
     {"type": "phone", "title": "Tự kiểm tra",
      "messages": [{"from": "them", "text": "Giải thích lại bằng lời của bạn?"},
                   {"from": "me", "text": "Đơn giản là làm mỗi ngày."}]}),
]

SYSTEM = (
    "Bạn là biên kịch video giáo dục ngắn tiếng Việt cho TikTok/Shorts. "
    "Trả về JSON thuần, không markdown."
)


def _prompt(topic: str, count: int) -> str:
    return (
        f"Chủ đề: {topic}\n"
        f"Viết đúng {count} câu, mỗi câu tối đa 70 ký tự, một ý duy nhất mỗi câu.\n"
        "Câu đầu là hook (câu hỏi hoặc số liệu gây chú ý), câu cuối là CTA "
        "(lưu lại / theo dõi). Các câu giữa là nội dung thực tế, có thể áp dụng ngay, "
        "ưu tiên con số và bước làm cụ thể. Không sáo rỗng.\n"
        "Trả về đúng cấu trúc:\n"
        '{"scenes":[{"text":"...","highlight":"cụm 1-3 từ quan trọng","kind":"hook|body|cta"}]}\n'
        "highlight phải xuất hiện nguyên văn trong text."
    )


def _ask_llm(topic: str, count: int) -> list:
    key = os.environ.get("LLM_API_KEY", "").strip()
    if not key:
        return []
    base = (os.environ.get("LLM_BASE_URL") or "https://api.openai.com/v1").rstrip("/")
    model = os.environ.get("LLM_MODEL") or "gpt-4o-mini"
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": _prompt(topic, count)},
        ],
        "temperature": 0.7,
    }
    req = urllib.request.Request(
        f"{base}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            data = json.load(resp)
        content = data["choices"][0]["message"]["content"].strip()
    except Exception as exc:  # network, quota, bad key: fall back, never fail
        print(f"  script_writer: LLM unavailable ({exc}); using fallback", flush=True)
        return []

    if content.startswith("```"):
        content = content.strip("`")
        if content.lower().startswith("json"):
            content = content[4:]
    try:
        scenes = json.loads(content).get("scenes", [])
    except Exception:
        return []

    out = []
    for s in scenes[:count]:
        text = str(s.get("text", "")).strip()
        if not text:
            continue
        out.append({
            "text": text[:88],
            "highlight": str(s.get("highlight", "")).strip()[:40],
            "kind": s.get("kind") if s.get("kind") in KINDS else "body",
        })
    return out if len(out) >= 3 else []


def fallback(topic: str, count: int) -> list:
    topic = re.sub(r"\s+", " ", topic).strip() or "kỹ năng mới"
    scenes = [
        {"text": f"Bạn đang học {topic} mà chưa thấy tiến bộ?", "highlight": topic,
         "kind": "hook", "visual": "auto"},
    ]
    for text, highlight, visual in FALLBACK_BODY[: max(1, count - 2)]:
        scenes.append({"text": text, "highlight": highlight, "kind": "body", "visual": visual})
    scenes.append({"text": "Lưu lại và bắt đầu từ hôm nay.", "highlight": "hôm nay",
                   "kind": "cta", "visual": {"type": "icons", "icons": ["heart", "bell"]}})
    return scenes[:count]


def write_scenes(topic: str, count: int = 8) -> list:
    count = max(3, min(10, int(count or 8)))
    scenes = _ask_llm(topic, count) or fallback(topic, count)
    scenes[0]["kind"] = "hook"
    scenes[-1]["kind"] = "cta"
    for s in scenes:
        s.setdefault("kind", "body")
        s.setdefault("highlight", "")
    return scenes
