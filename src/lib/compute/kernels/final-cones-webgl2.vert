#version 300 es

precision highp float;
precision highp int;
precision highp uint;

uniform vec4 u_uniforms;

layout(location = 0) in vec4 a_ciseledConeRimEcef;
layout(location = 1) in vec4 a_townBoundaryAngular;
layout(location = 2) in vec4 a_townBoundaryEcef;

out vec4 tf_finalConeGeometryEcef;

void main() {
	float earthRadiusMeters = u_uniforms.x;
	float ciseledDistanceMeters = length(a_ciseledConeRimEcef.xyz);
	float boundaryDistanceMeters = a_townBoundaryAngular.z * earthRadiusMeters;
	if (a_townBoundaryAngular.w > 0.0 && boundaryDistanceMeters > 0.0 && boundaryDistanceMeters < ciseledDistanceMeters) {
		tf_finalConeGeometryEcef = vec4(a_townBoundaryEcef.xyz, 1.0);
	} else {
		tf_finalConeGeometryEcef = a_ciseledConeRimEcef;
	}
	gl_Position = vec4(0.0);
}
