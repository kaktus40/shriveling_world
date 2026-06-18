/* Phase C scaffolding: double-buffer manager and worker protocol.

   This file contains lightweight scaffolding to start implementing Phase C
   (double-buffering and workerization). The functions are intentionally
   minimal and feature-flag friendly so they can be integrated incrementally.
*/

export type BufferSet<T> = {
	front: T;
	back: T;
};

export function createDoubleBufferManager<T>(allocate: () => T): BufferSet<T> {
	const a = allocate();
	const b = allocate();
	return { front: a, back: b };
}

export function swapBuffers<T>(set: BufferSet<T>): void {
	const tmp = set.front;
	set.front = set.back;
	set.back = tmp;
}

// Per-device/context double-buffer registries and helpers
const __gpuDoubleBuffers: WeakMap<GPUDevice, Map<string, BufferSet<GPUBuffer>>> = new WeakMap();
const __glDoubleBuffers: WeakMap<WebGL2RenderingContext, Map<string, BufferSet<WebGLBuffer>>> = new WeakMap();

export function getOrCreateGpuDoubleBuffer(device: GPUDevice, key: string, size: number, usage: number): BufferSet<GPUBuffer> {
	let map = __gpuDoubleBuffers.get(device);
	if (!map) {
		map = new Map();
		__gpuDoubleBuffers.set(device, map);
	}
	let set = map.get(key);
	if (set) return set;
	const a = device.createBuffer({ size, usage });
	const b = device.createBuffer({ size, usage });
	set = { front: a, back: b };
	map.set(key, set);
	return set;
}

export function swapGpuDoubleBuffer(device: GPUDevice, key: string): void {
	const map = __gpuDoubleBuffers.get(device);
	const set = map?.get(key);
	if (set) swapBuffers(set);
}

export function getOrCreateGlDoubleBuffer(gl: WebGL2RenderingContext, key: string, target: number, size: number, usage: number): BufferSet<WebGLBuffer> {
	let map = __glDoubleBuffers.get(gl);
	if (!map) {
		map = new Map();
		__glDoubleBuffers.set(gl, map);
	}
	let set = map.get(key);
	if (set) return set;
	const a = gl.createBuffer();
	const b = gl.createBuffer();
	// Do not initialize buffer sizes here; caller will bind and allocate as needed
	set = { front: a!, back: b! };
	map.set(key, set);
	return set;
}


export function swapGlDoubleBuffer(gl: WebGL2RenderingContext, key: string): void {
	const map = __glDoubleBuffers.get(gl);
	const set = map?.get(key);
	if (set) swapBuffers(set);
}

// Worker message protocol (minimal)
export type WorkerRequest = {
	id: string;
	type: 'compute' | 'parse' | 'ping';
	payload?: unknown;
};

export type WorkerResponse = {
	id: string;
	ok: boolean;
	type: 'result' | 'error' | 'pong';
	payload?: unknown;
};

// Helper for main-thread code to build worker and handle simple RPC-style messages.
// Tries to instantiate a module Worker (using provided scriptUrl or resolving the
// default src/workers/compute-worker.ts). Falls back to the in-process worker when
// Worker is unavailable or instantiation fails.
export function createComputeWorker(scriptUrl?: string) {
	// resolve default worker path relative to this file when none provided
	let resolved: string | undefined = scriptUrl;
	if (!resolved) {
		try {
			resolved = new URL('../../../workers/compute-worker.ts', import.meta.url).href;
		} catch (e) {
			resolved = undefined;
		}
	}

	const WorkerCtor = (globalThis as any).Worker;
	if (WorkerCtor && resolved) {
		try {
			const worker = new WorkerCtor(resolved, { type: 'module' });
			const pending = new Map<string, (res: WorkerResponse) => void>();
			worker.onmessage = (ev: MessageEvent) => {
				const msg = ev.data as WorkerResponse;
				const cb = pending.get(msg.id);
				if (cb) {
					cb(msg);
					pending.delete(msg.id);
				}
			};
			return {
				post(req: WorkerRequest) {
					return new Promise<WorkerResponse>((resolve) => {
						pending.set(req.id, resolve);
						// collect transferables recursively from payload
						try {
							const transferList: Transferable[] = [];
							const seen = new WeakSet();
							function collect(v: any) {
								if (!v || typeof v !== 'object') return;
								if (seen.has(v)) return;
								seen.add(v);
								if (v instanceof ArrayBuffer) {
									transferList.push(v);
									return;
								}
								if (ArrayBuffer.isView(v)) {
									transferList.push(v.buffer);
									return;
								}
								if (Array.isArray(v)) {
									for (const e of v) collect(e);
									return;
								}
								for (const key of Object.keys(v)) collect(v[key]);
							}
							if (req.payload) collect(req.payload);
							if (transferList.length > 0) {
								worker.postMessage(req, transferList);
							} else {
								worker.postMessage(req);
							}
						} catch (postErr) {
							// fallback to regular post
							try { worker.postMessage(req); } catch (e) { /* ignore */ }
						}
					});
				},
				terminate() {
					worker.terminate();
				},
			};
		} catch (e) {
			// fall through to in-process worker
		}
	}
	// fallback
		return createInprocessWorker();
	}// Lightweight in-process worker fallback that executes compute tasks synchronously
