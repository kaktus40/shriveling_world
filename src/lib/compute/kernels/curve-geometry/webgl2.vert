#version 300 es

precision highp float;
precision highp int;
precision highp uint;

uniform sampler2D u_curveControlPointsEcef;
uniform sampler2D u_curveThetaRadians;
uniform sampler2D u_curveSpeedRatio;
uniform usampler2D u_curveIds;
uniform vec4 u_uniforms;
uniform vec4 u_projection;
uniform vec4 u_projection_settings_a;
uniform vec4 u_projection_settings_b;

out vec4 tf_curveVertexPosition;

vec3 readCurvePoint(uint curveIndex, uint pointIndex) {
	return texelFetch(u_curveControlPointsEcef, ivec2(int(pointIndex), int(curveIndex)), 0).xyz;
}

vec3 liftCurvePoint(vec3 point, float curveHeightMeters, float earthRadiusMeters) {
	return normalize(point) * (earthRadiusMeters + curveHeightMeters);
}

vec3 sampleCubicBezier(vec3 p0, vec3 p1, vec3 p2, vec3 p3, float t) {
	float minusT = 1.0 - t;
	float minusTSquared = minusT * minusT;
	float tSquared = t * t;
	return
		minusT * minusTSquared * p0 +
		3.0 * minusTSquared * t * p1 +
		3.0 * minusT * tSquared * p2 +
		t * tSquared * p3;
}

float computeCurveHeightMeters(
	float speedRatio,
	float thetaRadians,
	float curvePositionCode,
	float coefficient,
	float earthRadiusMeters
) {
	float semiTheta = thetaRadians * 0.5;
	float sinSemiTheta = sin(semiTheta);
	float cosSemiTheta = cos(semiTheta);
	float ratio = (speedRatio * thetaRadians) * 0.5;
	float secondTerm = sqrt(max(0.0, ratio * ratio - sinSemiTheta * sinSemiTheta));
	float omPrime = (cosSemiTheta + secondTerm) * earthRadiusMeters * coefficient;
	float height = omPrime - earthRadiusMeters;
	if (curvePositionCode == 0.0) {
		return height;
	}
	return -height;
}

void main() {
	uint curveIndex = uint(gl_InstanceID);
	uint sampleIndex = uint(gl_VertexID);
	uint pointsPerCurve = uint(u_uniforms.y + 0.5);
	if (sampleIndex > pointsPerCurve) {
		return;
	}

	if (texelFetch(u_curveIds, ivec2(int(curveIndex), 0), 0).r == 0xffffffffu) {
		return;
	}

	float earthRadiusMeters = u_uniforms.x;
	float curvePositionCode = u_uniforms.z;
	float coefficient = u_uniforms.w;
	float thetaRadians = texelFetch(u_curveThetaRadians, ivec2(int(curveIndex), 0), 0).r;
	float speedRatio = texelFetch(u_curveSpeedRatio, ivec2(int(curveIndex), 0), 0).r;
	float curveHeightMeters = computeCurveHeightMeters(
		speedRatio,
		thetaRadians,
		curvePositionCode,
		coefficient,
		earthRadiusMeters
	);

	vec3 pointA = readCurvePoint(curveIndex, 0u);
	vec3 pointP = liftCurvePoint(readCurvePoint(curveIndex, 1u), curveHeightMeters, earthRadiusMeters);
	vec3 pointQ = liftCurvePoint(readCurvePoint(curveIndex, 2u), curveHeightMeters, earthRadiusMeters);
	vec3 pointB = readCurvePoint(curveIndex, 3u);

	float t = pointsPerCurve == 0u ? 0.0 : float(sampleIndex) / float(pointsPerCurve);
	vec3 position = sampleCubicBezier(pointA, pointP, pointQ, pointB, t);
	vec3 projected = project_display_from_ecef(
		position,
		u_projection.w,
		earthRadiusMeters,
		u_projection_settings_a.xyz,
		u_projection_settings_a.w,
		u_projection_settings_b.x,
		int(u_projection.x),
		int(u_projection.y),
		u_projection.z,
		u_projection_settings_b.y
	);
	tf_curveVertexPosition = vec4(projected, 1.0);
	gl_Position = vec4(0.0);
}
