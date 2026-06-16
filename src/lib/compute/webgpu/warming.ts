import type { WebGpuComputeContext, WebGpuComputeResources } from './types';
import type { ComputeResult } from '../core';
import { runWebGpuRawConeAlphaPass } from './passes/raw-cone-alphas';
import { runWebGpuCiseledConePass } from './passes/ciseled-cones';
import { getGpuBufferUsage } from '../shared/compute';
import { readBackFloat32Buffer } from './validation';

export interface WarmingOrchestratorDependencies {
    runRawAlpha: typeof runWebGpuRawConeAlphaPass;
    runCiseled: typeof runWebGpuCiseledConePass;
    readBack: typeof readBackFloat32Buffer;
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
        };
        this.queue = [...allYears];
    }

    async setFocusYear(year: number) {
        this.queue.sort((a, b) => {
            const getPriority = (y: number) => {
                if (y === year) return 0;
                if (Math.abs(y - year) <= 1) return 1;
                if (Math.abs(y - year) <= 5) return 2;
                return 3;
            };
            return getPriority(a) - getPriority(b);
        });
        await this.processQueue();
    }

    async processQueue() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        while (this.queue.length > 0) {
            const year = this.queue.shift()!;
            await this.warmYear(year);
        }

        this.isProcessing = false;
    }

    async warmYear(year: number): Promise<Float32Array> {
        if (this.cache.has(year)) return this.cache.get(year)!;
        
        const usage = getGpuBufferUsage();
        
        // 1. Run Raw Cone Alpha Pass
        await this.deps.runRawAlpha({
            context: this.context,
            result: this.result,
            resources: this.resources,
            usage,
        });

        // 2. Run Ciseled Cone Pass
        const ciseledPass = await this.deps.runCiseled({
            context: this.context,
            result: this.result,
            resources: this.resources,
            usage,
        });

        // 3. Readback the result (t)
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
