/*
 * video-edu studio — a static page, deliberately.
 *
 * It needs no build step, no server and no database: it writes the same JSON
 * brief the CLI writes and dispatches the render workflow on GitHub. The only
 * secret is a fine-grained personal access token that lives in this browser's
 * localStorage and is sent only to api.github.com.
 */

const STORAGE = "videoedu.v1";
const DEFAULT_REPO = "vanthuonghi/video-edu";

const ICONS = [
  ["clock", "Đồng hồ"], ["calendar", "Lịch"], ["bolt", "Tia chớp"], ["bulb", "Bóng đèn"],
  ["book", "Sách"], ["chart", "Biểu đồ"], ["check", "Dấu tích"], ["target", "Mục tiêu"],
  ["rocket", "Tên lửa"], ["coin", "Tiền"], ["spark", "Toả sáng"], ["bell", "Chuông"],
  ["search", "Tìm kiếm"], ["gear", "Cài đặt"], ["star", "Ngôi sao"], ["shield", "Khiên"],
  ["users", "Nhóm người"], ["phone", "Điện thoại"], ["list", "Danh sách"], ["heart", "Trái tim"],
  ["eye", "Mắt"], ["play", "Play"], ["arrowUp", "Mũi tên lên"], ["doc", "Tài liệu"],
];

const VISUALS = [
  ["auto", "Tự động theo từ khoá"],
  ["icons", "Icon động"],
  ["counter", "Con số lớn"],
  ["steps", "Các bước"],
  ["bars", "Biểu đồ cột"],
  ["compare", "Trước / Sau"],
  ["phone", "Khung chat"],
  ["list", "Checklist"],
  ["wordcard", "Thẻ từ vựng"],
  ["code", "Khối code"],
  ["formula", "Công thức từng bước"],
  ["html", "HTML tuỳ biến"],
  ["photo", "Ảnh tĩnh (Ken Burns)"],
];

const PRESET = [
  { text: "Bạn học 10 từ mới, mai quên sạch 8 từ?", highlight: "quên sạch", kind: "hook",
    visual: { type: "icons", icons: ["spark"], label: "Trí nhớ ngắn hạn" } },
  { text: "Không phải trí nhớ bạn kém.", highlight: "trí nhớ", kind: "body", visual: null },
  { text: "Học dồn một lúc không bằng học đều mỗi ngày.", highlight: "đều mỗi ngày", kind: "body",
    visual: { type: "compare", before: "10 từ trong một tối", after: "2 từ mỗi ngày" } },
  { text: "Mỗi ngày chỉ cần 2 từ, đủ 60 từ một tháng.", highlight: "60 từ", kind: "body",
    visual: { type: "counter", value: "60", unit: "từ", label: "sau 30 ngày" } },
  { text: "Ôn lại sau 1 ngày, 3 ngày và 7 ngày.", highlight: "7 ngày", kind: "body",
    visual: { type: "steps", title: "Lịch ôn tập", steps: ["Sau 1 ngày", "Sau 3 ngày", "Sau 7 ngày"] } },
  { text: "Lưu lại và bắt đầu ngay hôm nay.", highlight: "hôm nay", kind: "cta",
    visual: { type: "icons", icons: ["heart"], label: "" } },
];

const state = {
  repo: DEFAULT_REPO,
  token: "",
  theme: "neon",
  format: "9:16",
  voice: "vi-VN-HoaiMyNeural",
  caption: "karaoke",
  music: "neon",
  brand: "Văn Hỉ Official",
  topic: "",
  scenesCount: 8,
  scenes: [],
  busy: false,
};

const $ = (id) => document.getElementById(id);
const scenesEl = $("scenes");

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const lines = (value) => String(value || "").split("\n").map((s) => s.trim()).filter(Boolean);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (value) => String(value || "").replace(/\s+/g, " ").trim();

