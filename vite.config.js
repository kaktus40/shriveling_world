import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

import path from 'path';

export default defineConfig({
	cacheDir: '/tmp/shriveling_world_vite-cache',
	plugins: [sveltekit()],
	build: {
		rollupOptions: {
			input: {
				'compute-worker': path.resolve(__dirname, 'src/workers/compute-worker.ts')
			},
			output: {
				// ensure worker entry points can be referenced by URL in the app
				assetFileNames: (assetInfo) => assetInfo.name || '[name]'
			}
		}
	},
	test: {
		environment: 'node',
		include: ['tests/**/*.test.ts']
	}
});
