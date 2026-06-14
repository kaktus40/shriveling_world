#version 300 es

precision highp float;
precision highp int;

uniform sampler2D u_cityLinkOffsets;
uniform usampler2D u_cityLinkCounts;
uniform sampler2D u_cityLinkAzimuthRadians;
uniform sampler2D u_cityLinkAlphaRadians;
uniform sampler2D u_cityFastestTerrestrialAlphaRadians;
uniform vec4 u_uniforms;

out float tf_coneAlphaRadians;

float selectComplexConeAlpha(uint cityIndex, float azimuthRadians) {
	uint count = texelFetch(u_cityLinkCounts, ivec2(int(cityIndex), 0), 0).r;
	if (count == 0u) {
		return u_uniforms.x;
	}

	uint offset = texelFetch(u_cityLinkOffsets, ivec2(int(cityIndex), 0), 0).r;
	float attenuationRadians = u_uniforms.y;
	float lowerDistance = 1e30;
	float upperDistance = 1e30;
	float lowerAlpha = u_uniforms.x;
	float upperAlpha = u_uniforms.x;

	for (uint localIndex = 0u; localIndex < count; localIndex += 1u) {
		uint linkIndex = offset + localIndex;
		float linkAzimuth = texelFetch(u_cityLinkAzimuthRadians, ivec2(int(linkIndex), 0), 0).r;
		float linkAlpha = texelFetch(u_cityLinkAlphaRadians, ivec2(int(linkIndex), 0), 0).r;
		float candidateLowerDistance = positive_angle(azimuthRadians - linkAzimuth);
		float candidateUpperDistance = positive_angle(linkAzimuth - azimuthRadians);
		if (
			candidateLowerDistance < lowerDistance - ANGULAR_EPSILON ||
			(abs(candidateLowerDistance - lowerDistance) <= ANGULAR_EPSILON && linkAlpha < lowerAlpha)
		) {
			lowerDistance = candidateLowerDistance;
			lowerAlpha = linkAlpha;
		}
		if (
			candidateUpperDistance < upperDistance - ANGULAR_EPSILON ||
			(abs(candidateUpperDistance - upperDistance) <= ANGULAR_EPSILON && linkAlpha < upperAlpha)
		) {
			upperDistance = candidateUpperDistance;
			upperAlpha = linkAlpha;
		}
	}

	if (lowerDistance > attenuationRadians + ANGULAR_EPSILON) {
		lowerDistance = attenuationRadians;
		lowerAlpha = u_uniforms.x;
	} else {
		lowerDistance = min(lowerDistance, attenuationRadians);
	}
	if (upperDistance > attenuationRadians + ANGULAR_EPSILON) {
		upperDistance = attenuationRadians;
		upperAlpha = u_uniforms.x;
	} else {
		upperDistance = min(upperDistance, attenuationRadians);
	}

	float span = lowerDistance + upperDistance;
	float interpolation = span > 0.0 ? smoothstep(0.0, span, lowerDistance) : 0.0;
	return lowerAlpha + interpolation * (upperAlpha - lowerAlpha);
}

float selectConeAlpha(uint cityIndex, float azimuthRadians) {
	int shapeCode = int(u_uniforms.z + 0.5);
	if (shapeCode == 0) {
		return u_uniforms.x;
	}
	if (shapeCode == 1) {
		return texelFetch(u_cityFastestTerrestrialAlphaRadians, ivec2(int(cityIndex), 0), 0).r;
	}
	return selectComplexConeAlpha(cityIndex, azimuthRadians);
}

void main() {
	uint sampleCount = uint(u_uniforms.w + 0.5);
	uint instanceIndex = uint(gl_InstanceID);
	uint sampleIndex = instanceIndex % sampleCount;
	uint cityIndex = instanceIndex / sampleCount;
	float azimuthRadians = (float(sampleIndex) * TWO_PI) / u_uniforms.w;
	tf_coneAlphaRadians = selectConeAlpha(cityIndex, azimuthRadians);
	gl_Position = vec4(0.0);
}
