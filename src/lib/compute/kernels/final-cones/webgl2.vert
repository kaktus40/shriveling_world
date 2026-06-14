#version 300 es

precision highp float;
precision highp int;

uniform vec4 u_uniforms;
uniform vec4 u_projection;
uniform vec4 u_projection_settings_a;
uniform vec4 u_projection_settings_b;

layout(location = 0) in vec4 a_ciseledConeRimEcef;
layout(location = 1) in vec4 a_townBoundaryAngular;
layout(location = 2) in vec4 a_townBoundaryEcef;

out vec4 tf_finalConeGeometryEcef;

void main() {
	float earthRadiusMeters = u_uniforms.x;
	float globeRadius = u_uniforms.w;
	float ciseledDistanceMeters = length(a_ciseledConeRimEcef.xyz);
	float boundaryDistanceMeters = a_townBoundaryAngular.z * earthRadiusMeters;
	vec3 selectedPoint = a_ciseledConeRimEcef.xyz;
	if (a_townBoundaryAngular.w > 0.0 && boundaryDistanceMeters > 0.0 && boundaryDistanceMeters < ciseledDistanceMeters) {
		selectedPoint = a_townBoundaryEcef.xyz;
	}
	vec3 projected = project_display_from_ecef(
		selectedPoint,
		globeRadius,
		earthRadiusMeters,
		u_projection_settings_a.xyz,
		u_projection_settings_a.w,
		u_projection_settings_b.x,
		int(u_projection.x),
		int(u_projection.y),
		u_projection.z,
		u_projection_settings_b.y
	);
	tf_finalConeGeometryEcef = vec4(projected, 1.0);
	gl_Position = vec4(0.0);
}
