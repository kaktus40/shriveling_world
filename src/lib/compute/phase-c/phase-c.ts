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
