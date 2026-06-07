import { expect, test } from '@playwright/test';

test('the home page loads the SvelteKit shell', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { level: 1, name: 'Shriveling world' })).toBeVisible();
	await expect(page.getByText('SvelteKit route is active.')).toBeVisible();
	await expect(page.getByText('WGSL source import works through Vite ?raw.')).toBeVisible();
});
