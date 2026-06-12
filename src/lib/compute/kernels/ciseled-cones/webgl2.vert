#version 300 es

precision highp float;
precision highp int;
precision highp uint;

const uint UNUSED_INDEX = 0xffffffffu;

uniform sampler2D u_cityMatrices;
uniform usampler2D u_overlapCandidates;
uniform usampler2D u_overlapCandidateCounts;
uniform sampler2D u_rawConeRimEcef;
uniform vec4 u_uniforms;

out float tf_coneIntersectionDistanceMeters;
out vec4 tf_ciseledConeRimEcef;

vec3 readCitySummit(uint cityIndex) {
	return texelFetch(u_cityMatrices, ivec2(3, int(cityIndex)), 0).xyz;
}

vec3 readRawRim(uint cityIndex, uint sampleIndex) {
	uint azimuthSampleCount = uint(u_uniforms.y + 0.5);
	uint rimIndex = cityIndex * azimuthSampleCount + sampleIndex;
	return texelFetch(u_rawConeRimEcef, ivec2(int(rimIndex), 0), 0).xyz;
}

bool isPreferredIntersection(
	float distanceMeters,
	uint neighborCityIndex,
	uint faceIndex,
	float bestDistanceMeters,
	uint winningNeighborCityIndex,
	uint winningFaceIndex
) {
	return distanceMeters < bestDistanceMeters ||
		(distanceMeters == bestDistanceMeters &&
			winningNeighborCityIndex != UNUSED_INDEX &&
			(neighborCityIndex < winningNeighborCityIndex ||
				(neighborCityIndex == winningNeighborCityIndex && faceIndex < winningFaceIndex)));
}

void main() {
	uint cityCount = uint(u_uniforms.x + 0.5);
	uint azimuthSampleCount = uint(u_uniforms.y + 0.5);
	uint neighborLimit = uint(u_uniforms.z + 0.5);

	if (cityCount == 0u || azimuthSampleCount == 0u) {
		tf_coneIntersectionDistanceMeters = 0.0;
		tf_ciseledConeRimEcef = vec4(0.0);
		gl_Position = vec4(0.0);
		return;
	}

	uint sampleCount = azimuthSampleCount;
	uint cityIndex = uint(gl_InstanceID) / sampleCount;
	uint sampleIndex = uint(gl_InstanceID) - cityIndex * sampleCount;

	if (cityIndex >= cityCount || sampleIndex >= azimuthSampleCount) {
		tf_coneIntersectionDistanceMeters = 0.0;
		tf_ciseledConeRimEcef = vec4(0.0);
		gl_Position = vec4(0.0);
		return;
	}

	uint rayIndex = cityIndex * azimuthSampleCount + sampleIndex;
	vec3 summit = readCitySummit(cityIndex);
	vec3 rawRim = texelFetch(u_rawConeRimEcef, ivec2(int(rayIndex), 0), 0).xyz;
	vec3 rayDirection = rawRim - summit;
	float rawDistanceMeters = length(rayDirection);
	if (!(rawDistanceMeters > RAY_ORIGIN_EPSILON_METERS)) {
		tf_coneIntersectionDistanceMeters = 0.0;
		tf_ciseledConeRimEcef = vec4(rawRim, 1.0);
		gl_Position = vec4(0.0);
		return;
	}
	rayDirection = rayDirection / rawDistanceMeters;

	float bestDistanceMeters = rawDistanceMeters;
	uint winningNeighborCityIndex = UNUSED_INDEX;
	uint winningFaceIndex = UNUSED_INDEX;

	uint candidateCount = min(texelFetch(u_overlapCandidateCounts, ivec2(int(cityIndex), 0), 0).r, neighborLimit);
	for (uint candidateIndex = 0u; candidateIndex < candidateCount; candidateIndex += 1u) {
		uint neighborCityIndex = texelFetch(u_overlapCandidates, ivec2(int(candidateIndex), int(cityIndex)), 0).r;
		if (neighborCityIndex == UNUSED_INDEX) {
			continue;
		}
		vec3 neighborSummit = readCitySummit(neighborCityIndex);

		for (uint faceIndex = 0u; faceIndex < azimuthSampleCount; faceIndex += 1u) {
			uint nextFaceIndex = (faceIndex + 1u) % azimuthSampleCount;
			vec3 rim0 = readRawRim(neighborCityIndex, faceIndex);
			vec3 rim1 = readRawRim(neighborCityIndex, nextFaceIndex);
			float distanceMeters = intersectRayTriangleDoubleSided(
				summit,
				rayDirection,
				neighborSummit,
				rim0,
				rim1,
				bestDistanceMeters
			);
			if (
				distanceMeters > 0.0 &&
				isPreferredIntersection(
					distanceMeters,
					neighborCityIndex,
					faceIndex,
					bestDistanceMeters,
					winningNeighborCityIndex,
					winningFaceIndex
				)
			) {
				bestDistanceMeters = distanceMeters;
				winningNeighborCityIndex = neighborCityIndex;
				winningFaceIndex = faceIndex;
			}
		}
	}

	tf_coneIntersectionDistanceMeters = bestDistanceMeters;
	if (winningNeighborCityIndex != UNUSED_INDEX) {
		tf_ciseledConeRimEcef = vec4(summit + rayDirection * bestDistanceMeters, 1.0);
	} else {
		tf_ciseledConeRimEcef = vec4(rawRim, 1.0);
	}

	gl_Position = vec4(0.0);
}
