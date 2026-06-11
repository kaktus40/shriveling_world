import { executeQueryWorkerRequest } from './worker';
import type { QueryExecutionResult, QueryWorkerRequest } from './types';

/** Query worker client contract exposed to the workspace UI. */
export interface QueryWorkerClient {
	execute(request: QueryWorkerRequest): Promise<QueryExecutionResult>;
	terminate(): void;
}

/**
 * Creates a browser-side query worker client.
 *
 * The implementation uses the dedicated worker when available and falls back
 * to the pure executor in non-worker environments.
 *
 * @returns A client capable of executing query requests asynchronously.
 */
export function createQueryWorkerClient(): QueryWorkerClient {
	if (typeof Worker === 'undefined') {
		return {
			async execute(request: QueryWorkerRequest): Promise<QueryExecutionResult> {
				return executeQueryWorkerRequest(request);
			},
			terminate(): void {
				// No worker was created.
			},
		};
	}

	const worker = new Worker(new URL('../../workers/city-query.worker.ts', import.meta.url), {
		type: 'module',
	});
	let nextRequestId = 1;
	const pendingRequests = new Map<
		number,
		{
			resolve: (result: QueryExecutionResult) => void;
			reject: (reason: unknown) => void;
		}
	>();

	worker.onmessage = (event: MessageEvent<{ requestId: number; result: QueryExecutionResult }>) => {
		const pending = pendingRequests.get(event.data.requestId);
		if (!pending) {
			return;
		}
		pendingRequests.delete(event.data.requestId);
		pending.resolve(event.data.result);
	};

	worker.onerror = (event) => {
		const error = event.error ?? new Error(event.message);
		pendingRequests.forEach(({ reject }) => reject(error));
		pendingRequests.clear();
	};

	return {
		execute(request: QueryWorkerRequest): Promise<QueryExecutionResult> {
			const requestId = nextRequestId++;
			return new Promise<QueryExecutionResult>((resolve, reject) => {
				pendingRequests.set(requestId, { resolve, reject });
				worker.postMessage({ requestId, request });
			});
		},
		terminate(): void {
			worker.terminate();
			pendingRequests.clear();
		},
	};
}
