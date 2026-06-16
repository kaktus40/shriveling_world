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
import { diffComputeOptions } from './invalidation';

export interface ComputeOrchestrator {
        selectProfile(request: ComputeProfileRequest): Promise<ComputeProfileSelection>;
        computeFrame(input: ComputeInput, options?: ComputeOptions, request?: ComputeProfileRequest): Promise<ComputeResult>;
}

export function createComputeOrchestrator(
        registry: ComputeBackendRegistry = createDefaultComputeBackendRegistry(),
): ComputeOrchestrator {
        let lastOptions: ComputeOptions | null = null;

        return {
                selectProfile(request: ComputeProfileRequest): Promise<ComputeProfileSelection> {
                        return selectComputeProfile(request, registry);
                },

                async computeFrame(
                        input: ComputeInput,
                        options: ComputeOptions = {},
                        request: ComputeProfileRequest = {},
                ): Promise<ComputeResult> {
                        if (lastOptions) {
                                const impact = diffComputeOptions(lastOptions, options);
                                if (impact.staticTown || impact.boundary) {
                                        (options as any)._invalidateStatic = true;
                                }
                        }
                        
                        lastOptions = options;

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
