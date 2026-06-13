#version 300 es

precision highp float;
precision highp int;
precision highp uint;

const uint UNUSED_INDEX = 0xffffffffu;

uniform sampler2D u_cityMatrices;
uniform usampler2D u_overlapCandidates;
uniform usampler2D u_overlapCandidateCounts;
uniform sampler2D u_rawConeRimEcef;
uniform sampler2D u_cityPairInvariants;
uniform sampler2D u_coneAlphaRadians;
uniform vec4 u_uniforms;
uniform vec4 u_heuristics;

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

vec4 readCityPairInvariants(uint cityAIndex, uint cityBIndex) {
	uint pairIndex = cityAIndex * uint(u_uniforms.x + 0.5) + cityBIndex;
	return texelFetch(u_cityPairInvariants, ivec2(int(pairIndex), 0), 0);
}

float readConeAlpha(uint cityIndex, uint sampleIndex) {
	return texelFetch(u_coneAlphaRadians, ivec2(int(sampleIndex), int(cityIndex)), 0).r;
}

bool isFastFace(uint cityIndex, uint faceIndex, float roadAlphaRadians, float alphaEpsilonRadians) {
	uint azimuthSampleCount = uint(u_uniforms.y + 0.5);
	uint nextFaceIndex = (faceIndex + 1u) % azimuthSampleCount;
	return readConeAlpha(cityIndex, faceIndex) < roadAlphaRadians - alphaEpsilonRadians ||
		readConeAlpha(cityIndex, nextFaceIndex) < roadAlphaRadians - alphaEpsilonRadians;
}

bool isOnDirectedCorridor(int faceIndex, int startFaceIndex, int endFaceIndex, int direction, int faceCount) {
	int corridorLength = direction > 0
		? positive_mod_i32(endFaceIndex - startFaceIndex, faceCount)
		: positive_mod_i32(startFaceIndex - endFaceIndex, faceCount);
	int corridorDistance = direction > 0
		? positive_mod_i32(faceIndex - startFaceIndex, faceCount)
		: positive_mod_i32(startFaceIndex - faceIndex, faceCount);
	return corridorDistance <= corridorLength;
}

bool isPriorityFace(
	uint cityIndex,
	uint faceIndex,
	int startFaceIndex,
	int endFaceIndex,
	int direction,
	int faceCount,
	float roadAlphaRadians,
	float alphaEpsilonRadians,
	uint bilateralNeighborhoodFaceCount
) {
	if (isOnDirectedCorridor(int(faceIndex), startFaceIndex, endFaceIndex, direction, faceCount)) {
		return true;
	}

	int beforeStartFaceIndex = positive_mod_i32(startFaceIndex - direction, faceCount);
	int afterEndFaceIndex = positive_mod_i32(endFaceIndex + direction, faceCount);
	if (faceIndex == uint(beforeStartFaceIndex) || faceIndex == uint(afterEndFaceIndex)) {
		return true;
	}

	for (uint distance = 1u; distance <= bilateralNeighborhoodFaceCount; distance += 1u) {
		int lowerFaceIndex = positive_mod_i32(startFaceIndex - int(distance), faceCount);
		int upperFaceIndex = positive_mod_i32(startFaceIndex + int(distance), faceCount);
		if (
			(faceIndex == uint(lowerFaceIndex) || faceIndex == uint(upperFaceIndex)) &&
			isFastFace(cityIndex, faceIndex, roadAlphaRadians, alphaEpsilonRadians)
		) {
			return true;
		}
	}

	return false;
}