function save() {
  const { repo, token, theme, format, voice, caption, music, brand, topic, scenesCount, scenes } = state;
  localStorage.setItem(STORAGE, JSON.stringify({
    repo, token, theme, format, voice, caption, music, brand, topic, scenesCount, scenes,
  }));
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return false;
    Object.assign(state, JSON.parse(raw));
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Visual seeds + parameter editors                                    */
/* ------------------------------------------------------------------ */

const firstNumber = (text) => {
  const hit = String(text || "").match(/\d+([.,]\d+)?/);
  return hit ? hit[0].replace(",", ".") : "";
};

function clauses(text) {
  const parts = String(text || "")
    .split(/[,;:]|\bvà\b|\brồi\b/i)
    .map((s) => s.trim().replace(/\.$/, ""))
    .filter((s) => s.length > 2);
  return parts.slice(0, 3);
}

function seedVisual(type, scene) {
  const text = scene.text || "Nội dung";
  const n = firstNumber(text);
  switch (type) {
    case "icons":
      return { type: "icons", icons: ["spark"], label: scene.highlight || "" };
    case "counter":
      return { type: "counter", value: n || "3", unit: "", label: scene.highlight || "" };
    case "steps": {
      const items = clauses(text);
      return { type: "steps", title: "", steps: items.length >= 2 ? items : ["Bước 1", "Bước 2", "Bước 3"] };
    }
    case "bars":
      return {
        type: "bars",
        title: "",
        unit: "",
        values: [
          { label: "Trước", value: 2 },
          { label: "Sau", value: Number(n) || 5 },
        ],
      };
    case "compare":
      return { type: "compare", before: "Cách cũ", after: scene.highlight || text.slice(0, 40) };
    case "phone":
      return {
        type: "phone",
        title: "Tin nhắn",
        messages: [{ from: "them", text }, { from: "me", text: "Đã hiểu!" }],
      };
    case "list": {
      const items = clauses(text);
      return { type: "list", title: "", items: items.length >= 2 ? items : ["Việc 1", "Việc 2"] };
    }
    case "wordcard":
      return {
        type: "wordcard",
        word: scene.highlight || "từ mới",
        phonetic: "",
        meaning: "",
        example: "",
      };
    case "code":
      return {
        type: "code",
        language: "python",
        title: "",
        lines: ["total = 0", "total = total + 1", "print(total)"],
        cues: [],
      };
    case "formula":
      return {
        type: "formula",
        title: "",
        formula: "A = P × (1 + r)^{n}",
        steps: ["P — số tiền gốc", "r — lãi suất", "n — số năm"],
        result: "A — kết quả",
      };
    case "html":
      return {
        type: "html",
        html: '<div class="big" id="big">Xin chào</div>',
        css: ".big{font-size:88px;font-weight:900;color:#eaf6ff}",
        anim: "$('#big').style.opacity = ease(span(t, 0, 0.8));",
      };
    case "photo":
      return { type: "photo", image: "images/example.jpg", caption: scene.highlight || "" };
    default:
      return null;
  }
}

const valuesToText = (values) =>
  (values || []).map((v) => `${v.label}: ${v.value}`).join("\n");

const messagesToText = (messages) =>
  (messages || []).map((m) => `${m.from}|${m.text}`).join("\n");

function paramsHtml(scene) {
  const v = scene.visual;
  if (!v) {
    return `<p class="hint">Ảnh động tự chọn theo từ khoá trong câu — không cần cấu hình.</p>`;
  }
  const title = `<input data-p="title" value="${escapeHtml(v.title || "")}" placeholder="Tiêu đề nhỏ (tuỳ chọn)">`;

  switch (v.type) {
    case "icons":
      return `
        <div class="grid-2">
          <select data-p="icon">
            ${ICONS.map(([id, label]) =>
              `<option value="${id}" ${v.icons && v.icons[0] === id ? "selected" : ""}>${label}</option>`).join("")}
          </select>
          <input data-p="label" value="${escapeHtml(v.label || "")}" placeholder="Nhãn dưới icon">
        </div>`;
    case "counter":
      return `
        <div class="grid-2">
          <input data-p="value" value="${escapeHtml(v.value || "")}" placeholder="Con số">
          <input data-p="unit" value="${escapeHtml(v.unit || "")}" placeholder="Đơn vị (từ, phút…)">
        </div>
        <input data-p="label" value="${escapeHtml(v.label || "")}" placeholder="Chú thích (mỗi ngày…)">`;
    case "steps":
      return `${title}
        <textarea data-p="steps" rows="3" placeholder="Mỗi dòng một bước">${escapeHtml((v.steps || []).join("\n"))}</textarea>`;
    case "list":
      return `${title}
        <textarea data-p="items" rows="3" placeholder="Mỗi dòng một mục">${escapeHtml((v.items || []).join("\n"))}</textarea>`;
    case "bars":
      return `${title}
        <textarea data-p="values" rows="3" placeholder="Nhãn: số">${escapeHtml(valuesToText(v.values))}</textarea>
        <input data-p="unit" value="${escapeHtml(v.unit || "")}" placeholder="Đơn vị (phút, %, buổi…)">`;
    case "phone":
      return `${title}
        <textarea data-p="messages" rows="3" placeholder="them|Nội dung / me|Nội dung">${escapeHtml(messagesToText(v.messages))}</textarea>`;
    case "compare":
      return `${title}
        <div class="grid-2">
          <input data-p="before" value="${escapeHtml(v.before || "")}" placeholder="Trước">
          <input data-p="after" value="${escapeHtml(v.after || "")}" placeholder="Sau">
        </div>`;
    case "wordcard":
      return `
        <div class="grid-2">
          <input data-p="word" value="${escapeHtml(v.word || "")}" placeholder="Từ hoặc cụm từ">
          <input data-p="phonetic" value="${escapeHtml(v.phonetic || "")}" placeholder="/phiên âm/">
        </div>
        <input data-p="meaning" value="${escapeHtml(v.meaning || "")}" placeholder="Nghĩa">
        <input data-p="example" value="${escapeHtml(v.example || "")}" placeholder="Câu ví dụ (tuỳ chọn)">`;
    case "code":
      return `${title}
        <div class="grid-2">
          <input data-p="language" value="${escapeHtml(v.language || "")}" placeholder="Ngôn ngữ (python, js…)">
          <input data-p="cues" value="${escapeHtml((v.cues || []).join(" | "))}" placeholder="Cụm lời đọc cho từng dòng, cách nhau bởi |">
        </div>
        <textarea data-p="lines" rows="4" placeholder="Mỗi dòng một dòng code">${escapeHtml((v.lines || []).join("\n"))}</textarea>
        <p class="hint">Dòng đang được đọc sẽ sáng lên: mỗi cue khớp một cụm trong câu của scene.</p>`;
    case "formula":
      return `${title}
        <input data-p="formula" value="${escapeHtml(v.formula || "")}" placeholder="A = P × (1 + r)^{n}">
        <textarea data-p="steps" rows="3" placeholder="Mỗi dòng một bước">${escapeHtml((v.steps || []).join("\n"))}</textarea>
        <input data-p="result" value="${escapeHtml(v.result || "")}" placeholder="Dòng kết quả">`;
    case "html":
      return `
        <textarea data-p="html" rows="4" placeholder="HTML của hình">${escapeHtml(v.html || "")}</textarea>
        <textarea data-p="css" rows="3" placeholder="CSS (cô lập trong shadow root)">${escapeHtml(v.css || "")}</textarea>
        <textarea data-p="anim" rows="3" placeholder="anim: cập nhật style theo t (giây của scene)">${escapeHtml(v.anim || "")}</textarea>
        <p class="hint">Có sẵn <code>ease, span, lock, clamp, $</code>. Ảnh: <code>{{asset:images/x.jpg}}</code>.</p>`;
    case "photo":
      return `
        <div class="grid-2">
          <input data-p="image" value="${escapeHtml(v.image || "")}" placeholder="images/ten-anh.jpg">
          <input data-p="caption" value="${escapeHtml(v.caption || "")}" placeholder="Chú thích ảnh">
        </div>
        <p class="hint">Đặt file vào <code>public/images/</code> trong repo rồi push.</p>`;
    default:
      return "";
  }
}

/* ------------------------------------------------------------------ */
/* Scene list                                                          */
/* ------------------------------------------------------------------ */

function sceneCard(scene, index) {
  const type = scene.visual ? scene.visual.type : "auto";
  const text = scene.text || "";
  return `
    <article class="scene" data-i="${index}">
      <div class="scene-top">
        <span class="num">${String(index + 1).padStart(2, "0")}</span>
        <select data-field="kind" aria-label="Vai trò scene">
          ${["hook", "body", "cta"].map((k) =>
            `<option value="${k}" ${scene.kind === k ? "selected" : ""}>${
              k === "hook" ? "Hook" : k === "cta" ? "CTA" : "Nội dung"}</option>`).join("")}
        </select>
        <button class="icon" data-action="up" type="button" title="Lên">↑</button>
        <button class="icon" data-action="down" type="button" title="Xuống">↓</button>
        <button class="icon danger" data-action="remove" type="button" title="Xoá">✕</button>
      </div>
      <textarea data-field="text" rows="2" maxlength="120" placeholder="Một câu cho scene này…">${escapeHtml(text)}</textarea>
      <div class="scene-row">
        <input data-field="highlight" value="${escapeHtml(scene.highlight || "")}" placeholder="Từ nhấn mạnh (tuỳ chọn)">
        <select data-field="visualType" aria-label="Loại hình động">
          ${VISUALS.map(([id, label]) =>
            `<option value="${id}" ${type === id ? "selected" : ""}>${label}</option>`).join("")}
        </select>
      </div>
      <div class="params">${paramsHtml(scene)}</div>
      <div class="charcount${text.length > 88 ? " over" : ""}">${text.length}/88</div>
    </article>`;
}

function renderScenes() {
  scenesEl.innerHTML = state.scenes.map(sceneCard).join("");
  $("emptyState").classList.toggle("show", state.scenes.length === 0);
  const total = state.scenes.reduce((n, s) => n + (s.text || "").length, 0);
  $("totalHint").textContent = state.scenes.length
    ? `${state.scenes.length} scene · ${total} ký tự`
    : "";
  save();
}

function cardOf(target) {
  const card = target.closest(".scene");
  if (!card) return null;
  return { card, index: Number(card.dataset.i), scene: state.scenes[Number(card.dataset.i)] };
}

scenesEl.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;
  const found = cardOf(btn);
  if (!found) return;
  const { index } = found;
  const action = btn.dataset.action;
  if (action === "remove") state.scenes.splice(index, 1);
  if (action === "up" && index > 0) [state.scenes[index - 1], state.scenes[index]] = [state.scenes[index], state.scenes[index - 1]];
  if (action === "down" && index < state.scenes.length - 1) [state.scenes[index + 1], state.scenes[index]] = [state.scenes[index], state.scenes[index + 1]];
  renderScenes();
});

