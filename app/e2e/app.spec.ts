import {execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {expect, test} from '@playwright/test';

const API = 'http://127.0.0.1:5316/api';
const ROOT = path.resolve(import.meta.dirname, '../..');
const slug = `e2e-${Date.now()}`;
const jpgStem = `e2e-pic-${Date.now()}`;
const CAPTION = 'Xin chào từ E2E';

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
  const storyboard = JSON.parse(readFileSync(path.join(ROOT, 'projects/_smoke/storyboard.json'), 'utf8'));
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

test('edit caption: autosave pill and player', async ({page}) => {
  await page.goto(`/p/${slug}`);
  await page.getByRole('button', {name: /s1/}).first().click();
  const caption = page.getByLabel('Caption (hiển thị trên màn hình)');
  await caption.fill(CAPTION);
  await expect(page.getByRole('status').filter({hasText: 'Đã lưu'})).toBeVisible();
  // the pill also reads "Đã lưu" when idle, so confirm the caption really reached storyboard.json
  await expect.poll(async () => (await (await fetch(`${API}/projects/${slug}`)).json()).storyboard.data.scenes[0].caption, {timeout: 10_000}).toBe(CAPTION);
  const player = page.getByRole('region', {name: 'Xem trước'});
  await expect(player.getByText(CAPTION).first()).toBeVisible({timeout: 30_000});
  await player.screenshot({path: 'test-results/player-caption.png'});
});

test('voice job then draft render', async ({page}) => {
  await page.goto(`/p/${slug}`);
  const staleBanner = page.getByText(/chưa có giọng — đang dùng độ dài ước tính/);
  await expect(staleBanner).toBeVisible({timeout: 30_000});
  await page.getByRole('button', {name: 'Tạo giọng', exact: true}).first().click();
  await waitJob('voice', 120_000);
  // the Editor must re-run the preview by itself when the voice job ends (no edit in between)
  await expect(staleBanner).toBeHidden({timeout: 30_000});
  await page.getByRole('button', {name: 'Render nháp'}).click();
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
});
