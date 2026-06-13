import { expect, test } from '@playwright/test';

test('the home page exposes the operational and workspace routes', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { level: 1, name: 'Shriveling world' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Open application viewport' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Open dataset workspace' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Open validation bench' })).toBeVisible();
});
