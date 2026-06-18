import type { ComputeSession } from '$lib/compute';

/** Warms a long-lived compute session without tying it to a specific viewport implementation. */
export async function primeComputeRuntime(session: ComputeSession): Promise<void> {
	try {
		console.debug('primeComputeRuntime: warming compute session');
		await session.warm();
		console.debug('primeComputeRuntime: compute session warmed');
	} catch (error) {
		console.warn('Compute runtime warm-up failed:', error);
	}
}
