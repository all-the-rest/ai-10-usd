import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'node:path';
import process from 'node:process';

// Element-scoped interaction screenshots + REAL overflow-guard assertions.
// These go beyond the manifest-driven ui-screenshots.spec.ts (which never opens
// the hamburger) to prove the open menu stays fully on-screen on mobile and the
// UnadjustedCaption portal popover is not clipped by the overflow-x-auto table.
//
// Run via `pnpm test:screenshots` (dev server must be up at http://localhost:5173).

const OUTPUT_DIR = path.resolve(process.cwd(), 'test-results/ui-screenshots');

/** Run only under the Mobile Chrome project; skip on Desktop. */
function skipUnlessMobile(page: Page, testInfo: { project: { name: string } }) {
  test.skip(
    testInfo.project.name !== 'Mobile Chrome',
    `mobile-only interaction check (this project is ${testInfo.project.name})`,
  );
}

async function waitForApp(page: Page) {
  await page.waitForLoadState('networkidle');
  // The comparison table (and its UnadjustedCaption buttons) renders after data loads.
  await page.locator('button.cursor-help').first().waitFor({ state: 'attached', timeout: 15000 }).catch(() => {});
}

test('mobile hamburger opens on-screen at the far left', { tag: ['@screenshot'] }, async ({ page }, testInfo) => {
  skipUnlessMobile(page, testInfo);

  await page.goto('/');
  await waitForApp(page);

  const trigger = page.locator('div.dropdown-start > div[role="button"]');
  await expect(trigger).toHaveCount(1);

  // --- Assert the burger trigger sits at the far left (≤ 64px from the edge) ---
  const triggerBox = (await trigger.boundingBox())!;
  expect(triggerBox.x, 'burger trigger should be at the far left of the navbar').toBeLessThanOrEqual(64);

  // Open the dropdown (focus the tabindex=0 trigger → daisyUI reveals dropdown-content).
  await trigger.click();
  await page.waitForTimeout(300);

  const menu = page.locator('ul.menu.dropdown-content');
  await expect(menu).toBeVisible();

  // --- Element-scoped screenshot of the open menu at readable resolution ---
  await menu.screenshot({ path: path.join(OUTPUT_DIR, 'mobile-hamburger-menu.png') });

  // --- Real overflow guard: the open menu must be fully within the viewport ---
  // boundingBox() returns {x, y, width, height} (NOT left/top/right/bottom).
  const vp = page.viewportSize()!;
  const menuBox = (await menu.boundingBox())!;
  expect(menuBox.x, 'menu left edge must not overflow the left screen edge').toBeGreaterThanOrEqual(0);
  expect(menuBox.y, 'menu top edge must not overflow the top screen edge').toBeGreaterThanOrEqual(0);
  expect(menuBox.x + menuBox.width, 'menu right edge must not overflow the right screen edge').toBeLessThanOrEqual(vp.width);
  expect(menuBox.y + menuBox.height, 'menu bottom edge must not overflow the bottom screen edge').toBeLessThanOrEqual(vp.height);

  // Viewport capture of the open menu so the vision agent judges position/overflow
  // at full context. (The open menu is position:absolute below the <header> box, so a
  // header-element shot would clip it; a viewport shot frames the whole open state.)
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'mobile-hamburger-header.png'), fullPage: false });
});

test('mobile UnadjustedCaption popover is visible and not clipped', { tag: ['@screenshot'] }, async ({ page }, testInfo) => {
  skipUnlessMobile(page, testInfo);

  await page.goto('/');
  await waitForApp(page);

  const infoButton = page.locator('button.cursor-help').first();
  await expect(infoButton).toBeAttached();

  // Scroll the info button fully into view (it lives inside the overflow-x-auto table),
  // then tap to open the portal popover.
  await infoButton.scrollIntoViewIfNeeded();
  await infoButton.click();
  await page.waitForTimeout(300);

  const popover = page.locator('div[role="tooltip"]');
  await expect(popover, 'portal popover must be present after tap').toBeVisible();

  // --- Element-scoped screenshot of the popover at readable resolution ---
  await popover.screenshot({ path: path.join(OUTPUT_DIR, 'mobile-unadjusted-popover.png') });

  // --- Real overflow guard: the popover must be fully within the viewport ---
  // boundingBox() returns {x, y, width, height} (NOT left/top/right/bottom).
  const vp = page.viewportSize()!;
  const tipBox = (await popover.boundingBox())!;
  expect(tipBox.x, 'popover left edge must not overflow the left screen edge').toBeGreaterThanOrEqual(0);
  expect(tipBox.y, 'popover top edge must not overflow the top screen edge').toBeGreaterThanOrEqual(0);
  expect(tipBox.x + tipBox.width, 'popover right edge must not overflow the right screen edge').toBeLessThanOrEqual(vp.width);
  expect(tipBox.y + tipBox.height, 'popover bottom edge must not overflow the bottom screen edge').toBeLessThanOrEqual(vp.height);
});
