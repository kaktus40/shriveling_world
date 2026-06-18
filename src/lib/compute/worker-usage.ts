// Example helper: create a Worker using the built worker bundle URL.
// In production the bundler (Vite) will emit a URL for the worker module,
// so using new URL('./workers/compute-worker.ts', import.meta.url) is a robust pattern.

export function createBundledComputeWorker() {
	try {
		// Resolve relative to this module; adjust path if you move files
		const url = new URL('../../../workers/compute-worker.ts', import.meta.url);
		return new Worker(url.href, { type: 'module' });
	} catch (e) {
		throw new Error('Unable to construct worker URL: ' + String(e));
	}
}
