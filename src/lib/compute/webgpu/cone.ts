import { type GpuBufferAllocation } from './buffers';
import { getGpuBufferUsage } from '../shared/compute';
import type { DatasetDiagnostic } from '../../domain/data';
import type { ComputeResult, StageTiming } from '../core';
import type { ComputeOptions } from '../core';
import type { ComputeStage } from '../core/types';
import type { WebGpuComputeContext, WebGpuComputeResources } from './types';
import { runWebGpuCityMatrixPass } from './passes/city-ned2ecef';
import { runWebGpuRawConeAlphaPass } from './passes/raw-cone-alphas';
import { runWebGpuCiseledConePass } from './passes/ciseled-cones';

/** Runs the WebGPU passes that build and compare the cone pipeline. */
import { swapGpuDoubleBuffer } from '../phase-c/phase-c';

export async function runWebGpuConeStages(
        context: WebGpuComputeContext,
        result: ComputeResult,
        resources: WebGpuComputeResources,
        options: ComputeOptions = {},
        cachedCiseledRim?: GpuBufferAllocation,
): Promise<{
        extraTimings: StageTiming[];
        diagnostics: DatasetDiagnostic[];
        ciseledConeRimEcef: GpuBufferAllocation | null;
}> {
        const extraTimings: StageTiming[] = [];
        const diagnostics: DatasetDiagnostic[] = [];
        let ciseledConeRimEcef: GpuBufferAllocation | null = cachedCiseledRim ?? null;

        const shouldRun = (stage: ComputeStage) => !options.passFilter || options.passFilter.includes(stage);

        if (shouldRun('static-town-precompute') && result.staticTown) {
                const cityMatrixPass = await runWebGpuCityMatrixPass({
                        context,
                        result,
                        resources,
                        usage: getGpuBufferUsage(),
                });
                extraTimings.push(cityMatrixPass.timing);
                diagnostics.push(...cityMatrixPass.diagnostics);
        }

        if (shouldRun('raw-cones-precompute') && result.rawCones) {
                const rawConeAlphaPass = await runWebGpuRawConeAlphaPass({
                        context,
                        result,
                        resources,
                        usage: getGpuBufferUsage(),
                });
                extraTimings.push(rawConeAlphaPass.timing);
                diagnostics.push(...rawConeAlphaPass.diagnostics);
        }

        // Only run ciseled cone pass if no cached result is provided
        if (!cachedCiseledRim && shouldRun('cone-intersections-precompute') && result.staticTown && result.rawCones && result.coneIntersections) {
                const ciseledConePass = await runWebGpuCiseledConePass({
                        context,
                        result,
                        resources,
                        usage: getGpuBufferUsage(),
                        coneIntersection: options.coneIntersection,
                });
                extraTimings.push(ciseledConePass.timing);
                diagnostics.push(...ciseledConePass.diagnostics);
                ciseledConeRimEcef = ciseledConePass.ciseledConeRimEcef ?? null;
        }

        // Swap double-buffers so front reflects the most recently computed results
        try {
                if (context && context.device) {
                        swapGpuDoubleBuffer(context.device, 'raw-cone-alphas:coneAlphaRadians');
                        swapGpuDoubleBuffer(context.device, 'ciseled-cones:rim');
                }
        } catch {}

        return {
                extraTimings,
                diagnostics,
                ciseledConeRimEcef,
        };
}
