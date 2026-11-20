import { Scene, Visual } from "../config";
import { ICON_PATHS, isIconName } from "./icons";

/**
 * A scene without an explicit visual gets one picked from its own sentence.
 * This is what makes the web UI and the CLI usable without designing anything:
 * writing "Bạn quên 80% từ sau một tuần" already produces a clock icon, and
 * "Học 5 từ mỗi ngày" a calendar/counter-flavoured icon scene.
 */
export const strip = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

const KEYWORD_ICONS: { icon: string; words: string[] }[] = [
  { icon: "clock", words: ["gio", "phut", "thoi gian", "ngay", "dem", "sang", "toi", "tuan"] },
  { icon: "calendar", words: ["lich", "moi ngay", "hang ngay", "lich trinh"] },
  { icon: "coin", words: ["tien", "chi phi", "gia", "luong", "doanh thu", "tiet kiem"] },
  { icon: "chart", words: ["tang", "giam", "phan tram", "%", "bieu do", "so lieu", "hieu qua"] },
  { icon: "book", words: ["hoc", "doc", "sach", "bai", "kien thuc", "tu vung", "ngoai ngu"] },
  { icon: "target", words: ["muc tieu", "ke hoach", "chinh xac", "tap trung"] },
  { icon: "rocket", words: ["bat dau", "tang toc", "nhanh", "dot pha", "but pha"] },
  { icon: "bulb", words: ["meo", "y tuong", "sang tao", "giai phap", "bi quyet", "cach"] },
  { icon: "check", words: ["xong", "hoan thanh", "dung", "kiem tra", "chuan"] },
  { icon: "list", words: ["buoc", "cac", "danh sach", "quy trinh", "thu tu"] },
  { icon: "phone", words: ["dien thoai", "tin nhan", "thong bao", "ung dung", "app", "chat"] },
  { icon: "users", words: ["nguoi", "ban", "doi nhom", "khach hang", "cong dong"] },
  { icon: "shield", words: ["an toan", "bao mat", "rui ro", "bao ve"] },
  { icon: "search", words: ["tim", "tra cuu", "nghien cuu", "kiem"] },
  { icon: "bell", words: ["nhac", "theo doi", "dang ky", "thong bao"] },
  { icon: "heart", words: ["thich", "yeu", "quan tam"] },
  { icon: "star", words: ["tot nhat", "xuat sac", "sao", "danh gia"] },
  { icon: "gear", words: ["cai dat", "he thong", "tu dong", "cau hinh"] },
  { icon: "eye", words: ["nhin", "quan sat", "xem", "chu y"] },
  { icon: "doc", words: ["tai lieu", "van ban", "ghi chu", "bao cao"] },
];

export const autoVisual = (scene: Scene): Visual => {
  const text = strip(scene.text);
  const hit = KEYWORD_ICONS.find((entry) => entry.words.some((w) => text.includes(w)));
  const fallback = scene.kind === "cta" ? "bell" : scene.kind === "hook" ? "bolt" : "spark";
  const icon = hit && isIconName(hit.icon) ? hit.icon : fallback;
  const label = (scene.highlight || "").trim();
  return { type: "icons", icons: [icon], label: label || undefined };
};

/**
 * Never trust a hand-written visual blindly: a typo in an icon name or an
 * empty bar list should degrade to the automatic icon scene, not to a blank
 * half of the frame.
 */
export const resolveVisual = (scene: Scene): Visual => {
  const visual = scene.visual;
  if (!visual || visual === "auto") return autoVisual(scene);

  switch (visual.type) {
    case "icons": {
      const icons = (visual.icons || []).filter((n) => isIconName(n)).slice(0, 3);
      return {
        type: "icons",
        icons: icons.length ? icons : ["spark"],
        label: visual.label?.trim() || undefined,
      };
    }
    case "bars": {
      const values = (visual.values || [])
        .filter((v) => v && Number.isFinite(v.value))
        .slice(0, 6);
      if (!values.length) return autoVisual(scene);
      return { type: "bars", values, unit: visual.unit, title: visual.title };
    }
    case "steps": {
      const steps = (visual.steps || []).map((s) => s.trim()).filter(Boolean).slice(0, 4);
      if (!steps.length) return autoVisual(scene);
      return { type: "steps", steps, title: visual.title };
    }
    case "phone": {
      const messages = (visual.messages || [])
        .filter((m) => m && m.text)
        .slice(0, 4);
      if (!messages.length) return autoVisual(scene);
      return { type: "phone", messages, title: visual.title };
    }
    case "compare": {
      if (!visual.before?.trim() || !visual.after?.trim()) return autoVisual(scene);
      return visual;
    }
    case "counter": {
      if (!String(visual.value ?? "").trim()) return autoVisual(scene);
      return visual;
    }
    case "list": {
      const items = (visual.items || []).map((s) => s.trim()).filter(Boolean).slice(0, 4);
      if (!items.length) return autoVisual(scene);
      return { type: "list", items, title: visual.title };
    }
    case "wordcard": {
      const word = (visual.word || "").trim();
      const meaning = (visual.meaning || "").trim();
      if (!word || !meaning) return autoVisual(scene);
      return {
        type: "wordcard",
        word,
        meaning,
        phonetic: visual.phonetic?.trim() || undefined,
        example: visual.example?.trim() || undefined,
        title: visual.title?.trim() || undefined,
      };
    }
    case "code": {
      if (!Array.isArray(visual.lines)) return autoVisual(scene);
      const lines = visual.lines
        .map((line) => String(line).replace(/\s+$/, ""))
        .filter((line) => line.trim())
        .slice(0, 10);
      if (!lines.length) return autoVisual(scene);
      const cues = (visual.cues || []).map((cue) => String(cue).trim()).slice(0, lines.length);
      return {
        type: "code",
        lines,
        language: visual.language?.trim() || undefined,
        title: visual.title?.trim() || undefined,
        cues: cues.some(Boolean) ? cues : undefined,
      };
    }
    case "formula": {
      const formula = (visual.formula || "").trim();
      if (!formula) return autoVisual(scene);
      const steps = (visual.steps || [])
        .map((step) => String(step).trim())
        .filter(Boolean)
        .slice(0, 4);
      return {
        type: "formula",
        formula,
        steps: steps.length ? steps : undefined,
        result: visual.result?.trim() || undefined,
        title: visual.title?.trim() || undefined,
      };
    }
    case "html": {
      const html = (visual.html || "").trim();
      if (!html) return autoVisual(scene);
      return {
        type: "html",
        html,
        css: visual.css?.trim() || undefined,
        anim: visual.anim?.trim() || undefined,
        full: Boolean(visual.full),
      };
    }
    case "photo": {
      if (!visual.image?.trim()) return autoVisual(scene);
      return visual;
    }
    default:
      return autoVisual(scene);
  }
};
