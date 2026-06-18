import type {
	WebGl2FinalConesDispatchInput,
	WebGl2FinalConesDispatchResources,
} from '../../buffers';

import { getOrCreateGlDoubleBuffer } from '../../../phase-c/phase-c';

/** Creates the GPU allocations required by the final-cones WebGL2 pass. */
export function createFinalConesDispatchResources(
	gl: WebGL2RenderingContext,
	program: WebGLProgram,
	input: WebGl2FinalConesDispatchInput,
): WebGl2FinalConesDispatchResources {
	const vertexArray = gl.createVertexArray();
	let finalConeGeometryEcefBuffer = gl.createBuffer();
	const uniformLocation = gl.getUniformLocation(program, 'u_uniforms');
	const projectionUniformLocation = gl.getUniformLocation(program, 'u_projection');
	const projectionSettingsALocation = gl.getUniformLocation(program, 'u_projection_settings_a');
	const projectionSettingsBLocation = gl.getUniformLocation(program, 'u_projection_settings_b');
	if (
		!vertexArray ||
		!finalConeGeometryEcefBuffer ||
		!uniformLocation ||
		!projectionUniformLocation ||
		!projectionSettingsALocation ||
		!projectionSettingsBLocation
	) {
		throw new Error('WebGL2 final cones resource allocation failed');
	}

	const outputCount = Math.max(input.cityCount * input.azimuthSampleCount, 1);

	gl.bindVertexArray(vertexArray);

	gl.bindBuffer(gl.ARRAY_BUFFER, input.ciseledConeRimEcef);
	gl.enableVertexAttribArray(0);
	gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
	gl.vertexAttribDivisor?.(0, 1);

	gl.bindBuffer(gl.ARRAY_BUFFER, input.townBoundaryAngular);
	gl.enableVertexAttribArray(1);
	gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
	gl.vertexAttribDivisor?.(1, 1);

	gl.bindBuffer(gl.ARRAY_BUFFER, input.townBoundaryEcef);
	gl.enableVertexAttribArray(2);
	gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, 0);
	gl.vertexAttribDivisor?.(2, 1);

	gl.bindBuffer(gl.ARRAY_BUFFER, null);

	const finalSet = getOrCreateGlDoubleBuffer(gl, 'webgl2-final-cones:finalConeGeometryEcef', gl.TRANSFORM_FEEDBACK_BUFFER, outputCount * 4 * Float32Array.BYTES_PER_ELEMENT, gl.DYNAMIC_COPY);
	finalConeGeometryEcefBuffer = finalSet.back;

	gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, finalConeGeometryEcefBuffer);
	gl.bufferData(
		gl.TRANSFORM_FEEDBACK_BUFFER,
		outputCount * 4 * Float32Array.BYTES_PER_ELEMENT,
		gl.DYNAMIC_COPY,
	);
	gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, null);
	gl.bindVertexArray(null);

	return {
		vertexArray,
		program,
		ciseledConeRimEcefBuffer: input.ciseledConeRimEcef,
		townBoundaryAngularBuffer: input.townBoundaryAngular,
		townBoundaryEcefBuffer: input.townBoundaryEcef,
		finalConeGeometryEcefBuffer,
		uniformLocation,
		projectionUniformLocation,
		projectionSettingsALocation,
		projectionSettingsBLocation,
		ciseledConeRimEcefContract: {
			name: 'ciseledConeRimEcef',
			elementType: 'float32',
			strideBytes: 4 * Float32Array.BYTES_PER_ELEMENT,
			count: input.cityCount * input.azimuthSampleCount,
			linearUnit: 'meters',
			coordinateOrder: 'ecef',
			notes: ['Ciseled cone rims reused as vertex inputs for the final pass'],
		},
		townBoundaryAngularContract: {
			name: 'townBoundaryAngular',
			elementType: 'float32',
			strideBytes: 4 * Float32Array.BYTES_PER_ELEMENT,
			count: input.cityCount * input.azimuthSampleCount,
			angularUnit: 'radians',
			notes: ['Boundary angular data reused as vertex inputs for the final pass'],
		},
		townBoundaryEcefContract: {
			name: 'townBoundaryEcef',
			elementType: 'float32',
			strideBytes: 4 * Float32Array.BYTES_PER_ELEMENT,
			count: input.cityCount * input.azimuthSampleCount,
			linearUnit: 'meters',
			coordinateOrder: 'ecef',
			notes: ['Boundary ECEF data reused as vertex inputs for the final pass'],
		},
		finalConeGeometryEcefContract: {
			name: 'finalConeGeometryEcef',
			elementType: 'float32',
			strideBytes: 4 * Float32Array.BYTES_PER_ELEMENT,
			count: input.cityCount * input.azimuthSampleCount,
			linearUnit: 'meters',
			coordinateOrder: 'ecef',
			notes: ['Final cone geometry in display projection space, ready to display'],
		},
	};
}