scenesEl.addEventListener("input", (event) => {
  const found = cardOf(event.target);
  if (!found) return;
  const { card, scene } = found;
  const field = event.target.dataset.field;
  const param = event.target.dataset.p;

  if (field === "text") {
    scene.text = event.target.value;
    const counter = card.querySelector(".charcount");
    counter.textContent = `${scene.text.length}/88`;
    counter.classList.toggle("over", scene.text.length > 88);
    $("totalHint").textContent = `${state.scenes.length} scene · ${
      state.scenes.reduce((n, s) => n + (s.text || "").length, 0)} ký tự`;
    save();
  } else if (field === "highlight") {
    scene.highlight = event.target.value;
    save();
  } else if (param) {
    applyParam(scene, param, event.target.value);
    save();
  }
});

scenesEl.addEventListener("change", (event) => {
  const found = cardOf(event.target);
  if (!found) return;
  const { card, scene } = found;

  if (event.target.dataset.field === "kind") {
    scene.kind = event.target.value;
    save();
    return;
  }

  if (event.target.dataset.field === "visualType") {
    const type = event.target.value;
    scene.visual = type === "auto" ? null : seedVisual(type, scene);
    card.querySelector(".params").innerHTML = paramsHtml(scene);
    save();
    return;
  }

  if (event.target.dataset.p === "icon") {
    if (scene.visual) scene.visual.icons = [event.target.value];
    save();
  }
});

