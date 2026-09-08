import { expect, test } from '@playwright/test';
import path from 'node:path';
import process from 'node:process';
import fs from 'node:fs';

// Share-card dialog: open, reconfigure, live-preview, export SVG + PNG.
// Run via `pnpm test:screenshots` (dev server must be up at http://localhost:5173).

const OUTPUT_DIR = path.resolve(process.cwd(), 'test-results/ui-screenshots');

async function openShareDialog(page, screenshotName: string) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Comparison table renders after data loads.
  await page.locator('#comparison table').waitFor({ state: 'attached', timeout: 15000 });
  await page.getByRole('button', { name: 'Share', exact: true }).first().click();
  const dialog = page.locator('#share-dialog');
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(400);
  await dialog.screenshot({ path: path.join(OUTPUT_DIR, screenshotName) });
  return dialog;
}

test('share dialog opens with live SVG preview and exports SVG', { tag: ['@screenshot'] }, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'Desktop Chrome', 'desktop-only share export check');
  const dialog = await openShareDialog(page, 'share-dialog-dark.png');

  const previewSvg = dialog.locator('svg').first();
  await expect(previewSvg).toBeVisible();
  const dims = await previewSvg.evaluate((el) => ({
    width: el.getAttribute('width'),
    height: el.getAttribute('height'),
    rows: el.querySelectorAll('g > text').length,
  }));
  expect(dims.width).toBe('1200');
  expect(dims.height).toBe('630');

  // Switch to light theme + IG portrait preset + top 3, verify preview re-renders.
  await dialog.getByRole('radio', { name: 'Light' }).click();
  await dialog.getByLabel('Size preset').selectOption('portrait');
  await dialog.getByLabel('Top-N rows').selectOption('3');
  await page.waitForTimeout(300);
  const portraitDims = await previewSvg.evaluate((el) => ({
    width: el.getAttribute('width'),
    height: el.getAttribute('height'),
  }));
  expect(portraitDims.width).toBe('1080');
  expect(portraitDims.height).toBe('1350');
  await dialog.screenshot({ path: path.join(OUTPUT_DIR, 'share-dialog-light-portrait.png') });

  // Portrait rule: Top 10 clamps to Top 8 (modest TopN 5–8, constraints fill
  // the height instead of filler models) + peak/off-peak badges + block.
  await dialog.getByLabel('Size preset').selectOption('portrait');
  await dialog.getByLabel('Top-N rows').selectOption('10');
  await page.waitForTimeout(300);
  expect(await previewSvg.getAttribute('aria-label')).toMatch(/^Top 8 models/);
  const portraitHtml = await previewSvg.evaluate((el) => el.outerHTML);
  expect(portraitHtml).toContain('OFF-PEAK 01:00–04:00 + 06:00–10:00 UTC');
  expect(portraitHtml).toContain('Off-peak (UTC): 01:00–04:00 + 06:00–10:00');
  expect(portraitHtml).toContain('Weekdays per source');
  expect(portraitHtml).toContain('separate rows');
  await dialog.screenshot({ path: path.join(OUTPUT_DIR, 'share-dialog-portrait-top8.png') });

  // Landscape rule: Top 10 clamps to Top 5, no constraints.
  await dialog.getByLabel('Size preset').selectOption('og');
  await dialog.getByLabel('Top-N rows').selectOption('10');
  await page.waitForTimeout(300);
  expect(await previewSvg.getAttribute('aria-label')).toMatch(/^Top 5 models/);
  const ogHtml = await previewSvg.evaluate((el) => el.outerHTML);
  expect(ogHtml).not.toContain('OFF-PEAK 01:00');
  expect(ogHtml).not.toContain('>PEAK<');
  expect(ogHtml).not.toContain('separate rows');
  await dialog.screenshot({ path: path.join(OUTPUT_DIR, 'share-dialog-og-clamped.png') });

  // Restore portrait/top-3 for the export assertions below.
  await dialog.getByLabel('Size preset').selectOption('portrait');
  await dialog.getByLabel('Top-N rows').selectOption('3');
  await page.waitForTimeout(300);

  // SVG download produces a non-empty self-contained file.
  const svgDownload = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download SVG' }).click();
  const svgFile = await svgDownload;
  const svgPath = path.join(OUTPUT_DIR, 'share-card.svg');
  await svgFile.saveAs(svgPath);
  const svgText = fs.readFileSync(svgPath, 'utf8');
  expect(svgText.startsWith('<svg')).toBe(true);
  expect(svgText).toContain('xmlns="http://www.w3.org/2000/svg"');
  expect(svgText).toContain('ai-10-usd.all-the.rest');
  expect(svgText.length).toBeGreaterThan(2000);

  // PNG download produces a real PNG at preset size.
  const pngDownload = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download PNG' }).click();
  const pngFile = await pngDownload;
  const pngPath = path.join(OUTPUT_DIR, 'share-card.png');
  await pngFile.saveAs(pngPath);
  const pngBytes = fs.readFileSync(pngPath);
  expect(pngBytes.length).toBeGreaterThan(10000);
  // PNG magic bytes + IHDR width/height (1080×1350 IG portrait preset).
  expect(pngBytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(pngBytes.readUInt32BE(16)).toBe(1080);
  expect(pngBytes.readUInt32BE(20)).toBe(1350);
});

