import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	cacheDir: '/tmp/shriveling_world_vite-cache',
	plugins: [sveltekit()],
	test: {
		environment: 'node',
		include: ['tests/**/*.test.ts']
	}
});
