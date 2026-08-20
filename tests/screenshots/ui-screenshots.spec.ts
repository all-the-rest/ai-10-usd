import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'node:path';
import process from 'node:process';
import { routes, uiReviewConfig } from './ui-review.config';
import type { UiReviewRoute, UiReviewState, UiReviewViewport } from './ui-review.config';

const SCREENSHOT_OUTPUT_DIR = uiReviewConfig.outputDir;

const out = (state: UiReviewState, viewport: UiReviewViewport, file: string) =>
  path.resolve(process.cwd(), SCREENSHOT_OUTPUT_DIR, state, viewport, file);

function viewportForProject(projectName: string): UiReviewViewport {
  return projectName === 'Mobile Chrome' ? 'mobile' : 'desktop';
}

async function waitForAppSettled(page: Page, expectedTitle?: string): Promise<void> {
  await page.waitForLoadState('networkidle');
  if (expectedTitle) {
    await expect(page).toHaveTitle(expectedTitle);
  }
  await page.waitForTimeout(500);
}

async function captureSections(
  page: Page,
  state: UiReviewState,
  viewport: UiReviewViewport,
  name: string,
): Promise<void> {
  const scroller = await page.evaluate(() => {
    const doc = document.scrollingElement;
    const winH = window.innerHeight;
    if (doc && doc.scrollHeight > winH + 4) {
      return { kind: 'window', max: doc.scrollHeight - winH, step: Math.round(winH * 0.8) };
    }
    return { kind: 'window', max: 0, step: Math.round(winH * 0.8) };
  });
  const scroll = (y: number) =>
    page.evaluate(({ kind, y }) => {
      if (kind === 'main') {
        const el = document.querySelector('main');
        if (el) el.scrollTop = y;
      } else {
        window.scrollTo(0, y);
      }
    }, { kind: scroller.kind, y });

  let y = 0;
  let i = 0;
  for (;;) {
    await scroll(y);
    await page.waitForTimeout(150);
    await page.screenshot({ path: out(state, viewport, `${name}-sec${i}.png`), fullPage: false });
    if (y >= scroller.max) break;
    i += 1;
    y = Math.min(scroller.max, y + scroller.step);
  }
  await scroll(0);
}

for (const route of routes) {
  for (const state of route.states) {
    for (const viewport of route.viewports ?? ['desktop', 'mobile']) {
      test(`screenshot ${route.name} (${state}, ${viewport})`, { tag: ['@screenshot'] }, async ({ page }, testInfo) => {
        test.skip(
          viewportForProject(testInfo.project.name) !== viewport,
          `project ${testInfo.project.name} renders the ${viewportForProject(testInfo.project.name)} viewport`,
        );

        await page.goto(route.path);
        await waitForAppSettled(page, route.expectedTitle);

        // Full page screenshot
        await page.screenshot({ path: out(state, viewport, `${route.name}.png`), fullPage: true });
        // Section screenshots
        await captureSections(page, state, viewport, route.name);
      });
    }
  }
}