test('share link deep-link reopens the dialog with the same config', { tag: ['@screenshot'] }, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'Desktop Chrome', 'desktop-only deep-link check');
  await page.goto('/?share=1&topN=7&metric=max&winner=all&stheme=dark&preset=og');
  await page.waitForLoadState('networkidle');
  const dialog = page.locator('#share-dialog');
  await expect(dialog).toBeVisible({ timeout: 15000 });
  await expect(dialog.getByLabel('Top-N rows')).toHaveValue('7');
  await expect(dialog.locator('svg').first()).toBeVisible();
  // "Both plans only" toggle defaults to checked without an explicit card param.
  await expect(dialog.getByRole('checkbox', { name: 'Both plans only' })).toBeChecked();
});

test('share matchedOnly mirrors page default unless deep-linked', { tag: ['@screenshot'] }, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'Desktop Chrome', 'desktop-only matched check');
  // Explicit card param wins over the page state.
  await page.goto('/?share=1&topN=5&metric=max&winner=all&stheme=dark&preset=og&slang=en&matched=0');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#share-dialog')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#share-dialog').getByRole('checkbox', { name: 'Both plans only' })).not.toBeChecked();

  // Page match=0 is inherited when the card link carries no explicit matched param.
  await page.goto('/?share=1&topN=5&metric=max&winner=all&stheme=dark&preset=og&slang=en&match=0');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#share-dialog')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#share-dialog').getByRole('checkbox', { name: 'Both plans only' })).not.toBeChecked();
});

test('share dialog is usable on mobile without overflow', { tag: ['@screenshot'] }, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'Mobile Chrome', 'mobile-only share check');
  const dialog = await openShareDialog(page, 'share-dialog-mobile.png');

  const vp = page.viewportSize()!;
  const box = (await dialog.locator('.modal-box').boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width);

  // Every control must be reachable: preset, rows, filter, theme, toggles, 5 action buttons.
  for (const label of ['Size preset', 'Top-N rows', 'Winner filter']) {
    await expect(dialog.getByLabel(label)).toBeVisible();
  }
  for (const name of ['Copy SVG', 'Download SVG', 'Download PNG', 'Copy link']) {
    await expect(dialog.getByRole('button', { name, exact: true })).toBeVisible();
  }
  await expect(dialog.locator('.modal-action').getByRole('button', { name: 'Close', exact: true })).toBeVisible();
});

