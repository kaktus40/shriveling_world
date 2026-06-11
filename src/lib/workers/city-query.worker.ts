/// <reference lib="webworker" />

import { executeQueryWorkerRequest, type QueryWorkerRequest } from '$lib/application/query';

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (event: MessageEvent<QueryWorkerRequest>) => {
	self.postMessage(executeQueryWorkerRequest(event.data));
};

export {};
