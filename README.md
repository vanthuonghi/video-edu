# 🎬 video-edu

Video bài giảng ngắn (**9:16 / 4:5 / 1:1 / 16:9**) với **hình động thật sự** — icon vẽ nét,
biểu đồ cột, các bước, khung chat, so sánh trước/sau, con số đếm — cộng thêm caption chạy
theo từng từ khớp giọng đọc. Không footage, không API ảnh, không API key bắt buộc.

- **Giọng đọc**: edge-tts neural của Microsoft (`vi-VN-HoaiMyNeural` / `vi-VN-NamMinhNeural`) — miễn phí.
- **Timing từng từ**: faster-whisper đo trực tiếp từ audio (fallback: chia theo âm tiết).
- **Nhạc nền**: sinh bằng code, tự ducking theo giọng.
- **Render**: GitHub Actions (miễn phí), video tự đăng vào release `latest`.
- **Tạo video**: bằng web UI, bằng CLI (cho agent/Hermes), hoặc sửa JSON rồi push.

## Kiến trúc

```
brief (web UI / CLI / workflow inputs)
   └─ scripts/build_config.py  →  src/video-config.json
        └─ scripts/prepare.py   →  public/voiceover.mp3 + startMs/endMs/words
             └─ scripts/check_quality.py (chặn lỗi thật)
                  └─ remotion render  →  out/video.mp4  →  release "latest"
```

`src/video-config.json` là **file duy nhất** mô tả nội dung. `prepare.py` ghi lại
`startMs`, `endMs`, `words`, `totalMs` vào chính file đó — đừng sửa tay mấy trường này.

## Web UI

Mở GitHub Pages của repo: `https://<owner>.github.io/video-edu/`

Trang tĩnh, không server, không database:

1. Mở **Kết nối GitHub**, nhập `owner/repo` và một **fine-grained token**
   (quyền *Actions: Read and write*, *Contents: Read*; nếu muốn xem release thì thêm *Contents: Read* là đủ).
   Token chỉ nằm trong `localStorage` của trình duyệt và chỉ gửi tới `api.github.com`.
2. Viết các scene (mỗi scene một câu + từ nhấn mạnh + loại hình động), hoặc bấm **Mẫu bài giảng**.
3. Bấm **Tạo video trên GitHub**: trang dispatch workflow, theo dõi run, và khi xong sẽ
   phát luôn video từ `releases/download/latest/video.mp4`.

Ô **chủ đề** dùng khi bạn không muốn tự viết scene: workflow sẽ nhờ LLM viết kịch bản nếu repo
có secret `LLM_API_KEY` (và tuỳ chọn `LLM_BASE_URL`, `LLM_MODEL`), còn không thì dùng khung bài
giảng có sẵn trong `scripts/script_writer.py`.

## CLI (cho Hermes hoặc agent khác)

```bash
# render tại máy (cần Node, ffmpeg, edge-tts)
python3 scripts/create.py --topic "cách học từ vựng tiếng Anh" --local

# đẩy lên GitHub render rồi tải về
python3 scripts/create.py --topic "cách học từ vựng tiếng Anh" \
  --push --wait --download ~/Downloads/bai-hoc.mp4

# kiểm soát toàn bộ kịch bản bằng brief JSON
python3 scripts/create.py --brief brief.json --push --wait --download out.mp4
```

`create.py` in ra **một JSON object** ở stdout (`ok`, `scenes`, `video`, `run`…), log ở stderr,
nên agent parse được mà không phải đọc log.

Tuỳ chọn: `--theme neon|warm|paper`, `--format 9:16|4:5|1:1|16:9`,
`--voice vi-VN-NamMinhNeural`, `--caption karaoke|word-rise|line-mask`,
`--music neon|warm|none`, `--scenes 8`, `--brand "Tên kênh"`.

## Brief / `src/video-config.json`

```jsonc
{
  "topic": "học từ vựng tiếng Anh",
  "theme": { "id": "neon", "bg": ["#000814", "#001028", "#000814"],
             "text": "#eaf6ff", "accent": "#00d4ff", "muted": "#ff2e88" },
  "brand": "Văn Hỉ Official",
  "voice": "vi-VN-HoaiMyNeural",
  "width": 1080, "height": 1920, "fps": 30,
  "caption": { "effect": "karaoke" },       // karaoke | word-rise | line-mask
  "music": { "track": "music/bed-neon.mp3", "gainDb": -20 },
  "scenes": [
    {
      "text": "Học 50 từ một lúc, mai quên gần hết?",
      "highlight": "quên gần hết",
      "kind": "hook",                        // hook | body | cta
      "visual": { "type": "icons", "icons": ["spark"], "label": "Trí nhớ ngắn hạn" }
    },
    { "text": "Không phải trí nhớ bạn kém.", "kind": "body", "visual": "auto" }
  ]
}
```

### Các loại hình động

| `visual.type` | Hiển thị | Trường |
|---|---|---|
| `icons` | Icon vẽ nét trong vòng xoay | `icons[]` (tối đa 3), `label` |
| `counter` | Con số đếm lên | `value`, `unit`, `label` |
| `steps` | Danh sách bước, số thứ tự | `steps[]` (≤ 4), `title` |
| `bars` | Biểu đồ cột mọc lên | `values[{label,value}]` (≤ 6), `unit`, `title` |
| `compare` | Hai thẻ Trước / Sau | `before`, `after`, `title` |
| `phone` | Khung chat tự hiện tin | `messages[{from,text}]` (≤ 4), `title` |
| `list` | Checklist tự tick | `items[]` (≤ 4), `title` |
| `photo` | Ảnh tĩnh + Ken Burns | `image` (trong `public/`), `caption` |
| `"auto"` | Chọn icon theo từ khoá trong câu | — |

