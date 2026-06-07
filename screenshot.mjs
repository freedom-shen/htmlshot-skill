#!/usr/bin/env node
// htmlshot — 把 HTML 文件 / URL / stdin 片段截图为 PNG
// 用法: node screenshot.mjs <file.html|URL|-> [--out shot.png] [--full-page]
//       [--selector ".chart"] [--viewport 1280x800] [--scale 2] [--wait 500]
import { writeFile, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const USAGE = `用法: node screenshot.mjs <file.html|URL|-> [options]
  <input>            HTML 文件路径 / http(s) URL / "-"（从 stdin 读 HTML 片段）
  --out <path>       输出 PNG 路径（默认临时目录自动命名）
  --full-page        整页长截图（默认只截视口）
  --selector <css>   只截匹配的第一个元素（与 --full-page 同时给出时优先）
  --viewport <WxH>   视口尺寸（默认 1280x800）
  --scale <n>        deviceScaleFactor（默认 2 高清，自检省 token 可用 1）
  --wait <ms>        networkidle 后额外等待毫秒数（默认 0）`;

function fail(msg) {
  process.stderr.write(`htmlshot: ${msg}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const opts = {
    input: null, out: null, fullPage: false, selector: null,
    viewport: { width: 1280, height: 800 }, scale: 2, wait: 0,
  };
  const args = [...argv];
  while (args.length) {
    const a = args.shift();
    switch (a) {
      case '--out':
        opts.out = args.shift() ?? fail('--out 缺少值');
        break;
      case '--full-page':
        opts.fullPage = true;
        break;
      case '--selector':
        opts.selector = args.shift() ?? fail('--selector 缺少值');
        break;
      case '--viewport': {
        const m = /^(\d+)x(\d+)$/.exec(args.shift() ?? '');
        if (!m) fail('--viewport 需要 WxH 格式，例如 1280x800');
        opts.viewport = { width: Number(m[1]), height: Number(m[2]) };
        break;
      }
      case '--scale': {
        const n = Number(args.shift());
        if (!Number.isFinite(n) || n <= 0) fail('--scale 需要正数');
        opts.scale = n;
        break;
      }
      case '--wait': {
        const n = Number(args.shift());
        if (!Number.isInteger(n) || n < 0) fail('--wait 需要非负整数毫秒');
        opts.wait = n;
        break;
      }
      case '--help':
      case '-h':
        console.log(USAGE);
        process.exit(0);
      default:
        if (a.startsWith('--')) fail(`未知参数: ${a}\n${USAGE}`);
        if (opts.input) fail('只能指定一个输入');
        opts.input = a;
    }
  }
  if (!opts.input) fail(`缺少输入\n${USAGE}`);
  if (opts.selector && opts.fullPage) {
    process.stderr.write('htmlshot: --selector 与 --full-page 同时指定，优先使用 --selector\n');
  }
  return opts;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

// 把输入归一化为可加载的 URL
async function resolveInput(input) {
  if (/^https?:\/\//i.test(input)) return input;
  if (input === '-') {
    let html = await readStdin();
    if (!html.trim()) fail('stdin 为空');
    if (!/<html[\s>]/i.test(html)) {
      html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body>${html}</body></html>`;
    }
    const dir = await mkdtemp(join(tmpdir(), 'htmlshot-'));
    const file = join(dir, 'snippet.html');
    await writeFile(file, html, 'utf8');
    return pathToFileURL(file).href;
  }
  const abs = resolve(input);
  if (!existsSync(abs)) fail(`文件不存在: ${abs}`);
  return pathToFileURL(abs).href;
}

async function launchBrowser(chromium) {
  const channels = ['chrome', 'msedge'];
  let lastErr;
  for (const channel of channels) {
    try {
      return await chromium.launch({ channel, headless: true });
    } catch (err) {
      lastErr = err;
    }
  }
  fail(`无法启动浏览器（尝试了 Chrome 和 Edge）。请安装 Google Chrome。\n${lastErr?.message ?? ''}`);
}

const opts = parseArgs(process.argv.slice(2));

let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch (err) {
  if (err.code === 'ERR_MODULE_NOT_FOUND') {
    fail('缺少依赖 playwright-core，请在 skill 目录运行: npm install');
  }
  throw err;
}

const url = await resolveInput(opts.input);
const outPath = resolve(opts.out ?? join(tmpdir(), `htmlshot-${Date.now()}.png`));

const browser = await launchBrowser(chromium);
try {
  const context = await browser.newContext({
    viewport: opts.viewport,
    deviceScaleFactor: opts.scale,
  });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
  } catch (err) {
    fail(`页面加载失败: ${err.message}`);
  }
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  if (opts.wait > 0) await page.waitForTimeout(opts.wait);

  if (opts.selector) {
    const target = page.locator(opts.selector).first();
    try {
      await target.screenshot({ path: outPath, timeout: 10_000 });
    } catch {
      fail(`元素截图失败: 没有匹配 "${opts.selector}" 的可见元素。检查 selector 是否正确，或用 --wait 增加等待时间。`);
    }
  } else {
    await page.screenshot({ path: outPath, fullPage: opts.fullPage });
  }
  console.log(outPath);
} finally {
  await browser.close();
}