function applyParam(scene, key, value) {
  const v = scene.visual;
  if (!v) return;
  if (key === "steps" || key === "items" || key === "lines") {
    v[key] = lines(value);
  } else if (key === "cues") {
    v.cues = String(value || "").split("|").map((s) => s.trim()).filter(Boolean);
  } else if (key === "values") {
    v.values = lines(value).map((line) => {
      const [label, ...rest] = line.split(":");
      return { label: (label || "").trim(), value: Number((rest.join(":") || "0").replace(",", ".")) || 0 };
    });
  } else if (key === "messages") {
    v.messages = lines(value).map((line) => {
      const [from, ...rest] = line.split("|");
      return { from: from.trim() === "me" ? "me" : "them", text: rest.join("|").trim() || line.trim() };
    });
  } else {
    v[key] = value;
  }
}

/* ------------------------------------------------------------------ */
/* Brief + dispatch                                                    */
/* ------------------------------------------------------------------ */

function brief() {
  const scenes = state.scenes
    .filter((s) => slug(s.text))
    .map((s) => {
      const out = { text: slug(s.text), highlight: slug(s.highlight), kind: s.kind };
      if (s.visual) out.visual = s.visual;
      return out;
    });

  const payload = {
    theme: state.theme,
    format: state.format,
    voice: state.voice,
    caption: state.caption,
    music: state.music,
    brand: state.brand || undefined,
  };
  if (scenes.length) payload.scenes = scenes;
  else {
    payload.topic = slug(state.topic);
    payload.scenes_count = Number(state.scenesCount) || 8;
  }
  return payload;
}

