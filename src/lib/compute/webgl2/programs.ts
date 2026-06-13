/** WebGL2 program compilation helpers for the migration compute passes. */
/** Compiles a WebGL2 shader and throws with the info log on failure. */
export function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
	const shader = gl.createShader(type);
	if (!shader) {
		throw new Error('WebGL2 shader creation failed');
	}
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const message = gl.getShaderInfoLog(shader) ?? 'unknown WebGL2 compile error';
		gl.deleteShader(shader);
		throw new Error(`WebGL2 shader compile failed: ${message}`);
	}
	return shader;
}

const passthroughFragmentShaderSource = `#version 300 es
precision highp float;
out vec4 outColor;
void main() {
	outColor = vec4(0.0);
}
`;

function linkTransformFeedbackProgram(
	gl: WebGL2RenderingContext,
	label: string,
	vertexShader: WebGLShader,
	program: WebGLProgram,
): WebGLProgram {
	const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, passthroughFragmentShaderSource);
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const message = gl.getProgramInfoLog(program) ?? 'unknown WebGL2 link error';
		gl.deleteProgram(program);
		gl.deleteShader(vertexShader);
		gl.deleteShader(fragmentShader);
		throw new Error(`WebGL2 ${label} program link failed: ${message}`);
	}
	gl.deleteShader(vertexShader);
	gl.deleteShader(fragmentShader);
	return program;
}

/** Compiles the WebGL2 transform-feedback program for city NED-to-ECEF matrices. */
export function createCityNed2EcefProgram(
	gl: WebGL2RenderingContext,
	vertexShaderSource: string,
): WebGLProgram {
	const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
	const program = gl.createProgram();
	if (!program) {
		throw new Error('WebGL2 city NED-to-ECEF program creation failed');
	}
	gl.transformFeedbackVaryings(program, ['tf_col0', 'tf_col1', 'tf_col2', 'tf_col3'], gl.INTERLEAVED_ATTRIBS);
	return linkTransformFeedbackProgram(gl, 'city NED-to-ECEF', vertexShader, program);
}

/** Compiles the WebGL2 transform-feedback program for boundary raycasting. */
export function createBoundaryAlgebreProgram(
	gl: WebGL2RenderingContext,
	vertexShaderSource: string,
): WebGLProgram {
	const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
	const program = gl.createProgram();
	if (!program) {
		throw new Error('WebGL2 boundary raycast program creation failed');
	}
	gl.transformFeedbackVaryings(program, ['tf_boundaryAngular', 'tf_boundaryEcef'], gl.SEPARATE_ATTRIBS);
	return linkTransformFeedbackProgram(gl, 'boundary raycast', vertexShader, program);
}

/** Compiles the WebGL2 transform-feedback program for raw-cone alpha sampling. */
export function createRawConeAlphasProgram(
	gl: WebGL2RenderingContext,
	vertexShaderSource: string,
): WebGLProgram {
	const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
	const program = gl.createProgram();
	if (!program) {
		throw new Error('WebGL2 raw-cone alpha program creation failed');
	}
	gl.transformFeedbackVaryings(program, ['tf_coneAlphaRadians'], gl.SEPARATE_ATTRIBS);
	return linkTransformFeedbackProgram(gl, 'raw-cone alpha', vertexShader, program);
}

/** Compiles the WebGL2 transform-feedback program for ciseled cones. */
export function createCiseledConesProgram(
	gl: WebGL2RenderingContext,
	vertexShaderSource: string,
): WebGLProgram {
	const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
	const program = gl.createProgram();
	if (!program) {
		throw new Error('WebGL2 ciseled cones program creation failed');
	}
	gl.transformFeedbackVaryings(program, ['tf_coneIntersectionDistanceMeters', 'tf_ciseledConeRimEcef'], gl.SEPARATE_ATTRIBS);
	return linkTransformFeedbackProgram(gl, 'ciseled cones', vertexShader, program);
}

/** Compiles the WebGL2 transform-feedback program for final cone geometry. */
export function createFinalConesProgram(
	gl: WebGL2RenderingContext,
	vertexShaderSource: string,
): WebGLProgram {
	const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
	const program = gl.createProgram();
	if (!program) {
		throw new Error('WebGL2 final cones program creation failed');
	}
	gl.transformFeedbackVaryings(program, ['tf_finalConeGeometryEcef'], gl.SEPARATE_ATTRIBS);
	return linkTransformFeedbackProgram(gl, 'final cones', vertexShader, program);
}

/** Compiles the WebGL2 transform-feedback program for curve geometry. */
export function createCurveGeometryProgram(
	gl: WebGL2RenderingContext,
	vertexShaderSource: string,
): WebGLProgram {
	const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
	const program = gl.createProgram();
	if (!program) {
		throw new Error('WebGL2 curve geometry program creation failed');
	}
	gl.transformFeedbackVaryings(program, ['tf_curveVertexPosition'], gl.SEPARATE_ATTRIBS);
	return linkTransformFeedbackProgram(gl, 'curve geometry', vertexShader, program);
}