void updateCandidateFace(
	vec3 rayOrigin,
	vec3 rayDirection,
	uint neighborCityIndex,
	uint faceIndex,
	vec3 neighborSummit,
	inout float bestDistanceMeters,
	inout uint winningNeighborCityIndex,
	inout uint winningFaceIndex
) {
	uint azimuthSampleCount = uint(u_uniforms.y + 0.5);
	uint nextFaceIndex = (faceIndex + 1u) % azimuthSampleCount;
	vec3 rim0 = readRawRim(neighborCityIndex, faceIndex);
	vec3 rim1 = readRawRim(neighborCityIndex, nextFaceIndex);
	float distanceMeters = intersectRayTriangleDoubleSided(
		rayOrigin,
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

void main() {
	uint cityCount = uint(u_uniforms.x + 0.5);
	uint azimuthSampleCount = uint(u_uniforms.y + 0.5);
	uint neighborLimit = uint(u_uniforms.z + 0.5);
	float roadAlphaRadians = u_heuristics.x;
	uint bilateralNeighborhoodFaceCount = uint(u_heuristics.y + 0.5);
	float alphaEpsilonRadians = u_heuristics.z;

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
	vec3 rayOrigin = readCitySummit(cityIndex);
	vec3 rawRim = texelFetch(u_rawConeRimEcef, ivec2(int(rayIndex), 0), 0).xyz;
	vec3 rayDirection = rawRim - rayOrigin;
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
	float sampleStepRadians = TWO_PI / float(azimuthSampleCount);
	float phiARadians = float(sampleIndex) * sampleStepRadians;
	uint candidateCount = min(texelFetch(u_overlapCandidateCounts, ivec2(int(cityIndex), 0), 0).r, neighborLimit);

	for (uint candidateIndex = 0u; candidateIndex < candidateCount; candidateIndex += 1u) {
		uint neighborCityIndex = texelFetch(u_overlapCandidates, ivec2(int(candidateIndex), int(cityIndex)), 0).r;
		if (neighborCityIndex == UNUSED_INDEX) {
			continue;
		}

		vec4 cityPair = readCityPairInvariants(cityIndex, neighborCityIndex);
		float gammaABRadians = cityPair.x;
		float gammaBARadians = cityPair.y;
		float phiB0Radians = positive_angle(gammaBARadians - signed_angle_delta(phiARadians - gammaABRadians));
		int startFaceIndex = int(min(floor(phiB0Radians / sampleStepRadians), float(azimuthSampleCount - 1u)));
		int endFaceIndex = int(min(floor(positive_angle(gammaBARadians) / sampleStepRadians), float(azimuthSampleCount - 1u)));
		int direction = signed_angle_delta(gammaBARadians - phiB0Radians) < 0.0 ? -1 : 1;
		int faceCount = int(azimuthSampleCount);
		vec3 neighborSummit = readCitySummit(neighborCityIndex);
		int beforeStartFaceIndex = positiveModI32(startFaceIndex - direction, faceCount);
		int afterEndFaceIndex = positiveModI32(endFaceIndex + direction, faceCount);

		int corridorFaceIndex = startFaceIndex;
		for (uint visited = 0u; visited < azimuthSampleCount; visited += 1u) {
			updateCandidateFace(
				rayOrigin,
				rayDirection,
				neighborCityIndex,
				uint(corridorFaceIndex),
				neighborSummit,
				bestDistanceMeters,
				winningNeighborCityIndex,
				winningFaceIndex
			);
			if (corridorFaceIndex == endFaceIndex) {
				break;
			}
			corridorFaceIndex = positive_mod_i32(corridorFaceIndex + direction, faceCount);
		}

		if (uint(beforeStartFaceIndex) != uint(startFaceIndex)) {
			updateCandidateFace(
				rayOrigin,
				rayDirection,
				neighborCityIndex,
				uint(beforeStartFaceIndex),
				neighborSummit,
				bestDistanceMeters,
				winningNeighborCityIndex,
				winningFaceIndex
			);
		}

		if (uint(afterEndFaceIndex) != uint(endFaceIndex) && uint(afterEndFaceIndex) != uint(beforeStartFaceIndex)) {
			updateCandidateFace(
				rayOrigin,
				rayDirection,
				neighborCityIndex,
				uint(afterEndFaceIndex),
				neighborSummit,
				bestDistanceMeters,
				winningNeighborCityIndex,
				winningFaceIndex
			);
		}

		for (uint distance = 1u; distance <= bilateralNeighborhoodFaceCount; distance += 1u) {
			int lowerFaceIndex = positive_mod_i32(startFaceIndex - int(distance), faceCount);
			int upperFaceIndex = positive_mod_i32(startFaceIndex + int(distance), faceCount);
			if (
				uint(lowerFaceIndex) != uint(beforeStartFaceIndex) &&
				uint(lowerFaceIndex) != uint(afterEndFaceIndex) &&
				isFastFace(neighborCityIndex, uint(lowerFaceIndex), roadAlphaRadians, alphaEpsilonRadians) &&
				!isOnDirectedCorridor(lowerFaceIndex, startFaceIndex, endFaceIndex, direction, faceCount)
			) {
				updateCandidateFace(
					rayOrigin,
					rayDirection,
					neighborCityIndex,
					uint(lowerFaceIndex),
					neighborSummit,
					bestDistanceMeters,
					winningNeighborCityIndex,
					winningFaceIndex
				);
			}
			if (
				upperFaceIndex != lowerFaceIndex &&
				uint(upperFaceIndex) != uint(beforeStartFaceIndex) &&
				uint(upperFaceIndex) != uint(afterEndFaceIndex) &&
				isFastFace(neighborCityIndex, uint(upperFaceIndex), roadAlphaRadians, alphaEpsilonRadians) &&
				!isOnDirectedCorridor(upperFaceIndex, startFaceIndex, endFaceIndex, direction, faceCount)
			) {
				updateCandidateFace(
					rayOrigin,
					rayDirection,
					neighborCityIndex,
					uint(upperFaceIndex),
					neighborSummit,
					bestDistanceMeters,
					winningNeighborCityIndex,
					winningFaceIndex
				);
			}
		}

		for (uint faceIndex = 0u; faceIndex < azimuthSampleCount; faceIndex += 1u) {
			if (
				isPriorityFace(
					neighborCityIndex,
					faceIndex,
					startFaceIndex,
					endFaceIndex,
					direction,
					faceCount,
					roadAlphaRadians,
					alphaEpsilonRadians,
					bilateralNeighborhoodFaceCount
				)
			) {
				continue;
			}
			updateCandidateFace(
				rayOrigin,
				rayDirection,
				neighborCityIndex,
				faceIndex,
				neighborSummit,
				bestDistanceMeters,
				winningNeighborCityIndex,
				winningFaceIndex
			);
		}
	}

	tf_coneIntersectionDistanceMeters = bestDistanceMeters;
	if (winningNeighborCityIndex != UNUSED_INDEX) {
		tf_ciseledConeRimEcef = vec4(rayOrigin + rayDirection * bestDistanceMeters, 1.0);
	} else {
		tf_ciseledConeRimEcef = vec4(rawRim, 1.0);
	}
	gl_Position = vec4(0.0);
}