async function api(path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${state.token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} · ${text.slice(0, 240)}`);
  }
  return response.status === 204 ? null : response.json();
}

function setStatus(kind, text) {
  const pill = $("status");
  pill.className = `pill ${kind || ""}`.trim();
  pill.textContent = text;
}

function setResult(html, links = []) {
  const box = $("result");
  box.hidden = false;
  $("resultLinks").innerHTML = links.join("");
  if (html !== null) $("resultVideo").outerHTML = html;
}

async function create() {
  if (state.busy) return;
  const [owner, repo] = String(state.repo || "").split("/").filter(Boolean);
  if (!state.token || !owner || !repo) {
    $("connection").open = true;
    setStatus("err", "Cần token GitHub");
    $("createHint").textContent = "Mở “Kết nối GitHub”, nhập repo và token rồi bấm tạo lại.";
    return;
  }

  const payload = brief();
  if (!payload.scenes && !payload.topic) {
    setStatus("err", "Thiếu nội dung");
    $("createHint").textContent = "Viết ít nhất một scene, hoặc nhập chủ đề để sinh kịch bản.";
    return;
  }

  state.busy = true;
  $("createBtn").disabled = true;
  $("result").hidden = true;
  setStatus("run", "Đang gửi…");
  $("createHint").textContent = "Đang gửi yêu cầu render lên GitHub Actions.";

  try {
    const dispatch = await api(`/repos/${owner}/${repo}/actions/workflows/render.yml/dispatches`, {
      method: "POST",
      body: JSON.stringify({
        ref: "main",
        inputs: { brief: JSON.stringify(payload) },
        return_run_details: true,
      }),
    });

    let runId = dispatch && dispatch.workflow_run_id;
    if (!runId) {
      await sleep(4000);
      const runs = await api(`/repos/${owner}/${repo}/actions/runs?per_page=5`);
      runId = runs.workflow_runs && runs.workflow_runs[0] && runs.workflow_runs[0].id;
    }
    if (!runId) throw new Error("Không tìm thấy run vừa tạo");

    await watch(owner, repo, runId);
  } catch (error) {
    setStatus("err", "Lỗi");
    $("createHint").textContent = String(error.message || error);
    state.busy = false;
    $("createBtn").disabled = false;
  }
}

async function watch(owner, repo, runId) {
  const runUrl = `https://github.com/${owner}/${repo}/actions/runs/${runId}`;
  const started = Date.now();
  let last = "";

  while (Date.now() - started < 45 * 60 * 1000) {
    const run = await api(`/repos/${owner}/${repo}/actions/runs/${runId}`);
    const stateText = `${run.status}${run.conclusion ? ` · ${run.conclusion}` : ""}`;
    if (stateText !== last) {
      last = stateText;
      const label = run.status === "queued" ? "Đang xếp hàng…"
        : run.status === "in_progress" ? "Đang render…"
        : run.conclusion === "success" ? "Xong"
        : run.conclusion ? `Kết thúc: ${run.conclusion}` : "Đang chạy…";
      setStatus(run.conclusion === "success" ? "ok" : run.conclusion ? "err" : "run", label);
      $("createHint").textContent = `${label} (${Math.round((Date.now() - started) / 60000)} phút)`;
    }

    if (run.status === "completed") {
      if (run.conclusion === "success") {
        const video = `https://github.com/${owner}/${repo}/releases/download/latest/video.mp4`;
        setResult(
          `<video id="resultVideo" controls playsinline preload="metadata" src="${video}?v=${run.id}"></video>`,
          [
            `<a class="ghost small" href="${video}" target="_blank" rel="noreferrer">Tải MP4</a>`,
            `<a class="ghost small" href="${runUrl}" target="_blank" rel="noreferrer">Xem run</a>`,
            `<a class="ghost small" href="https://github.com/${owner}/${repo}/releases/tag/latest" target="_blank" rel="noreferrer">Release</a>`,
          ],
        );
        $("createHint").textContent = "Video đã render xong và nằm trong release “latest”.";
      } else {
        setResult(null, [`<a class="ghost small" href="${runUrl}" target="_blank" rel="noreferrer">Xem log lỗi</a>`]);
        $("createHint").textContent = "Render thất bại — mở log để xem bước lỗi.";
      }
      state.busy = false;
      $("createBtn").disabled = false;
      return;
    }
    await sleep(12000);
  }

  setStatus("err", "Quá thời gian");
  $("createHint").textContent = "Run chạy quá 45 phút. Mở trang Actions để kiểm tra.";
  state.busy = false;
  $("createBtn").disabled = false;
}

