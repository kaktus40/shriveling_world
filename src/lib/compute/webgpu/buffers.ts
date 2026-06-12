/** Public WebGPU compute buffer contracts. Implementation details live in pass-specific modules. */
import type { ComputeGpuBufferContract } from '../gpu';
import type { ConeShape, CurveGeometryInput } from '../../domain/precompute';

/** Minimal GPU buffer usage flags required by the WebGPU migration helpers. */
export interface GpuBufferUsageFlags {
	readonly STORAGE: number;
	readonly COPY_DST: number;
	readonly COPY_SRC: number;
	readonly UNIFORM: number;
	readonly MAP_READ: number;
}

/** Shared contract for a GPU buffer allocation used by the migration compute stack. */
export interface GpuBufferAllocation {
	readonly buffer: GPUBuffer;
	readonly contract: ComputeGpuBufferContract;
}

/** WebGPU resources required by the city NED-to-ECEF pass. */
export interface CityNed2EcefDispatchResources {
	readonly input: GpuBufferAllocation;
	readonly output: GpuBufferAllocation;
	readonly uniform: GpuBufferAllocation;
}

/** Input bundle required by the GeoJSON boundary WGSL pass. */
export interface BoundaryAlgebreDispatchInput {
	readonly cityNed2EcefMatrices: Float32Array;
	readonly cityContourIndexes: Int32Array;
	readonly countryContourNVectorBuffer: Float32Array;
	readonly countryContourOffsets: Int32Array;
	readonly countryContourSizes: Int32Array;
	readonly azimuthIntervals: Float32Array;
	readonly cityCount: number;
	readonly azimuthIntervalCount: number;
	readonly contourCount: number;
	readonly earthRadiusMeters: number;
}

/** WebGPU resources required by the GeoJSON boundary WGSL pass. */
export interface BoundaryAlgebreDispatchResources {
	readonly cityMatrices: GpuBufferAllocation;
	readonly cityContourIndexes: GpuBufferAllocation;
	readonly contourNVectors: GpuBufferAllocation;
	readonly contourOffsets: GpuBufferAllocation;
	readonly contourSizes: GpuBufferAllocation;
	readonly azimuthIntervals: GpuBufferAllocation;
	readonly uniform: GpuBufferAllocation;
	readonly townBoundaryAngular: GpuBufferAllocation;
	readonly townBoundaryEcef: GpuBufferAllocation;
}

/** Input bundle required by the raw-cone alpha WGSL pass. */
export interface RawConeAlphaDispatchInput {
	readonly cityLinkOffsets: Uint32Array;
	readonly cityLinkCounts: Uint32Array;
	readonly cityLinkAzimuthRadians: Float32Array;
	readonly cityLinkAlphaRadians: Float32Array;
	readonly cityFastestTerrestrialAlphaRadians: Float32Array;
	readonly cityCount: number;
	readonly azimuthSampleCount: number;
	readonly roadAlphaRadians: number;
	readonly attenuationRadians: number;
	readonly shape: ConeShape;
}

/** WebGPU resources required by the raw-cone alpha WGSL pass. */
export interface RawConeAlphaDispatchResources {
	readonly cityLinkOffsets: GpuBufferAllocation;
	readonly cityLinkCounts: GpuBufferAllocation;
	readonly cityLinkAzimuthRadians: GpuBufferAllocation;
	readonly cityLinkAlphaRadians: GpuBufferAllocation;
	readonly cityFastestTerrestrialAlphaRadians: GpuBufferAllocation;
	readonly uniform: GpuBufferAllocation;
	readonly coneAlphaRadians: GpuBufferAllocation;
}

/** Input bundle required by the ciseled-cones oracle WGSL pass. */
export interface CiseledConesDispatchInput {
	readonly cityNed2EcefMatrices: Float32Array;
	readonly overlapCandidates: Uint32Array;
	readonly overlapCandidateCounts: Uint32Array;
	readonly rawConeRimEcef: Float32Array;
	readonly cityCount: number;
	readonly azimuthSampleCount: number;
	readonly neighborLimit: number;
}

/** WebGPU resources required by the ciseled-cones oracle WGSL pass. */
export interface CiseledConesDispatchResources {
	readonly cityMatrices: GpuBufferAllocation;
	readonly overlapCandidates: GpuBufferAllocation;
	readonly overlapCandidateCounts: GpuBufferAllocation;
	readonly rawConeRimEcef: GpuBufferAllocation;
	readonly uniform: GpuBufferAllocation;
	readonly coneIntersectionDistanceMeters: GpuBufferAllocation;
	readonly ciseledConeRimEcef: GpuBufferAllocation;
}

/** Input bundle required by the final-cones WGSL pass. */
export interface FinalConesDispatchInput {
	readonly ciseledConeRimEcef: GpuBufferAllocation;
	readonly townBoundaryAngular: GpuBufferAllocation;
	readonly townBoundaryEcef: GpuBufferAllocation;
	readonly cityCount: number;
	readonly azimuthSampleCount: number;
	readonly earthRadiusMeters: number;
}

/** WebGPU resources required by the final-cones WGSL pass. */
export interface FinalConesDispatchResources {
	readonly ciseledConeRimEcef: GpuBufferAllocation;
	readonly townBoundaryAngular: GpuBufferAllocation;
	readonly townBoundaryEcef: GpuBufferAllocation;
	readonly uniform: GpuBufferAllocation;
	readonly finalConeGeometryEcef: GpuBufferAllocation;
}

/** Input bundle required by the curve-geometry WGSL pass. */
export interface CurveGeometryDispatchInput extends CurveGeometryInput {
	readonly earthRadiusMeters: number;
}

/** WebGPU resources required by the curve-geometry WGSL pass. */
export interface CurveGeometryDispatchResources {
	readonly curveControlPointsEcef: GpuBufferAllocation;
	readonly curveThetaRadians: GpuBufferAllocation;
	readonly curveSpeedRatio: GpuBufferAllocation;
	readonly curveIds: GpuBufferAllocation;
	readonly uniform: GpuBufferAllocation;
	readonly curveVertexPositions: GpuBufferAllocation;
}
