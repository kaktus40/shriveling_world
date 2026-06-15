import {
	assembleBaseNetwork,
	inspectDatasetFiles,
	prepareDataset,
	resolveDatasetManifest,
	toStaticTownInput,
	type DatasetDiagnostic,
	type PreparedDataset,
} from '../../domain/data';
import {
	computeFinalConePrecomputeCpu,
	computeFinalCurveVertexBufferCpu,
	computeDynamicTownPrecomputeForYearCpu,
	computeRawConePrecomputeCpu,
	computeStaticTownPrecomputeCpu,
	prepareCurveGeometryInput,
	type CurveVertexBuffer,
	type CurvePrecompute,
	type DynamicTownPrecompute,
	type DynamicTownPrecomputeByYear,
	type ConeIntersectionOraclePrecompute,
	type RawConePrecompute,
	type RawConePrecomputeOptions,
	type StaticTownPrecompute,
	type StaticTownPrecomputeOptions,
} from '../../domain/precompute';
import { EARTH_RADIUS_METERS } from '../../shared';
import {
	type ComputeBackend,
	type ComputeBackendDescriptor,
	type ComputeBackendRegistry,
	type ComputeBenchmarkReport,
	type ComputeCapabilities,
	type ComputeInput,
	type ComputeOptions,
	type ComputeProfileSelection,
	type ComputeResult,
	type StageTiming,
} from '../core/types';
import { createComputeAnnualCache, createComputeAnnualCacheKey } from '../core/annual-cache';
import { measureStage, sumStageDurations, measureAsyncStage } from '../core/timing';
import { createInprocessWorker } from '../phase-c/phase-c';
import { tagDiagnostics } from '../shared/compute';
import { runCpuBoundaryStages } from './boundary';
import { runCpuConeIntersectionStage } from './cone';

/** CPU reference backend for the whole migration compute pipeline. */
export class CpuComputeBackend implements ComputeBackend {
	readonly profile = 'cpu' as const;
	#annualCacheKey: string | null = null;
	#dynamicTownByYear: DynamicTownPrecomputeByYear | null = null;
	#curvePrecompute: CurvePrecompute | null = null;
	#worker = createInprocessWorker();

	async warm(): Promise<void> {
		// CPU backend has no external runtime to warm up, but the method keeps
		// the lifecycle contract uniform across all compute backends.
	}

