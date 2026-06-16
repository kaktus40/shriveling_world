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

export interface ComputeOrchestrator {
        selectProfile(request: ComputeProfileRequest): Promise<ComputeProfileSelection>;
        computeFrame(input: ComputeInput, options?: ComputeOptions, request?: ComputeProfileRequest): Promise<ComputeResult>;
}

export function createComputeOrchestrator(
        registry: ComputeBackendRegistry = createDefaultComputeBackendRegistry(),
): ComputeOrchestrator {
        let lastPhase2Options: { neighborLimit?: number; interiorPointSpacingRadians?: number } | null = null;
        let invalidatePhase2 = false;

        return {
                selectProfile(request: ComputeProfileRequest): Promise<ComputeProfileSelection> {
                        return selectComputeProfile(request, registry);
                },

                async computeFrame(
                        input: ComputeInput,
                        options: ComputeOptions = {},
                        request: ComputeProfileRequest = {},
                ): Promise<ComputeResult> {
                        const currentNeighborLimit = options.staticTown?.neighborLimit;
                        const currentSpacing = options.boundaryPrecompute?.interiorPointSpacingRadians;

                        if (lastPhase2Options && (currentNeighborLimit !== lastPhase2Options.neighborLimit || currentSpacing !== lastPhase2Options.interiorPointSpacingRadians)) {
                                invalidatePhase2 = true;
                        }

                        lastPhase2Options = { neighborLimit: currentNeighborLimit, interiorPointSpacingRadians: currentSpacing };

                        const selection = await selectComputeProfile(request, registry);
                        const backend = await resolveSelectedBackend(registry, selection);
                        
                        try {
                                if (invalidatePhase2) {
                                        options = { ...options, passFilter: ['static-town-precompute', 'geojson-boundary-precompute', ... (options.passFilter ?? [])] };
                                        invalidatePhase2 = false;
                                }
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
