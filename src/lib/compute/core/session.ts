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
	let backend: ComputeBackend | null = null;
	let backendProfile: ComputeProfileSelection['selected'] | null = null;

	return {
		selectProfile(request: ComputeProfileRequest): Promise<ComputeProfileSelection> {
			return selectComputeProfile(request, registry);
		},

		async computeFrame(
			input: ComputeInput,
			options: ComputeOptions = {},
			request: ComputeProfileRequest = {},
		): Promise<ComputeResult> {
			const selection = await selectComputeProfile(request, registry);
			const selectedBackend = await resolveSelectedBackend(registry, selection, backend, backendProfile);
			backend = selectedBackend.backend;
			backendProfile = selection.selected;
			return selectedBackend.backend.computeFrame(input, options, selection);
		},

		async dispose(): Promise<void> {
			if (!backend) {
				return;
			}
			const currentBackend = backend;
			backend = null;
			backendProfile = null;
			await currentBackend.dispose();
		},
	};
}

async function resolveSelectedBackend(
	registry: ComputeBackendRegistry,
	selection: ComputeProfileSelection,
	currentBackend: ComputeBackend | null,
	currentProfile: ComputeProfileSelection['selected'] | null,
): Promise<{ backend: ComputeBackend }> {
	if (currentBackend && currentProfile === selection.selected) {
		return { backend: currentBackend };
	}

	const nextBackend = await createSelectedBackend(registry, selection);
	if (currentBackend) {
		await currentBackend.dispose();
	}
	return { backend: nextBackend };
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
