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
	computeCurveVertexBufferCpu,
	computeDynamicTownPrecomputeForYearCpu,
	computeFinalConePrecomputeCpu,
	computeRawConePrecomputeCpu,
	computeStaticTownPrecomputeCpu,
	prepareCurveGeometryInput,
	prepareCurvePrecompute,
	type CurveVertexBuffer,
	type DynamicTownPrecompute,
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
import { measureStage, sumStageDurations } from '../core/timing';
import { tagDiagnostics } from '../shared/compute';
import { runCpuBoundaryStages } from './boundary';
import { runCpuConeIntersectionStage } from './cone';

/** CPU reference backend for the whole migration compute pipeline. */
export class CpuComputeBackend implements ComputeBackend {
	readonly profile = 'cpu' as const;

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

		let geojsonRuns = runCpuBoundaryStages(sourceFiles, inspectedFiles, preparedDataset, options, input.geojsonSources);
		for (const geojsonRun of geojsonRuns) {
			timings.push(geojsonRun.precomputeTiming, geojsonRun.raycastTiming);
			diagnostics.push(...geojsonRun.diagnostics);
		}

		const staticTownOptions = resolveStaticTownOptions(preparedDataset, options.staticTown);
		const { value: staticTown, timing: staticTiming } = measureStage(
			'static-town-precompute',
			'precompute',
			this.profile,
			() => computeStaticTownPrecomputeCpu(toStaticTownInput(preparedDataset), staticTownOptions),
		);
		timings.push(staticTiming);

		let dynamicTown: DynamicTownPrecompute | undefined;
		let rawCones: RawConePrecompute | undefined;
		let coneIntersections: ConeIntersectionOraclePrecompute | undefined;
		let curveGeometry: CurveVertexBuffer | undefined;

		const dynamicYear = options.dynamicYear ?? preparedDataset.speedTimeline.span.beginYear;
		if (Number.isFinite(dynamicYear)) {
			const dynamicTiming = measureStage(
				'dynamic-town-precompute',
				'precompute',
				this.profile,
				() => computeDynamicTownPrecomputeForYearCpu(preparedDataset, staticTown, dynamicYear),
			);
			dynamicTown = dynamicTiming.value;
			timings.push(dynamicTiming.timing);
		}

		if (options.rawCone && dynamicTown) {
			const rawConeTiming = measureStage(
				'raw-cones-precompute',
				'precompute',
				this.profile,
				() =>
					computeRawConePrecomputeCpu(
						staticTown,
						dynamicTown as DynamicTownPrecompute,
						options.rawCone as RawConePrecomputeOptions,
					),
			);
			rawCones = rawConeTiming.value;
			timings.push(rawConeTiming.timing);
		}

		if (options.coneIntersection?.enabled !== false && rawCones && dynamicTown) {
			const coneIntersectionResult = measureStage('cone-intersections-precompute', 'interactive', this.profile, () =>
				runCpuConeIntersectionStage(
					staticTown,
					rawCones,
					dynamicTown,
					options.coneIntersection?.strategy ?? 'oracle',
					options.coneIntersection,
				),
			);
			coneIntersections = coneIntersectionResult.value;
			timings.push(coneIntersectionResult.timing);
		}

		if (coneIntersections) {
			geojsonRuns = geojsonRuns.map((geojsonRun) => {
				const finalConesTiming = measureStage(
				'final-cones-precompute',
				'precompute',
				this.profile,
				() =>
					computeFinalConePrecomputeCpu(
						coneIntersections,
						geojsonRun.boundaryRaycast,
						EARTH_RADIUS_METERS,
						options.projection
							? {
									start: options.projection.start,
									end: options.projection.end,
									percent: options.projection.percent,
									settings: options.projection.settings,
								}
							: undefined,
					),
			);
				timings.push(finalConesTiming.timing);
				return {
					...geojsonRun,
					finalCones: finalConesTiming.value,
				};
			});
		}

		if (options.curve?.enabled === true) {
			const curvePrecompute = prepareCurvePrecompute(preparedDataset, staticTown);
			const curveGeometryResult = measureStage(
				'curve-geometry-precompute',
				'precompute',
				this.profile,
				() =>
					computeCurveVertexBufferCpu(
						prepareCurveGeometryInput(curvePrecompute, {
							year: options.curve?.year ?? dynamicYear,
							pointsPerCurve: options.curve?.pointsPerCurve ?? 15,
							curvePosition: options.curve?.curvePosition ?? 'above',
							coefficient: options.curve?.coefficient ?? 1,
						}),
					),
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
