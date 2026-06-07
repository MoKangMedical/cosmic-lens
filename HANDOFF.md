# Cosmic Lens · 宇宙之镜交接文档

## 项目信息

| 项目 | 当前状态 |
| --- | --- |
| 仓库 | `MoKangMedical/cosmic-lens` |
| 本地路径 | `/Users/apple/Desktop/OPC/cosmic-lens` |
| 线上地址 | `https://mokangmedical.github.io/cosmic-lens/` |
| GitHub Pages | `main` 分支 `/docs` 目录 |
| 当前产品形态 | 静态网站 + 课程体系 + 音频课程 + 购买入口 |

## 当前进度

| 模块 | 进度 |
| --- | --- |
| 正文课程 | 120/120 已生成并接入课程目录 |
| 核心课程音频 | 40/120 已上线，当前 1-40 全部 A级 |
| 音频口播稿 | 40/120 已生成，单课均超过 500 字 |
| 购买页 | 已有 3 档权益卡、Stripe 占位配置、购买成功交付页 |
| 真实支付链接 | 0/3，等待 `STRIPE_SECRET_KEY` 后运行脚本生成 |
| 宇航员视角平台 | 6 页面已上线：总观、故事馆、沉思录、反思日记、画廊、时空轴 |

## 目录结构

```text
docs/
├── index.html
├── courses.html
├── purchase.html
├── purchase-success.html
├── astronaut.html
├── astronaut-stories.html
├── astronaut-philosophy.html
├── astronaut-journal.html
├── astronaut-gallery.html
├── astronaut-timeline.html
├── lesson01.html ... lesson120.html
├── audio/
│   └── lesson01.mp3 ... lesson40.mp3
├── audio_scripts/
│   └── lesson01.txt ... lesson40.txt
├── courses/
│   └── 01-*.md ... 20-*.md
└── js/
    ├── starfield-bg.js
    └── purchase-config.js
scripts/
├── generate_core_audio_neural.py
├── audit_lesson1_benchmark.py
├── audit_product_readiness.py
├── create_stripe_payment_links.py
└── configure_purchase_links.py
```

## 音频标准

继续沿用同一套四层标准：

1. 课程化口播稿：每课不少于 500 字，优先从课程 HTML/Markdown 自动提炼。
2. TTS 音色：`zh-CN-YunyangNeural`。
3. TTS 参数：`rate=-8%`，`pitch=-2Hz`。
4. 后期规格：`loudnorm=I=-16:TP=-1.5:LRA=9`，`24000Hz`，单声道，MP3，`48k`。

当前本机 Homebrew `edge-tts`/`ffmpeg` 曾出现卡住。推荐做法：

```bash
python3 -m venv /tmp/cosmic-edge-venv
/tmp/cosmic-edge-venv/bin/python -m pip install -U pip edge-tts imageio-ffmpeg
FFMPEG_BIN=$(/tmp/cosmic-edge-venv/bin/python - <<'PY'
import imageio_ffmpeg
print(imageio_ffmpeg.get_ffmpeg_exe())
PY
)
python3 -B scripts/generate_core_audio_neural.py \
  --lessons 41-50 \
  --edge-tts-bin /tmp/cosmic-edge-venv/bin/edge-tts \
  --ffmpeg-bin "$FFMPEG_BIN" \
  --ffprobe-bin /usr/bin/false \
  --probe-timeout 5 \
  --tts-timeout 120 \
  --tts-attempts 2
```

审计命令：

```bash
COSMIC_AUDIO_PROBE=afinfo python3 -B scripts/audit_lesson1_benchmark.py --lessons 1-40 --fail-on-problem
python3 -B scripts/audit_product_readiness.py
```

## 购买上线流程

真实购买链接不能硬编码，也不能用假链接冒充。配置方式：

```bash
export STRIPE_SECRET_KEY=sk_live_...
python3 -B scripts/create_stripe_payment_links.py
python3 -B scripts/audit_product_readiness.py --strict-payments
```

脚本会创建 3 个 Stripe Payment Links，并把公开链接写入 `docs/js/purchase-config.js`。成功页会带 `?plan=personal/supporter/institution`，用于展示对应交付入口。

当前阻断：本机没有 `STRIPE_SECRET_KEY`，所以 `configured_payment_links` 仍为 `0/3`。

## 设计系统

视觉方向：深空黑底、星空背景、青紫未来感、克制的玻璃态面板。参考站点风格已在首页、课程页和购买页统一。

核心颜色：

```css
--bg: #050510;
--panel: rgba(9, 15, 34, 0.78);
--text: #f8fbff;
--muted: #aeb8cc;
--blue: #4cc9f0;
--purple: #7c3aed;
--gold: #f6c76f;
```

## 已知注意事项

1. `.hermes/` 是本地计划缓存，已加入 `.gitignore`，不要提交。
2. `docs/js/lesson-3d.js` 目前没有页面引用，属于未接入实验框架，本次不提交。
3. GitHub Pages 使用 `/cosmic-lens/` 子路径，课程音频路径必须保持 `/cosmic-lens/audio/lessonNN.mp3`。
4. Homebrew `ffprobe` 若卡住，可用 `COSMIC_AUDIO_PROBE=afinfo` 跑音频审计。
5. `scripts/audit_product_readiness.py` 普通模式允许支付链接警告；`--strict-payments` 会在 0/3 链接时失败。

## 下一步建议

1. 注入真实 `STRIPE_SECRET_KEY`，生成并验证 3 个 Stripe 购买链接。
2. 继续生成第41-50课音频，并把站内统计更新到 `50/120`。
3. 推送后验证 GitHub Pages 上第31-40课音频移动端播放。
4. 若要使用 `docs/js/lesson-3d.js`，先选定课程页接入 Three.js 和 `LESSON_3D_CONFIG`，通过浏览器截图验证后再提交。
