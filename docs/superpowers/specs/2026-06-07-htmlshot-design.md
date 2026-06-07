# htmlshot — HTML 截图 Skill 设计文档

日期：2026-06-07
状态：已确认（方案 A）

## 目标

做一个 Claude Code skill（`htmlshot`），把任意来源的 HTML 渲染成 PNG 截图：

- 本地 HTML 文件（含 Claude 刚生成的文件）
- 在线 URL
- HTML 代码片段（stdin 传入，不要求先落盘）

两类消费者：

1. **Claude 自检闭环**：生成 HTML → 截图 → `Read` 看图 → 改 → 再截。自检时加 `--scale 1` 省 token。
2. **给人看/存档**：默认 `--scale 2` 高清输出（必要时配 `--full-page`）。

发布到 GitHub，供他人安装到 `~/.claude/skills/htmlshot/`。

## 技术选型

`playwright-core` + 系统已装的 Google Chrome（`chromium.launch({ channel: 'chrome' })`）：

- 不下载浏览器二进制（playwright-core 仅 ~3MB）
- 原生支持 full-page、元素截图、`networkidle` 等待
- 备选回退：若未装 Chrome，尝试 `channel: 'msedge'`，再失败则报错提示安装 Chrome

否决的方案：Chrome headless 纯 CLI（无元素截图、等待不可控）、`npx playwright screenshot`（无元素截图、强制下载浏览器）。

## 仓库结构

```
htmlshot/
├── SKILL.md          # skill 入口：触发词、用法、两种使用模式
├── screenshot.mjs    # 自包含截图脚本
├── package.json      # 仅依赖 playwright-core
├── README.md         # GitHub 首页：安装方法、示例、效果图
└── docs/superpowers/specs/   # 本设计文档
```

安装方式（README 中说明）：克隆/复制到 `~/.claude/skills/htmlshot/`，在目录内 `npm install`。

## 脚本接口

```bash
node screenshot.mjs <input> [options]
```

| 参数 | 说明 | 默认 |
|---|---|---|
| `<input>` | 文件路径 / `http(s)://` URL / `-`（stdin 读 HTML 片段） | 必填 |
| `--out <path>` | 输出 PNG 路径 | 临时目录下自动命名 |
| `--full-page` | 整页长截图 | 关（只截视口） |
| `--selector <css>` | 只截匹配的第一个元素 | 无 |
| `--viewport <WxH>` | 视口尺寸 | `1280x800` |
| `--scale <n>` | deviceScaleFactor | `2` |
| `--wait <ms>` | networkidle 后额外等待 | `0` |

行为细节：

- **输入判别**：以 `http://`/`https://` 开头 → URL；`-` → stdin；其余 → 按文件路径解析为 `file://`（不存在则报错）。
- **HTML 片段**：stdin 内容若无 `<html`，自动包一层最小 boilerplate（含 `<meta charset>` 和 viewport meta）后写入临时文件加载。
- **等待策略**：`waitUntil: 'networkidle'` + `document.fonts.ready`，再加可选 `--wait` 毫秒，避免截到半成品。
- **selector 与 full-page 互斥**：同时给出时 selector 优先，并打印提示。
- **输出**：成功后向 stdout 打印一行图片绝对路径（便于 Claude 直接 `Read`）；失败以非零退出码 + stderr 信息结束。
- **超时**：页面加载默认 30s 超时，报清晰错误。

## SKILL.md 要点

- frontmatter：`name: htmlshot`，description 覆盖中英触发词（截图 HTML、screenshot html、渲染网页截图、看下页面效果等）。
- 首次使用检查 `node_modules/playwright-core` 是否存在，缺失则先 `npm install`。
- 写明两种模式：
  - 自检：默认参数截图 → `Read` 图片 → 迭代。
  - 存档：默认即高清（scale 2），按需 `--full-page`。
- 提醒：自检时主动加 `--scale 1`，控制图片体积和 token。

## 测试

手动验收清单（提交 GitHub 前跑一遍）：

1. 本地 HTML 文件截图成功，输出路径可 `Read`。
2. URL（如 example.com）截图成功。
3. `echo '<h1>hi</h1>' | node screenshot.mjs -` 成功。
4. `--full-page` 对长页面截出完整高度。
5. `--selector` 只截目标元素。
6. 不存在的文件 / 打不开的 URL → 非零退出 + 明确错误信息。

## 错误处理

- 未装 Chrome/Edge：报错并提示安装 Google Chrome。
- 未 `npm install`：捕获 `ERR_MODULE_NOT_FOUND`，提示在 skill 目录运行 `npm install`。
- selector 无匹配：报错列出建议（检查 selector、等待时间）。

## 非目标（YAGNI）

- 不做 PDF / JPEG / WebP 输出
- 不做多视口批量截图、设备仿真预设
- 不做 MCP server 封装——纯 CLI 脚本足够
