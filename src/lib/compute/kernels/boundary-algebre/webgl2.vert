#version 300 es

precision highp float;
precision highp int;

uniform sampler2D u_cityMatrices;
uniform isampler2D u_cityContourIndexes;
uniform sampler2D u_contourNVectors;
uniform isampler2D u_contourOffsets;
uniform isampler2D u_contourSizes;
uniform sampler2D u_azimuthIntervals;
uniform vec4 u_uniforms;

out vec4 tf_boundaryAngular;
out vec4 tf_boundaryEcef;

vec3 readContourNVector(int pointIndex) {
	return texelFetch(u_contourNVectors, ivec2(pointIndex, 0), 0).xyz;
}

vec3 intersectGreatCircleWithSegment(vec3 greatCircleNormal, vec3 segmentStart, vec3 segmentEnd) {
	vec3 bounds = segmentEnd - segmentStart;
	float denominator = dot(bounds, greatCircleNormal);
	if (abs(denominator) <= EPSILON) {
		return vec3(0.0);
	}
	float ratio = -dot(segmentStart, greatCircleNormal) / denominator;
	if (ratio < 0.0 || ratio > 1.0) {
		return vec3(0.0);
	}
	return normalize(segmentStart + bounds * ratio);
}

void main() {
	uint flatIndex = uint(gl_InstanceID);
	uint cityCount = uint(u_uniforms.y);
	uint azimuthIntervalCount = uint(u_uniforms.z);
	uint contourCount = uint(u_uniforms.w);

	if (cityCount == 0u || azimuthIntervalCount == 0u) {
		tf_boundaryAngular = vec4(0.0);
		tf_boundaryEcef = vec4(0.0);
		gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
		return;
	}

	uint cityIndex = flatIndex / azimuthIntervalCount;
	uint azimuthIndex = flatIndex - cityIndex * azimuthIntervalCount;
	if (cityIndex >= cityCount || azimuthIndex >= azimuthIntervalCount) {
		tf_boundaryAngular = vec4(0.0);
		tf_boundaryEcef = vec4(0.0);
		gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
		return;
	}

	int matrixBase = int(cityIndex);
	vec3 townNvector = normalize(texelFetch(u_cityMatrices, ivec2(3, matrixBase), 0).xyz);
	vec3 north = texelFetch(u_cityMatrices, ivec2(0, matrixBase), 0).xyz;
	vec3 east = texelFetch(u_cityMatrices, ivec2(1, matrixBase), 0).xyz;
	ivec2 intervalCoords = ivec2(int(azimuthIndex), 0);
	vec2 interval = texelFetch(u_azimuthIntervals, intervalCoords, 0).rg;
	float minRadians = interval.x;
	float maxRadians = interval.y;
	vec3 greatCircleNormal = great_circle_from_bearing(townNvector, north, east, (minRadians + maxRadians) * 0.5);
	int contourIndex = texelFetch(u_cityContourIndexes, ivec2(int(cityIndex), 0), 0).r;
	if (contourIndex < 0 || uint(contourIndex) >= contourCount) {
		vec2 townLonLat = lonlat_from_nvector(townNvector);
		tf_boundaryAngular = vec4(townLonLat.x, townLonLat.y, -1.0, 0.0);
		tf_boundaryEcef = vec4(0.0);
		gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
		return;
	}

	int contourOffset = texelFetch(u_contourOffsets, ivec2(contourIndex, 0), 0).r;
	int contourSize = texelFetch(u_contourSizes, ivec2(contourIndex, 0), 0).r;
	if (contourSize < 3) {
		vec2 townLonLat = lonlat_from_nvector(townNvector);
		tf_boundaryAngular = vec4(townLonLat.x, townLonLat.y, -1.0, 0.0);
		tf_boundaryEcef = vec4(0.0);
		gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
		return;
	}

	float bestDistance = 1e30;
	vec3 bestCandidate = vec3(0.0);
	for (int segmentIndex = 0; segmentIndex < contourSize; segmentIndex++) {
		vec3 start = readContourNVector(contourOffset + segmentIndex);
		vec3 end = readContourNVector(contourOffset + ((segmentIndex + 1) % contourSize));
		vec3 candidate = intersectGreatCircleWithSegment(greatCircleNormal, start, end);
		if (candidate.x == 0.0 && candidate.y == 0.0 && candidate.z == 0.0) {
			continue;
		}
		float candidateAzimuth = initial_bearing_radians(north, east, candidate);
		if (!is_angle_inside_continuous_interval(candidateAzimuth, minRadians, maxRadians)) {
			continue;
		}
		float distance = angular_distance_radians(candidate, townNvector);
		if (distance < bestDistance) {
			bestDistance = distance;
			bestCandidate = candidate;
		}
	}

	if (bestDistance < 1e29) {
		vec2 bestLonLat = lonlat_from_nvector(bestCandidate);
		tf_boundaryAngular = vec4(bestLonLat.x, bestLonLat.y, bestDistance, 1.0);
		tf_boundaryEcef = vec4(bestCandidate * u_uniforms.x, 1.0);
	} else {
		vec2 townLonLat = lonlat_from_nvector(townNvector);
		tf_boundaryAngular = vec4(townLonLat.x, townLonLat.y, -1.0, 0.0);
		tf_boundaryEcef = vec4(0.0);
	}

	gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
}
