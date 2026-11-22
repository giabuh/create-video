import {execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {expect, test} from '@playwright/test';
import type {PreviewResult, ProjectDetail} from '../shared/types.ts';

const API = `${process.env.REEL_API_URL ?? 'http://127.0.0.1:5316'}/api`;
const ROOT = process.env.REEL_ROOT ?? path.resolve(import.meta.dirname, '../..'); // must match the API's data root
const slug = `e2e-${Date.now()}`;
const jpgStem = `e2e-pic-${Date.now()}`;

type Job = {kind: string; project?: string; state: string; error?: string};
const jobs = async (): Promise<Job[]> => (await fetch(`${API}/jobs`)).json();
async function waitJob(kind: string, ms: number): Promise<void> {
  await expect.poll(async () => {
    const j = (await jobs()).find((x) => x.kind === kind && x.project === slug);
    if (j?.state === 'failed') throw new Error(`${kind} job failed: ${j.error}`);
    return j?.state;
  }, {timeout: ms, intervals: [1000]}).toBe('done');
}
async function libraryKeys(): Promise<string[]> {
  return Object.keys((await (await fetch(`${API}/library`)).json()).data).filter((k) => k.includes(jpgStem));
}

test.describe.configure({mode: 'serial'});

test.beforeAll(async () => {
  const r = await fetch(`${API}/projects`, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({name: slug})});
  expect(r.status).toBe(201);
  const storyboard = JSON.parse(readFileSync(path.join(ROOT, 'projects/2026-11-20-demo-card-moi/storyboard.json'), 'utf8'));
  const cur = await (await fetch(`${API}/projects/${slug}`)).json();
  const put = await fetch(`${API}/projects/${slug}/storyboard`, {method: 'PUT', headers: {'content-type': 'application/json'}, body: JSON.stringify({storyboard, baseMtime: cur.storyboard.mtime})});
  expect(put.ok).toBe(true);
});

test.afterAll(async () => {
  for (const k of await libraryKeys()) await fetch(`${API}/library/${encodeURIComponent(k)}`, {method: 'DELETE'});
  rmSync(path.join(ROOT, 'projects', slug), {recursive: true, force: true});
  rmSync(path.join(ROOT, 'inbox/_done', `${jpgStem}.jpg`), {force: true}); // ingest keeps the original here
});

test('projects list shows the scratch project', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('link', {name: new RegExp(slug)})).toBeVisible();
});

test('watch screen: player, scene strip, docked chat and the Sửa chỗ này tag', async ({page}) => {
  await page.goto(`/p/${slug}`);
  const player = page.getByRole('region', {name: 'Xem trước'});
  const ask = page.getByRole('button', {name: 'Sửa chỗ này'});
  await expect(ask).toBeEnabled({timeout: 30_000}); // enabled only once renderProps exist
  const chat = page.getByLabel('Chat', {exact: true}); // exact: the nav's "Chat với Claude" button also matches
  await expect(chat).toBeVisible();
  const previewBox = (await player.boundingBox())!;
  const chatBox = (await chat.boundingBox())!;
  expect(chatBox.x).toBeGreaterThanOrEqual(previewBox.x + previewBox.width);
  expect(chatBox.width).toBeGreaterThan(previewBox.width);
  const divider = page.getByRole('separator', {name: 'Đổi độ rộng chat'});
  await divider.press('Home');
  const narrowChat = (await chat.boundingBox())!.width;
  const handle = (await divider.boundingBox())!;
  const x = handle.x + handle.width / 2, y = handle.y + handle.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 120, y, {steps: 4});
  await page.mouse.up();
  expect((await chat.boundingBox())!.width).toBeGreaterThan(narrowChat + 100);
  await divider.press('ArrowRight');
  expect((await chat.boundingBox())!.width).toBeLessThan(narrowChat + 110);
  await expect(page.getByLabel(/Caption/)).toHaveCount(0); // no manual-editing fields left
  const scenes = page.getByRole('button', {name: /^Tới cảnh /});
  const strip = page.getByRole('group', {name: 'Các cảnh'});
  await expect(strip.locator('video')).toHaveCount(0);
  await expect(scenes.first().locator('img')).toHaveAttribute('src', /^\/library\/thumbs\/.+\.jpg$/);
  await expect(scenes.first().getByText('00:00,0')).toBeVisible();
  await expect(scenes.first().getByTestId('timeline-playhead')).toBeVisible();
  const second = scenes.nth(1);
  await second.click();
  await expect(second).toHaveAttribute('aria-current', 'true', {timeout: 10_000});
  const playhead = second.getByTestId('timeline-playhead');
  const start = (await playhead.boundingBox())!.x;
  const seek = page.getByRole('slider', {name: 'Tua xem trước'});
  for (let i = 0; i < 12; i++) await seek.press('ArrowRight');
  await expect.poll(async () => (await playhead.boundingBox())!.x).toBeGreaterThan(start + 1);
  await ask.click();
  const input = chat.getByRole('textbox');
  await expect(input).toHaveValue(/^\[cảnh \S+ · \d+:\d{2}\.\d · khung \d+\] $/);
  if (await input.isEnabled()) await expect(input).toBeFocused(); // disabled while another chat session is busy
  await divider.press('End');
  const middle = scenes.nth(2);
  await middle.click();
  await expect(middle).toHaveAttribute('aria-current', 'true');
  await expect.poll(async () => {
    const clip = (await middle.boundingBox())!, track = (await strip.boundingBox())!;
    return Math.abs(clip.x + clip.width / 2 - track.x - track.width / 2);
  }).toBeLessThan(2);
  const scroll = () => strip.evaluate((el) => ({left: el.scrollLeft, max: el.scrollWidth - el.clientWidth}));
  await seek.press('Home');
  await expect.poll(async () => (await scroll()).left).toBe(0);
  await seek.press('End');
  await expect.poll(async () => {
    const {left, max} = await scroll();
    return Math.abs(max - left);
  }).toBeLessThan(2);
  await player.screenshot({path: 'test-results/watch-player.png'});
});

