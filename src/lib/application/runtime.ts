import type { ComputeSession } from '$lib/compute';

/** Warms a long-lived compute session without tying it to a specific viewport implementation. */
export async function primeComputeRuntime(session: ComputeSession): Promise<void> {
	try {
		await session.warm();
	} catch (error) {
		console.warn('Compute runtime warm-up failed:', error);
	}
}
