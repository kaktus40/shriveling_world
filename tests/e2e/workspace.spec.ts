import { expect, test } from '@playwright/test';
import { expectNoPageIssues, openRoute, trackPageIssues } from './support';

const reducedDataset = '19 reduced';
const computeProfiles = ['cpu', 'webgl2', 'webgpu'] as const;

for (const profile of computeProfiles) {
	test(`workspace loads the reduced dataset on the ${profile} profile`, async ({ page }) => {
		const issues = trackPageIssues(page);

		await openRoute(page, '/workspace');
		await expect(page.getByText('No dataset loaded', { exact: true })).toBeVisible();
		await page.waitForFunction(() => Boolean((window as Window & { __workspaceE2e?: unknown }).__workspaceE2e));

		await page.evaluate(async (dataset) => {
			await (window as Window & {
				__workspaceE2e?: {
					setDataset: (next: string) => Promise<void>;
				};
			}).__workspaceE2e?.setDataset(dataset as string);
		}, reducedDataset);

		await expect(page.getByRole('heading', { name: 'Dataset workspace' })).toBeVisible({ timeout: 20_000 });
		await expect(page.getByText('Benchmark: ready')).toBeVisible({ timeout: 20_000 });
		await expect(page.getByText('Requested: CPU')).toBeVisible({ timeout: 20_000 });

		await page.evaluate(async (computeProfile) => {
			await (window as Window & {
				__workspaceE2e?: {
					setComputeProfile: (next: string) => Promise<void>;
				};
			}).__workspaceE2e?.setComputeProfile(computeProfile as string);
		}, profile);
		await expect(page.getByText(`Requested: ${profile.toUpperCase()}`)).toBeVisible({ timeout: 20_000 });
		await expect(page.getByText('Benchmark: ready')).toBeVisible({ timeout: 20_000 });
		await expect(page.getByRole('heading', { name: 'Compute benchmark' })).toBeVisible({ timeout: 20_000 });
		await expect(page.getByRole('table').first()).toBeVisible({ timeout: 20_000 });

		await page.evaluate(async (strategy) => {
			await (window as Window & {
				__workspaceE2e?: {
					setConeIntersectionStrategy: (next: string) => Promise<void>;
				};
			}).__workspaceE2e?.setConeIntersectionStrategy(strategy as string);
		}, 'alpha-aware-block-pruned');
		await expect(page.getByLabel('Cone strategy')).toHaveValue('alpha-aware-block-pruned');

		await expectNoPageIssues(issues);
	});
}
