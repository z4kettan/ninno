#!/usr/bin/env node
/**
 * Renders the PWA icons from the Ninno mark with headless Chrome (dev-time only; the PNGs
 * are committed). Usage: node tools/render-icons.mjs [path-to-chrome]
 *
 * - icon-192/512: the rounded-square mark on a transparent background.
 * - maskable-192/512: full-bleed green with the "n" inside the 80% safe zone, so Android's
 *   circle/squircle masks never clip it.
 * - apple-touch-icon (180): full-bleed (iOS applies its own rounding).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ACCENT = '#0f7a5c';
const ON_ACCENT = '#ffffff';
const OUT = resolve('apps/web/public/icons');

const chrome =
  process.argv[2] ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].find((p) => existsSync(p));
if (!chrome) {
  throw new Error('No Chrome/Edge found; pass its path as the first argument.');
}

/** The "n" stroke from <nn-mark>, on a 28-unit grid. */
const N_PATH = 'M9 20V12.5a5 5 0 0 1 10 0V20M9 12.5V9';

function svg(size, { maskable }) {
  // Maskable: shrink the glyph into the central safe zone; full-bleed background.
  const scale = maskable ? 0.62 : 1;
  const offset = (28 - 28 * scale) / 2;
  const background = maskable
    ? `<rect width="28" height="28" fill="${ACCENT}"/>`
    : `<rect width="28" height="28" rx="7" fill="${ACCENT}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 28 28">
    ${background}
    <g transform="translate(${offset} ${offset}) scale(${scale})">
      <path d="${N_PATH}" stroke="${ON_ACCENT}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </g></svg>`;
}

const icons = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'maskable-192.png', size: 192, maskable: true },
  { file: 'maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: true },
];

const work = mkdtempSync(join(tmpdir(), 'ninno-icons-'));
try {
  for (const { file, size, maskable } of icons) {
    const html = join(work, `${file}.html`);
    writeFileSync(
      html,
      `<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg(size, { maskable })}`,
    );
    execFileSync(chrome, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--default-background-color=00000000',
      `--window-size=${size},${size}`,
      `--screenshot=${join(OUT, file)}`,
      pathToFileURL(html).href,
    ]);
    console.log(`wrote ${file}`);
  }
  writeFileSync(join(OUT, 'mark.svg'), svg(512, { maskable: false }));
  console.log('wrote mark.svg');
} finally {
  rmSync(work, { recursive: true, force: true });
}
