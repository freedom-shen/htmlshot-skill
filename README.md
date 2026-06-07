# htmlshot

A Claude Code skill that screenshots HTML files, URLs, or HTML snippets to PNG — powered by `playwright-core` and your system Chrome (no browser download).

把本地 HTML 文件、在线 URL 或 HTML 代码片段渲染成 PNG 截图的 Claude Code skill。基于 playwright-core + 系统 Chrome，无需下载浏览器二进制。

## Why

- **Claude 自检闭环**：让 Claude 生成 HTML → 截图 → 看图 → 迭代，所见即所得
- **高清存档**：`--scale 2 --full-page` 输出给人看的完整高清图
- **轻量**：仅依赖 ~3MB 的 playwright-core，复用系统已装的 Chrome/Edge

## Install

```bash
git clone https://github.com/freedom-shen/htmlshot-skill.git ~/.claude/skills/htmlshot
cd ~/.claude/skills/htmlshot && npm install
```

Requirements: Node 18+, Google Chrome (or Microsoft Edge).

## Usage

```bash
node screenshot.mjs <file.html|URL|-> [options]
```

| Option | Description | Default |
|---|---|---|
| `--out <path>` | Output PNG path | auto-named in tmpdir |
| `--full-page` | Capture the full scrollable page | viewport only |
| `--selector <css>` | Capture only the first matching element | — |
| `--viewport <WxH>` | Viewport size | `1280x800` |
| `--scale <n>` | devicePixelRatio | `1` |
| `--wait <ms>` | Extra wait after networkidle | `0` |

### Examples

```bash
# Local file
node screenshot.mjs page.html --out shot.png

# URL, full page, retina
node screenshot.mjs https://example.com --full-page --scale 2

# HTML snippet from stdin
echo '<h1>hello</h1>' | node screenshot.mjs -

# Single element
node screenshot.mjs page.html --selector ".chart"
```

In Claude Code, just say things like "截图这个 HTML 看看效果" / "screenshot this page" and the skill takes over.

## License

MIT
