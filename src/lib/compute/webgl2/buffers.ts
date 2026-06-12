/** Public WebGL2 compute buffer contracts. Implementation details live in pass-specific modules. */
import type { ComputeGpuBufferContract } from '../gpu';
import type { ConeShape, CurveGeometryInput } from '../../domain/precompute';

/** WebGL2 resources required by the city NED-to-ECEF fallback pass. */
export interface WebGl2CityNed2EcefDispatchResources {
	readonly vertexArray: WebGLVertexArrayObject;
	readonly inputBuffer: WebGLBuffer;
	readonly outputBuffer: WebGLBuffer;
	readonly program: WebGLProgram;
	readonly uniformLocation: WebGLUniformLocation;
	readonly inputContract: ComputeGpuBufferContract;
	readonly outputContract: ComputeGpuBufferContract;
}

/** Input bundle required by the WebGL2 boundary raycast fallback pass. */
export interface WebGl2BoundaryAlgebreDispatchInput {
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

/** WebGL2 resources required by the boundary raycast fallback pass. */
export interface WebGl2BoundaryAlgebreDispatchResources {
	readonly vertexArray: WebGLVertexArrayObject;
	readonly program: WebGLProgram;
	readonly cityMatricesTexture: WebGLTexture;
	readonly cityContourIndexesTexture: WebGLTexture;
	readonly contourNVectorsTexture: WebGLTexture;
	readonly contourOffsetsTexture: WebGLTexture;
	readonly contourSizesTexture: WebGLTexture;
	readonly azimuthIntervalsTexture: WebGLTexture;
	readonly angularOutputBuffer: WebGLBuffer;
	readonly ecefOutputBuffer: WebGLBuffer;
	readonly uniformLocation: WebGLUniformLocation;
	readonly cityMatricesContract: ComputeGpuBufferContract;
	readonly cityContourIndexesContract: ComputeGpuBufferContract;
	readonly contourNVectorsContract: ComputeGpuBufferContract;
	readonly contourOffsetsContract: ComputeGpuBufferContract;
	readonly contourSizesContract: ComputeGpuBufferContract;
	readonly azimuthIntervalsContract: ComputeGpuBufferContract;
	readonly angularOutputContract: ComputeGpuBufferContract;
	readonly ecefOutputContract: ComputeGpuBufferContract;
}

/** Input bundle required by the raw-cone alpha WebGL2 pass. */
export interface WebGl2RawConeAlphaDispatchInput {
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

/** WebGL2 resources required by the raw-cone alpha fallback pass. */
export interface WebGl2RawConeAlphaDispatchResources {
	readonly vertexArray: WebGLVertexArrayObject;
	readonly program: WebGLProgram;
	readonly cityLinkOffsetsTexture: WebGLTexture;
	readonly cityLinkCountsTexture: WebGLTexture;
	readonly cityLinkAzimuthTexture: WebGLTexture;
	readonly cityLinkAlphaTexture: WebGLTexture;
	readonly cityFastestTerrestrialAlphaTexture: WebGLTexture;
	readonly outputBuffer: WebGLBuffer;
	readonly uniformLocation: WebGLUniformLocation;
	readonly cityLinkOffsetsContract: ComputeGpuBufferContract;
	readonly cityLinkCountsContract: ComputeGpuBufferContract;
	readonly cityLinkAzimuthContract: ComputeGpuBufferContract;
	readonly cityLinkAlphaContract: ComputeGpuBufferContract;
	readonly cityFastestTerrestrialAlphaContract: ComputeGpuBufferContract;
	readonly outputContract: ComputeGpuBufferContract;
}

/** Input bundle required by the ciseled-cones WebGL2 pass. */
export interface WebGl2CiseledConesDispatchInput {
	readonly cityNed2EcefMatrices: Float32Array;
	readonly overlapCandidates: Uint32Array;
	readonly overlapCandidateCounts: Uint32Array;
	readonly rawConeRimEcef: Float32Array;
	readonly cityCount: number;
	readonly azimuthSampleCount: number;
	readonly neighborLimit: number;
}

/** WebGL2 resources required by the ciseled-cones WebGL2 pass. */
export interface WebGl2CiseledConesDispatchResources {
	readonly vertexArray: WebGLVertexArrayObject;
	readonly program: WebGLProgram;
	readonly cityMatricesTexture: WebGLTexture;
	readonly overlapCandidatesTexture: WebGLTexture;
	readonly overlapCandidateCountsTexture: WebGLTexture;
	readonly rawConeRimEcefTexture: WebGLTexture;
	readonly coneIntersectionDistanceMetersBuffer: WebGLBuffer;
	readonly ciseledConeRimEcefBuffer: WebGLBuffer;
	readonly uniformLocation: WebGLUniformLocation;
	readonly cityMatricesContract: ComputeGpuBufferContract;
	readonly overlapCandidatesContract: ComputeGpuBufferContract;
	readonly overlapCandidateCountsContract: ComputeGpuBufferContract;
	readonly rawConeRimEcefContract: ComputeGpuBufferContract;
	readonly coneIntersectionDistanceMetersContract: ComputeGpuBufferContract;
	readonly ciseledConeRimEcefContract: ComputeGpuBufferContract;
}

/** Input bundle required by the final-cones WebGL2 pass. */
export interface WebGl2FinalConesDispatchInput {
	readonly ciseledConeRimEcef: WebGLBuffer;
	readonly townBoundaryAngular: WebGLBuffer;
	readonly townBoundaryEcef: WebGLBuffer;
	readonly cityCount: number;
	readonly azimuthSampleCount: number;
	readonly earthRadiusMeters: number;
}

/** WebGL2 resources required by the final-cones WebGL2 pass. */
export interface WebGl2FinalConesDispatchResources {
	readonly vertexArray: WebGLVertexArrayObject;
	readonly program: WebGLProgram;
	readonly ciseledConeRimEcefBuffer: WebGLBuffer;
	readonly townBoundaryAngularBuffer: WebGLBuffer;
	readonly townBoundaryEcefBuffer: WebGLBuffer;
	readonly finalConeGeometryEcefBuffer: WebGLBuffer;
	readonly uniformLocation: WebGLUniformLocation;
	readonly ciseledConeRimEcefContract: ComputeGpuBufferContract;
	readonly townBoundaryAngularContract: ComputeGpuBufferContract;
	readonly townBoundaryEcefContract: ComputeGpuBufferContract;
	readonly finalConeGeometryEcefContract: ComputeGpuBufferContract;
}

/** Input bundle required by the curve-geometry WebGL2 pass. */
export interface WebGl2CurveGeometryDispatchInput extends CurveGeometryInput {
	readonly earthRadiusMeters: number;
}

/** WebGL2 resources required by the curve-geometry fallback pass. */
export interface WebGl2CurveGeometryDispatchResources {
	readonly vertexArray: WebGLVertexArrayObject;
	readonly program: WebGLProgram;
	readonly curveControlPointsEcefTexture: WebGLTexture;
	readonly curveThetaRadiansTexture: WebGLTexture;
	readonly curveSpeedRatioTexture: WebGLTexture;
	readonly curveIdsTexture: WebGLTexture;
	readonly outputBuffer: WebGLBuffer;
	readonly uniformLocation: WebGLUniformLocation;
	readonly curveControlPointsEcefContract: ComputeGpuBufferContract;
	readonly curveThetaRadiansContract: ComputeGpuBufferContract;
	readonly curveSpeedRatioContract: ComputeGpuBufferContract;
	readonly curveIdsContract: ComputeGpuBufferContract;
	readonly outputContract: ComputeGpuBufferContract;
}

export { createBoundaryAlgebreProgram, createCiseledConesProgram, createCurveGeometryProgram, createFinalConesProgram, createRawConeAlphasProgram, createCityNed2EcefProgram } from './programs';
