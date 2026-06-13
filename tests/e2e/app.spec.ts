import { expect, test } from '@playwright/test';
import { expectNoPageIssues, openRoute, trackPageIssues } from './support';

const reducedDataset = '19 reduced';

test('the app starts inert and loads a reduced dataset on demand', async ({ page }) => {
	const issues = trackPageIssues(page);

	await openRoute(page, '/app');

	await expect(page.getByRole('note')).toContainText('No dataset loaded');
	await expect(page.getByRole('group', { name: 'Year control' })).toBeVisible();
	await expect(page.getByRole('group', { name: 'Projection control' })).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Application modules' })).toBeVisible();

	const sceneDockButton = page.getByRole('button', {
		name: 'Dataset, camera, and labels',
	});
	await sceneDockButton.hover();
	await expect(sceneDockButton.locator('.module-label')).toBeVisible();
	await expect(sceneDockButton).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByRole('group', { name: 'Application controls' })).toBeVisible();

	await page.waitForFunction(() => Boolean((window as Window & { __appE2e?: unknown }).__appE2e));
	await page.evaluate(async (dataset) => {
		await (window as Window & {
			__appE2e?: {
				setDataset: (next: string) => Promise<void>;
			};
		}).__appE2e?.setDataset(dataset as string);
	}, reducedDataset);

	await expect(page.getByText(/cities loaded/)).toBeVisible({ timeout: 20_000 });
	await expect(page.getByText(/final cone layer\(s\)/i)).toBeVisible({ timeout: 20_000 });
	await expect(page.getByText('Curve layer ready')).toBeVisible({ timeout: 20_000 });

	const yearRail = page.getByRole('group', { name: 'Year control' });
	const projectionRail = page.getByRole('group', { name: 'Projection control' });
	const yearSlider = yearRail.getByRole('slider');
	const projectionSlider = projectionRail.getByRole('slider');

	await expect(yearSlider).toBeVisible();
	await expect(projectionSlider).toBeVisible();
	await expect(yearSlider).toBeEnabled();
	await expect(projectionSlider).toBeEnabled();
	await expect(yearRail.getByRole('slider')).toHaveCount(1);
	await expect(projectionRail.getByRole('slider')).toHaveCount(1);

	const yearBox = await yearSlider.boundingBox();
	const projectionBox = await projectionSlider.boundingBox();
	expect(yearBox).not.toBeNull();
	expect(projectionBox).not.toBeNull();
	if (yearBox && projectionBox) {
		expect(yearBox.x + yearBox.width).toBeLessThan(projectionBox.x);
	}

	await projectionRail.getByLabel('Start').selectOption('Mercator');
	await projectionRail.getByLabel('End').selectOption('Winkel');
	await expect(projectionRail.getByLabel('Start')).toHaveValue('Mercator');
	await expect(projectionRail.getByLabel('End')).toHaveValue('Winkel');

	await page.getByRole('button', { name: 'Query builder and matching cities' }).click();
	await expect(page.getByRole('group', { name: 'Query controls' })).toBeVisible();

	await page.getByRole('button', { name: 'Angle and measurement tools' }).click();
	await expect(page.getByRole('group', { name: 'Measurement tools' })).toBeVisible();

	await expectNoPageIssues(issues);
});
