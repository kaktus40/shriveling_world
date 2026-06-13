import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const port = 4173;
const baseURL = `http://127.0.0.1:${port}`;
const braveExecutablePath = ['/usr/bin/brave', '/usr/bin/brave-browser'].find((path) => existsSync(path));
const firefoxExecutablePath = ['/usr/bin/firefox'].find((path) => existsSync(path));

export default defineConfig({
	testDir: './tests/e2e',
	outputDir: '/tmp/shriveling_world_playwright-results',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : 1,
	reporter: 'list',
	use: {
		baseURL,
		trace: 'on-first-retry'
	},
	projects: [
		{
			name: 'brave',
			use: {
				...devices['Desktop Chrome'],
				...(braveExecutablePath
					? {
							launchOptions: {
								executablePath: braveExecutablePath,
								args: [
									'--no-sandbox',
									'--enable-webgl',
									'--ignore-gpu-blocklist',
									'--use-angle=swiftshader',
									'--enable-unsafe-webgpu'
								]
							}
						}
					: {})
			}
		},
		{
			name: 'firefox',
			use: {
				...devices['Desktop Firefox'],
				...(firefoxExecutablePath
					? {
							launchOptions: {
								executablePath: firefoxExecutablePath
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
