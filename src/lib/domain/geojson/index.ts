/**
 * GeoJSON boundary-domain entrypoint.
 *
 * This module prepares country meshes and city-to-country associations from
 * GeoJSON without depending on SvelteKit, Babylon.js, WebGL, WebGPU, or DOM
 * APIs. GPU boundary sampling will be layered on top of these structures later.
 */
export * from './types';
export * from './geometry';
export * from './precompute';

