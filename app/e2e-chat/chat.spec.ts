import {expect, test} from '@playwright/test';

test('chat with the fake claude CLI', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button', {name: 'Chat với Claude'}).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const box = page.getByLabel('Tin nhắn cho Claude');
  const send = async (t: string) => { await box.fill(t); await box.press('Enter'); };

  await send('Xin chào');
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
