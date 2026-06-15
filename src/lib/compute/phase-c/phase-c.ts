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
export function createComputeWorker(scriptUrl: string) {
	const worker = new Worker(scriptUrl, { type: 'module' });
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
				worker.postMessage(req);
			});
		},
		terminate() {
			worker.terminate();
		},
	};
}

// Lightweight in-process worker fallback that executes compute tasks synchronously
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
