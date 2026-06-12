import type {
	WebGl2BoundaryAlgebreDispatchResources,
	WebGl2CiseledConesDispatchResources,
} from './buffers';

export function bindBoundaryTextures(
	gl: WebGL2RenderingContext,
	resources: WebGl2BoundaryAlgebreDispatchResources,
): void {
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, resources.cityMatricesTexture);
	const cityMatricesLocation = gl.getUniformLocation(resources.program, 'u_cityMatrices');
	const cityContourIndexesLocation = gl.getUniformLocation(resources.program, 'u_cityContourIndexes');
	const contourNVectorsLocation = gl.getUniformLocation(resources.program, 'u_contourNVectors');
	const contourOffsetsLocation = gl.getUniformLocation(resources.program, 'u_contourOffsets');
	const contourSizesLocation = gl.getUniformLocation(resources.program, 'u_contourSizes');
	const azimuthIntervalsLocation = gl.getUniformLocation(resources.program, 'u_azimuthIntervals');
	if (
		!cityMatricesLocation ||
		!cityContourIndexesLocation ||
		!contourNVectorsLocation ||
		!contourOffsetsLocation ||
		!contourSizesLocation ||
		!azimuthIntervalsLocation
	) {
		throw new Error('WebGL2 boundary raycast uniform lookup failed');
	}
	gl.uniform1i(cityMatricesLocation, 0);

	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, resources.cityContourIndexesTexture);
	gl.uniform1i(cityContourIndexesLocation, 1);

	gl.activeTexture(gl.TEXTURE2);
	gl.bindTexture(gl.TEXTURE_2D, resources.contourNVectorsTexture);
	gl.uniform1i(contourNVectorsLocation, 2);

	gl.activeTexture(gl.TEXTURE3);
	gl.bindTexture(gl.TEXTURE_2D, resources.contourOffsetsTexture);
	gl.uniform1i(contourOffsetsLocation, 3);

	gl.activeTexture(gl.TEXTURE4);
	gl.bindTexture(gl.TEXTURE_2D, resources.contourSizesTexture);
	gl.uniform1i(contourSizesLocation, 4);

	gl.activeTexture(gl.TEXTURE5);
	gl.bindTexture(gl.TEXTURE_2D, resources.azimuthIntervalsTexture);
	gl.uniform1i(azimuthIntervalsLocation, 5);
}

export function bindCiseledConesTextures(
	gl: WebGL2RenderingContext,
	resources: WebGl2CiseledConesDispatchResources,
): void {
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, resources.cityMatricesTexture);
	const cityMatricesLocation = gl.getUniformLocation(resources.program, 'u_cityMatrices');
	const overlapCandidatesLocation = gl.getUniformLocation(resources.program, 'u_overlapCandidates');
	const overlapCandidateCountsLocation = gl.getUniformLocation(resources.program, 'u_overlapCandidateCounts');
	const rawConeRimEcefLocation = gl.getUniformLocation(resources.program, 'u_rawConeRimEcef');
	if (
		!cityMatricesLocation ||
		!overlapCandidatesLocation ||
		!overlapCandidateCountsLocation ||
		!rawConeRimEcefLocation
	) {
		throw new Error('WebGL2 ciseled cones uniform lookup failed');
	}
	gl.uniform1i(cityMatricesLocation, 0);

	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, resources.overlapCandidatesTexture);
	gl.uniform1i(overlapCandidatesLocation, 1);

	gl.activeTexture(gl.TEXTURE2);
	gl.bindTexture(gl.TEXTURE_2D, resources.overlapCandidateCountsTexture);
	gl.uniform1i(overlapCandidateCountsLocation, 2);

	gl.activeTexture(gl.TEXTURE3);
	gl.bindTexture(gl.TEXTURE_2D, resources.rawConeRimEcefTexture);
	gl.uniform1i(rawConeRimEcefLocation, 3);
}