/* ------------------------------------------------------------------ */
/* Wiring                                                              */
/* ------------------------------------------------------------------ */

function syncInputs() {
  $("repo").value = state.repo;
  $("token").value = state.token;
  $("theme").value = state.theme;
  $("format").value = state.format;
  $("voice").value = state.voice;
  $("caption").value = state.caption;
  $("music").value = state.music;
  $("brand").value = state.brand;
  $("topic").value = state.topic;
  $("scenesCount").value = state.scenesCount;
  $("connState").textContent = state.token ? "· đã lưu token" : "";
  $("repoLink").href = `https://github.com/${state.repo}`;
  setStatus(state.token ? "ok" : "", state.token ? "Sẵn sàng" : "Chưa kết nối");
}

const bindings = [
  ["repo", "repo"], ["token", "token"], ["theme", "theme"], ["format", "format"],
  ["voice", "voice"], ["caption", "caption"], ["music", "music"], ["brand", "brand"],
  ["topic", "topic"], ["scenesCount", "scenesCount"],
];

bindings.forEach(([id, key]) => {
  const el = $(id);
  el.addEventListener("input", () => {
    state[key] = key === "scenesCount" ? Number(el.value) || 8 : el.value;
    if (id === "repo") $("repoLink").href = `https://github.com/${state.repo}`;
    if (id === "token") $("connState").textContent = state.token ? "· đã lưu token" : "";
    save();
  });
});

$("addSceneBtn").addEventListener("click", () => {
  state.scenes.push({
    text: "", highlight: "", kind: state.scenes.length === 0 ? "hook" : "body", visual: null,
  });
  renderScenes();
  const cards = scenesEl.querySelectorAll(".scene textarea");
  if (cards.length) cards[cards.length - 1].focus();
});

$("presetBtn").addEventListener("click", () => {
  state.scenes = PRESET.map((scene) => ({ ...scene, visual: scene.visual ? { ...scene.visual } : null }));
  renderScenes();
});

$("createBtn").addEventListener("click", create);

$("jsonOutBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(brief(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "video-edu-brief.json";
  link.click();
  URL.revokeObjectURL(url);
});

$("jsonIn").addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.theme && typeof data.theme === "string") state.theme = data.theme;
    if (data.format) state.format = data.format;
    if (data.voice) state.voice = data.voice;
    if (data.caption) state.caption = data.caption;
    if (data.music) state.music = data.music;
    if (data.brand) state.brand = data.brand;
    if (data.topic) state.topic = data.topic;
    if (Array.isArray(data.scenes)) {
      state.scenes = data.scenes.map((s) => ({
        text: s.text || "",
        highlight: s.highlight || "",
        kind: s.kind || "body",
        visual: s.visual && s.visual !== "auto" ? s.visual : null,
      }));
    }
    syncInputs();
    renderScenes();
    setStatus("ok", "Đã nạp JSON");
  } catch (error) {
    setStatus("err", "JSON lỗi");
    $("createHint").textContent = String(error.message || error);
  } finally {
    event.target.value = "";
  }
});

// First run: a ready-to-edit lesson beats an empty screen.
if (load()) {
  if (!state.scenes.length) state.scenes = PRESET.map((scene) => ({ ...scene }));
} else {
  state.scenes = PRESET.map((scene) => ({ ...scene }));
}
syncInputs();
renderScenes();