const PRESET_MATRIX: Array<{
  shot: string;
  query: string;
  width: string;
  height: string;
  heading: string;
  card: RegExp;
  badge: boolean;
}> = [
  { shot: 'share-preset-og.png', query: '?share=1&topN=5&metric=max&winner=all&stheme=dark&preset=og&slang=en', width: '1200', height: '630', heading: 'Share top models card', card: /^Top 5 models/, badge: false },
  { shot: 'share-preset-twitter.png', query: '?share=1&topN=5&metric=max&winner=all&stheme=dark&preset=twitter&slang=en', width: '1200', height: '675', heading: 'Share top models card', card: /^Top 5 models/, badge: false },
  { shot: 'share-preset-portrait.png', query: '?share=1&topN=7&metric=max&winner=all&stheme=dark&preset=portrait&slang=en', width: '1080', height: '1350', heading: 'Share top models card', card: /^Top 7 models/, badge: true },
  { shot: 'share-preset-story.png', query: '?share=1&topN=5&metric=max&winner=all&stheme=dark&preset=story&slang=en', width: '1080', height: '1920', heading: 'Share top models card', card: /^Top 5 models/, badge: true },
  // Densest portrait + densest story clamp to Top 8, German card language.
  { shot: 'share-preset-portrait-de.png', query: '?share=1&topN=10&metric=max&winner=all&stheme=light&preset=portrait&slang=de', width: '1080', height: '1350', heading: 'Top-Modelle-Karte teilen', card: /^Top-8-Modelle/, badge: true },
  { shot: 'share-preset-story-de.png', query: '?share=1&topN=10&metric=max&winner=commandCode&stheme=light&preset=story&slang=de', width: '1080', height: '1920', heading: 'Top-Modelle-Karte teilen', card: /^Top-8-Modelle/, badge: true },
];

test('share presets matrix renders all 4 sizes in EN + DE', { tag: ['@screenshot'] }, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'Desktop Chrome', 'desktop-only preset matrix');
  for (const c of PRESET_MATRIX) {
    await page.goto(`/${c.query}`);
    await page.waitForLoadState('networkidle');
    const dialog = page.locator('#share-dialog');
    await expect(dialog).toBeVisible({ timeout: 15000 });
    await expect(dialog.getByRole('heading', { name: c.heading })).toBeVisible();
    const svg = dialog.locator('svg').first();
    await expect(svg).toBeVisible({ timeout: 15000 });
    const dims = await svg.evaluate((el) => ({
      width: el.getAttribute('width'),
      height: el.getAttribute('height'),
    }));
    expect(dims.width).toBe(c.width);
    expect(dims.height).toBe(c.height);
    expect(await svg.getAttribute('aria-label')).toMatch(c.card);
    // Portrait rule: variant badges + constraints block; landscape: neither.
    const html = await svg.evaluate((el) => el.outerHTML);
    if (c.badge) {
      expect(html).toContain('OFF-PEAK 01:00–04:00 + 06:00–10:00 UTC');
      expect(html).toContain('Off-peak (UTC): 01:00–04:00 + 06:00–10:00');
      expect(html).toContain(c.heading === 'Top-Modelle-Karte teilen' ? 'Wochentage lt. Quelle' : 'Weekdays per source');
      expect(html).toContain(c.heading === 'Top-Modelle-Karte teilen' ? 'eigene Zeilen' : 'separate rows');
    } else {
      expect(html).not.toContain('OFF-PEAK 01:00');
      expect(html).not.toContain('>PEAK<');
    }
    // No text bbox may intersect a bar rect (bars sit beside labels, never behind).
    const overlaps = await svg.evaluate((root) => {
      const box = (el: SVGGraphicsElement) => {
        const b = el.getBBox();
        return { x: b.x, y: b.y, w: b.width, h: b.height };
      };
      const texts = [...root.querySelectorAll('text')].map((t) => ({
        text: (t.textContent ?? '').slice(0, 40),
        ...box(t as unknown as SVGGraphicsElement),
      }));
      const bars = [...root.querySelectorAll('rect')]
        .filter((r) => r.getAttribute('height') === '6')
        .map(box);
      const hits: string[] = [];
      for (const t of texts) {
        for (const b of bars) {
          const ix = Math.min(t.x + t.w, b.x + b.w) - Math.max(t.x, b.x);
          const iy = Math.min(t.y + t.h, b.y + b.h) - Math.max(t.y, b.y);
          if (ix > 0.5 && iy > 0.5) hits.push(`${t.text} @(${Math.round(t.x)},${Math.round(t.y)})`);
        }
      }
      return hits;
    });
    expect(overlaps).toEqual([]);
    // Footer RIGHT carries the last update with time (localized, intraday runs exist).
    const de = c.heading === 'Top-Modelle-Karte teilen';
    expect(html).toMatch(de ? /Stand .*?\d{1,2}:\d{2}/ : /Updated .*?\d{1,2}:\d{2}/);
    // Footer geometry: LEFT domain at pad, RIGHT update end-anchored, both bottom-anchored.
    // Dynamic TOP-X: rank-circle count matches the N in the card title (live from data, never hardcoded).
    const layout = await svg.evaluate((root) => {
      const box = (el: SVGGraphicsElement) => {
        const b = el.getBBox();
        return { x: b.x, y: b.y, w: b.width, h: b.height };
      };
      const H = Number(root.getAttribute('height'));
      const W = Number(root.getAttribute('width'));
      const texts = [...root.querySelectorAll('text')].map((t) => ({
        text: t.textContent ?? '',
        ...box(t as unknown as SVGGraphicsElement),
      }));
      const left = texts.find((t) => t.text === 'ai-10-usd.all-the.rest')!;
      const right = texts.find((t) => /^(Updated|Stand) /.test(t.text))!;
      const ranks = [...root.querySelectorAll('circle')].filter((el) => el.getAttribute('r') === '10').length;
      const aria = root.getAttribute('aria-label') ?? '';
      const n = Number(/Top[ -](\d+)/.exec(aria)?.[1]);
      return { H, W, left, right, ranks, n };
    });
    expect(layout.left.x).toBeCloseTo(48, 0);
    expect(layout.left.y + layout.left.h).toBeGreaterThan(layout.H - 40);
    expect(layout.right.x + layout.right.w).toBeCloseTo(layout.W - 48, 0);
    expect(layout.right.y + layout.right.h).toBeGreaterThan(layout.H - 40);
    expect(layout.ranks).toBe(layout.n);
    expect(layout.n).toBeGreaterThan(0);
    await expect.poll(async () => svg.evaluate((el) => el.outerHTML.includes('ai-10-usd.all-the.rest')), { timeout: 5000 }).toBe(true);
    await page.waitForTimeout(300);
    await dialog.screenshot({ path: path.join(OUTPUT_DIR, c.shot) });
  }
});