	async computeFrame(
		input: ComputeInput,
		options: ComputeOptions = {},
		selection?: ComputeProfileSelection,
	): Promise<ComputeResult> {
		const timings: StageTiming[] = [];
		const notes: string[] = [];
		const diagnostics: DatasetDiagnostic[] = [];

		const sourceFiles = [...input.sourceFiles];
		const { value: inspectedFiles, timing: csvTiming } = measureStage(
			'csv-ingestion',
			'ingestion',
			this.profile,
			() => inspectDatasetFiles(sourceFiles),
		);
		timings.push(csvTiming);

		const { value: manifest, timing: manifestTiming } = measureStage(
			'dataset-manifest',
			'ingestion',
			this.profile,
			() => resolveDatasetManifest(inspectedFiles),
		);
		timings.push(manifestTiming);
		diagnostics.push(...manifest.diagnostics);

		if (!manifest.valid) {
			throw new Error(`Dataset manifest is invalid: ${JSON.stringify(manifest.diagnostics, null, 2)}`);
		}

		const { value: baseNetwork, timing: assemblyTiming } = measureStage(
			'base-network-assembly',
			'ingestion',
			this.profile,
			() => assembleBaseNetwork({ files: sourceFiles, manifest }),
		);
		timings.push(assemblyTiming);
		diagnostics.push(...baseNetwork.diagnostics);

		const { value: preparedDataset, timing: preparedTiming } = measureStage(
			'prepared-dataset',
			'precompute',
			this.profile,
			() => prepareDataset(baseNetwork),
		);
		timings.push(preparedTiming);
		diagnostics.push(...preparedDataset.diagnostics);

		// Determine passFilter usage and stage dependencies so we can short-circuit CPU work
		const hasFilter = Array.isArray(options.passFilter);
		const inFilter = (stage: string) => !hasFilter || (options.passFilter as readonly string[]).includes(stage as any);
		const needStaticTown = inFilter('static-town-precompute') || inFilter('raw-cones-precompute') || inFilter('cone-intersections-precompute') || inFilter('final-cones-precompute') || inFilter('final-curves-precompute');
		const needRawCones = inFilter('raw-cones-precompute');
		const needConeIntersections = inFilter('cone-intersections-precompute');
		const needFinalCones = inFilter('final-cones-precompute');
		const needFinalCurves = inFilter('final-curves-precompute');

		let geojsonRuns = runCpuBoundaryStages(sourceFiles, inspectedFiles, preparedDataset, options, input.geojsonSources);
		for (const geojsonRun of geojsonRuns) {
			timings.push(geojsonRun.precomputeTiming, geojsonRun.raycastTiming);
			diagnostics.push(...geojsonRun.diagnostics);
		}

		const staticTownOptions = resolveStaticTownOptions(preparedDataset, options.staticTown);
		let staticTown: StaticTownPrecompute | undefined;
		let annualCache: ReturnType<typeof createComputeAnnualCache> | null = null;
		if (needStaticTown) {
			const staticTimingResult = await measureAsyncStage(
				'static-town-precompute',
				'precompute',
				this.profile,
				async () => {
					try {
						const req = await this.#worker.post({ id: `staticTown-${Date.now()}`, type: 'compute', payload: { action: 'staticTown', staticTownInput: toStaticTownInput(preparedDataset), staticTownOptions } });
						if (req.ok) return req.payload as StaticTownPrecompute;
						// fallback
						return computeStaticTownPrecomputeCpu(toStaticTownInput(preparedDataset), staticTownOptions);
					} catch (e) {
						return computeStaticTownPrecomputeCpu(toStaticTownInput(preparedDataset), staticTownOptions);
					}
				},
			);
			const { value: computedStaticTown, timing: staticTiming } = staticTimingResult;
			staticTown = computedStaticTown;
			timings.push(staticTiming);
			const annualCacheKey = createComputeAnnualCacheKey({
				sourceFiles,
				staticTown: staticTownOptions,
			});
			if (this.#annualCacheKey !== annualCacheKey || !this.#dynamicTownByYear || !this.#curvePrecompute) {
				annualCache = createComputeAnnualCache(preparedDataset, staticTown);
				this.#annualCacheKey = annualCacheKey;
				this.#dynamicTownByYear = annualCache.dynamicTownByYear;
				this.#curvePrecompute = annualCache.curvePrecompute;
			}
		}

		let dynamicTown: DynamicTownPrecompute | undefined;
		let rawCones: RawConePrecompute | undefined;
		let coneIntersections: ConeIntersectionOraclePrecompute | undefined;
		let curveGeometry: CurveVertexBuffer | undefined;

		const dynamicYear = options.dynamicYear ?? preparedDataset.speedTimeline.span.beginYear;
		if (Number.isFinite(dynamicYear) && (inFilter('dynamic-town-precompute') || needRawCones || needConeIntersections || needFinalCones || needFinalCurves)) {
			const dynamicTiming = measureStage(
				'dynamic-town-precompute',
				'precompute',
				this.profile,
				() => resolveAnnualDynamicTown(this.#dynamicTownByYear, preparedDataset, staticTown as StaticTownPrecompute, dynamicYear),
			);
			dynamicTown = dynamicTiming.value;
			timings.push(dynamicTiming.timing);
		}

		if (needRawCones && options.rawCone && dynamicTown && staticTown) {
			const rawConeTiming = await measureAsyncStage(
				'raw-cones-precompute',
				'precompute',
				this.profile,
				async () => {
					try {
						const req = await this.#worker.post({ id: `rawCones-${Date.now()}`, type: 'compute', payload: { action: 'rawCones', staticTown, dynamicTown, options: options.rawCone } });
						if (req.ok) return req.payload as RawConePrecompute;
						return computeRawConePrecomputeCpu(staticTown as StaticTownPrecompute, dynamicTown as DynamicTownPrecompute, options.rawCone as RawConePrecomputeOptions);
					} catch (e) {
						return computeRawConePrecomputeCpu(staticTown as StaticTownPrecompute, dynamicTown as DynamicTownPrecompute, options.rawCone as RawConePrecomputeOptions);
					}
				},
			);
			rawCones = rawConeTiming.value;
			timings.push(rawConeTiming.timing);
		}
		if (needConeIntersections && options.coneIntersection?.enabled !== false && rawCones && dynamicTown && staticTown) {
			const coneIntersectionResult = await measureAsyncStage('cone-intersections-precompute', 'interactive', this.profile, async () => {
				try {
					const req = await this.#worker.post({ id: `coneIntersections-${Date.now()}`, type: 'compute', payload: { action: 'coneIntersections', staticTown, rawCones, dynamicTown, strategy: options.coneIntersection?.strategy ?? 'oracle', options: options.coneIntersection } });
					if (req.ok) return req.payload as ConeIntersectionOraclePrecompute;
					return runCpuConeIntersectionStage(staticTown as StaticTownPrecompute, rawCones as RawConePrecompute, dynamicTown as DynamicTownPrecompute, options.coneIntersection?.strategy ?? 'oracle', options.coneIntersection);
				} catch (e) {
					return runCpuConeIntersectionStage(staticTown as StaticTownPrecompute, rawCones as RawConePrecompute, dynamicTown as DynamicTownPrecompute, options.coneIntersection?.strategy ?? 'oracle', options.coneIntersection);
				}
			});
			coneIntersections = coneIntersectionResult.value;
			timings.push(coneIntersectionResult.timing);
		}

		if ((needFinalCones || needFinalCurves) && coneIntersections) {
					geojsonRuns = await Promise.all(
			geojsonRuns.map(async (geojsonRun) => {
				if (needFinalCones) {
					const finalConesTiming = await measureAsyncStage(
						'final-cones-precompute',
						'precompute',
						this.profile,
						async () => {
							try {
										const req = await this.#worker.post({ id: `finalCones-${Date.now()}`, type: 'compute', payload: { action: 'finalCones', coneIntersections, boundaryRaycast: geojsonRun.boundaryRaycast, projection: options.projection, earthRadiusMeters: EARTH_RADIUS_METERS } });
										if (req.ok) return req.payload as any;
										return computeFinalConePrecomputeCpu(coneIntersections as ConeIntersectionOraclePrecompute, geojsonRun.boundaryRaycast, EARTH_RADIUS_METERS, options.projection ? { start: options.projection.start, end: options.projection.end, percent: options.projection.percent, settings: options.projection.settings } : undefined);
							} catch (e) {
										return computeFinalConePrecomputeCpu(coneIntersections as ConeIntersectionOraclePrecompute, geojsonRun.boundaryRaycast, EARTH_RADIUS_METERS, options.projection ? { start: options.projection.start, end: options.projection.end, percent: options.projection.percent, settings: options.projection.settings } : undefined);
							}
						},
					);
					timings.push(finalConesTiming.timing);
					geojsonRun = { ...geojsonRun, finalCones: finalConesTiming.value };
				}
				return geojsonRun;
			}),
					);
				}
				if (options.curve?.enabled === true) {
					const curvePrecompute = this.#curvePrecompute ?? annualCache?.curvePrecompute ?? createComputeAnnualCache(preparedDataset, staticTown).curvePrecompute;
					const curveGeometryResult = await measureAsyncStage(
			'final-curves-precompute',
			'precompute',
			this.profile,
			async () => {
				try {
					const req = await this.#worker.post({ id: `finalCurves-${Date.now()}`, type: 'compute', payload: { action: 'finalCurves', curvePrecompute, options: { year: options.curve?.year ?? dynamicYear, pointsPerCurve: options.curve?.pointsPerCurve ?? 15, curvePosition: options.curve?.curvePosition ?? 'above', coefficient: options.curve?.coefficient ?? 1 }, projection: options.projection } });
					if (req.ok) return req.payload as any;
					return computeFinalCurveVertexBufferCpu(prepareCurveGeometryInput(curvePrecompute, { year: options.curve?.year ?? dynamicYear, pointsPerCurve: options.curve?.pointsPerCurve ?? 15, curvePosition: options.curve?.curvePosition ?? 'above', coefficient: options.curve?.coefficient ?? 1 }), options.projection);
				} catch (e) {
					return computeFinalCurveVertexBufferCpu(prepareCurveGeometryInput(curvePrecompute, { year: options.curve?.year ?? dynamicYear, pointsPerCurve: options.curve?.pointsPerCurve ?? 15, curvePosition: options.curve?.curvePosition ?? 'above', coefficient: options.curve?.coefficient ?? 1 }), options.projection);
				}
			},
					);
					curveGeometry = curveGeometryResult.value;
					timings.push(curveGeometryResult.timing);
					diagnostics.push(...tagDiagnostics(curvePrecompute.diagnostics, this.profile));
				}

		const benchmark: ComputeBenchmarkReport = {
			profile: this.profile,
			timings,
			totalDurationMs: sumStageDurations(timings),
			notes,
		};

		return {
			selection: selection ?? cpuSelection(),
			inspectedFiles,
			baseNetwork,
			preparedDataset,
			geojsonRuns,
			staticTown,
			dynamicTown,
			rawCones,
			coneIntersections,
			curveGeometry,
			diagnostics: tagDiagnostics(diagnostics, this.profile),
			benchmark,
		};
	}

	async dispose(): Promise<void> {
		// CPU backend owns no external resource yet.
	}
}

/** Returns a CPU-only selection snapshot for standalone backend use. */
export function cpuSelection(): ComputeProfileSelection {
	return {
		selected: 'cpu',
		fallbackUsed: false,
		capabilities: cpuCapabilities(),
	};
}

/** Returns the capability snapshot of the CPU backend. */
export function cpuCapabilities(): ComputeCapabilities {
	return {
		webgpuAvailable: false,
		webgl2Available: false,
		cpuAvailable: true,
		notes: ['CPU reference backend'],
	};
}

/** Creates the default CPU backend descriptor. */
export function createCpuComputeBackend(): CpuComputeBackend {
	return new CpuComputeBackend();
}

function resolveAnnualDynamicTown(
	dynamicTownByYear: DynamicTownPrecomputeByYear | null,
	preparedDataset: PreparedDataset,
	staticTown: StaticTownPrecompute,
	year: number,
): DynamicTownPrecompute {
	if (dynamicTownByYear) {
		const cached = dynamicTownByYear[String(year)];
		if (cached) {
			return cached;
		}
	}
	return computeDynamicTownPrecomputeForYearCpu(preparedDataset, staticTown, year);
}

/** Creates a CPU-only registry that is always available. */
export function createDefaultComputeBackendRegistry(): ComputeBackendRegistry {
	return {
		cpu: createCpuComputeBackendDescriptor(),
	};
}

/** Creates a CPU backend descriptor suitable for profile selection. */
export function createCpuComputeBackendDescriptor(): ComputeBackendDescriptor {
	return {
		profile: 'cpu',
		isAvailable: () => true,
		create: async () => createCpuComputeBackend(),
	};
}

function resolveStaticTownOptions(
	preparedDataset: PreparedDataset,
	override?: Partial<StaticTownPrecomputeOptions>,
): StaticTownPrecomputeOptions {
	return {
		sectorCount: override?.sectorCount ?? 360,
		neighborLimit: override?.neighborLimit ?? Math.min(Math.max(preparedDataset.cityCount - 1, 0), 16),
	};
}
