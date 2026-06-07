---
name: htmlshot
description: 截图 HTML/网页为 PNG。Use when the user asks to 截图 HTML、screenshot html/webpage、渲染网页截图、看下页面效果、检查生成的 HTML 长什么样, or when Claude needs to visually verify HTML it generated.
---

# htmlshot — HTML 截图

把本地 HTML 文件、在线 URL 或 HTML 代码片段渲染成 PNG 截图。基于 playwright-core + 系统 Chrome。

## 首次使用检查

若 `node_modules/playwright-core` 不存在，先在本 skill 目录运行：

```bash
npm install
```

## 用法

```bash
node ~/.claude/skills/htmlshot/screenshot.mjs <input> [options]
```

- `<input>`：HTML 文件路径 / `http(s)://` URL / `-`（stdin 读 HTML 片段，自动补全 boilerplate）
- `--out <path>`：输出 PNG 路径（默认临时目录自动命名）
- `--full-page`：整页长截图
- `--selector <css>`：只截匹配的第一个元素（优先于 --full-page）
- `--viewport <WxH>`：视口（默认 1280x800）
- `--scale <n>`：deviceScaleFactor（默认 1）
- `--wait <ms>`：networkidle 后额外等待（异步渲染页面可加 500~1000）

成功时 stdout 打印图片绝对路径；失败时非零退出码 + stderr 错误信息。

## 模式一：自检闭环（默认）

生成/修改 HTML 后，用默认参数截图，然后用 Read 工具查看图片，发现问题修改后重截：

```bash
node ~/.claude/skills/htmlshot/screenshot.mjs page.html
# → /tmp/.../htmlshot-xxx.png，用 Read 读取该路径查看效果
```

长页面用 `--full-page` 但保持默认 scale 1，控制图片体积和 token 消耗。

## 模式二：高清存档（给人看）

```bash
node ~/.claude/skills/htmlshot/screenshot.mjs page.html --scale 2 --full-page --out ./screenshot.png
```

## 示例

```bash
# 截一段 HTML 片段
echo '<h1>hello</h1>' | node ~/.claude/skills/htmlshot/screenshot.mjs -

# 截在线页面的某个组件
node ~/.claude/skills/htmlshot/screenshot.mjs https://example.com --selector ".main-card"

# ECharts 等异步渲染页面
node ~/.claude/skills/htmlshot/screenshot.mjs chart.html --wait 800
```

## 排错

- `缺少依赖 playwright-core` → 在 skill 目录 `npm install`
- `无法启动浏览器` → 安装 Google Chrome（或 Edge）
- 元素截图失败 → 检查 selector；异步渲染加 `--wait`
- 截到半成品/白屏 → 加 `--wait 1000`
