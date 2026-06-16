import type { WebGpuComputeContext, WebGpuComputeResources } from './types';
import type { ComputeResult } from '../core';
import { runWebGpuRawConeAlphaPass } from './passes/raw-cone-alphas';
import { runWebGpuCiseledConePass } from './passes/ciseled-cones';
import { getGpuBufferUsage } from '../shared/compute';
import { readBackFloat32Buffer } from './validation';
import { computeDynamicTownPrecomputeForYearCpu } from '../domain/precompute';

export interface WarmingOrchestratorDependencies {
    runRawAlpha: typeof runWebGpuRawConeAlphaPass;
    runCiseled: typeof runWebGpuCiseledConePass;
    readBack: typeof readBackFloat32Buffer;
    computeDynamicTown: typeof computeDynamicTownPrecomputeForYearCpu;
}

export class WarmingOrchestrator {
    private cache = new Map<number, Float32Array>();
    private deps: WarmingOrchestratorDependencies;
    private queue: number[] = [];
    private isProcessing = false;
    
    constructor(
        private context: WebGpuComputeContext,
        private resources: WebGpuComputeResources,
        private result: ComputeResult,
        private allYears: number[],
        deps?: Partial<WarmingOrchestratorDependencies>
    ) {
        this.deps = {
            runRawAlpha: deps?.runRawAlpha ?? runWebGpuRawConeAlphaPass,
            runCiseled: deps?.runCiseled ?? runWebGpuCiseledConePass,
            readBack: deps?.readBack ?? readBackFloat32Buffer,
            computeDynamicTown: deps?.computeDynamicTown ?? computeDynamicTownPrecomputeForYearCpu,
        };
        this.queue = [...allYears];
    }

    setFocusYear(year: number) {
        // Move year to front if it exists, or just resort
        const index = this.queue.indexOf(year);
        if (index > -1) {
            this.queue.splice(index, 1);
            this.queue.unshift(year);
        }
        
        if (!this.isProcessing) this.processQueue();
    }

    processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;
        
        // Use requestIdleCallback for cooperative multitasking
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            (window as any).requestIdleCallback(async () => {
                await this.runNextBatch();
            });
        } else {
            // Fallback for environments without requestIdleCallback
            setTimeout(async () => await this.runNextBatch(), 0);
        }
    }

    private async runNextBatch() {
        this.isProcessing = true;
        
        // Process one year at a time to stay responsive
        if (this.queue.length > 0) {
            const year = this.queue.shift()!;
            await this.warmYear(year);
        }

        this.isProcessing = false;
        
        if (this.queue.length > 0) {
            this.processQueue();
        }
    }

    async warmYear(year: number): Promise<Float32Array> {
        if (this.cache.has(year)) return this.cache.get(year)!;
        
        const dynamicTown = this.deps.computeDynamicTown(
            this.result.preparedDataset,
            this.result.staticTown!,
            year
        );
        
        const warmedResult = { ...this.result, dynamicTown };
        const usage = getGpuBufferUsage();
        
        await this.deps.runRawAlpha({
            context: this.context,
            result: warmedResult,
            resources: this.resources,
            usage,
        });

        const ciseledPass = await this.deps.runCiseled({
            context: this.context,
            result: warmedResult,
            resources: this.resources,
            usage,
        });

        const tBuffer = await this.deps.readBack(
            this.context.device,
            ciseledPass.ciseledConeRimEcef!.buffer,
            this.result.preparedDataset.cityCount * 360 * 4 
        );

        const resultData = tBuffer ?? new Float32Array(0);
        this.cache.set(year, resultData);
        return resultData;
    }

    getCache(): Map<number, Float32Array> {
        return this.cache;
    }
}
