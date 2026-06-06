/**
 * Static and dynamic compute-domain entrypoint.
 *
 * This domain defines compact CPU/GPU-compatible buffer contracts without
 * depending on SvelteKit, Babylon.js, WebGPU, or DOM APIs.
 */
export * from './types';
export * from './static-town-cpu';
export * from './overlap-cpu';
export * from './curve-cpu';
export * from './backend';
export * from './benchmark';
export * from './views';
