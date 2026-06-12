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

/** Compute orchestration contract shared by workspace and the future app surface. */
export interface ComputeOrchestrator {
	selectProfile(request: ComputeProfileRequest): Promise<ComputeProfileSelection>;
	computeFrame(input: ComputeInput, options?: ComputeOptions, request?: ComputeProfileRequest): Promise<ComputeResult>;
}

/**
 * Creates one compute orchestrator around a backend registry.
 *
 * The orchestrator selects the best available backend, delegates one frame
 * computation and disposes the backend instance after use.
 */
export function createComputeOrchestrator(
	registry: ComputeBackendRegistry = createDefaultComputeBackendRegistry(),
): ComputeOrchestrator {
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
			const backend = await resolveSelectedBackend(registry, selection);
			try {
				return await backend.computeFrame(input, options, selection);
			} finally {
				await backend.dispose();
			}
		},
	};
}

async function resolveSelectedBackend(
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
