import {
	type ComputeBackend,
	type ComputeBackendRegistry,
	type ComputeInput,
	type ComputeOptions,
	type ComputeProfileRequest,
	type ComputeProfileSelection,
	type ComputeResult,
} from './types';
import { selectComputeProfile } from './selector';
import { createDefaultComputeBackendRegistry } from '../cpu';

/**
 * Persistent compute session used by workspace and app routes.
 *
 * The session keeps the selected backend instance alive across successive
 * computations so year and projection changes can reuse the same runtime
 * context instead of tearing it down after each pass.
 */
export interface ComputeSession {
	warm(): Promise<void>;
	selectProfile(request: ComputeProfileRequest): Promise<ComputeProfileSelection>;
	computeFrame(input: ComputeInput, options?: ComputeOptions, request?: ComputeProfileRequest): Promise<ComputeResult>;
	dispose(): Promise<void>;
}

/**
 * Creates one persistent compute session around a backend registry.
 *
 * The session keeps the selected backend warm until the profile changes or the
 * caller explicitly disposes it.
 */
export function createComputeSession(
	registry: ComputeBackendRegistry = createDefaultComputeBackendRegistry(),
): ComputeSession {
	const backends = new Map<ComputeProfileSelection['selected'], ComputeBackend>();

	return {
		async warm(): Promise<void> {
			await Promise.all([
				warmBackend(registry, backends, 'cpu'),
				warmBackend(registry, backends, 'webgl2'),
				warmBackend(registry, backends, 'webgpu'),
			].map((task) =>
				task.catch((error) => {
					console.warn('Compute backend warm-up failed:', error);
				}),
			));
		},

		selectProfile(request: ComputeProfileRequest): Promise<ComputeProfileSelection> {
			return selectComputeProfile(request, registry);
		},

		async computeFrame(
			input: ComputeInput,
			options: ComputeOptions = {},
			request: ComputeProfileRequest = {},
		): Promise<ComputeResult> {
			const selection = await selectComputeProfile(request, registry);
			const backend = await resolveSelectedBackend(registry, selection, backends);
			return backend.computeFrame(input, options, selection);
		},

		async dispose(): Promise<void> {
			const disposals = Array.from(backends.values()).map((backend) => backend.dispose());
			backends.clear();
			if (disposals.length > 0) {
				await Promise.all(disposals);
			}
		},
	};
}

async function resolveSelectedBackend(
	registry: ComputeBackendRegistry,
	selection: ComputeProfileSelection,
	backends: Map<ComputeProfileSelection['selected'], ComputeBackend>,
): Promise<ComputeBackend> {
	const currentBackend = backends.get(selection.selected);
	if (currentBackend) {
		return currentBackend;
	}

	const nextBackend = await createSelectedBackend(registry, selection);
	backends.set(selection.selected, nextBackend);
	return nextBackend;
}

async function warmBackend(
	registry: ComputeBackendRegistry,
	backends: Map<ComputeProfileSelection['selected'], ComputeBackend>,
	profile: ComputeProfileSelection['selected'],
): Promise<void> {
	if (backends.has(profile)) {
		return;
	}
	const descriptor = profile === 'cpu'
		? registry.cpu
		: profile === 'webgl2'
			? registry.webgl2
			: registry.webgpu;
	if (!descriptor) {
		return;
	}
	if (!(await descriptor.isAvailable())) {
		return;
	}
	backends.set(profile, await descriptor.create());
}

async function createSelectedBackend(
	registry: ComputeBackendRegistry,
	selection: ComputeProfileSelection,
): Promise<ComputeBackend> {
	if (selection.selected === 'webgl2' && registry.webgl2) {
		return registry.webgl2.create();
	}
	if (selection.selected === 'webgpu' && registry.webgpu) {
		return registry.webgpu.create();
	}
	return registry.cpu.create();
}