// but with a Promise API. Useful for Node test environments or browsers lacking
// worker support during the initial integration steps.
import {
	inspectDatasetFiles,
	resolveDatasetManifest,
	prepareDataset,
} from '../../domain/data';
import {
	computeStaticTownPrecomputeCpu,
	computeDynamicTownPrecomputeForYearCpu,
	computeRawConePrecomputeCpu,
	computeFinalConePrecomputeCpu,
	computeFinalCurveVertexBufferCpu,
} from '../../domain/precompute';
import { runCpuConeIntersectionStage } from '../cpu/cone';

export function createInprocessWorker() {
	return {
		async post(req: WorkerRequest): Promise<WorkerResponse> {
			try {
				if (req.type === 'ping') {
					return { id: req.id, ok: true, type: 'pong' };
				}
				if (req.type === 'parse') {
					const files = req.payload as { name: string; text: string }[];
					const inspected = inspectDatasetFiles(files);
					const manifest = resolveDatasetManifest(inspected);
					const prepared = prepareDataset({ files: files as any, manifest } as any);
					return { id: req.id, ok: true, type: 'result', payload: { inspected, manifest, prepared } };
				}
				if (req.type === 'compute') {
					const payload = req.payload as any;
					switch (payload.action) {
						case 'staticTown': {
							const { staticTownInput, staticTownOptions } = payload;
							const val = computeStaticTownPrecomputeCpu(staticTownInput, staticTownOptions);
							return { id: req.id, ok: true, type: 'result', payload: val };
						}
						case 'dynamicTown': {
							const { preparedDataset, staticTown, year } = payload;
							const val = computeDynamicTownPrecomputeForYearCpu(preparedDataset, staticTown, year);
							return { id: req.id, ok: true, type: 'result', payload: val };
						}
						case 'rawCones': {
							const { staticTown, dynamicTown, options } = payload;
							const val = computeRawConePrecomputeCpu(staticTown, dynamicTown, options);
							return { id: req.id, ok: true, type: 'result', payload: val };
						}
						case 'coneIntersections': {
							const { staticTown, rawCones, dynamicTown, strategy, options } = payload;
							const val = runCpuConeIntersectionStage(staticTown, rawCones, dynamicTown, strategy, options);
							return { id: req.id, ok: true, type: 'result', payload: val };
						}
						case 'finalCones': {
							const { coneIntersections, boundaryRaycast, projection } = payload;
							const val = computeFinalConePrecomputeCpu(coneIntersections, boundaryRaycast, projection?.settings ? projection : undefined, payload.earthRadiusMeters);
							return { id: req.id, ok: true, type: 'result', payload: val };
						}
						case 'finalCurves': {
							const { curvePrecompute, options, projection } = payload;
							const val = computeFinalCurveVertexBufferCpu(curvePrecompute, options, projection);
							return { id: req.id, ok: true, type: 'result', payload: val };
						}
						default:
							return { id: req.id, ok: false, type: 'error', payload: 'unknown compute action' };
					}
				}
				return { id: req.id, ok: false, type: 'error', payload: 'unhandled request type' };
			} catch (e: any) {
				return { id: req.id, ok: false, type: 'error', payload: String(e && e.message ? e.message : e) };
			}
		},
	};
}