`visual` bỏ trống = `auto`. Icon có sẵn: `clock calendar bolt bulb book chart check target
rocket coin spark bell search gear star shield users phone list heart eye play arrowUp doc`
(xem `src/visuals/icons.tsx`).

`highlight` được khớp **nguyên cụm, theo thứ tự**, nên `"giảm độ sáng"` không làm sáng chữ
`độ` nằm trong `chế độ`. Quality gate cảnh báo nếu cụm này không có trong câu.

`scenes[].text` nên là **một câu mỗi scene**, tối đa ~88 ký tự (caption tối đa 3 dòng).

### Bố cục khung hình

Nửa trên là hình động, 1/3 dưới là caption. Mọi kích thước viết trên khung tham chiếu
1080×1920 rồi nhân theo tỉ lệ, nên đổi `width`/`height` không làm vỡ layout.

## Chạy tại máy

| Thứ | Bản đã test |
|---|---|
| Node.js | 22 |
| FFmpeg | 6+ (`ffmpeg` trong PATH) |
| Python | 3.9+ (CI dùng 3.11) |
| edge-tts | 7.3.1 (`pip install edge-tts==7.3.1`) |
| faster-whisper | 1.1.1, tuỳ chọn — đo timing thật |

```bash
npm ci
python3 scripts/build_config.py --topic "cách học từ vựng" --print
python3 scripts/prepare.py        # giọng + timing + mix nhạc
python3 scripts/check_quality.py
npm run build                     # -> out/video.mp4
npm start                         # Remotion Studio để chỉnh trực tiếp
```

Nếu edge-tts bị chặn từ IP của bạn, cứ dùng GitHub Actions: workflow chạy trên runner
và không cần key.

## GitHub Actions

`.github/workflows/render.yml` chạy khi push `main` hoặc `workflow_dispatch` với các input
`topic`, `scenes`, `theme`, `voice`, `format`, `brand`, `caption`, `music`, `brief`.

Các bước: build config → edge-tts + faster-whisper → probe aligner → quality gate →
render 3 ảnh preview → render video → tạo release `latest` → upload artifact.

- Video: `https://github.com/<owner>/<repo>/releases/download/latest/video.mp4`
- Artifact: tab Actions → run → `video-edu-video` (giữ 14 ngày)
- Preview: `video-edu-previews` (3 khung hình, giữ 7 ngày)

Secret tuỳ chọn:

| Tên | Dùng cho |
|---|---|
| `LLM_API_KEY` | viết kịch bản từ `topic` (OpenAI-compatible) |
| biến `LLM_BASE_URL`, `LLM_MODEL` | đổi endpoint/model |

Không có key vẫn render bình thường với khung bài giảng mặc định.

## Bật GitHub Pages (một lần)

Workflow `Deploy web UI` cần Pages được bật ở chế độ **GitHub Actions**:

```bash
gh api -X POST repos/<owner>/video-edu/pages -f build_type=workflow
# nếu đã bật: gh api -X PUT repos/<owner>/video-edu/pages -f build_type=workflow
```

Sau đó mỗi lần push thay đổi trong `web/`, UI được deploy tự động.

## Cấu trúc

```
src/
  Root.tsx          composition + đọc width/height/fps/totalMs
  Video.tsx         visual + caption + chrome + scene transitions
  Caption.tsx       đo chữ, wrap 3 dòng, karaoke / word-rise / line-mask
  Background.tsx    gradient + quầng sáng + vignette + grain
  config.ts         type + hằng số từ video-config.json
  stage.ts          scale theo khung, clamp/ease/withAlpha
  visuals/          icon, biểu đồ, bước, chat, so sánh, con số, checklist, ảnh
scripts/
  build_config.py   brief/topic → video-config.json
  script_writer.py  LLM (tuỳ chọn) + khung bài giảng dự phòng
  prepare.py        edge-tts, đo timing, mix nhạc
  align.py          faster-whisper + difflib
  check_quality.py  quality gate
  make_music.py     sinh nhạc nền
  create.py         CLI tạo video (local hoặc GitHub)
web/                UI tĩnh cho GitHub Pages
public/             font, nhạc, ảnh (nếu dùng visual photo)
```

## Xử lý sự cố

| Hiện tượng | Nguyên nhân / cách xử lý |
|---|---|
| `edge-tts produced no audio` | IP bị chặn hoặc mất mạng — chạy trên GitHub Actions |
| Caption cắt chữ | Câu quá dài: giữ ≤ 88 ký tự, hoặc giảm số chữ trong `highlight` |
| Hình động trống | `visual` sai schema — quality gate liệt kê lỗi cụ thể |
| Ảnh không hiện | `visual.image` phải nằm trong `public/`, ví dụ `images/abc.jpg` |
| Run fail ở bước release | Repo cần `permissions: contents: write` (đã khai báo trong workflow) |
| UI báo 404 khi dispatch | Token thiếu quyền *Actions: write*, hoặc workflow chưa có trên `main` |
