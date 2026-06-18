// Module compute worker (TypeScript)
// Implements compute handlers by delegating to existing CPU compute functions.

import { inspectDatasetFiles, resolveDatasetManifest, prepareDataset } from '../domain/data';
import {
	computeStaticTownPrecomputeCpu,
	computeDynamicTownPrecomputeForYearCpu,
	computeRawConePrecomputeCpu,
	computeFinalConePrecomputeCpu,
	computeFinalCurveVertexBufferCpu,
} from '../domain/precompute';
import { runCpuConeIntersectionStage } from '../lib/compute/cpu/cone';

type WorkerRequest = {
	id: string | null;
	type: 'compute' | 'parse' | 'ping';
	payload?: unknown;
};

type WorkerResponse = {
	id: string | null;
	ok: boolean;
	type: 'result' | 'error' | 'pong';
	payload?: unknown;
};

self.addEventListener('message', async (ev: MessageEvent<WorkerRequest>) => {
	const msg = ev.data;
	const id = msg?.id ?? null;
	try {
		if (!msg || !msg.type) {
			(self as any).postMessage({ id, ok: false, type: 'error', payload: 'malformed message' });
			return;
		}

		if (msg.type === 'ping') {
			(self as any).postMessage({ id, ok: true, type: 'pong' });
			return;
		}

		if (msg.type === 'parse') {
			const files = msg.payload as { name: string; text: string }[];
			try {
				const inspected = inspectDatasetFiles(files);
				const manifest = resolveDatasetManifest(inspected);
				const prepared = prepareDataset({ files: files as any, manifest } as any);
				(self as any).postMessage({ id, ok: true, type: 'result', payload: { inspected, manifest, prepared } });
			} catch (e: any) {
				(self as any).postMessage({ id, ok: false, type: 'error', payload: String(e && e.message ? e.message : e) });
			}
			return;
		}

		if (msg.type === 'compute') {
			const payload = msg.payload as any;
			switch (payload.action) {
				case 'staticTown': {
					const val = computeStaticTownPrecomputeCpu(payload.staticTownInput, payload.staticTownOptions);
					(self as any).postMessage({ id, ok: true, type: 'result', payload: val }, []);
					return;
				}
				case 'dynamicTown': {
					const val = computeDynamicTownPrecomputeForYearCpu(payload.preparedDataset, payload.staticTown, payload.year);
					(self as any).postMessage({ id, ok: true, type: 'result', payload: val }, []);
					return;
				}
				case 'rawCones': {
					const val = computeRawConePrecomputeCpu(payload.staticTown, payload.dynamicTown, payload.options);
					(self as any).postMessage({ id, ok: true, type: 'result', payload: val }, []);
					return;
				}
				case 'coneIntersections': {
					const val = runCpuConeIntersectionStage(payload.staticTown, payload.rawCones, payload.dynamicTown, payload.strategy, payload.options);
					(self as any).postMessage({ id, ok: true, type: 'result', payload: val }, []);
					return;
				}
				case 'finalCones': {
					const val = computeFinalConePrecomputeCpu(payload.coneIntersections, payload.boundaryRaycast, payload.projection?.settings ? payload.projection : undefined, payload.earthRadiusMeters);
					(self as any).postMessage({ id, ok: true, type: 'result', payload: val }, []);
					return;
				}
				case 'finalCurves': {
					const val = computeFinalCurveVertexBufferCpu(payload.curvePrecompute, payload.options, payload.projection);
					(self as any).postMessage({ id, ok: true, type: 'result', payload: val }, []);
					return;
				}
				default: {
					(self as any).postMessage({ id, ok: false, type: 'error', payload: 'unknown compute action' });
					return;
				}
			}
		}

		(self as any).postMessage({ id, ok: false, type: 'error', payload: 'unhandled request type' });
	} catch (e: any) {
		(self as any).postMessage({ id, ok: false, type: 'error', payload: String(e && e.message ? e.message : e) });
	}
});
