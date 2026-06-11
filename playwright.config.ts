import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const port = 4173;
const baseURL = `http://127.0.0.1:${port}`;
const systemChromiumExecutablePath = ['/usr/bin/chromium', '/usr/bin/chromium-browser'].find((path) =>
	existsSync(path),
);

export default defineConfig({
	testDir: './tests/e2e',
	outputDir: '/tmp/shriveling_world_playwright-results',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	reporter: 'list',
	use: {
		baseURL,
		trace: 'on-first-retry'
	},
	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				...(systemChromiumExecutablePath
					? {
							launchOptions: {
								executablePath: systemChromiumExecutablePath,
								args: ['--no-sandbox']
							}
						}
					: {})
			}
		}
	],
	webServer: {
		command: `node ./node_modules/vite/bin/vite.js dev --host 127.0.0.1 --port ${port} --configLoader runner`,
		url: baseURL,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000
	}
});