test('landscape preview fits while widening chat', async ({page}) => {
  const size = {width: 1920, height: 1080};
  await page.route(`**/api/projects/${slug}`, async (route) => {
    const response = await route.fetch();
    const detail: ProjectDetail = await response.json();
    await route.fulfill({response, json: {
      ...detail, size, renderProps: detail.renderProps && {...detail.renderProps, ...size},
    }});
  });
  await page.route(`**/api/projects/${slug}/preview`, async (route) => {
    const response = await route.fetch();
    const preview: PreviewResult = await response.json();
    await route.fulfill({response, json: {...preview, renderProps: preview.renderProps && {...preview.renderProps, ...size}}});
  });
  await page.goto(`/p/${slug}`);
  const player = page.getByRole('region', {name: 'Xem trước'});
  const frame = page.getByTestId('preview-frame');
  const chat = page.getByLabel('Chat', {exact: true});
  await expect(frame).toBeVisible();
  expect((await player.boundingBox())!.width).toBeGreaterThan((await chat.boundingBox())!.width);
  const before = (await frame.boundingBox())!;
  await page.getByRole('separator', {name: 'Đổi độ rộng chat'}).press('End');
  const after = (await frame.boundingBox())!;
  expect(after.width).toBeLessThan(before.width);
  expect(after.width / after.height).toBeCloseTo(16 / 9, 2);
  const preview = (await player.boundingBox())!;
  expect(after.x).toBeGreaterThan(preview.x);
  expect(after.x + after.width).toBeLessThan(preview.x + preview.width);
});

test('voice job then render', async ({page}) => {
  await page.goto(`/p/${slug}`);
  const staleBanner = page.getByText(/\d+ cảnh chưa tạo giọng/);
  await expect(staleBanner).toBeVisible({timeout: 30_000});
  await page.getByRole('button', {name: 'Tạo giọng', exact: true}).first().click();
  await waitJob('voice', 120_000);
  // the Editor must re-run the preview by itself when the voice job ends (no edit in between)
  await expect(staleBanner).toBeHidden({timeout: 30_000});
  await page.getByRole('button', {name: 'Render', exact: true}).click();
  await waitJob('render', 240_000);
  await page.goto(`/p/${slug}/renders`);
  await expect(page.getByRole('heading', {name: 'reel-v1'})).toBeVisible();
});

test('library upload appears after ingest', async ({page}) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'e2e-'));
  const file = path.join(dir, `${jpgStem}.jpg`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=320x240', '-frames:v', '1', file]);
  try {
    await page.goto('/library');
    await page.locator('input[type=file]').first().setInputFiles(file);
    await page.getByRole('radio', {name: 'Tất cả'}).last().click(); // orientation filter defaults to portrait
    await page.getByLabel('Tìm media').fill(jpgStem);
    await expect(page.getByRole('button', {name: new RegExp(jpgStem)})).toBeVisible({timeout: 60_000});
  } finally { rmSync(dir, {recursive: true, force: true}); }
});

test('light theme toggle', async ({page}) => {
  await page.goto('/settings');
  await page.getByRole('radio', {name: 'Sáng'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.goto(`/p/${slug}`);
  await expect(page.getByRole('region', {name: 'Xem trước'})).toHaveCSS('color-scheme', 'light');
});