test('legacy share links coerce to the current config', { tag: ['@screenshot'] }, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'Desktop Chrome', 'desktop-only compat check');
  // Removed "square" preset falls back to OG dimensions.
  await page.goto('/?share=1&topN=5&metric=max&winner=all&stheme=dark&preset=square&slang=en');
  await page.waitForLoadState('networkidle');
  const dialog = page.locator('#share-dialog');
  await expect(dialog).toBeVisible({ timeout: 15000 });
  const dims = await dialog.locator('svg').first().evaluate((el) => ({
    width: el.getAttribute('width'),
    height: el.getAttribute('height'),
  }));
  expect(dims).toEqual({ width: '1200', height: '630' });

  // Removed gap metrics still open the dialog (ranked by total requests).
  await page.goto('/?share=1&topN=5&metric=advantage&winner=all&stheme=dark&preset=og');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#share-dialog')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#share-dialog').locator('svg').first()).toBeVisible({ timeout: 15000 });
});

test('share dialog tall story card has no mobile overflow', { tag: ['@screenshot'] }, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'Mobile Chrome', 'mobile-only tall-card check');
  await page.goto('/?share=1&topN=10&metric=max&winner=all&stheme=dark&preset=story&slang=en');
  await page.waitForLoadState('networkidle');
  const dialog = page.locator('#share-dialog');
  await expect(dialog).toBeVisible({ timeout: 15000 });
  await expect(dialog.locator('svg').first()).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(400);
  await dialog.screenshot({ path: path.join(OUTPUT_DIR, 'share-dialog-mobile-story.png') });

  const vp = page.viewportSize()!;
  const box = (await dialog.locator('.modal-box').boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
  for (const name of ['Copy SVG', 'Download SVG', 'Download PNG', 'Copy link']) {
    await expect(dialog.getByRole('button', { name, exact: true })).toBeVisible();
  }
  await expect(dialog.locator('.modal-action').getByRole('button', { name: 'Close', exact: true })).toBeVisible();
});
