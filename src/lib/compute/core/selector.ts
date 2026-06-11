import type {
	ComputeCapabilities,
	ComputeProfile,
	ComputeProfileRequest,
	ComputeProfileSelection,
	ComputeWorkflowBackendRegistry,
} from './types';

const PROFILE_FALLBACKS: Record<ComputeProfile, readonly ComputeProfile[]> = {
	webgpu: ['webgpu', 'webgl2', 'cpu'],
	webgl2: ['webgl2', 'cpu'],
	cpu: ['cpu'],
};

/** Returns the fallback chain associated with one requested profile. */
export function getComputeFallbackChain(preferredProfile: ComputeProfile = 'webgpu'): readonly ComputeProfile[] {
	return PROFILE_FALLBACKS[preferredProfile];
}

/** Detects the availability snapshot of a registry without creating a backend. */
export async function detectComputeCapabilities(
	registry: ComputeWorkflowBackendRegistry,
): Promise<ComputeCapabilities> {
	const [webgpuAvailable, webgl2Available] = await Promise.all([
		probeAvailability(registry.webgpu),
		probeAvailability(registry.webgl2),
	]);

	return {
		webgpuAvailable,
		webgl2Available,
		cpuAvailable: true,
		notes: buildAvailabilityNotes(webgpuAvailable, webgl2Available),
	};
}

/** Selects the first backend available in the requested fallback chain. */
export async function selectComputeProfile(
	request: ComputeProfileRequest,
	registry: ComputeWorkflowBackendRegistry,
): Promise<ComputeProfileSelection> {
	const requestedProfile = request.forced ?? request.preferred ?? 'webgpu';
	const chain = getComputeFallbackChain(requestedProfile);
	const capabilities = await detectComputeCapabilities(registry);
	const availability = await probeRegistry(registry);
	const allowFallback = request.allowFallback ?? true;

	for (let index = 0; index < chain.length; index += 1) {
		const profile = chain[index];
		if (availability[profile]) {
			return {
				requested: request.forced ?? request.preferred,
				forced: request.forced,
				selected: profile,
				fallbackUsed: index > 0,
				fallbackFrom: index > 0 ? chain[0] : undefined,
				reason: index > 0 ? `fallback from ${chain[0]} to ${profile}` : undefined,
				capabilities,
			};
		}
		if (!allowFallback) {
			throw new Error(`Requested compute profile "${requestedProfile}" is unavailable`);
		}
	}

	return {
		requested: request.forced ?? request.preferred,
		forced: request.forced,
		selected: 'cpu',
		fallbackUsed: true,
		fallbackFrom: requestedProfile,
		reason: `fallback from ${requestedProfile} to cpu`,
		capabilities,
	};
}

async function probeRegistry(
	registry: ComputeWorkflowBackendRegistry,
): Promise<Record<ComputeProfile, boolean>> {
	return {
		webgpu: await probeAvailability(registry.webgpu),
		webgl2: await probeAvailability(registry.webgl2),
		cpu: true,
	};
}

async function probeAvailability(
	descriptor: ComputeWorkflowBackendRegistry[keyof ComputeWorkflowBackendRegistry] | undefined,
): Promise<boolean> {
	if (!descriptor) {
		return false;
	}
	return Boolean(await descriptor.isAvailable());
}

function buildAvailabilityNotes(webgpuAvailable: boolean, webgl2Available: boolean): string[] {
	const notes: string[] = [];
	if (!webgpuAvailable) {
		notes.push('WebGPU unavailable');
	}
	if (!webgl2Available) {
		notes.push('WebGL2 unavailable');
	}
	return notes;
}
