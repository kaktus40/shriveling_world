/// <reference lib="webworker" />

import { executeQueryWorkerRequest, type QueryWorkerRequest } from '$lib/application/query';

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (event: MessageEvent<{ requestId: number; request: QueryWorkerRequest }>) => {
	self.postMessage({
		requestId: event.data.requestId,
		result: executeQueryWorkerRequest(event.data.request),
	});
};

export {};
