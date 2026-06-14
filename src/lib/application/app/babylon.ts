/** Canvas-like target used to probe Babylon WebGL support without touching the render surface. */
export type BabylonProbeCanvasLike = HTMLCanvasElement | OffscreenCanvas;

/** Creates a throwaway probe canvas when the runtime can allocate one. */
export function createBabylonProbeCanvas(): BabylonProbeCanvasLike | null {
	if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
		return document.createElement('canvas');
	}
	if (typeof OffscreenCanvas !== 'undefined') {
		return new OffscreenCanvas(1, 1);
	}
	return null;
}

/** Probes whether Babylon can open a WebGL or WebGL2 context without consuming the render canvas. */
export function probeBabylonContext(canvas?: BabylonProbeCanvasLike | null): boolean {
	const probeCanvas = canvas ?? createBabylonProbeCanvas();
	if (!probeCanvas) {
		return false;
	}
	const contextOptions = {
		antialias: true,
		preserveDrawingBuffer: true,
		stencil: true,
		powerPreference: 'high-performance' as WebGLPowerPreference,
	};
	return (
		probeCanvas.getContext('webgl2', contextOptions) !== null ||
		probeCanvas.getContext('webgl', contextOptions) !== null
	);
}
