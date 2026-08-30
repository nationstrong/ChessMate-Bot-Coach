const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const images = path.join(root, 'docs', 'images');
const outDir = path.join(images, 'annotated');
fs.mkdirSync(outDir, { recursive: true });

const RED = '#e11d48';
const specs = [
  {
    input: '01-install-extension.png', output: '01-install-extension-annotated.jpg',
    boxes: [
      { x: 26, y: 88, w: 354, h: 64, label: '② 点击「加载未打包的扩展程序」', lx: 28, ly: 172, lw: 620 },
      { x: 2705, y: 18, w: 160, h: 45, label: '① 开启开发者模式', lx: 2240, ly: 78, lw: 430 }
    ]
  },
  {
    input: '02-opening-and-live-outcome.png', output: '02-opening-and-live-outcome-annotated.jpg',
    boxes: [
      { x: 1902, y: 235, w: 955, h: 205, label: '① 开局识别与计划说明', lx: 1920, ly: 190, lw: 430 },
      { x: 1902, y: 450, w: 955, h: 150, label: '② 实时结果估计（胜 / 和 / 负）', lx: 1920, ly: 610, lw: 560 }
    ]
  },
  {
    input: '03-candidates-and-arrows.png', output: '03-candidates-and-arrows-annotated.jpg',
    boxes: [
      { x: 770, y: 790, w: 710, h: 680, label: '① 棋盘候选箭头', lx: 800, ly: 735, lw: 350 },
      { x: 1890, y: 940, w: 970, h: 535, label: '② 三个候选方案与解释', lx: 1910, ly: 885, lw: 440 }
    ]
  },
  {
    input: '04-move-safety.png', output: '04-move-safety-annotated.jpg',
    banner: '落点安全：绿色＝不受攻击　黄色＝受攻击但有保护　红色＝受攻击且无保护',
    boxes: [
      { x: 735, y: 635, w: 172, h: 172, label: '绿色：安全', lx: 740, ly: 580, lw: 240 },
      { x: 1078, y: 635, w: 172, h: 172, label: '黄色：有保护', lx: 1025, ly: 820, lw: 280 },
      { x: 1250, y: 807, w: 170, h: 172, label: '红色：危险', lx: 1125, ly: 990, lw: 250 }
    ]
  },
  {
    input: '05-loose-targets.png', output: '05-loose-targets-annotated.jpg',
    boxes: [
      { x: 1445, y: 165, w: 620, h: 255, label: '对手悬空目标：未受保护的棋子', lx: 1455, ly: 110, lw: 540 }
    ]
  },
  {
    input: '06-opponent-tendency-and-controls.png', output: '06-opponent-tendency-and-controls-annotated.jpg',
    boxes: [
      { x: 1375, y: 680, w: 690, h: 260, label: '① 分析强度与显示控制', lx: 1390, ly: 625, lw: 430 },
      { x: 1375, y: 945, w: 690, h: 405, label: '② 中局 Bot 风格画像与应对建议', lx: 1390, ly: 890, lw: 570 }
    ]
  }
];

function esc(text) {
  return text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

function overlaySvg(width, height, spec) {
  const fontSize = Math.max(24, Math.round(width / 90));
  let body = '';
  if (spec.banner) {
    body += `<rect x="20" y="20" width="${width - 40}" height="64" rx="12" fill="${RED}" fill-opacity="0.94"/>`;
    body += `<text x="42" y="62" font-family="PingFang SC, Noto Sans CJK SC, sans-serif" font-size="${Math.max(22, fontSize - 2)}" font-weight="700" fill="white">${esc(spec.banner)}</text>`;
  }
  for (const b of spec.boxes) {
    body += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="10" fill="none" stroke="${RED}" stroke-width="7"/>`;
    body += `<rect x="${b.lx}" y="${b.ly}" width="${b.lw}" height="52" rx="10" fill="${RED}" fill-opacity="0.95"/>`;
    body += `<text x="${b.lx + 16}" y="${b.ly + 36}" font-family="PingFang SC, Noto Sans CJK SC, sans-serif" font-size="${fontSize}" font-weight="700" fill="white">${esc(b.label)}</text>`;
  }
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${body}</svg>`);
}

(async () => {
  for (const spec of specs) {
    const input = path.join(images, spec.input);
    const output = path.join(outDir, spec.output);
    const meta = await sharp(input).metadata();
    await sharp(input)
      .composite([{ input: overlaySvg(meta.width, meta.height, spec), top: 0, left: 0 }])
      .jpeg({ quality: 86, chromaSubsampling: '4:4:4', mozjpeg: true })
      .toFile(output);
    const bytes = fs.statSync(output).size;
    console.log(`${path.basename(output)} ${bytes}`);
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

