import {expect, test} from '@playwright/test';

test('chat with the fake claude CLI', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button', {name: 'Chat với Claude'}).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const box = page.getByLabel('Tin nhắn cho Claude');
  const send = async (t: string) => { await box.fill(t); await box.press('Enter'); };

  const sendButton = dialog.getByRole('button', {name: 'Gửi tin nhắn'});
  await expect(sendButton).toBeDisabled();
  await box.fill('Xin chào');
  await sendButton.click();
  await expect(dialog.getByText('acc=default mode=new sys=yes prompt=Xin chào')).toBeVisible();
  await expect(dialog.getByText('Bash: ls projects')).toBeVisible();

  await expect(box).toBeEnabled();
  await send('lần hai');
  await expect(dialog.getByText('acc=default mode=resume sys=yes prompt=lần hai')).toBeVisible();

  await expect(box).toBeEnabled();
  await send('LIMIT');
  await expect(dialog.getByText(/claude hết limit \(reset/)).toBeVisible();
  await expect(dialog.getByText(/Chọn tài khoản khác/)).toBeVisible();

  await expect(box).toBeEnabled();
  await dialog.getByRole('combobox', {name: 'Tài khoản Claude'}).click();
  await page.getByRole('option', {name: 'claude2'}).click();
  await send('tiếp');
  await expect(dialog.getByText('acc=.claude-acc2 mode=resume sys=yes prompt=tiếp')).toBeVisible();

  await expect(box).toBeEnabled();
  await send('SLOW');
  await dialog.getByRole('button', {name: 'Dừng'}).click();
  await expect(dialog.getByText('Đã dừng')).toBeVisible();
  await expect(box).toBeEnabled();

  await page.reload();
  await page.getByRole('button', {name: 'Chat với Claude'}).first().click();
  await expect(page.getByRole('dialog').getByText('prompt=Xin chào')).toBeVisible();
});

test('codex chat with the fake codex CLI', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button', {name: 'Chat với Claude'}).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', {name: 'Phiên mới'}).click();
  await page.getByRole('menuitem', {name: 'Phiên Codex'}).click();
  const box = page.getByLabel('Tin nhắn cho Codex');
  await expect(box).toBeVisible();
  await box.fill('xin chào codex'); await box.press('Enter');
  const first = dialog.getByText(/engine=codex mode=new thread=[0-9a-f-]{36} dev=yes prompt=xin chào codex/);
  await expect(first).toBeVisible();
  await expect(dialog.getByText('Bash: ls projects')).toBeVisible();
  const thread = /thread=([0-9a-f-]{36})/.exec(await first.innerText())![1];
  await expect(box).toBeEnabled();
  await box.fill('lần hai'); await box.press('Enter');
  await expect(dialog.getByText(`engine=codex mode=resume thread=${thread} dev=yes prompt=lần hai`)).toBeVisible();
});

test('image attachment and copy', async ({page, context}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await page.getByRole('button', {name: 'Chat với Claude'}).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', {name: 'Phiên mới'}).click(); // earlier tests leave a codex chat as the newest
  await page.getByRole('menuitem', {name: 'Phiên Claude'}).click();
  const box = page.getByLabel('Tin nhắn cho Claude');

  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  await page.locator('input[type=file]').setInputFiles({name: 'shot.png', mimeType: 'image/png', buffer: PNG});
  await expect(dialog.getByRole('button', {name: 'Bỏ ảnh'})).toBeVisible();
  await box.fill('xem ảnh này');
  await box.press('Enter');
  // the fake echoes the prompt as markdown, so the text and the attachment list are separate elements
  await expect(dialog.getByText(/prompt=xem ảnh này/)).toBeVisible();
  await expect(dialog.getByText('Attached images (open each file to look at it):')).toBeVisible();
  await expect(dialog.getByText(/images\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.png/)).toBeVisible();

  const thumb = dialog.getByRole('img', {name: 'Ảnh đính kèm'});
  await expect(thumb).toBeVisible();
  expect(await thumb.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);

  await dialog.getByRole('button', {name: 'Sao chép'}).first().click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('xem ảnh này');
});
